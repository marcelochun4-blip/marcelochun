// compose.js
// 송신 메시지 번역 (KO → VI) 보조 패널.
//
// 요구사항 매핑:
//  - F-07: 입력창 한국어 입력 후 번역 버튼 클릭 → 베트남어 번역 생성.
//  - F-08: 번역된 베트남어를 별도 미리보기 패널에 표시.
//  - F-09: 사용자가 번역 내용을 직접 수정 가능 (편집 가능 textarea).
//  - F-10: "삽입" 클릭 시 Zalo 입력창에 베트남어 텍스트 자동 삽입.
//  - F-11: 최종 전송은 사용자가 Zalo 전송 버튼으로 직접 수행 (자동 전송 안 함).
//  - F-12: 원문(한국어)+번역문(베트남어) 동시 삽입 옵션.
//  - F-21/F-22: 로딩/오류 + 재시도.

(() => {
  const S = window.ZALO_SELECTORS;
  const API = window.ZaloTranslateAPI;

  let panel = null;
  let inputEl = null;
  let settings = { enabled: true, showOriginalOnSend: false };

  function getRoomTitle() {
    const el = S.queryFirst(document, 'roomTitle');
    return el ? el.textContent.trim() : '';
  }

  // Zalo 입력창 텍스트 읽기 (contenteditable 또는 textarea 모두 지원)
  function readInput() {
    if (!inputEl) return '';
    if (inputEl.isContentEditable) return inputEl.innerText.trim();
    return (inputEl.value || '').trim();
  }

  // F-10: 입력창에 텍스트 삽입. Zalo 가 입력 이벤트를 감지하도록 이벤트 디스패치.
  function writeInput(text) {
    if (!inputEl) return;
    inputEl.focus();
    if (inputEl.isContentEditable) {
      inputEl.innerText = text;
      inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    } else {
      inputEl.value = text;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function buildPanel() {
    const el = document.createElement('div');
    el.className = 'zt-compose';
    el.innerHTML = `
      <div class="zt-compose-head">
        <span>KO → VI 번역 미리보기</span>
        <button class="zt-compose-close" type="button" title="닫기">✕</button>
      </div>
      <textarea class="zt-compose-preview" placeholder="번역된 베트남어가 여기 표시됩니다. 직접 수정할 수 있어요."></textarea>
      <div class="zt-compose-status"></div>
      <div class="zt-compose-actions">
        <label class="zt-compose-opt">
          <input type="checkbox" class="zt-compose-bilingual"> 원문(KO)+번역(VI) 함께 삽입
        </label>
        <button class="zt-compose-insert" type="button" disabled>입력창에 삽입</button>
      </div>
      <div class="zt-compose-hint">삽입 후 Zalo 전송 버튼으로 직접 보내세요. (자동 전송 안 함)</div>
    `;
    el.querySelector('.zt-compose-close').addEventListener('click', () => el.remove());
    el.querySelector('.zt-compose-bilingual').checked = !!settings.showOriginalOnSend;
    return el;
  }

  function setStatus(msg, kind = '') {
    if (!panel) return;
    const s = panel.querySelector('.zt-compose-status');
    s.textContent = msg || '';
    s.className = `zt-compose-status ${kind}`;
  }

  async function doTranslate(btn) {
    const sourceText = readInput();
    if (!sourceText) {
      setStatus('입력창에 한국어를 먼저 입력하세요.', 'warn');
      return;
    }
    if (!panel) {
      panel = buildPanel();
      // 입력 영역 위쪽에 패널 부착 (비침습적: 입력창 자체는 건드리지 않음)
      inputEl.closest('div')?.parentElement?.insertBefore(panel, inputEl.closest('div')) ||
        document.body.appendChild(panel);
      wirePanel(sourceText);
    }
    const preview = panel.querySelector('.zt-compose-preview');
    const insertBtn = panel.querySelector('.zt-compose-insert');
    insertBtn.disabled = true;
    setStatus('번역 중…', 'loading');

    try {
      // 명시 타깃 'vi' → KO→VI 강제 (F-07)
      const data = await API.translate({
        text: sourceText,
        target: 'vi',
        room: getRoomTitle(),
        sender: '(나)',
        save: true,
      });
      preview.value = data.translatedText; // F-08, F-09(편집 가능)
      preview.dataset.source = sourceText;
      insertBtn.disabled = false;
      setStatus(data.cached ? '완료 (캐시)' : '완료', 'ok');
    } catch (err) {
      setStatus(`번역 실패: ${err.message}`, 'error');
      // F-22: 재시도 = 버튼을 다시 누르면 됨
    }
  }

  function wirePanel(sourceText) {
    const preview = panel.querySelector('.zt-compose-preview');
    preview.dataset.source = sourceText;
    panel.querySelector('.zt-compose-insert').addEventListener('click', () => {
      const vi = preview.value.trim();
      if (!vi) return;
      const bilingual = panel.querySelector('.zt-compose-bilingual').checked;
      // F-12: 옵션 시 원문+번역 함께 삽입
      const finalText = bilingual ? `${preview.dataset.source}\n${vi}` : vi;
      writeInput(finalText); // F-10
      setStatus('입력창에 삽입했습니다. Zalo 전송 버튼으로 보내세요.', 'ok');
    });
  }

  // 입력창 옆에 "번역" 버튼 주입
  function injectButton() {
    if (!settings.enabled) return;
    const found = S.queryFirst(document, 'inputBox');
    if (!found) return;
    inputEl = found;

    if (document.getElementById('zt-translate-btn')) return; // 중복 주입 방지

    const btn = document.createElement('button');
    btn.id = 'zt-translate-btn';
    btn.type = 'button';
    btn.className = 'zt-translate-btn';
    btn.textContent = '한→베 번역';
    btn.title = '입력한 한국어를 베트남어로 번역';
    btn.addEventListener('click', () => doTranslate(btn));

    // 입력창 근처에 고정 배치 (비침습적: position 으로 띄움)
    const host = inputEl.closest('div') || document.body;
    host.style.position = host.style.position || 'relative';
    document.body.appendChild(btn);
  }

  async function init() {
    settings = await API.getSettings();
    API.onSettingsChanged((changes) => {
      if (changes.enabled) settings.enabled = changes.enabled.newValue;
      if (changes.showOriginalOnSend && panel) {
        panel.querySelector('.zt-compose-bilingual').checked = changes.showOriginalOnSend.newValue;
      }
    });

    // 입력창은 채팅방 전환 시 다시 그려질 수 있으므로 주기적으로 버튼 주입 확인
    const obs = new MutationObserver(() => injectButton());
    obs.observe(document.body, { childList: true, subtree: true });
    injectButton();
  }

  init();
})();
