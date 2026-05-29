// selectors.js
// Zalo Web DOM 선택자를 외부화하여 한 곳에서 관리한다.
//
// 리스크 대응 (NF-08): Zalo 가 UI 를 업데이트하면 선택자만 바꿔 대응할 수 있도록
// 모든 DOM 의존 지점을 이 파일에 모은다. 여러 후보 선택자를 배열로 두고
// 순차적으로 시도하여 일부 변경에도 견디도록 설계한다.
//
// 주의: 아래 값들은 공개 Zalo Web 구조 기준의 "추정" 선택자다. 실제 환경에서
// 동작이 멈추면 DevTools 로 확인 후 이 파일만 수정하면 된다.

window.ZALO_SELECTORS = {
  // 새 메시지가 추가되는 대화 영역 컨테이너 (MutationObserver 부착 대상)
  conversationContainers: ['#conversationContainer', '.conversation-container', '[id^="chatBox"]'],

  // 개별 메시지 행(버블) 요소
  messageItems: ['.chat-item', '[id^="msg_"]', '.msg-item'],

  // 메시지 텍스트가 들어있는 요소 (messageItem 내부에서 탐색)
  messageText: ['.card-text', '.text-msg', '.msg-text', '[class*="text-"]'],

  // 메시지 발신자 이름 (그룹 채팅; 1:1 에서는 없을 수 있음) — F-14 발신자 기록용
  senderName: ['.sender-name', '.author-name', '[class*="sender"]'],

  // 내가 보낸 메시지를 구분하는 표식 (있으면 송신 메시지로 간주 → 번역 생략 가능)
  outgoingMarker: ['.chat-item.me', '.me', '[class*="--me"]', '[class*="sent"]'],

  // 현재 채팅방 이름 표시 영역 — F-14 채팅방 이름 기록용
  roomTitle: ['.conversation-title', '.header-title', '[class*="conv-name"]', 'header [class*="title"]'],

  // 메시지 입력창 (KO→VI 송신 시 번역 텍스트 자동 삽입 대상) — F-10
  inputBox: [
    '#richInput',
    '[contenteditable="true"][id*="input"]',
    'div[contenteditable="true"]',
    'textarea',
  ],
};

/**
 * 후보 선택자 배열에서 첫 번째로 매칭되는 요소를 반환.
 */
window.ZALO_SELECTORS.queryFirst = function (root, key) {
  const candidates = window.ZALO_SELECTORS[key] || [];
  for (const sel of candidates) {
    const el = (root || document).querySelector(sel);
    if (el) return el;
  }
  return null;
};

/**
 * 후보 선택자 배열로 매칭되는 모든 요소(중복 제거)를 반환.
 */
window.ZALO_SELECTORS.queryAll = function (root, key) {
  const candidates = window.ZALO_SELECTORS[key] || [];
  const set = new Set();
  for (const sel of candidates) {
    (root || document).querySelectorAll(sel).forEach((el) => set.add(el));
  }
  return [...set];
};

/**
 * 한 요소가 후보 선택자 중 하나에 매칭되는지 검사.
 */
window.ZALO_SELECTORS.matches = function (el, key) {
  if (!el || !el.matches) return false;
  return (window.ZALO_SELECTORS[key] || []).some((sel) => {
    try {
      return el.matches(sel);
    } catch {
      return false;
    }
  });
};
