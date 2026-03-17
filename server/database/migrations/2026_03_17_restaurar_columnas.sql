-- ================================================================
-- MIGRACIÓN CORRECTIVA: Restaurar columnas eliminadas por error
-- Fecha: 2026-03-17
-- ================================================================
-- Solo debieron eliminarse: stage, es_oficial_siia, es_local,
-- es_investigacion. El resto se conserva en inventario.
-- ================================================================

BEGIN;

ALTER TABLE public.inventario
    ADD COLUMN IF NOT EXISTS ubicacion           VARCHAR(200),
    ADD COLUMN IF NOT EXISTS numero_empleado     VARCHAR(50),
    ADD COLUMN IF NOT EXISTS usu_asig            VARCHAR(255),
    ADD COLUMN IF NOT EXISTS descripcion_bien    TEXT,
    ADD COLUMN IF NOT EXISTS valor_actual        NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS vida_util_anos      INTEGER,
    ADD COLUMN IF NOT EXISTS estado              VARCHAR(50) DEFAULT 'buena';

COMMIT;
