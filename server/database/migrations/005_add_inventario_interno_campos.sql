-- =====================================================
-- MIGRACION 005: Agregar campos faltantes a inventario_interno
-- Idempotente: usa ADD COLUMN IF NOT EXISTS
-- =====================================================

DO $$
BEGIN
  IF to_regclass('public.inventario_interno') IS NOT NULL THEN
    ALTER TABLE inventario_interno
      ADD COLUMN IF NOT EXISTS cuenta VARCHAR(100),
      ADD COLUMN IF NOT EXISTS descripcion_cuenta TEXT,
      ADD COLUMN IF NOT EXISTS tipo_bien VARCHAR(100),
      ADD COLUMN IF NOT EXISTS ejercicio VARCHAR(10),
      ADD COLUMN IF NOT EXISTS solicitud_orden_compra VARCHAR(150),
      ADD COLUMN IF NOT EXISTS fondo VARCHAR(100),
      ADD COLUMN IF NOT EXISTS cuenta_por_pagar VARCHAR(100),
      ADD COLUMN IF NOT EXISTS idcon VARCHAR(100),
      ADD COLUMN IF NOT EXISTS usuario_registro VARCHAR(100),
      ADD COLUMN IF NOT EXISTS fecha_registro DATE,
      ADD COLUMN IF NOT EXISTS fecha_asignacion DATE,
      ADD COLUMN IF NOT EXISTS fecha_aprobacion DATE;
  END IF;
END $$;

-- Indexes útiles para búsquedas/filtrado
CREATE INDEX IF NOT EXISTS idx_interno_cuenta ON inventario_interno(cuenta);
CREATE INDEX IF NOT EXISTS idx_interno_tipo_bien ON inventario_interno(tipo_bien);
CREATE INDEX IF NOT EXISTS idx_interno_ejercicio ON inventario_interno(ejercicio);
