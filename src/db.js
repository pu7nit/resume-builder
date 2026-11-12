import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { seedResume } from './seed.js';

let db = null;

/** Open (and create if needed) the SQLite database, then seed on first run. */
export function initDb(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS resumes (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      data       TEXT NOT NULL,
      settings   TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const { count } = db.prepare('SELECT COUNT(*) AS count FROM resumes').get();
  if (count === 0) {
    const seed = seedResume();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO resumes (id, title, data, settings, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(randomUUID(), seed.title, JSON.stringify(seed.data), JSON.stringify(seed.settings), now, now);
    console.log('[db] seeded first resume');
  }
  return db;
}

export function closeDb() {
  if (db) {
    try {
      db.close();
    } catch {
      /* already closed */
    }
    db = null;
  }
}

function row(rowData) {
  if (!rowData) return null;
  return {
    id: rowData.id,
    title: rowData.title,
    data: safeParse(rowData.data, {}),
    settings: safeParse(rowData.settings, {}),
    created_at: rowData.created_at,
    updated_at: rowData.updated_at,
  };
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function listResumes() {
  return db
    .prepare('SELECT id, title, updated_at FROM resumes ORDER BY updated_at DESC')
    .all()
    .map((r) => ({ id: r.id, title: r.title, updated_at: r.updated_at }));
}

export function getResume(id) {
  return row(db.prepare('SELECT * FROM resumes WHERE id = ?').get(id));
}

export function createResume({ title, data, settings }) {
  const now = new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    'INSERT INTO resumes (id, title, data, settings, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    title,
    JSON.stringify(data ?? {}),
    JSON.stringify(settings ?? {}),
    now,
    now
  );
  return getResume(id);
}

export function duplicateResume(id) {
  const source = getResume(id);
  if (!source) return null;
  return createResume({
    title: `${source.title} (copy)`.slice(0, 120),
    data: source.data,
    settings: source.settings,
  });
}

export function updateResume(id, patch) {
  const existing = getResume(id);
  if (!existing) return null;
  const title = typeof patch.title === 'string' ? patch.title.slice(0, 120) : existing.title;
  const data = isPlainObject(patch.data) ? patch.data : existing.data;
  const settings = isPlainObject(patch.settings) ? patch.settings : existing.settings;
  const now = new Date().toISOString();
  db.prepare('UPDATE resumes SET title = ?, data = ?, settings = ?, updated_at = ? WHERE id = ?').run(
    title,
    JSON.stringify(data),
    JSON.stringify(settings),
    now,
    id
  );
  return getResume(id);
}

export function deleteResume(id) {
  const result = db.prepare('DELETE FROM resumes WHERE id = ?').run(id);
  return result.changes > 0;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
