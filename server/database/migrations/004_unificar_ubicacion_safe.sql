-- =====================================================
-- MIGRACION 004: Unificar ubicación (idempotente/segura)
-- Maneja esquemas viejos y nuevos sin fallar si columnas no existen
-- =====================================================

DO $$
BEGIN
  -- INTERNO
  IF to_regclass('public.inventario_interno') IS NOT NULL THEN
    ALTER TABLE inventario_interno
      ADD COLUMN IF NOT EXISTS ubicacion VARCHAR(255);

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'inventario_interno'
        AND column_name = 'ubicacion_edificio'
    ) THEN
      EXECUTE '
        UPDATE inventario_interno
        SET ubicacion = COALESCE(NULLIF(ubicacion, ''''), ubicacion_edificio)
        WHERE ubicacion IS NULL OR ubicacion = ''''
      ';

      ALTER TABLE inventario_interno
        DROP COLUMN IF EXISTS ubicacion_edificio;
    END IF;
  END IF;

  -- EXTERNO
  IF to_regclass('public.inventario_externo') IS NOT NULL THEN
    ALTER TABLE inventario_externo
      ADD COLUMN IF NOT EXISTS ubicacion VARCHAR(255);

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'inventario_externo'
        AND column_name = 'ubicacion_edificio'
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'inventario_externo'
        AND column_name = 'ubicacion_salon'
    ) THEN
      EXECUTE '
        UPDATE inventario_externo
        SET ubicacion = COALESCE(
          NULLIF(ubicacion, ''''),
          NULLIF(TRIM(CONCAT_WS('' '', COALESCE(ubicacion_edificio, ''''), COALESCE(ubicacion_salon, ''''))), '''')
        )
        WHERE ubicacion IS NULL OR ubicacion = ''''
      ';
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'inventario_externo'
        AND column_name = 'ubicacion_edificio'
    ) THEN
      EXECUTE '
        UPDATE inventario_externo
        SET ubicacion = COALESCE(NULLIF(ubicacion, ''''), ubicacion_edificio)
        WHERE ubicacion IS NULL OR ubicacion = ''''
      ';
    END IF;

    ALTER TABLE inventario_externo
      DROP COLUMN IF EXISTS ubicacion_edificio,
      DROP COLUMN IF EXISTS ubicacion_salon;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_interno_ubicacion ON inventario_interno(ubicacion);
CREATE INDEX IF NOT EXISTS idx_externo_ubicacion ON inventario_externo(ubicacion);
