// background.js (service worker)
// content script 의 번역 요청을 로컬 백엔드로 중계한다.
// content script 가 백엔드를 직접 호출하지 않고 background 를 경유함으로써
// 백엔드 URL/CORS 를 한 곳에서 관리한다.

const DEFAULTS = {
  enabled: true,
  showOriginalOnSend: false,
  backendUrl: 'http://127.0.0.1:8787',
};

async function getBackendUrl() {
  const { backendUrl } = await chrome.storage.sync.get({ backendUrl: DEFAULTS.backendUrl });
  return backendUrl;
}

chrome.runtime.onInstalled.addListener(async () => {
  // 기본 설정 초기화 (기존 값 보존)
  const current = await chrome.storage.sync.get(DEFAULTS);
  await chrome.storage.sync.set({ ...DEFAULTS, ...current });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'TRANSLATE') {
    handleTranslate(msg.payload).then(sendResponse);
    return true; // 비동기 응답 유지
  }
  if (msg?.type === 'HEALTH') {
    handleHealth().then(sendResponse);
    return true;
  }
  return false;
});

async function handleTranslate(payload) {
  try {
    const base = await getBackendUrl();
    const res = await fetch(`${base}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || `HTTP ${res.status}` };
    return { data };
  } catch (err) {
    return { error: `백엔드 연결 실패: ${err.message}` };
  }
}

async function handleHealth() {
  try {
    const base = await getBackendUrl();
    const res = await fetch(`${base}/api/health`);
    const data = await res.json();
    return { data };
  } catch (err) {
    return { error: err.message };
  }
}
