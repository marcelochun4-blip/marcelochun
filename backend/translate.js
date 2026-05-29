// translate.js
// Google Cloud Translation API 래퍼 + 언어 감지 + 인메모리 캐시.
//
// 요구사항 매핑:
//  - NF-03: API 키는 이 백엔드(서버)에서만 사용/관리한다.
//  - 리스크(Google API 비용): 동일 (텍스트, 방향) 요청은 캐싱하여 호출량을 줄인다.
//  - F-01: Google Translate API 언어 자동 감지 기능 활용.

const KO = 'ko';
const VI = 'vi';

/**
 * 단순 LRU 캐시. 같은 문장 재번역 시 API 호출을 막아 비용/지연을 줄인다.
 */
class LruCache {
  constructor(maxSize = 2000) {
    this.maxSize = maxSize;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key);
    // 최근 사용 항목을 맨 뒤로 이동 (LRU 갱신)
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.maxSize) {
      // 가장 오래된 항목 제거
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
  }

  get size() {
    return this.map.size;
  }
}

export class Translator {
  constructor({ apiKey, apiVersion = 'v2', projectId = '', cacheSize = 2000 } = {}) {
    this.apiKey = apiKey;
    this.apiVersion = apiVersion;
    this.projectId = projectId;
    this.cache = new LruCache(cacheSize);
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  /**
   * HTML 엔티티 디코딩. Google v2 응답은 &#39; 같은 엔티티를 포함할 수 있다.
   */
  static decodeEntities(text) {
    if (!text) return text;
    return text
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  /**
   * 텍스트와 (옵션) 명시 타깃을 받아 자동으로 번역 방향을 결정한다.
   * 규칙:
   *  - source 가 한국어로 감지되면 → 베트남어 (KO→VI)
   *  - 그 외(베트남어 등)면 → 한국어 (VI→KO)   (F-02)
   *  - 한국어 메시지는 수신 측에서 번역 없이 원문 표시되도록 호출되지 않음 (F-06)
   *
   * @param {string} text 원문
   * @param {{target?: string}} opts 명시 타깃 ('ko' | 'vi'). 미지정 시 자동 결정.
   * @returns {Promise<{translatedText, detectedSourceLanguage, target, cached}>}
   */
  async translate(text, opts = {}) {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      return { translatedText: '', detectedSourceLanguage: null, target: opts.target || null, cached: false };
    }
    if (!this.isConfigured()) {
      throw new Error('GOOGLE_TRANSLATE_API_KEY가 설정되지 않았습니다. backend/.env 를 확인하세요.');
    }

    const cacheKey = `${opts.target || 'auto'}::${trimmed}`;
    const cachedHit = this.cache.get(cacheKey);
    if (cachedHit) {
      return { ...cachedHit, cached: true };
    }

    const result =
      this.apiVersion === 'v3'
        ? await this._translateV3(trimmed, opts.target)
        : await this._translateV2(trimmed, opts.target);

    this.cache.set(cacheKey, result);
    return { ...result, cached: false };
  }

  /**
   * 타깃 언어 결정: 명시값 우선, 없으면 감지된 source 기반으로 자동 결정.
   */
  static resolveTarget(detected, explicitTarget) {
    if (explicitTarget) return explicitTarget;
    return detected === KO ? VI : KO;
  }

  // ── Google Cloud Translation API v2 (REST, API 키 기반) ─────────────
  async _translateV2(text, explicitTarget) {
    // 타깃이 명시되지 않은 경우, 먼저 언어를 감지해서 방향을 정한다.
    let target = explicitTarget;
    let detected = null;

    if (!target) {
      detected = await this._detectV2(text);
      target = Translator.resolveTarget(detected, null);
    }

    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, target, format: 'text' }),
    });

    if (!res.ok) {
      const detail = await safeErrorText(res);
      throw new Error(`Google Translate v2 오류 (${res.status}): ${detail}`);
    }

    const data = await res.json();
    const item = data?.data?.translations?.[0];
    return {
      translatedText: Translator.decodeEntities(item?.translatedText ?? ''),
      detectedSourceLanguage: detected || item?.detectedSourceLanguage || null,
      target,
    };
  }

  async _detectV2(text) {
    const url = `https://translation.googleapis.com/language/translate/v2/detect?key=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text }),
    });
    if (!res.ok) {
      const detail = await safeErrorText(res);
      throw new Error(`Google Detect v2 오류 (${res.status}): ${detail}`);
    }
    const data = await res.json();
    return data?.data?.detections?.[0]?.[0]?.language ?? null;
  }

  // ── Google Cloud Translation API v3 (translateText, API 키 기반) ────
  async _translateV3(text, explicitTarget) {
    if (!this.projectId) {
      throw new Error('v3 사용 시 GOOGLE_PROJECT_ID 가 필요합니다.');
    }
    // v3 는 source 미지정 시 자동 감지된다. 타깃이 없으면 먼저 감지 후 결정.
    let target = explicitTarget;
    let detected = null;
    if (!target) {
      detected = await this._detectV3(text);
      target = Translator.resolveTarget(detected, null);
    }

    const url =
      `https://translation.googleapis.com/v3/projects/${encodeURIComponent(this.projectId)}` +
      `/locations/global:translateText?key=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [text], targetLanguageCode: target, mimeType: 'text/plain' }),
    });
    if (!res.ok) {
      const detail = await safeErrorText(res);
      throw new Error(`Google Translate v3 오류 (${res.status}): ${detail}`);
    }
    const data = await res.json();
    const item = data?.translations?.[0];
    return {
      translatedText: Translator.decodeEntities(item?.translatedText ?? ''),
      detectedSourceLanguage: detected || item?.detectedLanguageCode || null,
      target,
    };
  }

  async _detectV3(text) {
    const url =
      `https://translation.googleapis.com/v3/projects/${encodeURIComponent(this.projectId)}` +
      `/locations/global:detectLanguage?key=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text, mimeType: 'text/plain' }),
    });
    if (!res.ok) {
      const detail = await safeErrorText(res);
      throw new Error(`Google Detect v3 오류 (${res.status}): ${detail}`);
    }
    const data = await res.json();
    return data?.languages?.[0]?.languageCode ?? null;
  }
}

async function safeErrorText(res) {
  try {
    const j = await res.json();
    return j?.error?.message || JSON.stringify(j);
  } catch {
    return res.statusText || 'unknown error';
  }
}

export const LANG = { KO, VI };
