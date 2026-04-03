-- =====================================================
-- MIGRACION 003: Estado de localización para inventario interno
-- Reemplaza el uso de booleano activo en UI con estado textual
-- =====================================================

ALTER TABLE inventario_interno
  ADD COLUMN IF NOT EXISTS estado_localizacion VARCHAR(30);

UPDATE inventario_interno
SET estado_localizacion = CASE
  WHEN estado_localizacion IS NOT NULL THEN estado_localizacion
  WHEN activo = true THEN 'Localizado Activo'
  ELSE 'Localizado No Activo'
END;

ALTER TABLE inventario_interno
  ALTER COLUMN estado_localizacion SET NOT NULL;

ALTER TABLE inventario_interno
  ALTER COLUMN estado_localizacion SET DEFAULT 'Localizado Activo';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventario_interno_estado_localizacion_check'
  ) THEN
    ALTER TABLE inventario_interno
      ADD CONSTRAINT inventario_interno_estado_localizacion_check
      CHECK (estado_localizacion IN ('Localizado Activo', 'Localizado No Activo', 'No Localizado'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_interno_estado_localizacion
  ON inventario_interno(estado_localizacion);
