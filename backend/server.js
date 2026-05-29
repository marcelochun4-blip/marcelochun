// server.js
// Zalo KO-VI Translator 로컬 백엔드 진입점.
//
// 책임:
//  - Google Translate API 키를 서버에서만 보관/사용 (NF-03)
//  - 번역 프록시 + 히스토리(SQLite, 로컬) 제공 (NF-04)
//  - Chrome Extension(content/popup/history) 의 요청을 CORS 허용
//
// 외부로 데이터를 전송하지 않으며, 모든 호출은 localhost 에서 동작한다.

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { Translator } from './translate.js';
import { HistoryStore } from './db.js';
import { createTranslateRouter } from './routes/translate.js';
import { createHistoryRouter } from './routes/history.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 8787;
const DB_PATH = process.env.DB_PATH || './data/history.db';

const translator = new Translator({
  apiKey: process.env.GOOGLE_TRANSLATE_API_KEY,
  apiVersion: process.env.GOOGLE_TRANSLATE_API_VERSION || 'v2',
  projectId: process.env.GOOGLE_PROJECT_ID || '',
  cacheSize: Number(process.env.TRANSLATION_CACHE_SIZE) || 2000,
});

const store = new HistoryStore(DB_PATH);

const app = express();

// 확장 프로그램(content script)은 web.zalo.me 출처에서 호출하므로 CORS 허용.
// 로컬 전용 서버이며 인증 쿠키를 쓰지 않으므로 origin 제한을 두지 않는다.
app.use(cors());
app.use(express.json({ limit: '256kb' }));

// 헬스체크 — popup 이 백엔드/키 설정 상태를 확인하는 데 사용 (F-22)
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    apiConfigured: translator.isConfigured(),
    apiVersion: translator.apiVersion,
    cacheSize: translator.cache.size,
  });
});

app.use('/api', createTranslateRouter({ translator, store }));
app.use('/api', createHistoryRouter({ store }));

// 글로벌 에러 핸들러 (JSON 파싱 오류 등)
app.use((err, _req, res, _next) => {
  console.error('[server] 처리되지 않은 오류:', err.message);
  res.status(500).json({ error: err.message });
});

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ Zalo 번역 백엔드 실행 중: http://127.0.0.1:${PORT}`);
  console.log(`   - API 키 설정됨: ${translator.isConfigured() ? '예' : '아니오 (.env 확인 필요)'}`);
  console.log(`   - 번역 API 버전: ${translator.apiVersion}`);
  console.log(`   - 히스토리 DB:   ${DB_PATH}`);
});

// 정상 종료 처리
function shutdown() {
  console.log('\n종료 중...');
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app, translator, store };
