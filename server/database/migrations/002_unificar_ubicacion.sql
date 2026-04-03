-- =====================================================
-- MIGRACION 002: Unificar columnas de ubicación
-- - inventario_interno: ubicacion_edificio -> ubicacion
-- - inventario_externo: ubicacion_edificio + ubicacion_salon -> ubicacion
-- =====================================================

-- INTERNO
ALTER TABLE inventario_interno
  ADD COLUMN IF NOT EXISTS ubicacion VARCHAR(255);

UPDATE inventario_interno
SET ubicacion = COALESCE(NULLIF(ubicacion, ''), ubicacion_edificio)
WHERE ubicacion IS NULL OR ubicacion = '';

CREATE INDEX IF NOT EXISTS idx_interno_ubicacion ON inventario_interno(ubicacion);

ALTER TABLE inventario_interno
  DROP COLUMN IF EXISTS ubicacion_edificio;

-- EXTERNO
ALTER TABLE inventario_externo
  ADD COLUMN IF NOT EXISTS ubicacion VARCHAR(255);

UPDATE inventario_externo
SET ubicacion = COALESCE(
  NULLIF(ubicacion, ''),
  NULLIF(TRIM(CONCAT_WS(' ', COALESCE(ubicacion_edificio, ''), COALESCE(ubicacion_salon, ''))), '')
)
WHERE ubicacion IS NULL OR ubicacion = '';

CREATE INDEX IF NOT EXISTS idx_externo_ubicacion ON inventario_externo(ubicacion);

ALTER TABLE inventario_externo
  DROP COLUMN IF EXISTS ubicacion_edificio,
  DROP COLUMN IF EXISTS ubicacion_salon;
