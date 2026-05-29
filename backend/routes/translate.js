// routes/translate.js
// 번역 엔드포인트. 번역 수행 후(자동 저장 옵션) 히스토리에 기록한다.
import express from 'express';

export function createTranslateRouter({ translator, store }) {
  const router = express.Router();

  /**
   * POST /api/translate
   * body: {
   *   text: string,            // 원문 (필수)
   *   target?: 'ko' | 'vi',    // 명시 타깃 (송신 KO→VI 시 'vi' 등). 미지정 시 자동.
   *   room?: string,           // 채팅방 이름 (히스토리용)
   *   sender?: string,         // 발신자 (히스토리용)
   *   save?: boolean,          // 히스토리 저장 여부 (기본 true)
   * }
   *
   * 응답: { translatedText, detectedSourceLanguage, target, direction, cached, historyId }
   * F-01/F-02/F-07: 자동 감지 + 번역. NF-01: 가능한 한 빠르게 응답.
   */
  router.post('/translate', async (req, res) => {
    const { text, target, room, sender, save = true } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text 필드가 필요합니다.' });
    }

    try {
      const result = await translator.translate(text, { target });

      // 방향 라벨 결정 (F-14)
      const direction = result.target === 'ko' ? 'VI2KO' : 'KO2VI';

      let historyId = null;
      if (save) {
        const saved = store.insert({
          room,
          sender,
          direction,
          sourceText: text,
          translatedText: result.translatedText,
          detectedLang: result.detectedSourceLanguage,
        });
        historyId = saved.id;
      }

      return res.json({
        translatedText: result.translatedText,
        detectedSourceLanguage: result.detectedSourceLanguage,
        target: result.target,
        direction,
        cached: result.cached,
        historyId,
      });
    } catch (err) {
      // F-22: 실패 시 클라이언트가 재시도 버튼을 띄울 수 있도록 명확한 오류 반환
      console.error('[translate] 오류:', err.message);
      return res.status(502).json({ error: err.message });
    }
  });

  return router;
}
