-- =====================================================
-- MIGRACION 007: Convertir columnas CHARACTER VARYING / CHARACTER a VARCHAR(512)
-- - Recorre todas las tablas del esquema `public`
-- - Convierte columnas `character varying` o `character` a `character varying(512)`
-- - Trunca valores a 512 caracteres con `LEFT(...,512)` para evitar fallos
-- - Registra `NOTICE` para cada columna convertida o en caso de error
-- Nota: Haz un backup antes de ejecutar en producción.
-- =====================================================

DO $$
DECLARE
  rec RECORD;
  stmt TEXT;
BEGIN
  FOR rec IN
    SELECT table_schema, table_name, column_name, data_type, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('character varying','character')
  LOOP
    BEGIN
      IF rec.character_maximum_length IS NOT NULL AND rec.character_maximum_length = 512 THEN
        RAISE NOTICE 'Skipping %I.%I.%I: already VARCHAR(512)', rec.table_schema, rec.table_name, rec.column_name;
      ELSE
        stmt := format(
          'ALTER TABLE %I.%I ALTER COLUMN %I TYPE character varying(512) USING LEFT(COALESCE(%I::text, ''), 512)',
          rec.table_schema, rec.table_name, rec.column_name, rec.column_name
        );
        EXECUTE stmt;
        RAISE NOTICE '%', format('Converted %I.%I.%I to VARCHAR(512) (from %s, length=%s)', rec.table_schema, rec.table_name, rec.column_name, rec.data_type, COALESCE(rec.character_maximum_length::text, 'NULL'));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '%', format('Skipping %I.%I.%I: %s', rec.table_schema, rec.table_name, rec.column_name, SQLERRM);
    END;
  END LOOP;
END
$$;
