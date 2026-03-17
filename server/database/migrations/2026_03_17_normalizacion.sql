-- ================================================================
-- MIGRACIÓN: Normalización completa — InvPatrimonio
-- Fecha: 2026-03-17
-- ================================================================
-- Cambios:
--   1. Tablas de referencia: ubicaciones, dependencias,
--      coordinaciones, empleados
--   2. Tablas hijas: inventario_adquisicion,
--      inventario_datos_fiscales, inventario_imagenes
--   3. Migrar datos de inventario a tablas hijas
--   4. Campo tiene_datos_fiscales + trigger de sincronía
--   5. FK constraints a inventario
--   6. Eliminar columnas migradas + redundantes
--   7. Eliminar stage (columna + trigger + función + constraint)
--   8. Eliminar es_oficial_siia, es_local, es_investigacion
--   9. Corregir bug vw_inventario_sin_asignar
--  10. Actualizar MVs y funciones que usaban costo
-- ================================================================

BEGIN;

-- ================================================================
-- PARTE 1: TABLAS DE REFERENCIA
-- ================================================================

CREATE TABLE IF NOT EXISTS public.ubicaciones (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(200) NOT NULL,
    descripcion TEXT,
    activo      BOOLEAN DEFAULT true,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.dependencias (
    id         SERIAL PRIMARY KEY,
    nombre     VARCHAR(200) NOT NULL,
    clave      VARCHAR(50),
    activo     BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.coordinaciones (
    id             SERIAL PRIMARY KEY,
    nombre         VARCHAR(200) NOT NULL,
    clave          VARCHAR(50),
    dependencia_id INTEGER REFERENCES public.dependencias(id) ON DELETE SET NULL,
    activo         BOOLEAN DEFAULT true,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.empleados (
    id              SERIAL PRIMARY KEY,
    numero_empleado VARCHAR(50) UNIQUE,
    nombre_completo VARCHAR(255) NOT NULL,
    coordinacion_id INTEGER REFERENCES public.coordinaciones(id) ON DELETE SET NULL,
    activo          BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================================
-- PARTE 2: TABLAS HIJAS NORMALIZADAS
-- ================================================================

-- Datos de adquisición
CREATE TABLE IF NOT EXISTS public.inventario_adquisicion (
    inventario_id     INTEGER PRIMARY KEY REFERENCES public.inventario(id) ON DELETE CASCADE,
    proveedor         VARCHAR(255),
    factura           VARCHAR(100),
    fecha_adquisicion DATE,
    costo             NUMERIC(15,2) CHECK (costo >= 0),
    solicitud_compra  VARCHAR(100),
    cuenta_por_pagar  VARCHAR(100),
    valor_actual      NUMERIC(15,2),
    vida_util_anos    INTEGER,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Datos fiscales / patrimoniales
CREATE TABLE IF NOT EXISTS public.inventario_datos_fiscales (
    inventario_id            INTEGER PRIMARY KEY REFERENCES public.inventario(id) ON DELETE CASCADE,
    uuid_fiscal              VARCHAR(100),
    id_patrimonio            VARCHAR(100),
    clave_patrimonial        VARCHAR(100),
    ur                       VARCHAR(100),
    ures_gasto               VARCHAR(100),
    cog                      VARCHAR(100),
    fondo                    VARCHAR(100),
    ejercicio                VARCHAR(20),
    idcon                    VARCHAR(100),
    ures_asignacion          VARCHAR(100),
    recurso                  VARCHAR(100),
    elaboro_nombre           VARCHAR(255),
    fecha_elaboracion        DATE,
    registro_patrimonial     VARCHAR(100),
    registro_interno         VARCHAR(100),
    numero_resguardo_interno VARCHAR(100),
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Imágenes (reemplaza inventario.imagenes jsonb)
CREATE TABLE IF NOT EXISTS public.inventario_imagenes (
    id              SERIAL PRIMARY KEY,
    inventario_id   INTEGER NOT NULL REFERENCES public.inventario(id) ON DELETE CASCADE,
    path            VARCHAR(500) NOT NULL,
    thumbnail_path  VARCHAR(500),
    nombre_original VARCHAR(255),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inv_imagenes_inventario_id
    ON public.inventario_imagenes(inventario_id);

-- ================================================================
-- PARTE 3: MIGRAR DATOS
-- ================================================================

-- Imágenes: jsonb array → inventario_imagenes
INSERT INTO public.inventario_imagenes (inventario_id, path, thumbnail_path, nombre_original)
SELECT
    i.id,
    img->>'path',
    img->>'thumbnail',
    img->>'nombre_original'
FROM public.inventario i,
     jsonb_array_elements(i.imagenes) AS img
WHERE i.imagenes IS NOT NULL
  AND jsonb_array_length(i.imagenes) > 0
  AND (img->>'path') IS NOT NULL;

-- Adquisición
INSERT INTO public.inventario_adquisicion (
    inventario_id, proveedor, factura, fecha_adquisicion,
    costo, solicitud_compra, cuenta_por_pagar,
    valor_actual, vida_util_anos
)
SELECT
    id, proveedor, factura, fecha_adquisicion,
    costo, solicitud_compra, cuenta_por_pagar,
    valor_actual, vida_util_anos
FROM public.inventario
WHERE proveedor IS NOT NULL
   OR factura IS NOT NULL
   OR costo IS NOT NULL
   OR fecha_adquisicion IS NOT NULL
ON CONFLICT DO NOTHING;

-- Datos fiscales
INSERT INTO public.inventario_datos_fiscales (
    inventario_id, uuid_fiscal, id_patrimonio, clave_patrimonial,
    ur, ures_gasto, cog, fondo, ejercicio, idcon, ures_asignacion,
    recurso, elaboro_nombre, fecha_elaboracion,
    registro_patrimonial, registro_interno, numero_resguardo_interno
)
SELECT
    id, uuid_fiscal, id_patrimonio, clave_patrimonial,
    ur, ures_gasto, cog, fondo, ejercicio, idcon, ures_asignacion,
    recurso, elaboro_nombre, fecha_elaboracion,
    registro_patrimonial, registro_interno, numero_resguardo_interno
FROM public.inventario
WHERE uuid_fiscal IS NOT NULL
   OR id_patrimonio IS NOT NULL
   OR registro_patrimonial IS NOT NULL
   OR ur IS NOT NULL
   OR numero_resguardo_interno IS NOT NULL
ON CONFLICT DO NOTHING;

-- ================================================================
-- PARTE 4: tiene_datos_fiscales + TRIGGER DE SINCRONÍA
-- ================================================================

ALTER TABLE public.inventario
    ADD COLUMN IF NOT EXISTS tiene_datos_fiscales BOOLEAN DEFAULT false;

UPDATE public.inventario i
SET tiene_datos_fiscales = true
WHERE EXISTS (
    SELECT 1 FROM public.inventario_adquisicion a
    WHERE a.inventario_id = i.id AND a.proveedor IS NOT NULL
);

CREATE OR REPLACE FUNCTION public.sync_tiene_datos_fiscales()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE public.inventario SET tiene_datos_fiscales = false WHERE id = OLD.inventario_id;
        RETURN OLD;
    ELSE
        UPDATE public.inventario
        SET tiene_datos_fiscales = (NEW.proveedor IS NOT NULL)
        WHERE id = NEW.inventario_id;
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS sync_adquisicion_flag ON public.inventario_adquisicion;
CREATE TRIGGER sync_adquisicion_flag
AFTER INSERT OR UPDATE OR DELETE ON public.inventario_adquisicion
FOR EACH ROW EXECUTE FUNCTION public.sync_tiene_datos_fiscales();

-- ================================================================
-- PARTE 5: FK CONSTRAINTS A INVENTARIO
-- ================================================================

ALTER TABLE public.inventario
    ADD CONSTRAINT fk_inventario_ubicacion
        FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_inventario_dependencia
        FOREIGN KEY (dependencia_id) REFERENCES public.dependencias(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_inventario_coordinacion
        FOREIGN KEY (coordinacion_id) REFERENCES public.coordinaciones(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_inventario_empleado
        FOREIGN KEY (empleado_resguardante_id) REFERENCES public.empleados(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_inventario_responsable
        FOREIGN KEY (responsable_entrega_id) REFERENCES public.empleados(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_inventario_created_by
        FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_inventario_updated_by
        FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- ================================================================
-- PARTE 6: ELIMINAR COLUMNAS MIGRADAS Y REDUNDANTES
-- ================================================================

-- Eliminar vistas y MVs que dependen de columnas que se van a dropear
DROP VIEW IF EXISTS public.vw_inventario_activo;
DROP VIEW IF EXISTS public.vw_inventario_sin_asignar;
DROP MATERIALIZED VIEW IF EXISTS public.mv_inventario_dashboard CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_inventario_por_tipo CASCADE;

ALTER TABLE public.inventario DROP CONSTRAINT IF EXISTS check_costo_positivo;

ALTER TABLE public.inventario
    -- Texto libre duplicado por ubicacion_id FK
    DROP COLUMN IF EXISTS ubicacion,
    -- Redundante: viene del JOIN con empleados
    DROP COLUMN IF EXISTS numero_empleado,
    DROP COLUMN IF EXISTS usu_asig,
    -- Sin referencias en el backend activo
    DROP COLUMN IF EXISTS descripcion_bien,
    DROP COLUMN IF EXISTS valor_actual,
    DROP COLUMN IF EXISTS vida_util_anos,
    -- Movidas a inventario_adquisicion
    DROP COLUMN IF EXISTS proveedor,
    DROP COLUMN IF EXISTS factura,
    DROP COLUMN IF EXISTS fecha_adquisicion,
    DROP COLUMN IF EXISTS costo,
    DROP COLUMN IF EXISTS solicitud_compra,
    DROP COLUMN IF EXISTS cuenta_por_pagar,
    -- Movidas a inventario_datos_fiscales
    DROP COLUMN IF EXISTS uuid_fiscal,
    DROP COLUMN IF EXISTS id_patrimonio,
    DROP COLUMN IF EXISTS clave_patrimonial,
    DROP COLUMN IF EXISTS ur,
    DROP COLUMN IF EXISTS ures_gasto,
    DROP COLUMN IF EXISTS cog,
    DROP COLUMN IF EXISTS fondo,
    DROP COLUMN IF EXISTS ejercicio,
    DROP COLUMN IF EXISTS idcon,
    DROP COLUMN IF EXISTS ures_asignacion,
    DROP COLUMN IF EXISTS recurso,
    DROP COLUMN IF EXISTS elaboro_nombre,
    DROP COLUMN IF EXISTS fecha_elaboracion,
    DROP COLUMN IF EXISTS registro_patrimonial,
    DROP COLUMN IF EXISTS registro_interno,
    DROP COLUMN IF EXISTS numero_resguardo_interno,
    -- Reemplazada por inventario_imagenes
    DROP COLUMN IF EXISTS imagenes;

-- ================================================================
-- PARTE 7: ELIMINAR stage
-- ================================================================

DROP TRIGGER IF EXISTS trigger_actualizar_stage ON public.inventario;
DROP FUNCTION IF EXISTS public.actualizar_stage_inventario();
ALTER TABLE public.inventario DROP CONSTRAINT IF EXISTS check_stage;
ALTER TABLE public.inventario DROP COLUMN IF EXISTS stage;

-- ================================================================
-- PARTE 8: ELIMINAR BOOLEANOS NO USADOS
-- ================================================================

ALTER TABLE public.inventario
    DROP COLUMN IF EXISTS es_oficial_siia,
    DROP COLUMN IF EXISTS es_local,
    DROP COLUMN IF EXISTS es_investigacion;

-- ================================================================
-- PARTE 9: CORREGIR BUGS
-- ================================================================

-- Bug: estado_uso = 'operativo' no existe en check_estado_uso
CREATE OR REPLACE VIEW public.vw_inventario_sin_asignar AS
SELECT
    i.id, i.folio, i.numero_patrimonio,
    i.marca, i.modelo, i.estado_uso, i.created_at
FROM public.inventario i
WHERE i.empleado_resguardante_id IS NULL
  AND i.estado_uso != 'baja'
ORDER BY i.created_at DESC;

-- Bug: vw_inventario_activo usaba costo directo de inventario
CREATE OR REPLACE VIEW public.vw_inventario_activo AS
SELECT
    i.id, i.folio, i.numero_patrimonio,
    i.marca, i.modelo, i.descripcion,
    i.tipo_inventario, i.estado_uso,
    i.coordinacion_id, i.empleado_resguardante_id, i.ubicacion_id,
    a.costo,
    i.created_at
FROM public.inventario i
LEFT JOIN public.inventario_adquisicion a ON a.inventario_id = i.id
WHERE i.estado_uso != 'baja'
  AND i.estatus_validacion = 'validado'
ORDER BY i.created_at DESC;

-- ================================================================
-- PARTE 10: ACTUALIZAR MVs Y FUNCIONES (costo ahora en JOIN)
-- ================================================================

DROP MATERIALIZED VIEW IF EXISTS public.mv_inventario_dashboard CASCADE;
CREATE MATERIALIZED VIEW public.mv_inventario_dashboard AS
SELECT
    count(*)                                                    AS total_registros,
    count(*) FILTER (WHERE i.tipo_inventario = 'INTERNO')      AS total_interno,
    count(*) FILTER (WHERE i.tipo_inventario = 'EXTERNO')      AS total_externo,
    count(*) FILTER (WHERE i.estado_uso = 'bueno')             AS estado_bueno,
    count(*) FILTER (WHERE i.estado_uso = 'regular')           AS estado_regular,
    count(*) FILTER (WHERE i.estado_uso = 'malo')              AS estado_malo,
    count(*) FILTER (WHERE i.estado_uso = 'baja')              AS estado_baja,
    count(*) FILTER (WHERE i.estatus_validacion = 'validado')  AS validados,
    count(*) FILTER (WHERE i.estatus_validacion = 'borrador')  AS borradores,
    count(*) FILTER (WHERE i.estatus_validacion = 'revision')  AS en_revision,
    count(*) FILTER (WHERE i.estatus_validacion = 'rechazado') AS rechazados,
    sum(COALESCE(a.costo, 0))                                   AS valor_total_inventario,
    avg(COALESCE(a.costo, 0))                                   AS costo_promedio,
    max(i.created_at)                                           AS ultimo_registro,
    min(i.created_at)                                           AS primer_registro,
    count(DISTINCT i.coordinacion_id)                          AS coordinaciones_activas,
    count(DISTINCT i.empleado_resguardante_id)                 AS empleados_con_equipo,
    count(DISTINCT i.ubicacion_id)                             AS ubicaciones_utilizadas
FROM public.inventario i
LEFT JOIN public.inventario_adquisicion a ON a.inventario_id = i.id
WITH NO DATA;

CREATE UNIQUE INDEX mv_dashboard_refresh_idx
    ON public.mv_inventario_dashboard ((1));

DROP MATERIALIZED VIEW IF EXISTS public.mv_inventario_por_tipo CASCADE;
CREATE MATERIALIZED VIEW public.mv_inventario_por_tipo AS
SELECT
    i.tipo_inventario,
    count(*)                                           AS total_items,
    count(*) FILTER (WHERE i.estado_uso = 'bueno')    AS buenos,
    count(*) FILTER (WHERE i.estado_uso = 'regular')  AS regulares,
    count(*) FILTER (WHERE i.estado_uso = 'malo')     AS malos,
    count(*) FILTER (WHERE i.estado_uso = 'baja')     AS baja,
    sum(COALESCE(a.costo, 0))                          AS valor_total,
    avg(COALESCE(a.costo, 0))                          AS costo_promedio,
    max(i.created_at)                                  AS ultimo_registro
FROM public.inventario i
LEFT JOIN public.inventario_adquisicion a ON a.inventario_id = i.id
WHERE i.tipo_inventario IS NOT NULL
GROUP BY i.tipo_inventario
WITH NO DATA;

CREATE UNIQUE INDEX mv_tipo_refresh_idx
    ON public.mv_inventario_por_tipo (tipo_inventario);

-- get_inventario_paginado: costo desde JOIN
CREATE OR REPLACE FUNCTION public.get_inventario_paginado(
    cursor_created      timestamp without time zone DEFAULT NULL,
    cursor_id           integer DEFAULT NULL,
    page_size           integer DEFAULT 50,
    filter_tipo         character varying DEFAULT NULL,
    filter_estado       character varying DEFAULT NULL,
    filter_coordinacion integer DEFAULT NULL,
    search_term         text DEFAULT NULL
) RETURNS TABLE(
    id                       integer,
    folio                    character varying,
    descripcion              text,
    marca                    character varying,
    modelo                   character varying,
    numero_serie             character varying,
    tipo_inventario          character varying,
    estado_uso               character varying,
    created_at               timestamp without time zone,
    costo                    numeric,
    coordinacion_id          integer,
    empleado_resguardante_id integer,
    ubicacion_id             integer
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id, i.folio, i.descripcion, i.marca, i.modelo, i.numero_serie,
    i.tipo_inventario, i.estado_uso, i.created_at, a.costo,
    i.coordinacion_id, i.empleado_resguardante_id, i.ubicacion_id
  FROM public.inventario i
  LEFT JOIN public.inventario_adquisicion a ON a.inventario_id = i.id
  WHERE
    (cursor_created IS NULL OR cursor_id IS NULL OR
     (i.created_at, i.id) < (cursor_created, cursor_id))
    AND (filter_tipo IS NULL OR i.tipo_inventario = filter_tipo)
    AND (filter_estado IS NULL OR i.estado_uso = filter_estado)
    AND (filter_coordinacion IS NULL OR i.coordinacion_id = filter_coordinacion)
    AND (search_term IS NULL OR search_term = '' OR
         LOWER(COALESCE(i.descripcion, ''))    LIKE LOWER('%' || search_term || '%') OR
         LOWER(COALESCE(i.marca::text, ''))    LIKE LOWER('%' || search_term || '%') OR
         LOWER(COALESCE(i.modelo::text, ''))   LIKE LOWER('%' || search_term || '%') OR
         LOWER(COALESCE(i.folio::text, ''))    LIKE LOWER('%' || search_term || '%') OR
         LOWER(COALESCE(i.numero_serie::text,'')) LIKE LOWER('%' || search_term || '%'))
  ORDER BY i.created_at DESC, i.id DESC
  LIMIT page_size;
END;
$$;

-- buscar_inventario_texto: sin cambios de lógica, limpiar encoding roto
CREATE OR REPLACE FUNCTION public.buscar_inventario_texto(
    search_text   text,
    limit_result  integer DEFAULT 50,
    offset_result integer DEFAULT 0
) RETURNS TABLE(
    id              integer,
    folio           character varying,
    descripcion     text,
    marca           character varying,
    modelo          character varying,
    numero_serie    character varying,
    tipo_inventario character varying,
    estado_uso      character varying,
    relevancia      real
) LANGUAGE plpgsql AS $$
BEGIN
  IF search_text IS NULL OR trim(search_text) = '' THEN
    RETURN QUERY
    SELECT i.id, i.folio, i.descripcion, i.marca, i.modelo,
           i.numero_serie, i.tipo_inventario, i.estado_uso,
           1.0::real AS relevancia
    FROM public.inventario i
    ORDER BY i.created_at DESC
    LIMIT limit_result OFFSET offset_result;
  ELSE
    RETURN QUERY
    SELECT i.id, i.folio, i.descripcion, i.marca, i.modelo,
           i.numero_serie, i.tipo_inventario, i.estado_uso,
           ts_rank(
             to_tsvector('spanish',
               COALESCE(i.descripcion, '')       || ' ' ||
               COALESCE(i.marca::text, '')       || ' ' ||
               COALESCE(i.modelo::text, '')      || ' ' ||
               COALESCE(i.numero_serie::text,'') || ' ' ||
               COALESCE(i.folio::text, '')
             ),
             to_tsquery('spanish', search_text || ':*')
           ) AS relevancia
    FROM public.inventario i
    WHERE to_tsvector('spanish',
      COALESCE(i.descripcion, '')       || ' ' ||
      COALESCE(i.marca::text, '')       || ' ' ||
      COALESCE(i.modelo::text, '')      || ' ' ||
      COALESCE(i.numero_serie::text,'') || ' ' ||
      COALESCE(i.folio::text, '')
    ) @@ to_tsquery('spanish', search_text || ':*')
    ORDER BY relevancia DESC, i.created_at DESC
    LIMIT limit_result OFFSET offset_result;
  END IF;
END;
$$;

SELECT public.refresh_all_views_safe();

COMMIT;
