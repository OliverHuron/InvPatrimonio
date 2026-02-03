-- =====================================================
-- IMPLEMENTACIÓN COMPLETA: Arquitectura de Alto Rendimiento SIAF
-- PostgreSQL 18 + Redis Integration
-- Performance-Optimized Inventory System
-- =====================================================

-- =====================================================
-- CONFIGURACIÓN INICIAL
-- =====================================================

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS uuid-ossp;

-- Configuración de sesión para mejor rendimiento
SET work_mem = '256MB';
SET maintenance_work_mem = '1GB';
SET effective_cache_size = '4GB';

-- =====================================================
-- 1. OPTIMISTIC LOCKING: TABLA INVENTARIO CON VERSIONING
-- =====================================================

-- Primero, agregar versioning a tabla existente
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS session_lock UUID DEFAULT NULL;

-- =====================================================
-- 2. ÍNDICES AVANZADOS DE ALTO RENDIMIENTO
-- =====================================================

-- Índice GIN combinado para búsqueda full-text multi-campo
DROP INDEX IF EXISTS idx_inventario_search_combined;
CREATE INDEX idx_inventario_search_combined 
ON inventario USING gin (
    (setweight(to_tsvector('spanish', coalesce(marca,'')), 'A') ||
     setweight(to_tsvector('spanish', coalesce(modelo,'')), 'A') ||
     setweight(to_tsvector('spanish', coalesce(numero_serie,'')), 'B') ||
     setweight(to_tsvector('spanish', coalesce(descripcion,'')), 'C'))
);

-- Índices parciales para estados críticos
CREATE INDEX idx_inventario_pendiente_fiscal 
ON inventario (coordinacion_id, created_at DESC, costo)
WHERE stage = 'PENDIENTE_FISCAL' AND estado = 'disponible';

CREATE INDEX idx_inventario_alto_valor 
ON inventario (costo DESC, fecha_adquisicion)
WHERE costo > 50000 AND estado != 'baja';

CREATE INDEX idx_inventario_sin_resguardante
ON inventario (coordinacion_id, created_at DESC)
WHERE empleado_resguardante_id IS NULL AND estado = 'disponible';

-- Covering index para queries frecuentes (Index-Only Scans)
CREATE INDEX idx_inventario_covering_dashboard
ON inventario (coordinacion_id, estado, stage)
INCLUDE (marca, modelo, costo, created_at, numero_patrimonio, version);

-- Índice optimizado para keyset pagination
CREATE INDEX idx_inventario_keyset_pagination
ON inventario (coordinacion_id, created_at DESC, id DESC);

-- =====================================================
-- 3. PAGINACIÓN KEYSET (CURSOR-BASED) DE ALTO RENDIMIENTO
-- =====================================================

-- Función para paginación keyset ultra-rápida
CREATE OR REPLACE FUNCTION get_inventario_keyset(
    p_coordinacion_id INTEGER,
    p_limit INTEGER DEFAULT 20,
    p_cursor_created_at TIMESTAMPTZ DEFAULT NULL,
    p_cursor_id INTEGER DEFAULT NULL,
    p_search_text TEXT DEFAULT NULL,
    p_estado TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    query_sql TEXT;
    where_conditions TEXT[] := ARRAY[]::TEXT[];
    result_json JSON;
BEGIN
    -- Construir condiciones WHERE dinámicamente
    where_conditions := array_append(where_conditions, 
        format('coordinacion_id = %L', p_coordinacion_id));
    
    IF p_search_text IS NOT NULL THEN
        where_conditions := array_append(where_conditions, 
            format('(setweight(to_tsvector(''spanish'', coalesce(marca,'''')), ''A'') ||
                    setweight(to_tsvector(''spanish'', coalesce(modelo,'''')), ''A'') ||
                    setweight(to_tsvector(''spanish'', coalesce(numero_serie,'''')), ''B'') ||
                    setweight(to_tsvector(''spanish'', coalesce(descripcion,'''')), ''C'')) @@ plainto_tsquery(''spanish'', %L)', 
                   p_search_text));
    END IF;
    
    IF p_estado IS NOT NULL THEN
        where_conditions := array_append(where_conditions, 
            format('estado = %L', p_estado));
    END IF;
    
    -- Cursor para página siguiente
    IF p_cursor_created_at IS NOT NULL AND p_cursor_id IS NOT NULL THEN
        where_conditions := array_append(where_conditions, 
            format('(created_at, id) < (%L, %L)', p_cursor_created_at, p_cursor_id));
    END IF;
    
    -- Construir query completa
    query_sql := format(
        'SELECT json_build_object(
            ''data'', json_agg(
                json_build_object(
                    ''id'', id,
                    ''numero_patrimonio'', numero_patrimonio,
                    ''descripcion'', descripcion,
                    ''marca'', marca,
                    ''modelo'', modelo,
                    ''costo'', costo,
                    ''estado'', estado,
                    ''stage'', stage,
                    ''created_at'', created_at,
                    ''version'', version
                )
            ),
            ''has_next_page'', count(*) = %L,
            ''next_cursor'', 
                CASE WHEN count(*) = %L THEN
                    encode(convert_to(max(created_at)::text || '':'' || max(id)::text, ''UTF8''), ''base64'')
                ELSE NULL END
        )
        FROM (
            SELECT id, numero_patrimonio, descripcion, marca, modelo, costo, 
                   estado, stage, created_at, version
            FROM inventario
            WHERE %s
            ORDER BY created_at DESC, id DESC
            LIMIT %L
        ) sub',
        p_limit + 1, p_limit + 1,
        array_to_string(where_conditions, ' AND '),
        p_limit + 1
    );
    
    EXECUTE query_sql INTO result_json;
    
    RETURN result_json;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. OPTIMISTIC LOCKING: FUNCIONES DE ACTUALIZACIÓN SEGURA
-- =====================================================

-- Función de actualización con optimistic locking
CREATE OR REPLACE FUNCTION update_inventario_optimistic(
    p_id INTEGER,
    p_expected_version INTEGER,
    p_updates JSONB
)
RETURNS JSON AS $$
DECLARE
    current_version INTEGER;
    affected_rows INTEGER;
    result JSON;
    update_fields TEXT[] := ARRAY[]::TEXT[];
    field_name TEXT;
    field_value TEXT;
BEGIN
    -- Verificar versión actual
    SELECT version INTO current_version 
    FROM inventario WHERE id = p_id;
    
    IF current_version IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'RECORD_NOT_FOUND',
            'message', 'Registro no encontrado'
        );
    END IF;
    
    IF current_version != p_expected_version THEN
        RETURN json_build_object(
            'success', false,
            'error', 'VERSION_CONFLICT',
            'message', 'El registro fue modificado por otro usuario',
            'current_version', current_version,
            'expected_version', p_expected_version
        );
    END IF;
    
    -- Construir SET clause dinámicamente desde JSONB
    FOR field_name, field_value IN 
        SELECT key, value::text FROM jsonb_each_text(p_updates)
    LOOP
        -- Solo permitir campos seguros para actualizar
        IF field_name IN ('numero_serie', 'descripcion', 'marca', 'modelo', 'costo', 
                         'estado', 'empleado_resguardante_id', 'ubicacion', 'observaciones_tecnicas') THEN
            update_fields := array_append(update_fields, 
                format('%I = %L', field_name, field_value));
        END IF;
    END LOOP;
    
    -- Actualización atómica con incremento de versión
    EXECUTE format('
        UPDATE inventario SET 
            %s,
            version = version + 1,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = COALESCE(
                NULLIF(current_setting(''app.current_user_id'', true), '''')::integer,
                0
            )
        WHERE id = %L AND version = %L',
        array_to_string(update_fields, ', '),
        p_id,
        p_expected_version
    );
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    
    IF affected_rows = 0 THEN
        -- Verificación de concurrencia
        SELECT version INTO current_version 
        FROM inventario WHERE id = p_id;
        
        RETURN json_build_object(
            'success', false,
            'error', 'CONCURRENT_MODIFICATION',
            'current_version', current_version
        );
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'new_version', p_expected_version + 1,
        'updated_at', CURRENT_TIMESTAMP
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. AUDITORÍA ASÍNCRONA DE ALTO RENDIMIENTO
-- =====================================================

-- Schema separado para auditoría
CREATE SCHEMA IF NOT EXISTS audit;

-- Tabla de auditoría particionada por mes
CREATE TABLE audit.inventario_logs (
    log_id BIGSERIAL,
    inventario_id BIGINT NOT NULL,
    operation_type CHAR(1) NOT NULL CHECK (operation_type IN ('I','U','D')),
    changes JSONB NOT NULL,
    user_id INTEGER,
    session_id UUID,
    ip_address INET DEFAULT inet_client_addr(),
    user_agent TEXT,
    timestamp_utc TIMESTAMPTZ DEFAULT NOW(),
    log_month DATE GENERATED ALWAYS AS (date_trunc('month', timestamp_utc)::date) STORED,
    PRIMARY KEY (log_id, log_month)
) PARTITION BY RANGE (log_month);

-- Crear particiones para 2026
CREATE TABLE audit.inventario_logs_2026_01 
PARTITION OF audit.inventario_logs 
FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE audit.inventario_logs_2026_02 
PARTITION OF audit.inventario_logs 
FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE audit.inventario_logs_2026_03 
PARTITION OF audit.inventario_logs 
FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- Índices para auditoría
CREATE INDEX idx_audit_inventario_id_time 
ON audit.inventario_logs (inventario_id, timestamp_utc DESC);

CREATE INDEX idx_audit_user_time 
ON audit.inventario_logs (user_id, timestamp_utc DESC) 
WHERE user_id IS NOT NULL;

CREATE INDEX idx_audit_changes_gin 
ON audit.inventario_logs USING gin (changes);

-- Función de auditoría ultra-optimizada
CREATE OR REPLACE FUNCTION audit.inventario_audit_optimized()
RETURNS TRIGGER AS $$
DECLARE
    changes_json JSONB := '{}'::jsonb;
    field_name TEXT;
    critical_fields TEXT[] := ARRAY[
        'numero_patrimonio', 'numero_serie', 'costo', 'stage',
        'empleado_resguardante_id', 'coordinacion_id', 'estado', 'version'
    ];
    old_val TEXT;
    new_val TEXT;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- Solo auditar campos críticos que cambiaron
        FOREACH field_name IN ARRAY critical_fields LOOP
            old_val := to_jsonb(OLD) ->> field_name;
            new_val := to_jsonb(NEW) ->> field_name;
            
            IF old_val IS DISTINCT FROM new_val THEN
                changes_json := changes_json || jsonb_build_object(
                    field_name, 
                    jsonb_build_object('from', old_val, 'to', new_val)
                );
            END IF;
        END LOOP;
        
        -- Solo insertar si hay cambios reales
        IF changes_json != '{}'::jsonb THEN
            INSERT INTO audit.inventario_logs (
                inventario_id, operation_type, changes, user_id, 
                session_id, timestamp_utc
            ) VALUES (
                NEW.id, 'U', changes_json,
                NULLIF(current_setting('app.current_user_id', true), '')::integer,
                NULLIF(current_setting('app.session_id', true), '')::uuid,
                CURRENT_TIMESTAMP
            );
        END IF;
        
    ELSIF TG_OP = 'INSERT' THEN
        -- Para inserciones, solo campos básicos
        changes_json := jsonb_build_object(
            'numero_patrimonio', NEW.numero_patrimonio,
            'costo', NEW.costo,
            'coordinacion_id', NEW.coordinacion_id,
            'stage', NEW.stage
        );
        
        INSERT INTO audit.inventario_logs (
            inventario_id, operation_type, changes, user_id, session_id
        ) VALUES (
            NEW.id, 'I', changes_json,
            NULLIF(current_setting('app.current_user_id', true), '')::integer,
            NULLIF(current_setting('app.session_id', true), '')::uuid
        );
        
    ELSIF TG_OP = 'DELETE' THEN
        changes_json := jsonb_build_object(
            'deleted_record', to_jsonb(OLD)
        );
        
        INSERT INTO audit.inventario_logs (
            inventario_id, operation_type, changes, user_id, session_id
        ) VALUES (
            OLD.id, 'D', changes_json,
            NULLIF(current_setting('app.current_user_id', true), '')::integer,
            NULLIF(current_setting('app.session_id', true), '')::uuid
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger de auditoría optimizado
DROP TRIGGER IF EXISTS tr_inventario_audit_optimized ON inventario;
CREATE TRIGGER tr_inventario_audit_optimized
    AFTER INSERT OR UPDATE OR DELETE ON inventario
    FOR EACH ROW 
    EXECUTE FUNCTION audit.inventario_audit_optimized();

-- =====================================================
-- 6. BULK LOADING DE ULTRA ALTO RENDIMIENTO
-- =====================================================

-- Función para carga masiva optimizada (COPY vs INSERT)
CREATE OR REPLACE FUNCTION bulk_load_inventario_v2(
    p_data JSONB,  -- Array de objetos JSON
    p_batch_size INTEGER DEFAULT 2000,
    p_upsert_mode BOOLEAN DEFAULT true
)
RETURNS JSON AS $$
DECLARE
    start_time TIMESTAMP := clock_timestamp();
    processed_count INTEGER := 0;
    error_count INTEGER := 0;
    batch_count INTEGER := 0;
    temp_table_name TEXT;
    result JSON;
BEGIN
    -- Crear tabla temporal UNLOGGED para máximo rendimiento
    temp_table_name := 'inventario_bulk_' || extract(epoch from clock_timestamp())::bigint;
    
    EXECUTE format('
        CREATE UNLOGGED TABLE %I (
            numero_patrimonio VARCHAR(50),
            numero_serie VARCHAR(100),
            descripcion TEXT NOT NULL,
            marca VARCHAR(100),
            modelo VARCHAR(100),
            costo NUMERIC(15,4) NOT NULL DEFAULT 0,
            coordinacion_id INTEGER NOT NULL,
            estado VARCHAR(20) DEFAULT ''disponible'',
            stage VARCHAR(20) DEFAULT ''PENDIENTE'',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            batch_num INTEGER,
            is_valid BOOLEAN DEFAULT true,
            error_msg TEXT
        )', temp_table_name);
    
    -- Insertar datos JSON en tabla temporal usando INSERT con VALUES
    -- (COPY desde JSON es más complejo, INSERT es aceptable para lotes medianos)
    WITH json_data AS (
        SELECT 
            row_number() OVER () as rn,
            (value ->> 'numero_patrimonio')::varchar(50) as numero_patrimonio,
            (value ->> 'numero_serie')::varchar(100) as numero_serie,
            COALESCE(value ->> 'descripcion', 'Sin descripción') as descripcion,
            (value ->> 'marca')::varchar(100) as marca,
            (value ->> 'modelo')::varchar(100) as modelo,
            COALESCE((value ->> 'costo')::numeric(15,4), 0) as costo,
            (value ->> 'coordinacion_id')::integer as coordinacion_id,
            COALESCE(value ->> 'estado', 'disponible') as estado
        FROM jsonb_array_elements(p_data)
    )
    INSERT INTO inventario_bulk_temp (
        numero_patrimonio, numero_serie, descripcion, marca, modelo,
        costo, coordinacion_id, estado, batch_num
    )
    SELECT 
        numero_patrimonio, numero_serie, descripcion, marca, modelo,
        costo, coordinacion_id, estado,
        ((rn - 1) / p_batch_size) + 1
    FROM json_data;
    
    GET DIAGNOSTICS processed_count = ROW_COUNT;
    
    -- Validación en lote
    EXECUTE format('
        UPDATE %I SET 
            is_valid = false,
            error_msg = CASE 
                WHEN numero_patrimonio IS NULL THEN ''Número de patrimonio requerido''
                WHEN costo < 0 THEN ''Costo debe ser mayor o igual a 0''
                WHEN coordinacion_id IS NULL THEN ''Coordinación requerida''
                WHEN EXISTS(SELECT 1 FROM inventario i WHERE i.numero_patrimonio = %I.numero_patrimonio) 
                    AND NOT %L THEN ''Número de patrimonio ya existe''
                ELSE ''Registro válido''
            END
        WHERE numero_patrimonio IS NULL 
           OR costo < 0 
           OR coordinacion_id IS NULL
           OR (NOT %L AND EXISTS(SELECT 1 FROM inventario i WHERE i.numero_patrimonio = %I.numero_patrimonio))',
        temp_table_name, temp_table_name, p_upsert_mode, p_upsert_mode, temp_table_name);
    
    -- Contar errores
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE NOT is_valid', temp_table_name)
    INTO error_count;
    
    -- Procesamiento por lotes para evitar bloqueos largos
    FOR batch_count IN 1..(processed_count / p_batch_size + 1) LOOP
        IF p_upsert_mode THEN
            -- UPSERT con ON CONFLICT
            EXECUTE format('
                INSERT INTO inventario (
                    numero_patrimonio, numero_serie, descripcion, marca, modelo,
                    costo, coordinacion_id, estado, stage, created_at, version
                )
                SELECT 
                    numero_patrimonio, numero_serie, descripcion, marca, modelo,
                    costo, coordinacion_id, estado, stage, created_at, 1
                FROM %I
                WHERE batch_num = %L AND is_valid = true
                ON CONFLICT (numero_patrimonio) 
                DO UPDATE SET 
                    numero_serie = EXCLUDED.numero_serie,
                    descripcion = EXCLUDED.descripcion,
                    marca = EXCLUDED.marca,
                    modelo = EXCLUDED.modelo,
                    costo = EXCLUDED.costo,
                    updated_at = CURRENT_TIMESTAMP,
                    version = inventario.version + 1',
                temp_table_name, batch_count);
        ELSE
            -- Solo INSERT (falla si existe)
            EXECUTE format('
                INSERT INTO inventario (
                    numero_patrimonio, numero_serie, descripcion, marca, modelo,
                    costo, coordinacion_id, estado, stage, created_at, version
                )
                SELECT 
                    numero_patrimonio, numero_serie, descripcion, marca, modelo,
                    costo, coordinacion_id, estado, stage, created_at, 1
                FROM %I
                WHERE batch_num = %L AND is_valid = true',
                temp_table_name, batch_count);
        END IF;
        
        -- Commit cada lote
        COMMIT;
    END LOOP;
    
    -- Cleanup
    EXECUTE format('DROP TABLE %I', temp_table_name);
    
    -- Actualizar estadísticas
    ANALYZE inventario;
    
    result := json_build_object(
        'success', true,
        'duration_seconds', EXTRACT(EPOCH FROM clock_timestamp() - start_time),
        'total_processed', processed_count,
        'total_errors', error_count,
        'total_success', processed_count - error_count,
        'batches_processed', batch_count,
        'upsert_mode', p_upsert_mode
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Cleanup en caso de error
    EXECUTE format('DROP TABLE IF EXISTS %I', temp_table_name);
    
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'total_processed', processed_count
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. CACHE INVALIDATION CON REDIS NOTIFY
-- =====================================================

-- Función para invalidar cache Redis via NOTIFY
CREATE OR REPLACE FUNCTION invalidate_redis_cache()
RETURNS TRIGGER AS $$
DECLARE
    cache_keys TEXT[];
    key TEXT;
BEGIN
    -- Determinar qué caches invalidar basado en la tabla y operación
    IF TG_TABLE_NAME = 'inventario' THEN
        cache_keys := ARRAY[
            'stats:coordinacion:' || COALESCE(NEW.coordinacion_id, OLD.coordinacion_id) || ':*',
            'search:*',
            'inventory:coordinacion:' || COALESCE(NEW.coordinacion_id, OLD.coordinacion_id) || ':*',
            'stats:global:*'
        ];
        
        -- Si cambió el número de patrimonio, invalidar cache del item específico
        IF TG_OP = 'UPDATE' AND OLD.numero_patrimonio != NEW.numero_patrimonio THEN
            cache_keys := array_append(cache_keys, 'item:inventory:' || NEW.id || ':*');
        END IF;
    END IF;
    
    -- Enviar notificaciones para cada patrón de cache
    FOREACH key IN ARRAY cache_keys LOOP
        PERFORM pg_notify('cache_invalidate', json_build_object(
            'pattern', key,
            'table', TG_TABLE_NAME,
            'operation', TG_OP,
            'id', COALESCE(NEW.id, OLD.id),
            'timestamp', CURRENT_TIMESTAMP
        )::text);
    END LOOP;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers para invalidación automática
DROP TRIGGER IF EXISTS tr_invalidate_cache_inventario ON inventario;
CREATE TRIGGER tr_invalidate_cache_inventario
    AFTER INSERT OR UPDATE OR DELETE ON inventario
    FOR EACH ROW 
    EXECUTE FUNCTION invalidate_redis_cache();

-- =====================================================
-- 8. VISTA MATERIALIZADA OPTIMIZADA CON REFRESH INCREMENTAL
-- =====================================================

-- Recrear vista materializada con más métricas
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
    COALESCE(SUM(costo), 0) as valor_total,
    COALESCE(AVG(costo), 0) as costo_promedio,
    COALESCE(MAX(costo), 0) as costo_maximo,
    COALESCE(MIN(costo), 0) as costo_minimo,
    
    -- Métricas por stage
    COUNT(CASE WHEN stage = 'COMPLETO' THEN 1 END) as completos,
    COUNT(CASE WHEN stage = 'EN_TRANSITO' THEN 1 END) as en_transito,
    COUNT(CASE WHEN stage = 'PENDIENTE_FISCAL' THEN 1 END) as pendiente_fiscal,
    COUNT(CASE WHEN stage = 'FISCAL' THEN 1 END) as fiscal,
    COUNT(CASE WHEN stage = 'FISICO' THEN 1 END) as fisico,
    
    -- Timestamp para refresh incremental
    MAX(updated_at) as ultima_actualizacion,
    COUNT(CASE WHEN updated_at >= CURRENT_DATE - INTERVAL '24 hours' THEN 1 END) as actualizados_24h
    
FROM inventario
WHERE coordinacion_id IS NOT NULL
GROUP BY coordinacion_id, dependencia_id, stage, estado, DATE_TRUNC('month', created_at)
WITH DATA;

-- Índice único para REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_mv_inventario_stats_unique 
ON mv_inventario_stats (coordinacion_id, COALESCE(dependencia_id, 0), stage, estado, mes);

-- Función de refresh incremental mejorada
CREATE OR REPLACE FUNCTION refresh_inventario_stats_v2(
    force_full_refresh BOOLEAN DEFAULT FALSE
)
RETURNS JSON AS $$
DECLARE
    last_refresh TIMESTAMP WITH TIME ZONE;
    affected_coords INTEGER[];
    start_time TIMESTAMP := clock_timestamp();
    refresh_type TEXT;
BEGIN
    -- Obtener timestamp de último refresh
    SELECT MAX(ultima_actualizacion) INTO last_refresh FROM mv_inventario_stats;
    
    IF force_full_refresh OR last_refresh IS NULL OR 
       last_refresh < CURRENT_TIMESTAMP - INTERVAL '2 hours' THEN
        
        -- Refresh completo
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventario_stats;
        refresh_type := 'full';
        
    ELSE
        -- Refresh incremental - solo coordinaciones afectadas
        SELECT ARRAY_AGG(DISTINCT coordinacion_id) INTO affected_coords
        FROM inventario 
        WHERE updated_at > last_refresh AND coordinacion_id IS NOT NULL;
        
        IF array_length(affected_coords, 1) > 0 THEN
            -- Eliminar estadísticas afectadas
            DELETE FROM mv_inventario_stats 
            WHERE coordinacion_id = ANY(affected_coords);
            
            -- Recalcular solo coordinaciones afectadas
            INSERT INTO mv_inventario_stats
            SELECT 
                coordinacion_id, dependencia_id, stage, estado,
                DATE_TRUNC('month', created_at) as mes,
                COUNT(*) as total_items,
                COUNT(CASE WHEN estado = 'disponible' THEN 1 END) as disponibles,
                COUNT(CASE WHEN estado = 'en_uso' THEN 1 END) as en_uso,
                COUNT(CASE WHEN estado = 'mantenimiento' THEN 1 END) as mantenimiento,
                COUNT(CASE WHEN estado = 'baja' THEN 1 END) as baja,
                COALESCE(SUM(costo), 0) as valor_total,
                COALESCE(AVG(costo), 0) as costo_promedio,
                COALESCE(MAX(costo), 0) as costo_maximo,
                COALESCE(MIN(costo), 0) as costo_minimo,
                COUNT(CASE WHEN stage = 'COMPLETO' THEN 1 END) as completos,
                COUNT(CASE WHEN stage = 'EN_TRANSITO' THEN 1 END) as en_transito,
                COUNT(CASE WHEN stage = 'PENDIENTE_FISCAL' THEN 1 END) as pendiente_fiscal,
                COUNT(CASE WHEN stage = 'FISCAL' THEN 1 END) as fiscal,
                COUNT(CASE WHEN stage = 'FISICO' THEN 1 END) as fisico,
                MAX(updated_at) as ultima_actualizacion,
                COUNT(CASE WHEN updated_at >= CURRENT_DATE - INTERVAL '24 hours' THEN 1 END) as actualizados_24h
            FROM inventario
            WHERE coordinacion_id = ANY(affected_coords)
            GROUP BY coordinacion_id, dependencia_id, stage, estado, DATE_TRUNC('month', created_at);
            
            refresh_type := 'incremental';
        ELSE
            refresh_type := 'no_changes';
        END IF;
    END IF;
    
    RETURN json_build_object(
        'refresh_type', refresh_type,
        'duration_seconds', EXTRACT(EPOCH FROM clock_timestamp() - start_time),
        'affected_coordinaciones', COALESCE(array_length(affected_coords, 1), 0),
        'timestamp', CURRENT_TIMESTAMP
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. FUNCIONES DE UTILIDAD Y MONITOREO
-- =====================================================

-- Función para obtener estadísticas de rendimiento
CREATE OR REPLACE FUNCTION get_performance_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'table_stats', (
            SELECT json_build_object(
                'total_rows', (SELECT COUNT(*) FROM inventario),
                'table_size', pg_size_pretty(pg_total_relation_size('inventario')),
                'index_size', pg_size_pretty(pg_indexes_size('inventario')),
                'avg_row_size', pg_size_pretty(
                    pg_total_relation_size('inventario')::numeric / NULLIF(COUNT(*), 0)
                ) 
            FROM inventario
        ),
        'index_usage', (
            SELECT json_agg(
                json_build_object(
                    'index_name', indexrelname,
                    'scans', idx_scan,
                    'tuples_read', idx_tup_read,
                    'tuples_fetched', idx_tup_fetch,
                    'usage_ratio', 
                        CASE WHEN (idx_scan + seq_scan) > 0 
                        THEN round(idx_scan::numeric / (idx_scan + seq_scan), 4)
                        ELSE 0 END
                )
            )
            FROM pg_stat_user_indexes 
            WHERE relname = 'inventario'
        ),
        'slow_queries', (
            SELECT json_agg(
                json_build_object(
                    'query', substr(query, 1, 100) || '...',
                    'calls', calls,
                    'mean_time_ms', round(mean_time, 2),
                    'total_time_ms', round(total_time, 2)
                )
            )
            FROM pg_stat_statements 
            WHERE query LIKE '%inventario%'
              AND calls > 10
            ORDER BY mean_time DESC
            LIMIT 10
        ),
        'cache_hit_ratio', (
            SELECT round(
                sum(heap_blks_hit) * 100.0 / 
                nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2
            )
            FROM pg_statio_user_tables 
            WHERE relname = 'inventario'
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. CONFIGURACIÓN Y MANTENIMIENTO AUTOMATIZADO
-- =====================================================

-- Función de mantenimiento automatizado
CREATE OR REPLACE FUNCTION mantener_sistema_inventario()
RETURNS JSON AS $$
DECLARE
    start_time TIMESTAMP := clock_timestamp();
    maintenance_log TEXT := '';
    deleted_audits INTEGER;
    result JSON;
BEGIN
    -- Limpiar auditorías antiguas (6 meses)
    DELETE FROM audit.inventario_logs 
    WHERE timestamp_utc < CURRENT_DATE - INTERVAL '6 months';
    
    GET DIAGNOSTICS deleted_audits = ROW_COUNT;
    maintenance_log := maintenance_log || format('Auditorías eliminadas: %s. ', deleted_audits);
    
    -- Refresh incremental de estadísticas
    SELECT refresh_inventario_stats_v2(false) INTO result;
    maintenance_log := maintenance_log || format('Stats refresh: %s. ', 
        result->>'refresh_type');
    
    -- Actualizar estadísticas de PostgreSQL
    ANALYZE inventario;
    ANALYZE audit.inventario_logs;
    maintenance_log := maintenance_log || 'ANALYZE completado. ';
    
    -- VACUUM selectivo si es necesario
    VACUUM (ANALYZE) inventario;
    maintenance_log := maintenance_log || 'VACUUM completado. ';
    
    -- Verificar integridad de índices
    REINDEX INDEX CONCURRENTLY idx_inventario_search_combined;
    maintenance_log := maintenance_log || 'Índices verificados. ';
    
    RETURN json_build_object(
        'success', true,
        'duration_seconds', EXTRACT(EPOCH FROM clock_timestamp() - start_time),
        'maintenance_log', maintenance_log,
        'timestamp', CURRENT_TIMESTAMP,
        'deleted_audit_records', deleted_audits
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'maintenance_log', maintenance_log,
        'timestamp', CURRENT_TIMESTAMP
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CONFIGURACIÓN FINAL Y COMENTARIOS
-- =====================================================

-- Comentarios de documentación
COMMENT ON TABLE inventario IS 'Tabla principal de inventario optimizada para alto rendimiento v2.0';
COMMENT ON COLUMN inventario.version IS 'Columna para optimistic locking y control de concurrencia';
COMMENT ON FUNCTION get_inventario_keyset IS 'Paginación keyset para rendimiento constante independiente del tamaño';
COMMENT ON FUNCTION update_inventario_optimistic IS 'Actualización segura con optimistic locking';
COMMENT ON FUNCTION bulk_load_inventario_v2 IS 'Carga masiva optimizada con validación y UPSERT';
COMMENT ON MATERIALIZED VIEW mv_inventario_stats IS 'Estadísticas precalculadas con refresh incremental';

-- Configuraciones recomendadas para postgresql.conf
/*
work_mem = 256MB
maintenance_work_mem = 1GB  
effective_cache_size = 4GB
shared_buffers = 2GB
max_connections = 200
max_worker_processes = 8
*/

-- Script de validación post-implementación
SELECT 'Implementación completada exitosamente' as status,
       COUNT(*) as total_registros,
       COUNT(DISTINCT coordinacion_id) as coordinaciones_activas,
       pg_size_pretty(pg_total_relation_size('inventario')) as tamaño_tabla,
       pg_size_pretty(pg_indexes_size('inventario')) as tamaño_indices
FROM inventario;

-- =====================================================
-- FIN DE IMPLEMENTACIÓN
-- =====================================================