-- =====================================================
-- SIAF → InvPatrimonio: Super Optimización PostgreSQL
-- Arquitecto: Sistema Administrativo FCCA-UMSNH
-- Versión: 2.0 Optimizada
-- Fecha: Febrero 2026
-- =====================================================

-- =====================================================
-- 1. EXTENSIONES Y CONFIGURACIÓN INICIAL
-- =====================================================

-- Extensiones ya verificadas como activas
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Configuración optimizada para inventario
SET work_mem = '256MB';
SET maintenance_work_mem = '1GB';
SET effective_cache_size = '4GB';

-- =====================================================
-- 2. TABLA INVENTARIO OPTIMIZADA
-- =====================================================

DROP TABLE IF EXISTS inventario CASCADE;

CREATE TABLE inventario (
    -- Identificadores únicos
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid(),
    folio VARCHAR(50) UNIQUE,
    
    -- Información patrimonial (campos más críticos primero)
    numero_patrimonio VARCHAR(50),
    numero_serie VARCHAR(100),
    clave_patrimonial VARCHAR(100),
    registro_patrimonial VARCHAR(100),
    
    -- Información básica del bien
    descripcion TEXT NOT NULL,
    marca VARCHAR(100),
    modelo VARCHAR(100),
    tipo_bien VARCHAR(100),
    
    -- Relaciones críticas
    coordinacion_id INTEGER NOT NULL,
    dependencia_id INTEGER,
    empleado_resguardante_id INTEGER,
    usuario_asignado_id INTEGER,
    
    -- Información fiscal y financiera
    costo NUMERIC(15,4) NOT NULL CHECK (costo >= 0), -- Aumentamos precisión
    valor_actual NUMERIC(15,4) CHECK (valor_actual >= 0),
    depreciacion_anual NUMERIC(15,4) CHECK (depreciacion_anual >= 0),
    vida_util_anios INTEGER DEFAULT 5 CHECK (vida_util_anios > 0),
    
    -- Información del proveedor
    proveedor VARCHAR(200),
    factura VARCHAR(100),
    numero_factura VARCHAR(100),
    fondo VARCHAR(255),
    cuenta_por_pagar VARCHAR(100),
    
    -- Estados y clasificaciones
    stage VARCHAR(20) DEFAULT 'PENDIENTE' 
        CHECK (stage IN ('FISCAL', 'FISICO', 'EN_TRANSITO', 'COMPLETO', 'PENDIENTE_FISCAL', 'PENDIENTE')),
    estado VARCHAR(20) DEFAULT 'disponible'
        CHECK (estado IN ('disponible', 'en_uso', 'mantenimiento', 'baja', 'reservado')),
    estado_uso VARCHAR(20) DEFAULT 'operativo'
        CHECK (estado_uso IN ('operativo', 'regular', 'deficiente', 'inservible')),
    estatus_validacion VARCHAR(20) DEFAULT 'borrador'
        CHECK (estatus_validacion IN ('borrador', 'validado', 'rechazado', 'en_revision')),
    
    -- Ubicación y asignación
    ubicacion VARCHAR(200),
    numero_resguardo_interno VARCHAR(50),
    
    -- Clasificaciones
    es_oficial_siia BOOLEAN DEFAULT false,
    es_local BOOLEAN DEFAULT true,
    es_investigacion BOOLEAN DEFAULT false,
    
    -- Fechas críticas
    fecha_adquisicion DATE,
    fecha_compra DATE,
    fecha_envio TIMESTAMP WITH TIME ZONE,
    fecha_recepcion TIMESTAMP WITH TIME ZONE,
    fecha_baja DATE,
    
    -- Mantenimiento y garantía
    ultimo_mantenimiento DATE,
    proximo_mantenimiento DATE,
    garantia_meses INTEGER CHECK (garantia_meses >= 0),
    
    -- Información adicional
    comentarios TEXT,
    motivo_baja TEXT,
    observaciones_tecnicas TEXT,
    
    -- Recursos y ejercicio fiscal
    recurso VARCHAR(100),
    ur VARCHAR(100),
    ures_asignacion VARCHAR(100),
    ures_gasto VARCHAR(100),
    ejercicio VARCHAR(10),
    
    -- Personal relacionado
    enviado_por INTEGER,
    recibido_por INTEGER,
    elaboro_nombre VARCHAR(200),
    fecha_elaboracion DATE,
    
    -- Archivos y documentos (OPTIMIZADO)
    documentos_adjuntos JSONB DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(documentos_adjuntos) = 'array'),
    imagenes JSONB DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(imagenes) = 'array'),
    
    -- Campos de auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,
    
    -- Constraint para patrimonio único cuando no es nulo
    CONSTRAINT uq_numero_patrimonio UNIQUE (numero_patrimonio) 
        DEFERRABLE INITIALLY DEFERRED,
    
    -- Constraint para serie única cuando no es nulo
    CONSTRAINT uq_numero_serie UNIQUE (numero_serie) 
        DEFERRABLE INITIALLY DEFERRED,
        
    -- Validación de fechas lógicas
    CONSTRAINT ck_fechas_logicas CHECK (
        fecha_envio IS NULL OR fecha_recepcion IS NULL OR fecha_envio <= fecha_recepcion
    ),
    
    -- Validación de mantenimiento
    CONSTRAINT ck_mantenimiento_logico CHECK (
        ultimo_mantenimiento IS NULL OR proximo_mantenimiento IS NULL 
        OR ultimo_mantenimiento <= proximo_mantenimiento
    )
);

-- =====================================================
-- 3. ÍNDICES SUPER OPTIMIZADOS
-- =====================================================

-- Índices únicos parciales para evitar conflictos con NULLs
DROP INDEX IF EXISTS idx_inventario_numero_patrimonio_unique;
CREATE UNIQUE INDEX idx_inventario_numero_patrimonio_unique 
ON inventario (numero_patrimonio) 
WHERE numero_patrimonio IS NOT NULL AND numero_patrimonio != '';

DROP INDEX IF EXISTS idx_inventario_numero_serie_unique;
CREATE UNIQUE INDEX idx_inventario_numero_serie_unique 
ON inventario (numero_serie) 
WHERE numero_serie IS NOT NULL AND numero_serie != '';

-- Índices compuestos para consultas más frecuentes
CREATE INDEX idx_inventario_stage_coordinacion_optim 
ON inventario (stage, coordinacion_id) 
WHERE stage IN ('EN_TRANSITO', 'PENDIENTE_FISCAL');

CREATE INDEX idx_inventario_estado_dependencia_fecha 
ON inventario (estado, dependencia_id, created_at DESC) 
WHERE estado IN ('disponible', 'en_uso');

-- Índices GIN optimizados para búsqueda de texto completo
CREATE INDEX idx_inventario_descripcion_gin_optim 
ON inventario USING gin (to_tsvector('spanish', descripcion));

CREATE INDEX idx_inventario_marca_modelo_gin 
ON inventario USING gin (to_tsvector('spanish', coalesce(marca, '') || ' ' || coalesce(modelo, '')));

-- Índices para JSONB con operadores específicos
CREATE INDEX idx_inventario_imagenes_gin 
ON inventario USING gin (imagenes) 
WHERE jsonb_array_length(imagenes) > 0;

CREATE INDEX idx_inventario_documentos_gin 
ON inventario USING gin (documentos_adjuntos) 
WHERE jsonb_array_length(documentos_adjuntos) > 0;

-- Índices para consultas de rendimiento financiero
CREATE INDEX idx_inventario_costo_fecha_adquisicion 
ON inventario (fecha_adquisicion DESC, costo DESC) 
WHERE costo > 0;

-- Índice para auditoría y trazabilidad
CREATE INDEX idx_inventario_updated_at_user 
ON inventario (updated_at DESC, updated_by) 
WHERE updated_by IS NOT NULL;

-- Índice para consultas de coordinación específicas (RLS)
CREATE INDEX idx_inventario_coordinacion_estado_stage 
ON inventario (coordinacion_id, estado, stage);

-- =====================================================
-- 4. FUNCIÓN OPTIMIZADA PARA ACTUALIZAR STAGE
-- =====================================================

DROP FUNCTION IF EXISTS actualizar_stage_inventario() CASCADE;

CREATE OR REPLACE FUNCTION actualizar_stage_inventario()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    -- Validaciones iniciales para evitar datos inconsistentes
    IF NEW IS NULL THEN
        RAISE EXCEPTION 'NEW record cannot be NULL';
    END IF;

    -- Normalizar campos de texto para evitar problemas con espacios
    NEW.proveedor = NULLIF(TRIM(NEW.proveedor), '');
    NEW.numero_serie = NULLIF(TRIM(NEW.numero_serie), '');

    -- Lógica de stage optimizada con CASE más eficiente
    NEW.stage = CASE
        -- COMPLETO: Tiene datos fiscales Y físicos
        WHEN NEW.proveedor IS NOT NULL 
             AND NEW.numero_serie IS NOT NULL 
             AND LENGTH(NEW.proveedor) > 0
             AND LENGTH(NEW.numero_serie) > 0
        THEN 'COMPLETO'
        
        -- EN_TRANSITO: Solo fiscal + coordinación asignada
        WHEN NEW.proveedor IS NOT NULL 
             AND LENGTH(NEW.proveedor) > 0
             AND (NEW.numero_serie IS NULL OR LENGTH(NEW.numero_serie) = 0)
             AND NEW.coordinacion_id IS NOT NULL
        THEN 'EN_TRANSITO'
        
        -- FISCAL: Solo datos de proveedor sin coordinación
        WHEN NEW.proveedor IS NOT NULL 
             AND LENGTH(NEW.proveedor) > 0
             AND (NEW.numero_serie IS NULL OR LENGTH(NEW.numero_serie) = 0)
             AND NEW.coordinacion_id IS NULL
        THEN 'FISCAL'
        
        -- FISICO: Tiene número de serie y fecha de recepción
        WHEN NEW.numero_serie IS NOT NULL 
             AND LENGTH(NEW.numero_serie) > 0
             AND NEW.fecha_recepcion IS NOT NULL
             AND (NEW.proveedor IS NULL OR LENGTH(NEW.proveedor) = 0)
        THEN 'FISICO'
        
        -- PENDIENTE_FISCAL: Solo número de serie sin proveedor
        WHEN NEW.numero_serie IS NOT NULL 
             AND LENGTH(NEW.numero_serie) > 0
             AND (NEW.proveedor IS NULL OR LENGTH(NEW.proveedor) = 0)
        THEN 'PENDIENTE_FISCAL'
        
        -- PENDIENTE: Estado por defecto
        ELSE 'PENDIENTE'
    END;

    -- Actualizar timestamp automáticamente
    NEW.updated_at = CURRENT_TIMESTAMP;
    
    -- Asignar usuario que actualiza si no está definido
    IF NEW.updated_by IS NULL AND current_setting('app.current_user_id', true) IS NOT NULL THEN
        NEW.updated_by = current_setting('app.current_user_id')::integer;
    END IF;

    RETURN NEW;
END;
$$;

-- =====================================================
-- 5. TRIGGER OPTIMIZADO
-- =====================================================

DROP TRIGGER IF EXISTS tr_inventario_actualizar_stage ON inventario;

CREATE TRIGGER tr_inventario_actualizar_stage
    BEFORE INSERT OR UPDATE ON inventario
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_stage_inventario();

-- =====================================================
-- 6. AUDITORÍA AUTOMATIZADA SIN DEGRADACIÓN
-- =====================================================

-- Tabla de auditoría optimizada
CREATE TABLE inventario_audit (
    audit_id BIGSERIAL PRIMARY KEY,
    inventario_id BIGINT NOT NULL,
    operation CHAR(1) NOT NULL CHECK (operation IN ('I','U','D')),
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[], -- Array de campos modificados
    usuario_id INTEGER,
    timestamp_audit TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_user TEXT DEFAULT SESSION_USER,
    ip_address INET DEFAULT inet_client_addr()
);

-- Índices para auditoría
CREATE INDEX idx_inventario_audit_id_timestamp 
ON inventario_audit (inventario_id, timestamp_audit DESC);

CREATE INDEX idx_inventario_audit_usuario_timestamp 
ON inventario_audit (usuario_id, timestamp_audit DESC) 
WHERE usuario_id IS NOT NULL;

CREATE INDEX idx_inventario_audit_operation_timestamp 
ON inventario_audit (operation, timestamp_audit DESC);

-- Función de auditoría optimizada
CREATE OR REPLACE FUNCTION inventario_audit_trigger()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
DECLARE
    changed_fields TEXT[] := ARRAY[]::TEXT[];
    column_name TEXT;
    old_val TEXT;
    new_val TEXT;
BEGIN
    -- Solo auditar campos críticos para optimizar performance
    FOR column_name IN SELECT column_name::text FROM information_schema.columns 
        WHERE table_name = 'inventario' AND table_schema = 'public'
        AND column_name IN ('numero_patrimonio', 'numero_serie', 'costo', 'stage', 'estado', 
                           'coordinacion_id', 'empleado_resguardante_id', 'proveedor')
    LOOP
        IF TG_OP = 'UPDATE' THEN
            EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', column_name, column_name) 
            INTO old_val, new_val USING OLD, NEW;
            
            IF COALESCE(old_val, '') != COALESCE(new_val, '') THEN
                changed_fields := array_append(changed_fields, column_name);
            END IF;
        END IF;
    END LOOP;
    
    -- Solo insertar auditoría si hay cambios significativos
    IF TG_OP = 'DELETE' OR TG_OP = 'INSERT' OR array_length(changed_fields, 1) > 0 THEN
        INSERT INTO inventario_audit (
            inventario_id, operation, old_values, new_values, 
            changed_fields, usuario_id
        ) VALUES (
            COALESCE(NEW.id, OLD.id),
            CASE TG_OP 
                WHEN 'INSERT' THEN 'I'
                WHEN 'UPDATE' THEN 'U'
                WHEN 'DELETE' THEN 'D'
            END,
            CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)::jsonb END,
            CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb END,
            changed_fields,
            COALESCE(
                NEW.updated_by, 
                OLD.updated_by,
                NULLIF(current_setting('app.current_user_id', true), '')::integer
            )
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger de auditoría
CREATE TRIGGER tr_inventario_audit
    AFTER INSERT OR UPDATE OR DELETE ON inventario
    FOR EACH ROW 
    EXECUTE FUNCTION inventario_audit_trigger();

-- =====================================================
-- 7. VISTA MATERIALIZADA OPTIMIZADA CON REFRESH INCREMENTAL
-- =====================================================

DROP MATERIALIZED VIEW IF EXISTS mv_inventario_stats CASCADE;

CREATE MATERIALIZED VIEW mv_inventario_stats AS
SELECT 
    coordinacion_id,
    dependencia_id,
    stage,
    estado,
    DATE_TRUNC('month', created_at) as mes,
    
    -- Conteos básicos
    COUNT(*) as total_items,
    COUNT(CASE WHEN estado = 'disponible' THEN 1 END) as disponibles,
    COUNT(CASE WHEN estado = 'en_uso' THEN 1 END) as en_uso,
    COUNT(CASE WHEN estado = 'mantenimiento' THEN 1 END) as mantenimiento,
    COUNT(CASE WHEN estado = 'baja' THEN 1 END) as baja,
    
    -- Métricas financieras
    SUM(costo) as valor_total,
    AVG(costo) as costo_promedio,
    SUM(valor_actual) as valor_actual_total,
    SUM(CASE WHEN valor_actual > 0 THEN valor_actual ELSE costo END) as valor_contable,
    
    -- Métricas por stage
    COUNT(CASE WHEN stage = 'COMPLETO' THEN 1 END) as completos,
    COUNT(CASE WHEN stage = 'EN_TRANSITO' THEN 1 END) as en_transito,
    COUNT(CASE WHEN stage = 'PENDIENTE_FISCAL' THEN 1 END) as pendiente_fiscal,
    
    -- Timestamp de última actualización
    MAX(updated_at) as ultima_actualizacion
FROM inventario
WHERE coordinacion_id IS NOT NULL
GROUP BY coordinacion_id, dependencia_id, stage, estado, DATE_TRUNC('month', created_at)
WITH DATA;

-- Índices únicos para REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_mv_inventario_stats_unique 
ON mv_inventario_stats (coordinacion_id, dependencia_id, stage, estado, mes);

-- Función para refresh inteligente
CREATE OR REPLACE FUNCTION refresh_inventario_stats(
    force_full_refresh BOOLEAN DEFAULT FALSE
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    last_refresh TIMESTAMP WITH TIME ZONE;
    affected_rows INTEGER;
BEGIN
    -- Obtener timestamp de último refresh
    SELECT MAX(ultima_actualizacion) INTO last_refresh FROM mv_inventario_stats;
    
    IF force_full_refresh OR last_refresh IS NULL OR 
       last_refresh < CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN
        
        -- Refresh completo si es muy antiguo
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventario_stats;
        RETURN 'Full refresh completed';
    ELSE
        -- Refresh incremental solo para registros nuevos
        DELETE FROM mv_inventario_stats 
        WHERE ultima_actualizacion >= last_refresh;
        
        INSERT INTO mv_inventario_stats
        SELECT 
            coordinacion_id, dependencia_id, stage, estado,
            DATE_TRUNC('month', created_at) as mes,
            COUNT(*) as total_items,
            COUNT(CASE WHEN estado = 'disponible' THEN 1 END) as disponibles,
            COUNT(CASE WHEN estado = 'en_uso' THEN 1 END) as en_uso,
            COUNT(CASE WHEN estado = 'mantenimiento' THEN 1 END) as mantenimiento,
            COUNT(CASE WHEN estado = 'baja' THEN 1 END) as baja,
            SUM(costo) as valor_total,
            AVG(costo) as costo_promedio,
            SUM(valor_actual) as valor_actual_total,
            SUM(CASE WHEN valor_actual > 0 THEN valor_actual ELSE costo END) as valor_contable,
            COUNT(CASE WHEN stage = 'COMPLETO' THEN 1 END) as completos,
            COUNT(CASE WHEN stage = 'EN_TRANSITO' THEN 1 END) as en_transito,
            COUNT(CASE WHEN stage = 'PENDIENTE_FISCAL' THEN 1 END) as pendiente_fiscal,
            MAX(updated_at) as ultima_actualizacion
        FROM inventario
        WHERE coordinacion_id IS NOT NULL 
          AND updated_at >= last_refresh
        GROUP BY coordinacion_id, dependencia_id, stage, estado, DATE_TRUNC('month', created_at)
        ON CONFLICT (coordinacion_id, dependencia_id, stage, estado, mes)
        DO UPDATE SET
            total_items = EXCLUDED.total_items,
            disponibles = EXCLUDED.disponibles,
            en_uso = EXCLUDED.en_uso,
            mantenimiento = EXCLUDED.mantenimiento,
            baja = EXCLUDED.baja,
            valor_total = EXCLUDED.valor_total,
            costo_promedio = EXCLUDED.costo_promedio,
            valor_actual_total = EXCLUDED.valor_actual_total,
            valor_contable = EXCLUDED.valor_contable,
            completos = EXCLUDED.completos,
            en_transito = EXCLUDED.en_transito,
            pendiente_fiscal = EXCLUDED.pendiente_fiscal,
            ultima_actualizacion = EXCLUDED.ultima_actualizacion;
            
        RETURN 'Incremental refresh completed';
    END IF;
END;
$$;

-- =====================================================
-- 8. POLÍTICAS DE SEGURIDAD (RLS) OPTIMIZADAS
-- =====================================================

-- Habilitar RLS en la tabla inventario
ALTER TABLE inventario ENABLE ROW LEVEL SECURITY;

-- Política optimizada para administradores
DROP POLICY IF EXISTS inventario_admin_all_access ON inventario;
CREATE POLICY inventario_admin_all_access ON inventario
FOR ALL TO PUBLIC
USING (
    EXISTS (
        SELECT 1 FROM usuarios 
        WHERE id = current_setting('app.current_user_id', true)::integer 
        AND role = 'admin'
    )
);

-- Política optimizada para coordinadores (solo su coordinación)
DROP POLICY IF EXISTS inventario_coordinador_own_access ON inventario;
CREATE POLICY inventario_coordinador_own_access ON inventario
FOR ALL TO PUBLIC
USING (
    EXISTS (
        SELECT 1 FROM usuarios u 
        JOIN coordinaciones c ON u.dependencia_id = c.dependencia_id
        WHERE u.id = current_setting('app.current_user_id', true)::integer
        AND u.role = 'coordinador'
        AND inventario.coordinacion_id = c.id
    )
);

-- Política optimizada para usuarios (solo lectura de su coordinación)
DROP POLICY IF EXISTS inventario_usuario_readonly ON inventario;
CREATE POLICY inventario_usuario_readonly ON inventario
FOR SELECT TO PUBLIC
USING (
    EXISTS (
        SELECT 1 FROM usuarios u 
        JOIN coordinaciones c ON u.dependencia_id = c.dependencia_id
        WHERE u.id = current_setting('app.current_user_id', true)::integer
        AND u.role = 'usuario'
        AND inventario.coordinacion_id = c.id
    )
);

-- =====================================================
-- 9. VISTAS OPTIMIZADAS PARA CONSULTAS FRECUENTES
-- =====================================================

-- Vista completa optimizada para reportes
CREATE OR REPLACE VIEW v_inventario_completo AS
SELECT 
    i.*,
    c.nombre as coordinacion_nombre,
    d.nombre as dependencia_nombre,
    er.nombre_completo as resguardante_nombre,
    ua.nombre_completo as usuario_asignado_nombre,
    
    -- Cálculos de depreciación optimizados
    CASE 
        WHEN i.fecha_adquisicion IS NOT NULL AND i.vida_util_anios > 0 THEN
            GREATEST(
                i.costo - (
                    i.costo * 
                    EXTRACT(YEAR FROM AGE(CURRENT_DATE, i.fecha_adquisicion)) / 
                    i.vida_util_anios
                ), 
                0
            )
        ELSE i.valor_actual
    END as valor_depreciado_calculado,
    
    -- Estado de la garantía
    CASE 
        WHEN i.fecha_adquisicion IS NOT NULL AND i.garantia_meses > 0 THEN
            i.fecha_adquisicion + (i.garantia_meses || ' months')::interval > CURRENT_DATE
        ELSE false
    END as en_garantia,
    
    -- Tiempo desde última actualización
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - i.updated_at))/3600 as horas_sin_actualizacion
    
FROM inventario i
LEFT JOIN coordinaciones c ON i.coordinacion_id = c.id
LEFT JOIN dependencias d ON i.dependencia_id = d.id
LEFT JOIN empleados er ON i.empleado_resguardante_id = er.id
LEFT JOIN usuarios ua ON i.usuario_asignado_id = ua.id;

-- =====================================================
-- 10. FUNCIONES DE UTILIDAD Y MANTENIMIENTO
-- =====================================================

-- Función para generar folio optimizada
CREATE OR REPLACE FUNCTION generar_folio_inventario()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    anio_actual INTEGER;
    secuencia INTEGER;
    nuevo_folio TEXT;
BEGIN
    -- Solo generar folio si no existe
    IF NEW.folio IS NOT NULL AND LENGTH(TRIM(NEW.folio)) > 0 THEN
        RETURN NEW;
    END IF;
    
    anio_actual := EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Obtener siguiente secuencia para el año actual
    SELECT COALESCE(MAX(
        CAST(SPLIT_PART(folio, '-', 3) AS INTEGER)
    ), 0) + 1
    INTO secuencia
    FROM inventario 
    WHERE folio LIKE 'INV-' || anio_actual || '-%';
    
    -- Generar folio con formato INV-YYYY-XXXX
    nuevo_folio := 'INV-' || anio_actual || '-' || LPAD(secuencia::TEXT, 4, '0');
    
    NEW.folio := nuevo_folio;
    RETURN NEW;
END;
$$;

-- Trigger para generación de folio
DROP TRIGGER IF EXISTS tr_generar_folio_inventario ON inventario;
CREATE TRIGGER tr_generar_folio_inventario
    BEFORE INSERT ON inventario
    FOR EACH ROW
    EXECUTE FUNCTION generar_folio_inventario();

-- =====================================================
-- 11. FUNCIÓN DE LIMPIEZA Y MANTENIMIENTO AUTOMATIZADO
-- =====================================================

CREATE OR REPLACE FUNCTION mantener_inventario_optimizado()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    result_text TEXT := '';
    deleted_audits INTEGER;
    updated_stats INTEGER;
BEGIN
    -- Limpiar auditorías muy antiguas (más de 2 años)
    DELETE FROM inventario_audit 
    WHERE timestamp_audit < CURRENT_DATE - INTERVAL '2 years';
    
    GET DIAGNOSTICS deleted_audits = ROW_COUNT;
    result_text := result_text || format('Eliminadas %s auditorías antiguas. ', deleted_audits);
    
    -- Refresh de estadísticas
    PERFORM refresh_inventario_stats(false);
    result_text := result_text || 'Estadísticas actualizadas. ';
    
    -- Actualizar estadísticas de PostgreSQL
    ANALYZE inventario;
    result_text := result_text || 'ANALYZE completado. ';
    
    -- Vacuum incremental si es necesario
    VACUUM inventario;
    result_text := result_text || 'VACUUM completado.';
    
    RETURN result_text;
END;
$$;

-- =====================================================
-- 12. COMENTARIOS DOCUMENTANDO EL ESQUEMA
-- =====================================================

COMMENT ON TABLE inventario IS 'Tabla central optimizada para gestión de patrimonio FCCA-UMSNH v2.0';
COMMENT ON COLUMN inventario.stage IS 'Estado del flujo: FISCAL→EN_TRANSITO→FISICO→COMPLETO o PENDIENTE_FISCAL';
COMMENT ON COLUMN inventario.costo IS 'Costo con 4 decimales para máxima precisión contable';
COMMENT ON COLUMN inventario.imagenes IS 'Array JSON de URLs de imágenes (WebP, máx 3 fotos)';
COMMENT ON COLUMN inventario.documentos_adjuntos IS 'Array JSON de documentos adjuntos con metadata';

COMMENT ON FUNCTION actualizar_stage_inventario() IS 'Función optimizada para clasificación automática de etapas de inventario';
COMMENT ON FUNCTION refresh_inventario_stats(BOOLEAN) IS 'Refresh inteligente de estadísticas (incremental o completo)';
COMMENT ON FUNCTION mantener_inventario_optimizado() IS 'Mantenimiento automatizado de la base de datos';

-- =====================================================
-- 13. CONFIGURACIÓN FINAL Y GRANTS
-- =====================================================

-- Grants básicos (ajustar según roles específicos)
-- GRANT ALL ON inventario TO app_admin;
-- GRANT SELECT, INSERT, UPDATE ON inventario TO app_coordinador;
-- GRANT SELECT ON inventario TO app_usuario;

-- Grant para funciones de mantenimiento
-- GRANT EXECUTE ON FUNCTION mantener_inventario_optimizado() TO app_admin;
-- GRANT EXECUTE ON FUNCTION refresh_inventario_stats(BOOLEAN) TO app_coordinador;

-- =====================================================
-- FIN DEL SCRIPT DE OPTIMIZACIÓN
-- =====================================================

-- Para ejecutar mantenimiento cada día:
-- SELECT cron.schedule('maintain-inventario', '0 2 * * *', 'SELECT mantener_inventario_optimizado();');
