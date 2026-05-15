-- =====================================================
-- MIGRACION 011: Auditoría de Campo - Soporte modo API
-- - ures_codes en sessions para saber qué URES auditar vía API externa
-- - item_folio / item_descripcion en events para registrar info del bien
--   cuando proviene de la API (no existe en inventario_interno local)
-- =====================================================

-- audit_sessions: guardar las URES que cubre esta sesión de auditoría
ALTER TABLE audit_sessions
  ADD COLUMN IF NOT EXISTS ures_codes TEXT;  -- JSON array ej. '["23110100","23110200"]'

-- audit_events: info del bien para cuando el ítem viene de la API externa
ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS item_folio       TEXT,
  ADD COLUMN IF NOT EXISTS item_descripcion TEXT;
