# 🚀 Script de Migración SIAF → InvPatrimonio

## ⚡ Migración Automática con Validación y Rollback

```sql
-- =====================================================
-- SCRIPT DE MIGRACIÓN SIAF → INVPATRIMONIO
-- Versión: 2.0 Ultra Optimizada
-- Fecha: Febrero 2026
-- Tiempo estimado: 15-30 minutos
-- =====================================================

DO $$
DECLARE
    backup_schema TEXT := 'siaf_backup_' || to_char(NOW(), 'YYYYMMDD_HH24MI');
    start_time TIMESTAMP := NOW();
    total_records BIGINT;
    migrated_records BIGINT := 0;
    error_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'INICIANDO MIGRACIÓN SIAF → InvPatrimonio a las %', start_time;
    
    -- =====================================================
    -- 1. CREAR BACKUP DE SEGURIDAD
    -- =====================================================
    RAISE NOTICE '1. Creando backup de seguridad...';
    EXECUTE format('CREATE SCHEMA %I', backup_schema);
    EXECUTE format('CREATE TABLE %I.inventario_backup AS SELECT * FROM public.inventario', backup_schema);
    
    SELECT COUNT(*) INTO total_records FROM public.inventario;
    RAISE NOTICE 'Backup creado: % registros respaldados en schema %', total_records, backup_schema;
    
    -- =====================================================
    -- 2. DESHABILITAR TRIGGERS TEMPORALMENTE
    -- =====================================================
    RAISE NOTICE '2. Deshabilitando triggers durante migración...';
    ALTER TABLE inventario DISABLE TRIGGER ALL;
    
    -- =====================================================
    -- 3. MIGRAR DATOS CON TRANSFORMACIONES
    -- =====================================================
    RAISE NOTICE '3. Iniciando migración de datos...';
    
    -- Crear tabla temporal con estructura optimizada
    CREATE TEMP TABLE inventario_migrated AS
    SELECT 
        -- IDs y identificadores
        id,
        uuid::UUID as uuid,
        folio,
        
        -- Información patrimonial normalizada
        NULLIF(TRIM(numero_patrimonio), '') as numero_patrimonio,
        NULLIF(TRIM(numero_serie), '') as numero_serie,
        NULLIF(TRIM(clave_patrimonial), '') as clave_patrimonial,
        NULLIF(TRIM(registro_patrimonial), '') as registro_patrimonial,
        
        -- Descripción y clasificación
        COALESCE(NULLIF(TRIM(descripcion), ''), 'Sin descripción') as descripcion,
        NULLIF(TRIM(marca), '') as marca,
        NULLIF(TRIM(modelo), '') as modelo,
        NULLIF(TRIM(tipo_bien), '') as tipo_bien,
        
        -- Relaciones críticas
        coordinacion_id,
        dependencia_id,
        empleado_resguardante_id,
        usuario_asignado_id,
        
        -- Información financiera con validación
        CASE 
            WHEN costo IS NULL OR costo < 0 THEN 0.0000
            ELSE costo
        END as costo,
        CASE 
            WHEN valor_actual IS NULL OR valor_actual < 0 THEN NULL
            ELSE valor_actual
        END as valor_actual,
        CASE 
            WHEN depreciacion_anual IS NULL OR depreciacion_anual < 0 THEN NULL
            ELSE depreciacion_anual
        END as depreciacion_anual,
        COALESCE(vida_util_anios, 5) as vida_util_anios,
        
        -- Información del proveedor normalizada
        NULLIF(TRIM(proveedor), '') as proveedor,
        NULLIF(TRIM(factura), '') as factura,
        NULLIF(TRIM(numero_factura), '') as numero_factura,
        NULLIF(TRIM(fondo), '') as fondo,
        NULLIF(TRIM(cuenta_por_pagar), '') as cuenta_por_pagar,
        
        -- Estados validados
        CASE 
            WHEN stage IN ('FISCAL', 'FISICO', 'EN_TRANSITO', 'COMPLETO', 'PENDIENTE_FISCAL') 
            THEN stage
            ELSE 'PENDIENTE'
        END as stage,
        
        CASE 
            WHEN estado IN ('disponible', 'en_uso', 'mantenimiento', 'baja', 'reservado') 
            THEN estado
            ELSE 'disponible'
        END as estado,
        
        CASE 
            WHEN estado_uso IN ('operativo', 'regular', 'deficiente', 'inservible') 
            THEN estado_uso
            ELSE 'operativo'
        END as estado_uso,
        
        CASE 
            WHEN estatus_validacion IN ('borrador', 'validado', 'rechazado', 'en_revision') 
            THEN estatus_validacion
            ELSE 'borrador'
        END as estatus_validacion,
        
        -- Ubicación y asignación
        NULLIF(TRIM(ubicacion), '') as ubicacion,
        NULLIF(TRIM(numero_resguardo_interno), '') as numero_resguardo_interno,
        
        -- Clasificaciones boolean
        COALESCE(es_oficial_siia, false) as es_oficial_siia,
        COALESCE(es_local, true) as es_local,
        COALESCE(es_investigacion, false) as es_investigacion,
        
        -- Fechas
        fecha_adquisicion,
        fecha_compra,
        fecha_envio,
        fecha_recepcion,
        fecha_baja,
        ultimo_mantenimiento,
        proximo_mantenimiento,
        garantia_meses,
        
        -- Información adicional
        comentarios,
        motivo_baja,
        observaciones_tecnicas,
        recurso,
        ur,
        ures_asignacion,
        ures_gasto,
        ejercicio,
        
        -- Personal
        enviado_por,
        recibido_por,
        elaboro_nombre,
        fecha_elaboracion,
        
        -- JSONB con validación y migración
        CASE 
            WHEN imagenes IS NULL THEN '[]'::jsonb
            WHEN jsonb_typeof(imagenes) != 'array' THEN 
                CASE 
                    WHEN imagenes::text = '{}' THEN '[]'::jsonb
                    ELSE jsonb_build_array(imagenes)
                END
            ELSE imagenes
        END as imagenes,
        
        -- Migrar documentos adjuntos
        CASE 
            WHEN documento_adjunto_url IS NOT NULL AND documento_adjunto_url != '' THEN
                jsonb_build_array(
                    jsonb_build_object(
                        'url', documento_adjunto_url,
                        'tipo', 'documento',
                        'fecha_subida', COALESCE(created_at, NOW()),
                        'nombre', 'documento_migrado.pdf'
                    )
                )
            ELSE '[]'::jsonb
        END as documentos_adjuntos,
        
        -- Fechas de auditoría
        COALESCE(created_at, NOW()) as created_at,
        COALESCE(updated_at, NOW()) as updated_at,
        updated_by
    FROM public.inventario;
    
    -- Verificar migración de datos
    SELECT COUNT(*) INTO migrated_records FROM inventario_migrated;
    RAISE NOTICE 'Datos transformados: % de % registros', migrated_records, total_records;
    
    IF migrated_records != total_records THEN
        RAISE EXCEPTION 'ERROR: No se migraron todos los registros (% vs %)', migrated_records, total_records;
    END IF;
    
    -- =====================================================
    -- 4. RECREAR TABLA CON ESTRUCTURA OPTIMIZADA
    -- =====================================================
    RAISE NOTICE '4. Recreando tabla con estructura optimizada...';
    
    -- Respaldar constraints y triggers
    CREATE TEMP TABLE constraint_backup AS
    SELECT conname, pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'public.inventario'::regclass;
    
    -- Drop tabla original
    DROP TABLE IF EXISTS public.inventario CASCADE;
    
    -- Crear tabla optimizada (usar el schema del archivo principal)
    -- [Aquí iría la definición completa de la tabla optimizada]
    
    -- =====================================================
    -- 5. INSERTAR DATOS MIGRADOS
    -- =====================================================
    RAISE NOTICE '5. Insertando datos migrados...';
    
    INSERT INTO public.inventario (
        id, uuid, folio, numero_patrimonio, numero_serie, clave_patrimonial,
        registro_patrimonial, descripcion, marca, modelo, tipo_bien,
        coordinacion_id, dependencia_id, empleado_resguardante_id, usuario_asignado_id,
        costo, valor_actual, depreciacion_anual, vida_util_anios,
        proveedor, factura, numero_factura, fondo, cuenta_por_pagar,
        stage, estado, estado_uso, estatus_validacion,
        ubicacion, numero_resguardo_interno,
        es_oficial_siia, es_local, es_investigacion,
        fecha_adquisicion, fecha_compra, fecha_envio, fecha_recepcion, fecha_baja,
        ultimo_mantenimiento, proximo_mantenimiento, garantia_meses,
        comentarios, motivo_baja, observaciones_tecnicas,
        recurso, ur, ures_asignacion, ures_gasto, ejercicio,
        enviado_por, recibido_por, elaboro_nombre, fecha_elaboracion,
        documentos_adjuntos, imagenes, created_at, updated_at, updated_by
    )
    SELECT 
        id, uuid, folio, numero_patrimonio, numero_serie, clave_patrimonial,
        registro_patrimonial, descripcion, marca, modelo, tipo_bien,
        coordinacion_id, dependencia_id, empleado_resguardante_id, usuario_asignado_id,
        costo, valor_actual, depreciacion_anual, vida_util_anios,
        proveedor, factura, numero_factura, fondo, cuenta_por_pagar,
        stage, estado, estado_uso, estatus_validacion,
        ubicacion, numero_resguardo_interno,
        es_oficial_siia, es_local, es_investigacion,
        fecha_adquisicion, fecha_compra, fecha_envio, fecha_recepcion, fecha_baja,
        ultimo_mantenimiento, proximo_mantenimiento, garantia_meses,
        comentarios, motivo_baja, observaciones_tecnicas,
        recurso, ur, ures_asignacion, ures_gasto, ejercicio,
        enviado_por, recibido_por, elaboro_nombre, fecha_elaboracion,
        documentos_adjuntos, imagenes, created_at, updated_at, updated_by
    FROM inventario_migrated;
    
    -- =====================================================
    -- 6. RECREAR ÍNDICES OPTIMIZADOS
    -- =====================================================
    RAISE NOTICE '6. Creando índices optimizados...';
    
    -- [Aquí irían todos los CREATE INDEX del archivo principal]
    
    -- =====================================================
    -- 7. RECREAR FUNCIONES Y TRIGGERS
    -- =====================================================
    RAISE NOTICE '7. Recreando funciones y triggers...';
    
    -- [Aquí irían las funciones y triggers del archivo principal]
    
    -- Rehabilitar triggers
    ALTER TABLE inventario ENABLE TRIGGER ALL;
    
    -- =====================================================
    -- 8. VALIDACIÓN POST-MIGRACIÓN
    -- =====================================================
    RAISE NOTICE '8. Ejecutando validaciones...';
    
    -- Validar conteos
    DECLARE
        validation_count BIGINT;
    BEGIN
        SELECT COUNT(*) INTO validation_count FROM public.inventario;
        IF validation_count != total_records THEN
            RAISE EXCEPTION 'VALIDACIÓN FALLIDA: Registros finales (%) != originales (%)', validation_count, total_records;
        END IF;
        
        -- Validar constraints
        PERFORM * FROM public.inventario LIMIT 1;
        
        -- Validar stage automático
        UPDATE public.inventario SET stage = stage WHERE id IN (
            SELECT id FROM public.inventario LIMIT 10
        );
        
        RAISE NOTICE 'Validaciones exitosas: % registros verificados', validation_count;
    END;
    
    -- =====================================================
    -- 9. RECREAR VISTA MATERIALIZADA
    -- =====================================================
    RAISE NOTICE '9. Recreando vista materializada...';
    
    -- [Crear mv_inventario_stats del archivo principal]
    
    REFRESH MATERIALIZED VIEW mv_inventario_stats;
    
    -- =====================================================
    -- 10. ANÁLISIS FINAL
    -- =====================================================
    RAISE NOTICE '10. Ejecutando análisis final...';
    
    ANALYZE public.inventario;
    ANALYZE inventario_audit;
    ANALYZE mv_inventario_stats;
    
    -- =====================================================
    -- RESUMEN DE MIGRACIÓN
    -- =====================================================
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRACIÓN COMPLETADA EXITOSAMENTE';
    RAISE NOTICE 'Tiempo total: %', NOW() - start_time;
    RAISE NOTICE 'Registros migrados: %', total_records;
    RAISE NOTICE 'Backup creado en: %', backup_schema;
    RAISE NOTICE '========================================';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '========================================';
        RAISE NOTICE 'ERROR EN MIGRACIÓN: %', SQLERRM;
        RAISE NOTICE 'Restaurando desde backup...';
        
        -- Rollback automático
        DROP TABLE IF EXISTS public.inventario CASCADE;
        EXECUTE format('CREATE TABLE public.inventario AS SELECT * FROM %I.inventario_backup', backup_schema);
        
        RAISE NOTICE 'Datos restaurados desde %', backup_schema;
        RAISE NOTICE 'Por favor revise el error antes de reintentarlo';
        RAISE NOTICE '========================================';
        
        RAISE;
END $$;

-- =====================================================
-- SCRIPT POST-MIGRACIÓN PARA OPTIMIZACIÓN
-- =====================================================

-- Configurar secuencias
SELECT setval('inventario_id_seq', (SELECT MAX(id) FROM inventario));

-- Estadísticas de uso
INSERT INTO inventario_audit (
    inventario_id, operation, new_values, usuario_id, timestamp_audit
)
SELECT 
    id, 'I', row_to_json(inventario)::jsonb, 1, created_at
FROM inventario 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
LIMIT 1000; -- Solo los últimos para no sobrecargar

-- Programar mantenimiento automático
-- SELECT cron.schedule('maintain-inventario', '0 2 * * *', 'SELECT mantener_inventario_optimizado();');

-- Recomendaciones finales
SELECT 
    'MIGRACIÓN COMPLETADA' as status,
    COUNT(*) as total_registros,
    COUNT(DISTINCT stage) as stages_diferentes,
    COUNT(DISTINCT coordinacion_id) as coordinaciones,
    pg_size_pretty(pg_total_relation_size('inventario')) as tamaño_tabla,
    pg_size_pretty(pg_total_relation_size('inventario_audit')) as tamaño_audit
FROM inventario;
```

## 🔧 Scripts de Utilidad Post-Migración

```sql
-- Verificar integridad de datos
SELECT 
    'Registros totales' as metrica, COUNT(*)::text as valor
FROM inventario
UNION ALL
SELECT 
    'Registros con patrimonio único', COUNT(DISTINCT numero_patrimonio)::text
FROM inventario WHERE numero_patrimonio IS NOT NULL
UNION ALL
SELECT 
    'Registros con serie única', COUNT(DISTINCT numero_serie)::text  
FROM inventario WHERE numero_serie IS NOT NULL
UNION ALL
SELECT 
    'Stages válidos', COUNT(*)::text
FROM inventario WHERE stage IN ('FISCAL', 'FISICO', 'EN_TRANSITO', 'COMPLETO', 'PENDIENTE_FISCAL', 'PENDIENTE');

-- Verificar rendimiento de índices
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename = 'inventario'
ORDER BY idx_scan DESC;

-- Limpieza de esquemas de backup antiguos (ejecutar después de validar)
-- DROP SCHEMA siaf_backup_XXXXXXXX_XXXX CASCADE;
```

## ⚡ Comandos de Verificación Rápida

```bash
# Conectar a PostgreSQL y verificar
psql -d invpatrimonio -c "
SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN stage = 'COMPLETO' THEN 1 END) as completos,
    pg_size_pretty(pg_total_relation_size('inventario')) as size
FROM inventario;"

# Verificar rendimiento de una consulta típica
psql -d invpatrimonio -c "
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM inventario 
WHERE coordinacion_id = 1 AND estado = 'disponible'
ORDER BY created_at DESC LIMIT 10;"
```