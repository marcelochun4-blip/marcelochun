// content.js
// 수신 메시지 번역 (VI → KO) 핵심 로직.
//
// 요구사항 매핑:
//  - F-01: MutationObserver 로 새 메시지를 감지하고 언어를 자동 판별(백엔드 위임).
//  - F-02: 베트남어 메시지를 한국어로 번역.
//  - F-03: 원문 아래에 번역문 말풍선 오버레이 표시.
//  - F-04: 메시지별 접기/펼치기 토글.
//  - F-05: 그룹 채팅 모든 참여자 메시지에 적용.
//  - F-06: 한국어 메시지는 번역 없이 원문 유지 (백엔드가 'ko' 감지 시 동일 텍스트 반환 → 스킵).
//  - F-20: 비침습적 오버레이. F-21: 로딩 인디케이터. F-22: 오류 + 재시도.
//  - 리스크: Debounce + 번역 대상 필터링으로 그룹 채팅 성능 저하 방지.

(() => {
  const S = window.ZALO_SELECTORS;
  const API = window.ZaloTranslateAPI;

  const PROCESSED_ATTR = 'data-zt-processed'; // 중복 처리 방지 마킹
  let settings = { enabled: true };
  let observer = null;
  let containerEl = null;

  // ── 유틸 ────────────────────────────────────────────────
  function debounce(fn, wait) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function getRoomTitle() {
    const el = S.queryFirst(document, 'roomTitle');
    return el ? el.textContent.trim() : '';
  }

  function getSenderName(messageEl) {
    const el = S.queryFirst(messageEl, 'senderName');
    return el ? el.textContent.trim() : '';
  }

  function isOutgoing(messageEl) {
    // 내가 보낸 메시지인지 판별 (송신 메시지는 수신 번역에서 제외)
    if (S.matches(messageEl, 'outgoingMarker')) return true;
    return S.outgoingMarker.some((sel) => {
      try {
        return messageEl.closest(sel) != null;
      } catch {
        return false;
      }
    });
  }

  // ── 오버레이 렌더링 (F-03/F-04/F-21/F-22) ───────────────
  function buildOverlay() {
    const box = document.createElement('div');
    box.className = 'zt-overlay zt-loading';
    box.innerHTML = `
      <div class="zt-head">
        <span class="zt-badge">번역(KO)</span>
        <button class="zt-toggle" type="button" title="번역 접기/펼치기">▼</button>
      </div>
      <div class="zt-body"><span class="zt-spinner"></span> 번역 중…</div>
    `;
    // F-04: 헤더 클릭으로 본문 접기/펼치기
    box.querySelector('.zt-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      box.classList.toggle('zt-collapsed');
      box.querySelector('.zt-toggle').textContent = box.classList.contains('zt-collapsed') ? '▶' : '▼';
    });
    return box;
  }

  function renderTranslated(box, text) {
    box.classList.remove('zt-loading', 'zt-error');
    box.querySelector('.zt-body').textContent = text;
  }

  function renderError(box, message, onRetry) {
    box.classList.remove('zt-loading');
    box.classList.add('zt-error');
    const body = box.querySelector('.zt-body');
    body.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = `번역 실패: ${message}`;
    const retry = document.createElement('button');
    retry.className = 'zt-retry';
    retry.type = 'button';
    retry.textContent = '재시도';
    retry.addEventListener('click', (e) => {
      e.stopPropagation();
      box.classList.add('zt-loading');
      box.classList.remove('zt-error');
      body.innerHTML = '<span class="zt-spinner"></span> 번역 중…';
      onRetry();
    });
    body.appendChild(span);
    body.appendChild(retry);
  }

  // ── 단일 메시지 처리 ─────────────────────────────────────
  async function processMessage(messageEl) {
    if (!settings.enabled) return;
    if (messageEl.getAttribute(PROCESSED_ATTR)) return;
    if (isOutgoing(messageEl)) {
      // 송신 메시지는 수신 번역 대상이 아님 (송신 번역은 compose.js 담당)
      messageEl.setAttribute(PROCESSED_ATTR, 'skip-outgoing');
      return;
    }

    const textEl = S.queryFirst(messageEl, 'messageText');
    const sourceText = textEl ? textEl.textContent.trim() : '';
    if (!sourceText) return; // 이미지/스티커 등 텍스트 없는 메시지 스킵

    messageEl.setAttribute(PROCESSED_ATTR, '1');

    const overlay = buildOverlay();
    // 원문 바로 아래에 삽입 (F-03, F-20: 기존 UI 흐름을 깨지 않는 위치)
    textEl.insertAdjacentElement('afterend', overlay);

    const room = getRoomTitle();
    const sender = getSenderName(messageEl);

    const run = async () => {
      try {
        const data = await API.translate({ text: sourceText, room, sender, save: true });
        // F-06: 한국어 원문이면 번역문이 사실상 동일 → 오버레이 제거(원문 그대로)
        if (data.target === 'vi' || data.detectedSourceLanguage === 'ko') {
          overlay.remove();
          return;
        }
        renderTranslated(overlay, data.translatedText);
      } catch (err) {
        renderError(overlay, err.message, run);
      }
    };
    run();
  }

  function scanAll() {
    if (!containerEl) return;
    const items = S.queryAll(containerEl, 'messageItems');
    items.forEach(processMessage);
  }

  const debouncedScan = debounce(scanAll, 300); // 리스크 대응: 다량 메시지 시 debounce

  // ── 옵저버 부착 (F-01/F-05/NF-08) ────────────────────────
  function attachObserver() {
    const found = S.queryFirst(document, 'conversationContainers');
    if (!found) return false;
    if (found === containerEl) return true;

    if (observer) observer.disconnect();
    containerEl = found;
    observer = new MutationObserver(() => debouncedScan());
    observer.observe(containerEl, { childList: true, subtree: true });
    scanAll(); // 최초 진입 시 기존 메시지도 1회 처리
    return true;
  }

  // 채팅방 전환 등으로 컨테이너가 바뀔 수 있으므로 주기적으로 재확인
  function watchForContainer() {
    if (!attachObserver()) {
      // 아직 채팅방이 안 열렸으면 잠시 후 재시도
      setTimeout(watchForContainer, 1500);
    }
  }

  // ── 부팅 ────────────────────────────────────────────────
  async function init() {
    settings = await API.getSettings();
    API.onSettingsChanged((changes) => {
      if (changes.enabled) {
        settings.enabled = changes.enabled.newValue;
        if (settings.enabled) scanAll();
      }
    });
    // 채팅방 헤더 변경(전환) 감지 → 새 컨테이너에 옵저버 재부착
    const bodyObserver = new MutationObserver(debounce(() => attachObserver(), 500));
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    watchForContainer();
  }

  init();
})();
