// api.js
// content script ↔ background ↔ 로컬 백엔드 통신 헬퍼.
//
// 번역 요청은 background service worker 를 경유해 백엔드로 전달한다.
// (NF-03: API 키는 백엔드에만 존재하므로 content script 는 키를 다루지 않는다.)

window.ZaloTranslateAPI = {
  /**
   * 번역 요청. background 로 메시지를 보내고 응답을 받는다.
   * @param {{text, target?, room?, sender?, save?}} payload
   * @returns {Promise<{translatedText, detectedSourceLanguage, target, direction, cached, historyId}>}
   */
  translate(payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'TRANSLATE', payload }, (res) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (!res) return reject(new Error('백엔드 응답이 없습니다.'));
        if (res.error) return reject(new Error(res.error));
        resolve(res.data);
      });
    });
  },

  /** 확장 설정 읽기 (번역 ON/OFF 등) */
  getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        { enabled: true, showOriginalOnSend: false, backendUrl: 'http://127.0.0.1:8787' },
        resolve
      );
    });
  },

  /** 설정 변경 구독 */
  onSettingsChanged(callback) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') callback(changes);
    });
  },
};
