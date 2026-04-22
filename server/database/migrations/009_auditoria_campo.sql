-- =====================================================
-- MIGRACION 009: Auditoría de Campo
-- Tablas para sesiones de practicantes y registro de eventos
-- =====================================================

-- Sesiones por practicante (magic link con token UUID)
CREATE TABLE IF NOT EXISTS audit_sessions (
  id           SERIAL PRIMARY KEY,
  token_hash   VARCHAR(64) UNIQUE NOT NULL,   -- SHA-256 del token (nunca el plain)
  intern_name  VARCHAR(100) NOT NULL,
  created_by   VARCHAR(100),                  -- usuario admin que generó el link
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ DEFAULT NULL,       -- NULL = activa
  last_seen_at TIMESTAMPTZ DEFAULT NULL
);

-- Registro de cambios realizados por cada practicante
CREATE TABLE IF NOT EXISTS audit_events (
  id               SERIAL PRIMARY KEY,
  audit_session_id INTEGER NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
  inventario_id    INTEGER NOT NULL,
  campo            VARCHAR(50)  NOT NULL DEFAULT 'estado',
  valor_anterior   VARCHAR(100),
  valor_nuevo      VARCHAR(100) NOT NULL,
  observaciones    TEXT,
  ts               TIMESTAMPTZ  DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_audit_sessions_token_hash ON audit_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_audit_sessions_expires    ON audit_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_session      ON audit_events(audit_session_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_inventario   ON audit_events(inventario_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_ts           ON audit_events(ts);
