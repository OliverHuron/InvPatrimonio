-- =====================================================
-- ESQUEMA UNIFICADO SIAF - ESTRUCTURA COMPLETA
-- Base de datos completa para desarrollo y producción
-- =====================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================
-- TABLA PRINCIPAL: INVENTARIO (ESQUEMA SIAF COMPLETO)
-- =====================================================

-- Crear secuencia si no existe
CREATE SEQUENCE IF NOT EXISTS inventario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Tabla principal inventario
CREATE TABLE IF NOT EXISTS inventario (
    -- Identificadores principales
    id integer NOT NULL DEFAULT nextval('inventario_id_seq'::regclass),
    folio character varying(50),
    numero_patrimonio character varying(50),
    numero_serie character varying(100),
    numero_inventario character varying(100),
    uuid character varying(100),
    uuid_fiscal character varying(100),
    
    -- Información básica del bien
    marca character varying(100),
    modelo character varying(100),
    descripcion text,
    descripcion_bien text,
    tipo_bien character varying(100),
    
    -- Estado y ubicación
    estado character varying(50) DEFAULT 'buena'::character varying NOT NULL,
    estado_uso character varying(50) DEFAULT 'operativo'::character varying,
    ubicacion character varying(200),
    ubicacion_id integer,
    ubicacion_especifica character varying(255),
    
    -- Organización SIAF
    dependencia_id integer,
    coordinacion_id integer,
    stage character varying(50) DEFAULT 'COMPLETO'::character varying,
    estatus_validacion character varying(50) DEFAULT 'borrador'::character varying,
    tipo_inventario character varying(20),
    
    -- Flags SIAF
    es_oficial_siia boolean DEFAULT false,
    es_local boolean DEFAULT true,
    es_investigacion boolean DEFAULT false,
    
    -- Información financiera
    costo numeric(12,2),
    cog character varying(50),
    factura character varying(100),
    numero_factura character varying(100),
    fondo character varying(255),
    cuenta_por_pagar character varying(100),
    proveedor character varying(200),
    
    -- Fechas importantes
    fecha_adquisicion date,
    fecha_compra date,
    fecha_factura date,
    fecha_recepcion timestamp without time zone,
    fecha_envio timestamp without time zone,
    fecha_registro date,
    fecha_asignacion date,
    fecha_elaboracion date,
    fecha_baja date,
    
    -- Depreciación y vida útil
    vida_util_anios integer DEFAULT 5,
    depreciacion_anual numeric(12,2),
    valor_actual numeric(12,2),
    
    -- Mantenimiento y garantía
    ultimo_mantenimiento date,
    proximo_mantenimiento date,
    garantia_meses integer,
    
    -- Responsables y asignaciones
    empleado_resguardante_id integer,
    usuario_asignado_id integer,
    numero_resguardo_interno character varying(50),
    enviado_por integer,
    recibido_por integer,
    responsable_entrega_id integer,
    numero_empleado character varying(50),
    elaboro_nombre character varying(200),
    usu_asig character varying(200),
    
    -- Registros patrimoniales gubernamentales
    registro_patrimonial character varying(100),
    registro_interno character varying(100),
    id_patrimonio character varying(100),
    clave_patrimonial character varying(100),
    
    -- Controles presupuestales SIAF
    ures_asignacion character varying(100),
    ures_gasto character varying(100),
    recurso character varying(100),
    ur character varying(100),
    ejercicio character varying(10),
    solicitud_compra character varying(100),
    idcon character varying(50),
    
    -- Documentación y multimedia
    foto_url character varying(500),
    documento_adjunto_url character varying(500),
    imagenes jsonb DEFAULT '[]'::jsonb,
    
    -- Observaciones
    comentarios text,
    observaciones_tecnicas text,
    motivo_baja text,
    
    -- Timestamps
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT inventario_pkey PRIMARY KEY (id),
    CONSTRAINT inventario_estado_uso_check CHECK (((estado_uso)::text = ANY ((ARRAY['operativo'::character varying, 'en_reparacion'::character varying, 'de_baja'::character varying, 'obsoleto'::character varying, 'resguardo_temporal'::character varying])::text[]))),
    CONSTRAINT inventario_estatus_validacion_check CHECK (((estatus_validacion)::text = ANY ((ARRAY['borrador'::character varying, 'revision'::character varying, 'validado'::character varying, 'rechazado'::character varying])::text[]))),
    CONSTRAINT inventario_stage_check CHECK (((stage)::text = ANY ((ARRAY['FISCAL'::character varying, 'EN_TRANSITO'::character varying, 'FISICO'::character varying, 'COMPLETO'::character varying, 'PENDIENTE_FISCAL'::character varying])::text[]))),
    CONSTRAINT inventario_tipo_inventario_check CHECK (((tipo_inventario)::text = ANY ((ARRAY['INTERNO'::character varying, 'EXTERNO'::character varying])::text[])))
);

-- =====================================================
-- ÍNDICES OPTIMIZADOS
-- =====================================================

-- Índices principales
CREATE INDEX IF NOT EXISTS inventario_numero_patrimonio_idx ON inventario USING btree (numero_patrimonio);
CREATE INDEX IF NOT EXISTS inventario_numero_serie_idx ON inventario USING btree (numero_serie);
CREATE INDEX IF NOT EXISTS inventario_folio_idx ON inventario USING btree (folio);
CREATE INDEX IF NOT EXISTS inventario_estado_idx ON inventario USING btree (estado);
CREATE INDEX IF NOT EXISTS inventario_estado_uso_idx ON inventario USING btree (estado_uso);
CREATE INDEX IF NOT EXISTS inventario_ubicacion_idx ON inventario USING btree (ubicacion);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS inventario_marca_modelo_idx ON inventario USING btree (marca, modelo);
CREATE INDEX IF NOT EXISTS inventario_stage_idx ON inventario USING btree (stage);
CREATE INDEX IF NOT EXISTS inventario_estatus_validacion_idx ON inventario USING btree (estatus_validacion);
CREATE INDEX IF NOT EXISTS inventario_cog_idx ON inventario USING btree (cog);

-- Índices para relaciones SIAF
CREATE INDEX IF NOT EXISTS inventario_coordinacion_id_idx ON inventario USING btree (coordinacion_id);
CREATE INDEX IF NOT EXISTS inventario_dependencia_id_idx ON inventario USING btree (dependencia_id);
CREATE INDEX IF NOT EXISTS inventario_empleado_resguardante_idx ON inventario USING btree (empleado_resguardante_id);

-- Índices para fechas y temporales
CREATE INDEX IF NOT EXISTS inventario_updated_at_idx ON inventario USING btree (updated_at);
CREATE INDEX IF NOT EXISTS inventario_fecha_adquisicion_idx ON inventario USING btree (fecha_adquisicion);
CREATE INDEX IF NOT EXISTS inventario_created_at_idx ON inventario USING btree (created_at);

-- Índices para búsqueda de texto
CREATE INDEX IF NOT EXISTS inventario_descripcion_trgm_idx ON inventario USING gin (descripcion gin_trgm_ops);
CREATE INDEX IF NOT EXISTS inventario_marca_trgm_idx ON inventario USING gin (marca gin_trgm_ops);

-- =====================================================
-- FUNCIONES Y TRIGGERS SIAF
-- =====================================================

-- Función para actualizar stage automáticamente
CREATE OR REPLACE FUNCTION actualizar_stage_inventario() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Si tiene datos fiscales Y físicos (numero_serie) → COMPLETO
  IF NEW.proveedor IS NOT NULL AND NEW.numero_serie IS NOT NULL THEN
    NEW.stage := 'COMPLETO';
  
  -- Si solo tiene fiscal y hay coordinacion_id → EN_TRANSITO
  ELSIF NEW.proveedor IS NOT NULL AND NEW.numero_serie IS NULL AND NEW.coordinacion_id IS NOT NULL THEN
    NEW.stage := 'EN_TRANSITO';
  
  -- Si solo tiene fiscal sin coordinacion → FISCAL
  ELSIF NEW.proveedor IS NOT NULL AND NEW.numero_serie IS NULL THEN
    NEW.stage := 'FISCAL';
  
  -- Si solo tiene físico (serie) → PENDIENTE_FISCAL
  ELSIF NEW.numero_serie IS NOT NULL AND NEW.proveedor IS NULL THEN
    NEW.stage := 'PENDIENTE_FISCAL';
  
  -- Si tiene físico y ya fue recibido → FISICO
  ELSIF NEW.numero_serie IS NOT NULL AND NEW.fecha_recepcion IS NOT NULL THEN
    NEW.stage := 'FISICO';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Función para generar folio automático
CREATE OR REPLACE FUNCTION generar_folio_inventario() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    anio_actual INTEGER;
    secuencia INTEGER;
BEGIN
    -- Si ya tiene folio, no hacer nada
    IF NEW.folio IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    -- Obtener año actual
    anio_actual := EXTRACT(year FROM CURRENT_DATE);
    
    -- Obtener siguiente secuencia para este año
    SELECT COALESCE(MAX(CAST(SPLIT_PART(folio, '-', 2) AS INTEGER)), 0) + 1 
    INTO secuencia
    FROM inventario 
    WHERE folio LIKE CAST(anio_actual AS TEXT) || '-%';
    
    -- Generar folio con formato YYYY-NNNN
    NEW.folio := CAST(anio_actual AS TEXT) || '-' || LPAD(CAST(secuencia AS TEXT), 4, '0');
    
    RETURN NEW;
END;
$$;

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Eliminar triggers existentes si existen
DROP TRIGGER IF EXISTS trigger_actualizar_stage ON inventario;
DROP TRIGGER IF EXISTS trigger_generar_folio ON inventario;
DROP TRIGGER IF EXISTS trigger_updated_at ON inventario;

-- Crear triggers
CREATE TRIGGER trigger_actualizar_stage 
    BEFORE INSERT OR UPDATE ON inventario 
    FOR EACH ROW EXECUTE FUNCTION actualizar_stage_inventario();

CREATE TRIGGER trigger_generar_folio 
    BEFORE INSERT ON inventario 
    FOR EACH ROW EXECUTE FUNCTION generar_folio_inventario();

CREATE TRIGGER trigger_updated_at 
    BEFORE UPDATE ON inventario 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- VISTAS ÚTILES SIAF
-- =====================================================

-- Vista resumen de inventario
CREATE OR REPLACE VIEW inventario_resumen AS
SELECT 
    id,
    folio,
    numero_patrimonio,
    marca,
    modelo,
    descripcion,
    estado,
    estado_uso,
    ubicacion,
    costo,
    stage,
    estatus_validacion,
    fecha_adquisicion,
    created_at,
    updated_at
FROM inventario
ORDER BY updated_at DESC;

-- Vista estadísticas por stage
CREATE OR REPLACE VIEW stats_por_stage AS
SELECT 
    stage,
    COUNT(*) as cantidad,
    COALESCE(SUM(costo), 0) as valor_total,
    AVG(costo) as promedio_costo
FROM inventario 
GROUP BY stage
ORDER BY cantidad DESC;

-- Vista equipos sin asignar
CREATE OR REPLACE VIEW equipos_sin_asignar AS
SELECT 
    id,
    folio,
    numero_patrimonio,
    marca,
    modelo,
    ubicacion,
    estado,
    created_at
FROM inventario 
WHERE empleado_resguardante_id IS NULL 
   AND estado_uso = 'operativo'
ORDER BY created_at DESC;

-- =====================================================
-- TABLA DE MIGRACIONES (CONTROL DE VERSIONES)
-- =====================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version character varying(255) NOT NULL PRIMARY KEY,
    applied_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- Insertar versión actual
INSERT INTO schema_migrations (version) 
VALUES ('2024_02_02_siaf_completo') 
ON CONFLICT (version) DO NOTHING;

-- =====================================================
-- PERMISOS
-- =====================================================

-- Crear usuario si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'siaf_admin') THEN
        CREATE USER siaf_admin WITH PASSWORD 'siaf2024_secure!';
    END IF;
END
$$;

-- Dar permisos
GRANT ALL PRIVILEGES ON DATABASE patrimonio_db TO siaf_admin;
GRANT ALL PRIVILEGES ON TABLE inventario TO siaf_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO siaf_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO siaf_admin;

-- =====================================================
-- COMENTARIOS DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE inventario IS 'Gestión completa de inventario con esquema SIAF';
COMMENT ON COLUMN inventario.numero_patrimonio IS 'Número de patrimonio único del artículo';
COMMENT ON COLUMN inventario.numero_serie IS 'Número de serie del fabricante';
COMMENT ON COLUMN inventario.stage IS 'Etapa del workflow SIAF: FISCAL → EN_TRANSITO → FISICO → COMPLETO';
COMMENT ON COLUMN inventario.folio IS 'Folio autogenerado formato YYYY-NNNN';
COMMENT ON COLUMN inventario.estatus_validacion IS 'Control de validación: borrador → revision → validado → rechazado';

-- Mensaje de finalización
SELECT 'Esquema SIAF unificado aplicado exitosamente!' as resultado;