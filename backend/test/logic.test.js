// logic.test.js
// 외부 API 호출 없이 검증 가능한 순수 로직 테스트.
// 실행: cd backend && npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import { Translator, LANG } from '../translate.js';
import { HistoryStore } from '../db.js';

test('resolveTarget: 한국어 감지 시 베트남어로', () => {
  assert.equal(Translator.resolveTarget('ko', null), 'vi');
});

test('resolveTarget: 베트남어/기타 감지 시 한국어로', () => {
  assert.equal(Translator.resolveTarget('vi', null), 'ko');
  assert.equal(Translator.resolveTarget('en', null), 'ko');
});

test('resolveTarget: 명시 타깃이 항상 우선', () => {
  assert.equal(Translator.resolveTarget('ko', 'ko'), 'ko');
  assert.equal(Translator.resolveTarget('vi', 'vi'), 'vi');
});

test('decodeEntities: HTML 엔티티 디코딩', () => {
  assert.equal(Translator.decodeEntities('xin ch&#39;ao &amp; b&quot;n'), `xin ch'ao & b"n`);
});

test('translate: 빈 문자열은 API 호출 없이 빈 결과', async () => {
  const t = new Translator({ apiKey: 'dummy' });
  const r = await t.translate('   ');
  assert.equal(r.translatedText, '');
  assert.equal(r.cached, false);
});

test('translate: API 키 미설정 시 오류', async () => {
  const t = new Translator({});
  await assert.rejects(() => t.translate('xin chao'), /API_KEY/);
});

test('LANG 상수', () => {
  assert.equal(LANG.KO, 'ko');
  assert.equal(LANG.VI, 'vi');
});

// ── HistoryStore (임시 DB) ──────────────────────────────
function tmpStore() {
  const p = path.join(os.tmpdir(), `zt-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  return { store: new HistoryStore(p), path: p };
}

test('HistoryStore: insert + list + 필터', () => {
  const { store, path: p } = tmpStore();
  try {
    store.insert({ room: 'A', sender: 'Nam', direction: 'VI2KO', sourceText: 'xin chao', translatedText: '안녕' });
    store.insert({ room: 'B', sender: '나', direction: 'KO2VI', sourceText: '감사합니다', translatedText: 'cam on' });

    const all = store.list({});
    assert.equal(all.total, 2);

    const onlyA = store.list({ room: 'A' });
    assert.equal(onlyA.total, 1);
    assert.equal(onlyA.rows[0].sourceText, 'xin chao');

    const onlyKo2vi = store.list({ direction: 'KO2VI' });
    assert.equal(onlyKo2vi.total, 1);
    assert.equal(onlyKo2vi.rows[0].translatedText, 'cam on');

    const search = store.list({ q: '감사' });
    assert.equal(search.total, 1);
  } finally {
    store.close();
    fs.rmSync(p, { force: true });
    fs.rmSync(`${p}-shm`, { force: true });
    fs.rmSync(`${p}-wal`, { force: true });
  }
});

test('HistoryStore: 5분 내 동일 메시지 중복 방지', () => {
  const { store, path: p } = tmpStore();
  try {
    const a = store.insert({ room: 'A', direction: 'VI2KO', sourceText: 'dup', translatedText: '중복' });
    const b = store.insert({ room: 'A', direction: 'VI2KO', sourceText: 'dup', translatedText: '중복' });
    assert.equal(b.deduped, true);
    assert.equal(a.id, b.id);
    assert.equal(store.list({}).total, 1);
  } finally {
    store.close();
    fs.rmSync(p, { force: true });
    fs.rmSync(`${p}-shm`, { force: true });
    fs.rmSync(`${p}-wal`, { force: true });
  }
});

test('HistoryStore: 삭제 (단건/조건)', () => {
  const { store, path: p } = tmpStore();
  try {
    const a = store.insert({ room: 'A', direction: 'VI2KO', sourceText: 's1', translatedText: 't1' });
    store.insert({ room: 'B', direction: 'KO2VI', sourceText: 's2', translatedText: 't2' });

    assert.equal(store.deleteOne(a.id), true);
    assert.equal(store.list({}).total, 1);

    const removed = store.deleteMany({ room: 'B' });
    assert.equal(removed, 1);
    assert.equal(store.list({}).total, 0);
  } finally {
    store.close();
    fs.rmSync(p, { force: true });
    fs.rmSync(`${p}-shm`, { force: true });
    fs.rmSync(`${p}-wal`, { force: true });
  }
});

test('HistoryStore: rooms 집계', () => {
  const { store, path: p } = tmpStore();
  try {
    store.insert({ room: 'A', direction: 'VI2KO', sourceText: 'x', translatedText: 'y' });
    store.insert({ room: 'A', direction: 'VI2KO', sourceText: 'x2', translatedText: 'y2' });
    store.insert({ room: 'B', direction: 'VI2KO', sourceText: 'z', translatedText: 'w' });
    const rooms = store.rooms();
    const a = rooms.find((r) => r.room === 'A');
    assert.equal(a.count, 2);
  } finally {
    store.close();
    fs.rmSync(p, { force: true });
    fs.rmSync(`${p}-shm`, { force: true });
    fs.rmSync(`${p}-wal`, { force: true });
  }
});
