const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.AUDIT_DB_PATH || path.join(DATA_DIR, 'audit.db');

let db = null;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');   // lectores no bloquean escritores
    db.pragma('synchronous = NORMAL'); // seguro con WAL, mucho más rápido que FULL
    db.pragma('busy_timeout = 5000');  // espera hasta 5s antes de fallar por lock
    db.pragma('foreign_keys = ON');
    initSchema(db);
    console.log(`[SQLite] Base de datos de auditoría abierta: ${DB_PATH}`);
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_sessions (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash       TEXT    NOT NULL UNIQUE,
      token_plain      TEXT,
      intern_name      TEXT    NOT NULL,
      created_by       TEXT,
      created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
      expires_at       TEXT    NOT NULL,
      expires_in_hours INTEGER NOT NULL DEFAULT 8,
      revoked_at       TEXT,
      last_seen_at     TEXT,
      last_activity_at TEXT,
      username         TEXT    UNIQUE,
      password_hash    TEXT,
      ures_codes       TEXT,
      umich_jsession   TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_session_id INTEGER NOT NULL REFERENCES audit_sessions(id),
      inventario_id    INTEGER,
      campo            TEXT    NOT NULL DEFAULT 'estado',
      valor_anterior   TEXT,
      valor_nuevo      TEXT    NOT NULL,
      observaciones    TEXT,
      metadata         TEXT,
      client_change_id TEXT,
      item_folio       TEXT,
      item_descripcion TEXT,
      ts               TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(audit_session_id, client_change_id)
    );

    -- Estado actual de cada bien (upsert en cada cambio de auditoría)
    CREATE TABLE IF NOT EXISTS item_estados (
      inventario_id    INTEGER PRIMARY KEY,
      estado           TEXT    NOT NULL DEFAULT 'Sin asignar',
      audit_session_id INTEGER REFERENCES audit_sessions(id),
      updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_audit_events_session
      ON audit_events(audit_session_id);
    CREATE INDEX IF NOT EXISTS idx_audit_events_inventario
      ON audit_events(inventario_id);
  `);

  // Migración: agregar token_plain si no existe (bases de datos existentes)
  const cols = db.pragma('table_info(audit_sessions)').map(c => c.name);
  if (!cols.includes('token_plain')) {
    db.exec(`ALTER TABLE audit_sessions ADD COLUMN token_plain TEXT`);
    console.log('[SQLite] Migración: columna token_plain agregada');
  }

  // Migración: eliminar columnas username y password_hash (ya no se usan)
  if (cols.includes('username') || cols.includes('password_hash')) {
    db.exec(`
      BEGIN;
      CREATE TABLE IF NOT EXISTS audit_sessions_new (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        token_hash       TEXT    NOT NULL UNIQUE,
        token_plain      TEXT,
        intern_name      TEXT    NOT NULL,
        created_by       TEXT,
        created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
        expires_at       TEXT    NOT NULL,
        expires_in_hours INTEGER NOT NULL DEFAULT 8,
        revoked_at       TEXT,
        last_seen_at     TEXT,
        last_activity_at TEXT,
        ures_codes       TEXT,
        umich_jsession   TEXT
      );
      INSERT INTO audit_sessions_new
        (id, token_hash, token_plain, intern_name, created_by, created_at,
         expires_at, expires_in_hours, revoked_at, last_seen_at, last_activity_at,
         ures_codes, umich_jsession)
      SELECT
        id, token_hash, token_plain, intern_name, created_by, created_at,
        expires_at, expires_in_hours, revoked_at, last_seen_at, last_activity_at,
        ures_codes, umich_jsession
      FROM audit_sessions;
      DROP TABLE audit_sessions;
      ALTER TABLE audit_sessions_new RENAME TO audit_sessions;
      COMMIT;
    `);
    console.log('[SQLite] Migración: columnas username y password_hash eliminadas');
  }
}

module.exports = { getDb };
