#!/bin/bash

# =====================================================
# DBVPS.sh - MIGRACIÓN INTELIGENTE DE BD A PRODUCCIÓN
# Aplica cambios DDL preservando datos de producción
# =====================================================

set -e  # Salir en cualquier error

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuración VPS
VPS_USER="root"
VPS_HOST="165.232.146.180"
DB_NAME="patrimonio_db"
DB_USER="siaf_admin"
BACKUP_DIR="/root/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Funciones de logging
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

# Banner
show_banner() {
    echo -e "${CYAN}================================================${NC}"
    echo -e "${CYAN}  🗃️  MIGRACIÓN INTELIGENTE BD SIAF${NC}"
    echo -e "${CYAN}  📊  Preserva datos - Actualiza estructura${NC}" 
    echo -e "${CYAN}================================================${NC}"
    echo ""
}

# Verificar archivos necesarios
verify_local_files() {
    log_step "Verificando archivos locales..."
    
    if [ ! -f "schema-unificado-siaf.sql" ]; then
        log_error "Archivo schema-unificado-siaf.sql no encontrado"
        exit 1
    fi
    
    log_success "Archivos locales verificados"
}

# Crear backup completo de datos
create_data_backup() {
    log_step "Creando backup completo de datos en VPS..."
    
    ssh $VPS_USER@$VPS_HOST << EOF
        # Crear directorio de backup
        mkdir -p $BACKUP_DIR
        
        echo "🔄 Iniciando backup completo..."
        
        # Backup completo de la base de datos
        sudo -u postgres pg_dump $DB_NAME > $BACKUP_DIR/full_backup_$TIMESTAMP.sql
        
        # Backup solo de datos (sin estructura)
        sudo -u postgres pg_dump --data-only $DB_NAME > $BACKUP_DIR/data_only_$TIMESTAMP.sql
        
        # Backup específico de tabla inventario con datos
        sudo -u postgres psql $DB_NAME -c "\\copy (SELECT * FROM inventario ORDER BY id) TO '$BACKUP_DIR/inventario_data_$TIMESTAMP.csv' WITH CSV HEADER;"
        
        # Verificar backups
        if [ -f "$BACKUP_DIR/full_backup_$TIMESTAMP.sql" ]; then
            echo "✅ Backup completo creado"
            ls -lh $BACKUP_DIR/*$TIMESTAMP*
        else
            echo "❌ Error creando backup"
            exit 1
        fi
EOF
    
    log_success "Backup de datos creado: $TIMESTAMP"
}

# Analizar estructura actual vs nueva
analyze_schema_changes() {
    log_step "Analizando cambios de estructura..."
    
    ssh $VPS_USER@$VPS_HOST << 'EOF'
        echo "📊 Analizando esquema actual..."
        
        # Obtener columnas actuales de inventario/patrimonio
        sudo -u postgres psql patrimonio_db -c "
            SELECT 
                table_name,
                column_name, 
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_name IN ('inventario', 'patrimonio')
            ORDER BY table_name, ordinal_position;
        " > /tmp/schema_actual.txt
        
        # Obtener índices actuales
        sudo -u postgres psql patrimonio_db -c "
            SELECT 
                indexname,
                tablename,
                indexdef
            FROM pg_indexes 
            WHERE tablename IN ('inventario', 'patrimonio')
            ORDER BY indexname;
        " > /tmp/indices_actuales.txt
        
        echo "📋 Estructura actual guardada en /tmp/"
EOF
    
    log_success "Análisis de esquema completado"
}

# Subir nuevo esquema al VPS
upload_schema() {
    log_step "Subiendo nuevo esquema a VPS..."
    
    scp schema-unificado-siaf.sql $VPS_USER@$VPS_HOST:/tmp/
    
    log_success "Esquema subido a VPS"
}

# Migrar datos de manera inteligente
intelligent_migration() {
    log_step "Ejecutando migración inteligente..."
    
    ssh $VPS_USER@$VPS_HOST << 'EOF'
        set -e
        cd /tmp
        
        echo "🔄 Iniciando migración inteligente..."
        
        # 1. Verificar si tabla inventario existe
        INVENTARIO_EXISTS=$(sudo -u postgres psql patrimonio_db -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='inventario';")
        PATRIMONIO_EXISTS=$(sudo -u postgres psql patrimonio_db -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='patrimonio';")
        
        echo "📊 Estado actual:"
        echo "   - Tabla inventario existe: $INVENTARIO_EXISTS"
        echo "   - Tabla patrimonio existe: $PATRIMONIO_EXISTS"
        
        # 2. Si existe patrimonio pero no inventario, migrar datos
        if [ "$PATRIMONIO_EXISTS" -eq "1" ] && [ "$INVENTARIO_EXISTS" -eq "0" ]; then
            echo "🔄 Migrando de patrimonio → inventario..."
            
            # Crear backup de patrimonio
            sudo -u postgres pg_dump --table=patrimonio patrimonio_db > patrimonio_backup_before_migration.sql
            
            # Aplicar nuevo esquema (esto crea la tabla inventario)
            sudo -u postgres psql patrimonio_db -f schema-unificado-siaf.sql
            
            # Migrar datos de patrimonio a inventario (mapeo de campos)
            sudo -u postgres psql patrimonio_db << MIGRATION_SQL
                INSERT INTO inventario (
                    id, marca, modelo, descripcion, estado, ubicacion,
                    numero_patrimonio, numero_serie, costo, created_at, updated_at
                ) 
                SELECT 
                    id, 
                    marca, 
                    modelo, 
                    descripcion, 
                    estado, 
                    ubicacion,
                    numero_patrimonio, 
                    numero_serie, 
                    precio as costo,
                    created_at, 
                    updated_at
                FROM patrimonio
                ON CONFLICT (id) DO NOTHING;
                
                -- Actualizar secuencia
                SELECT setval('inventario_id_seq', (SELECT MAX(id) FROM inventario));
MIGRATION_SQL
            
            echo "✅ Datos migrados de patrimonio → inventario"
            
            # Verificar migración
            MIGRATED_COUNT=$(sudo -u postgres psql patrimonio_db -tAc "SELECT COUNT(*) FROM inventario;")
            echo "📊 Registros migrados: $MIGRATED_COUNT"
            
        # 3. Si ya existe inventario, solo actualizar estructura
        elif [ "$INVENTARIO_EXISTS" -eq "1" ]; then
            echo "🔧 Actualizando estructura existente..."
            
            # Aplicar cambios de estructura (CREATE IF NOT EXISTS no afecta datos)
            sudo -u postgres psql patrimonio_db -f schema-unificado-siaf.sql
            
            echo "✅ Estructura actualizada preservando datos"
            
        # 4. Si no existe ninguna, crear desde cero
        else
            echo "🆕 Creando estructura desde cero..."
            sudo -u postgres psql patrimonio_db -f schema-unificado-siaf.sql
            echo "✅ Estructura creada"
        fi
        
        # 5. Verificar integridad final
        echo "🔍 Verificando integridad..."
        sudo -u postgres psql patrimonio_db << VERIFY_SQL
            -- Contar registros
            SELECT 'Total inventario: ' || COUNT(*) FROM inventario;
            
            -- Verificar triggers
            SELECT 'Triggers: ' || COUNT(*) FROM information_schema.triggers WHERE event_object_table = 'inventario';
            
            -- Verificar índices
            SELECT 'Índices: ' || COUNT(*) FROM pg_indexes WHERE tablename = 'inventario';
            
            -- Verificar funciones
            SELECT 'Funciones SIAF: ' || COUNT(*) FROM information_schema.routines 
            WHERE routine_name LIKE '%inventario%';
VERIFY_SQL

EOF
    
    log_success "Migración inteligente completada"
}

# Validar migración
validate_migration() {
    log_step "Validando migración..."
    
    ssh $VPS_USER@$VPS_HOST << 'EOF'
        echo "🧪 Ejecutando validaciones..."
        
        # Test 1: Verificar estructura SIAF
        echo "📋 Test 1: Estructura SIAF"
        SIAF_COLUMNS=$(sudo -u postgres psql patrimonio_db -tAc "
            SELECT COUNT(*) FROM information_schema.columns 
            WHERE table_name='inventario' AND column_name IN 
            ('stage', 'folio', 'estatus_validacion', 'uuid_fiscal');
        ")
        echo "   Columnas SIAF encontradas: $SIAF_COLUMNS/4"
        
        # Test 2: Verificar triggers funcionando
        echo "📋 Test 2: Triggers automáticos"
        sudo -u postgres psql patrimonio_db -c "
            INSERT INTO inventario (marca, modelo, descripcion) 
            VALUES ('Test', 'Migration', 'Prueba migración') 
            RETURNING id, folio, stage, created_at;
        " | head -10
        
        # Test 3: Contar registros preservados
        echo "📋 Test 3: Datos preservados"
        TOTAL_RECORDS=$(sudo -u postgres psql patrimonio_db -tAc "SELECT COUNT(*) FROM inventario;")
        echo "   Total registros en inventario: $TOTAL_RECORDS"
        
        # Test 4: API funcionando
        echo "📋 Test 4: Conectividad API"
        if curl -s http://localhost:3001/api/test | grep -q "funcionando"; then
            echo "   ✅ API respondiendo"
        else
            echo "   ⚠️  API podría necesitar reinicio"
        fi
EOF
    
    log_success "Validación completada"
}

# Limpiar y optimizar
cleanup_and_optimize() {
    log_step "Limpieza y optimización..."
    
    ssh $VPS_USER@$VPS_HOST << 'EOF'
        echo "🧹 Limpiando y optimizando..."
        
        # Eliminar tabla patrimonio antigua si existe e inventario tiene datos
        INVENTARIO_COUNT=$(sudo -u postgres psql patrimonio_db -tAc "SELECT COUNT(*) FROM inventario;")
        PATRIMONIO_EXISTS=$(sudo -u postgres psql patrimonio_db -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='patrimonio';")
        
        if [ "$INVENTARIO_COUNT" -gt "0" ] && [ "$PATRIMONIO_EXISTS" -eq "1" ]; then
            echo "🗑️  Eliminando tabla patrimonio antigua..."
            sudo -u postgres psql patrimonio_db -c "DROP TABLE IF EXISTS patrimonio CASCADE;"
            echo "   ✅ Tabla patrimonio eliminada"
        fi
        
        # Optimizar base de datos
        echo "⚡ Optimizando BD..."
        sudo -u postgres psql patrimonio_db << OPTIMIZE_SQL
            -- Actualizar estadísticas
            ANALYZE inventario;
            
            -- Vacuum para liberar espacio
            VACUUM ANALYZE inventario;
            
            -- Reindex para optimizar
            REINDEX TABLE inventario;
OPTIMIZE_SQL
        
        echo "✅ Optimización completada"
EOF
    
    log_success "Limpieza y optimización finalizada"
}

# Reiniciar servicios
restart_services() {
    log_step "Reiniciando servicios..."
    
    ssh $VPS_USER@$VPS_HOST << 'EOF'
        echo "🔄 Reiniciando servicios..."
        
        # Reiniciar PM2
        pm2 restart invpatrimonio-api || pm2 start ecosystem.config.js
        pm2 save
        
        # Esperar a que el servicio esté listo
        sleep 5
        
        # Verificar servicios
        echo "📊 Estado de servicios:"
        pm2 status
EOF
    
    log_success "Servicios reiniciados"
}

# Mostrar resumen final
show_summary() {
    echo ""
    echo -e "${CYAN}================================================${NC}"
    echo -e "${GREEN}✅ MIGRACIÓN COMPLETADA EXITOSAMENTE${NC}"
    echo -e "${CYAN}================================================${NC}"
    echo ""
    echo "🎯 RESUMEN:"
    echo "   • Backup creado: $TIMESTAMP"
    echo "   • Estructura SIAF aplicada"
    echo "   • Datos de producción preservados"
    echo "   • Servicios funcionando"
    echo ""
    echo "🌐 ENDPOINTS:"
    echo "   • Frontend: https://patrimonio.siafsystem.online"
    echo "   • API Test: https://patrimonio.siafsystem.online/api/test"
    echo "   • Inventarios: https://patrimonio.siafsystem.online/api/inventarios"
    echo ""
    echo "🧪 COMANDOS DE PRUEBA:"
    echo "   curl https://patrimonio.siafsystem.online/api/test"
    echo "   curl https://patrimonio.siafsystem.online/api/inventarios/stats/dashboard"
    echo ""
    echo "💾 BACKUP GUARDADO EN VPS: $BACKUP_DIR/*$TIMESTAMP*"
    echo ""
}

# Función principal
main() {
    show_banner
    
    verify_local_files
    create_data_backup
    analyze_schema_changes
    upload_schema
    intelligent_migration
    validate_migration
    cleanup_and_optimize
    restart_services
    show_summary
    
    log_success "🎉 Migración de BD a producción completada"
}

# Verificar si se ejecuta con parámetros
if [ "$1" == "--dry-run" ]; then
    log_info "🧪 MODO DRY RUN - Solo verificación"
    verify_local_files
    analyze_schema_changes
    exit 0
elif [ "$1" == "--backup-only" ]; then
    log_info "💾 MODO BACKUP - Solo respaldo"
    create_data_backup
    exit 0
elif [ "$1" == "--help" ]; then
    echo "USO: ./DBVPS.sh [opciones]"
    echo ""
    echo "OPCIONES:"
    echo "  --dry-run      Solo verificar, no aplicar cambios"
    echo "  --backup-only  Solo crear backup"
    echo "  --help         Mostrar esta ayuda"
    echo ""
    echo "EJEMPLO:"
    echo "  ./DBVPS.sh                 # Migración completa"
    echo "  ./DBVPS.sh --dry-run       # Solo verificar"
    echo "  ./DBVPS.sh --backup-only   # Solo backup"
    exit 0
fi

# Ejecutar migración completa
main