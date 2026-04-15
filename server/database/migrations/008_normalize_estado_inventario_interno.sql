-- =====================================================
-- MIGRACION 008: Normalizar valores de `estado` en inventario_interno
-- - Mapea variantes históricas a los cuatro valores estándar:
--     'Sin asignar', 'Localizado', 'Baja', 'No Localizado'
-- - Convierte NULL/'' y valores no reconocidos a 'Sin asignar'
-- - Recrea el CHECK constraint `inventario_interno_estado_check` de forma idempotente
-- Recomendación: hacer backup antes de ejecutar en producción.
-- =====================================================

DO $$
DECLARE
  v_count INT;
BEGIN
  IF to_regclass('public.inventario_interno') IS NULL THEN
    RAISE NOTICE 'Table inventario_interno no encontrada, omitiendo migracion 008';
    RETURN;
  END IF;

  -- 1) Mapear variantes conocidas a los valores nuevos
  UPDATE inventario_interno
  SET estado = 'Localizado'
  WHERE LOWER(TRIM(estado)) IN ('localizado activo', 'localizado_activo');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Mapped -> Localizado: % filas', v_count;

  UPDATE inventario_interno
  SET estado = 'Baja'
  WHERE LOWER(TRIM(estado)) IN ('localizado no activo', 'localizado_no_activo', 'localizado-no-activo');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Mapped -> Baja: % filas', v_count;

  UPDATE inventario_interno
  SET estado = 'No Localizado'
  WHERE LOWER(TRIM(estado)) IN ('no localizado', 'no_localizado', 'nolocalizado');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Mapped -> No Localizado: % filas', v_count;

  -- 2) Normalizar NULL/empty a 'Sin asignar'
  UPDATE inventario_interno
  SET estado = 'Sin asignar'
  WHERE estado IS NULL OR TRIM(estado) = '';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'NULL/empty -> Sin asignar: % filas', v_count;

  -- 3) Cualquier valor restante no permitido -> 'Sin asignar'
  UPDATE inventario_interno
  SET estado = 'Sin asignar'
  WHERE COALESCE(estado, '') NOT IN ('Sin asignar', 'Localizado', 'Baja', 'No Localizado');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Unknown values -> Sin asignar: % filas', v_count;

  -- 4) Recrear constraint de forma segura
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventario_interno_estado_check'
  ) THEN
    ALTER TABLE inventario_interno DROP CONSTRAINT inventario_interno_estado_check;
    RAISE NOTICE 'Constraint inventario_interno_estado_check borrado (si existia)';
  END IF;

  ALTER TABLE inventario_interno
    ADD CONSTRAINT inventario_interno_estado_check CHECK (estado IN ('Sin asignar', 'Localizado', 'Baja', 'No Localizado'));
  RAISE NOTICE 'Constraint inventario_interno_estado_check creada con valores permitidos: Sin asignar, Localizado, Baja, No Localizado';

END
$$;

ALTER TABLE inventario_interno 
  ALTER COLUMN clave_patrimonial TYPE character varying(255),
  ALTER COLUMN folio TYPE character varying(255),
  ALTER COLUMN marca TYPE character varying(255),
  ALTER COLUMN modelo TYPE character varying(255),
  ALTER COLUMN no_serie TYPE character varying(255),
  ALTER COLUMN no_factura TYPE character varying(255),
  ALTER COLUMN cog TYPE character varying(255),
  ALTER COLUMN numero_empleado_usuario TYPE character varying(255),
  ALTER COLUMN ures_gasto TYPE character varying(255),
  ALTER COLUMN usuario_creacion TYPE character varying(255),
  ALTER COLUMN usuario_actualizacion TYPE character varying(255),
  ALTER COLUMN cuenta TYPE character varying(255),
  ALTER COLUMN tipo_bien TYPE character varying(255),
  ALTER COLUMN fondo TYPE character varying(255),
  ALTER COLUMN cuenta_por_pagar TYPE character varying(255),
  ALTER COLUMN idcon TYPE character varying(255),
  ALTER COLUMN usuario_registro TYPE character varying(255);
