// routes/history.js
// 히스토리 조회 / 필터 / CSV 내보내기 / 삭제 엔드포인트.
import express from 'express';

export function createHistoryRouter({ store }) {
  const router = express.Router();

  // GET /api/history?room=&direction=&from=&to=&q=&limit=&offset=  (F-15, F-16)
  router.get('/history', (req, res) => {
    const result = store.list(req.query);
    res.json(result);
  });

  // GET /api/history/rooms  → 채팅방 목록 (필터 드롭다운, F-16)
  router.get('/history/rooms', (_req, res) => {
    res.json({ rooms: store.rooms() });
  });

  // GET /api/history/export.csv?...  → CSV 내보내기 (F-17)
  router.get('/history/export.csv', (req, res) => {
    const { rows } = store.list({ ...req.query, limit: 100000 });
    const header = ['id', 'timestamp', 'room', 'sender', 'direction', 'sourceText', 'translatedText', 'detectedLang'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(header.map((k) => csvCell(r[k])).join(','));
    }
    // BOM 추가 → Excel 에서 한글/베트남어 깨짐 방지
    const csv = '﻿' + lines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="zalo-translations-${Date.now()}.csv"`);
    res.send(csv);
  });

  // DELETE /api/history/:id  → 단건 삭제 (F-18)
  router.delete('/history/:id', (req, res) => {
    const ok = store.deleteOne(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    res.json({ ok: true });
  });

  // POST /api/history/delete  → 조건부 일괄 삭제 (F-18)
  // body: { room?, direction?, before? }  (조건 없으면 전체 삭제)
  router.post('/history/delete', (req, res) => {
    const removed = store.deleteMany(req.body || {});
    res.json({ ok: true, removed });
  });

  return router;
}

function csvCell(value) {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
