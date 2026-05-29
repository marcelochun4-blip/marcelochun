// popup.js
// 확장 팝업: 번역 ON/OFF (F-19), 옵션, 백엔드 주소 설정, 상태 표시(F-22), 히스토리 열기.

const DEFAULTS = {
  enabled: true,
  showOriginalOnSend: false,
  backendUrl: 'http://127.0.0.1:8787',
};

const $ = (id) => document.getElementById(id);

async function load() {
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  $('enabledToggle').checked = cfg.enabled;
  $('enabledState').textContent = cfg.enabled ? '켜짐' : '꺼짐';
  $('bilingualToggle').checked = cfg.showOriginalOnSend;
  $('backendUrl').value = cfg.backendUrl;
  checkHealth();
}

function save(patch) {
  chrome.storage.sync.set(patch);
}

$('enabledToggle').addEventListener('change', (e) => {
  save({ enabled: e.target.checked });
  $('enabledState').textContent = e.target.checked ? '켜짐' : '꺼짐';
});

$('bilingualToggle').addEventListener('change', (e) => {
  save({ showOriginalOnSend: e.target.checked });
});

$('backendUrl').addEventListener('change', (e) => {
  save({ backendUrl: e.target.value.trim() || DEFAULTS.backendUrl });
  setTimeout(checkHealth, 100);
});

$('historyBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('history/history.html') });
});

// F-22: 백엔드 연결 + API 키 설정 여부 표시
function setStatus(kind, text) {
  $('statusDot').className = `pp-dot ${kind}`;
  $('statusText').textContent = text;
}

function checkHealth() {
  setStatus('', '상태 확인 중…');
  chrome.runtime.sendMessage({ type: 'HEALTH' }, (res) => {
    if (chrome.runtime.lastError || !res || res.error) {
      setStatus('error', '백엔드 연결 실패 — 서버를 실행하세요');
      return;
    }
    const d = res.data;
    if (!d.apiConfigured) {
      setStatus('warn', 'API 키 미설정 — backend/.env 확인');
      return;
    }
    setStatus('ok', `정상 (API ${d.apiVersion}, 캐시 ${d.cacheSize})`);
  });
}

document.addEventListener('DOMContentLoaded', load);
