// db.js
// SQLite 기반 번역 히스토리 저장소.
//
// 요구사항 매핑:
//  - F-13: 번역된 모든 메시지(수신/송신)를 로컬에 자동 저장.
//  - F-14: 저장 항목 = 타임스탬프, 채팅방 이름, 발신자, 원문, 번역문, 방향.
//  - F-16: 채팅방별/날짜별 필터링.
//  - F-18: 수동 삭제.
//  - NF-04: 로컬 저장소에만 보관 (외부 서버 전송 없음).

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export class HistoryStore {
  constructor(dbPath = './data/history.db') {
    const dir = path.dirname(dbPath);
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this._migrate();
  }

  _migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS translations (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp     TEXT    NOT NULL,            -- ISO8601 (F-14)
        room          TEXT    NOT NULL DEFAULT '', -- 채팅방 이름 (F-14)
        sender        TEXT    NOT NULL DEFAULT '', -- 발신자 (F-14)
        direction     TEXT    NOT NULL,            -- 'VI2KO' | 'KO2VI' (F-14)
        source_text   TEXT    NOT NULL,            -- 원문 (F-14)
        translated_text TEXT  NOT NULL,            -- 번역문 (F-14)
        detected_lang TEXT,                         -- 감지된 원문 언어
        created_at    INTEGER NOT NULL              -- epoch ms (정렬/필터용)
      );
      CREATE INDEX IF NOT EXISTS idx_translations_room ON translations(room);
      CREATE INDEX IF NOT EXISTS idx_translations_created ON translations(created_at);
    `);
  }

  /**
   * 번역 1건 저장. dedupeKey 가 같은 직전 항목과 동일하면 중복 저장을 막는다
   * (그룹 채팅에서 MutationObserver 가 같은 메시지를 재감지하는 경우 대비).
   */
  insert(entry) {
    const now = Date.now();
    const row = {
      timestamp: entry.timestamp || new Date(now).toISOString(),
      room: entry.room || '',
      sender: entry.sender || '',
      direction: entry.direction,
      source_text: entry.sourceText || '',
      translated_text: entry.translatedText || '',
      detected_lang: entry.detectedLang || null,
      created_at: now,
    };

    // 최근 5분 내 동일 (room, direction, source_text) 중복 방지
    const dupe = this.db
      .prepare(
        `SELECT id FROM translations
         WHERE room = @room AND direction = @direction AND source_text = @source_text
           AND created_at > @cutoff
         LIMIT 1`
      )
      .get({ ...row, cutoff: now - 5 * 60 * 1000 });
    if (dupe) {
      return { id: dupe.id, deduped: true };
    }

    const info = this.db
      .prepare(
        `INSERT INTO translations
           (timestamp, room, sender, direction, source_text, translated_text, detected_lang, created_at)
         VALUES
           (@timestamp, @room, @sender, @direction, @source_text, @translated_text, @detected_lang, @created_at)`
      )
      .run(row);
    return { id: info.lastInsertRowid, deduped: false };
  }

  /**
   * 히스토리 조회 (필터 + 페이지네이션).
   * @param {{room?, direction?, from?, to?, q?, limit?, offset?}} filter
   */
  list(filter = {}) {
    const clauses = [];
    const params = {};
    if (filter.room) {
      clauses.push('room = @room');
      params.room = filter.room;
    }
    if (filter.direction) {
      clauses.push('direction = @direction');
      params.direction = filter.direction;
    }
    if (filter.from) {
      clauses.push('created_at >= @from');
      params.from = new Date(filter.from).getTime();
    }
    if (filter.to) {
      clauses.push('created_at <= @to');
      params.to = new Date(filter.to).getTime();
    }
    if (filter.q) {
      clauses.push('(source_text LIKE @q OR translated_text LIKE @q)');
      params.q = `%${filter.q}%`;
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = Math.min(Number(filter.limit) || 200, 1000);
    const offset = Number(filter.offset) || 0;

    const rows = this.db
      .prepare(
        `SELECT * FROM translations ${where}
         ORDER BY created_at DESC
         LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit, offset });

    const total = this.db
      .prepare(`SELECT COUNT(*) AS n FROM translations ${where}`)
      .get(params).n;

    return { rows: rows.map(toApi), total, limit, offset };
  }

  /** 채팅방 목록 (필터 드롭다운용, F-16) */
  rooms() {
    return this.db
      .prepare(
        `SELECT room, COUNT(*) AS count, MAX(created_at) AS last_at
         FROM translations WHERE room <> '' GROUP BY room ORDER BY last_at DESC`
      )
      .all();
  }

  /** 단건 삭제 (F-18) */
  deleteOne(id) {
    const info = this.db.prepare('DELETE FROM translations WHERE id = ?').run(id);
    return info.changes > 0;
  }

  /** 필터 조건에 맞는 항목 일괄 삭제 (F-18). 조건 없으면 전체 삭제. */
  deleteMany(filter = {}) {
    const clauses = [];
    const params = {};
    if (filter.room) {
      clauses.push('room = @room');
      params.room = filter.room;
    }
    if (filter.direction) {
      clauses.push('direction = @direction');
      params.direction = filter.direction;
    }
    if (filter.before) {
      clauses.push('created_at < @before');
      params.before = new Date(filter.before).getTime();
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const info = this.db.prepare(`DELETE FROM translations ${where}`).run(params);
    return info.changes;
  }

  close() {
    this.db.close();
  }
}

function toApi(row) {
  return {
    id: row.id,
    timestamp: row.timestamp,
    room: row.room,
    sender: row.sender,
    direction: row.direction,
    sourceText: row.source_text,
    translatedText: row.translated_text,
    detectedLang: row.detected_lang,
    createdAt: row.created_at,
  };
}
