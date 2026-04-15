-- =====================================================
-- MIGRACION 006: Normalizar nombres de columnas y limpiar inventario_interno
-- - Renombra columnas solicitadas
-- - Añade `fec_fact` y `usu_asig` si no existen
-- - Mapea valores de estado antiguos a los nuevos y aplica constraint
-- - Elimina columnas obsoletas (`estado_uso`, `activo`)
-- Idempotente: usa IF EXISTS / ADD COLUMN IF NOT EXISTS
-- =====================================================

DO $$
BEGIN
  IF to_regclass('public.inventario_interno') IS NOT NULL THEN

    -- Renombrar columnas de forma idempotente y segura (solo si el nuevo nombre no existe)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'no_registro') THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'folio') THEN
        RAISE NOTICE 'Renombrando inventario_interno.no_registro -> folio';
        EXECUTE 'ALTER TABLE inventario_interno RENAME COLUMN no_registro TO folio';
      ELSE
        RAISE NOTICE 'Omitido: inventario_interno.folio ya existe, no se renombra no_registro';
      END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'numero_registro_patrimonial') THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'clave_patrimonial') THEN
        RAISE NOTICE 'Renombrando inventario_interno.numero_registro_patrimonial -> clave_patrimonial';
        EXECUTE 'ALTER TABLE inventario_interno RENAME COLUMN numero_registro_patrimonial TO clave_patrimonial';
      ELSE
        RAISE NOTICE 'Omitido: inventario_interno.clave_patrimonial ya existe, no se renombra numero_registro_patrimonial';
      END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'observaciones') THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'comentarios') THEN
        RAISE NOTICE 'Renombrando inventario_interno.observaciones -> comentarios';
        EXECUTE 'ALTER TABLE inventario_interno RENAME COLUMN observaciones TO comentarios';
      ELSE
        RAISE NOTICE 'Omitido: inventario_interno.comentarios ya existe, no se renombra observaciones';
      END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'entrega_responsable') THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'responsable') THEN
        RAISE NOTICE 'Renombrando inventario_interno.entrega_responsable -> responsable';
        EXECUTE 'ALTER TABLE inventario_interno RENAME COLUMN entrega_responsable TO responsable';
      ELSE
        RAISE NOTICE 'Omitido: inventario_interno.responsable ya existe, no se renombra entrega_responsable';
      END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'recurso') THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'cog') THEN
        RAISE NOTICE 'Renombrando inventario_interno.recurso -> cog';
        EXECUTE 'ALTER TABLE inventario_interno RENAME COLUMN recurso TO cog';
      ELSE
        RAISE NOTICE 'Omitido: inventario_interno.cog ya existe, no se renombra recurso';
      END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'ur') THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'ures_gasto') THEN
        RAISE NOTICE 'Renombrando inventario_interno.ur -> ures_gasto';
        EXECUTE 'ALTER TABLE inventario_interno RENAME COLUMN ur TO ures_gasto';
      ELSE
        RAISE NOTICE 'Omitido: inventario_interno.ures_gasto ya existe, no se renombra ur';
      END IF;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'responsable_usuario') THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'usu_asig') THEN
        RAISE NOTICE 'Renombrando inventario_interno.responsable_usuario -> usu_asig';
        EXECUTE 'ALTER TABLE inventario_interno RENAME COLUMN responsable_usuario TO usu_asig';
      ELSE
        RAISE NOTICE 'Omitido: inventario_interno.usu_asig ya existe, no se renombra responsable_usuario';
      END IF;
    END IF;

    -- Renombrar estado_localizacion -> estado
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'estado_localizacion') THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'estado') THEN
        RAISE NOTICE 'Renombrando inventario_interno.estado_localizacion -> estado';
        EXECUTE 'ALTER TABLE inventario_interno RENAME COLUMN estado_localizacion TO estado';
      ELSE
        RAISE NOTICE 'Omitido: inventario_interno.estado ya existe, no se renombra estado_localizacion';
      END IF;
    END IF;

    -- Añadir columnas nuevas si faltan
    ALTER TABLE inventario_interno ADD COLUMN IF NOT EXISTS fec_fact DATE;
    ALTER TABLE inventario_interno ADD COLUMN IF NOT EXISTS usu_asig VARCHAR(100);

    -- Normalizar valores antiguos de estado a los nuevos: Sin asignar, Localizado, Baja, No Localizado
    -- Mapea 'Localizado Activo' -> 'Localizado', 'Localizado No Activo' -> 'Baja'
    -- Evitar referenciar la columna 'activo' que puede no existir en algunas instalaciones.
    -- Paso 1: mapear variantes conocidas en filas donde 'estado' ya tiene valor
    UPDATE inventario_interno
    SET estado = CASE
      WHEN estado = 'Localizado Activo' THEN 'Localizado'
      WHEN estado = 'Localizado No Activo' THEN 'Baja'
      ELSE estado
    END
    WHERE estado IS NOT NULL;

    -- Paso 2: normalizar valores vacíos o NULL a 'Sin asignar'
    UPDATE inventario_interno
    SET estado = 'Sin asignar'
    WHERE estado IS NULL OR TRIM(estado) = '';

    -- Eliminar constraint antiguo si existiera
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventario_interno_estado_localizacion_check') THEN
      ALTER TABLE inventario_interno DROP CONSTRAINT inventario_interno_estado_localizacion_check;
    END IF;

    -- Añadir nuevo check para estado
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventario_interno_estado_check') THEN
      ALTER TABLE inventario_interno
        ADD CONSTRAINT inventario_interno_estado_check CHECK (estado IN ('Sin asignar', 'Localizado', 'Baja', 'No Localizado'));
    END IF;

    -- Eliminar columnas que quedaron fuera del nuevo esquema
    ALTER TABLE inventario_interno DROP COLUMN IF EXISTS estado_uso;
    ALTER TABLE inventario_interno DROP COLUMN IF EXISTS activo;
    -- Eliminar fecha_elaboracion según solicitud (no se usa en el formulario)
    ALTER TABLE inventario_interno DROP COLUMN IF EXISTS fecha_elaboracion;

    -- Indexes nuevos / renombrados (crear solo si la columna existe)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'folio') THEN
      CREATE INDEX IF NOT EXISTS idx_interno_folio ON inventario_interno(folio);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'clave_patrimonial') THEN
      CREATE INDEX IF NOT EXISTS idx_interno_clave_patrimonial ON inventario_interno(clave_patrimonial);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'cog') THEN
      CREATE INDEX IF NOT EXISTS idx_interno_cog ON inventario_interno(cog);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'ubicacion') THEN
      CREATE INDEX IF NOT EXISTS idx_interno_ubicacion ON inventario_interno(ubicacion);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventario_interno' AND column_name = 'ures_gasto') THEN
      CREATE INDEX IF NOT EXISTS idx_interno_ures_gasto ON inventario_interno(ures_gasto);
    END IF;

  END IF;
END $$;
