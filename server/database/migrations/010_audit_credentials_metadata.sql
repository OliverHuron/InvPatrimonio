-- =====================================================
-- MIGRACION 010: Auditoría de Campo - Credenciales + Metadata + Idempotencia
-- - Credenciales temporales (user/pass) para reforzar acceso al magic link
-- - Caducidad en horas en lugar de días (last_activity_at para inactividad)
-- - metadata JSONB en eventos (lat/lng/accuracy)
-- - client_change_id UUID para idempotencia de PATCH desde la cola offline
-- =====================================================

-- ── audit_sessions: credenciales + actividad ─────────────────────────
ALTER TABLE audit_sessions
  ADD COLUMN IF NOT EXISTS username           VARCHAR(20),
  ADD COLUMN IF NOT EXISTS password_hash      VARCHAR(120),
  ADD COLUMN IF NOT EXISTS expires_in_hours   INTEGER,
  ADD COLUMN IF NOT EXISTS last_activity_at   TIMESTAMPTZ;

-- Username único (parcial: solo cuando esté seteado para no romper filas viejas)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_audit_sessions_username_uniq'
  ) THEN
    CREATE UNIQUE INDEX idx_audit_sessions_username_uniq
      ON audit_sessions(username)
      WHERE username IS NOT NULL;
  END IF;
END$$;

-- ── audit_events: metadata + idempotencia ────────────────────────────
ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS metadata          JSONB,
  ADD COLUMN IF NOT EXISTS client_change_id  UUID;

-- Idempotencia por sesión: el mismo client_change_id no se repite dentro de la sesión
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_audit_events_idempotency'
  ) THEN
    CREATE UNIQUE INDEX idx_audit_events_idempotency
      ON audit_events(audit_session_id, client_change_id)
      WHERE client_change_id IS NOT NULL;
  END IF;
END$$;

-- Índice para búsquedas por inventario en orden cronológico (último estado conocido)
CREATE INDEX IF NOT EXISTS idx_audit_events_inv_ts
  ON audit_events(inventario_id, ts DESC);
