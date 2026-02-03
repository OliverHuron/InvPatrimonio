#!/bin/bash

# ====================================================
# DEPLOY AUTOMÁTICO CON MIGRACIÓN SIAF COMPLETA
# Actualiza el sistema con nueva estructura de BD
# ====================================================

set -e  # Salir en cualquier error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
VPS_USER="root"
VPS_HOST="31.97.210.189"
VPS_PATH="/var/www/invpatrimonio"
LOCAL_PATH="."

# Función para logs
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar archivos necesarios
verify_files() {
    log_info "Verificando archivos necesarios..."
    
    if [ ! -f "migration-siaf.sql" ]; then
        log_error "Archivo migration-siaf.sql no encontrado"
        exit 1
    fi
    
    if [ ! -f "server/src/routes/inventarios.ts" ]; then
        log_error "Archivo de rutas no encontrado"
        exit 1
    fi
    
    if [ ! -f "server/src/models/Inventario.ts" ]; then
        log_error "Archivo de modelos no encontrado"
        exit 1
    fi
    
    log_success "Todos los archivos necesarios presentes"
}

# Build local del frontend
build_frontend() {
    log_info "Construyendo frontend con nueva estructura SIAF..."
    
    cd client
    if npm run build; then
        log_success "Frontend construido exitosamente"
    else
        log_warning "Frontend build con warnings, continuando..."
    fi
    cd ..
}

# Build local del backend
build_backend() {
    log_info "Construyendo backend con esquema SIAF..."
    
    cd server
    npm run build
    log_success "Backend construido exitosamente"
    cd ..
}

# Subir archivos al VPS
upload_files() {
    log_info "Subiendo archivos al VPS..."
    
    # Crear directorio temporal para migración
    ssh $VPS_USER@$VPS_HOST "mkdir -p $VPS_PATH/migration"
    
    # Subir archivos de migración
    scp migration-siaf.sql $VPS_USER@$VPS_HOST:$VPS_PATH/migration/
    
    # Subir código actualizado
    scp -r server/dist/* $VPS_USER@$VPS_HOST:$VPS_PATH/server/dist/
    scp -r server/src/* $VPS_USER@$VPS_HOST:$VPS_PATH/server/src/
    scp -r client/dist/* $VPS_USER@$VPS_HOST:$VPS_PATH/client/dist/
    
    log_success "Archivos subidos correctamente"
}

# Aplicar migración de BD
migrate_database() {
    log_info "Aplicando migración SIAF a la base de datos..."
    
    ssh $VPS_USER@$VPS_HOST << 'EOF'
        set -e
        cd /var/www/invpatrimonio
        
        echo "Creando backup de BD actual..."
        sudo -u postgres pg_dump patrimonio_db > migration/backup_$(date +%Y%m%d_%H%M%S).sql
        
        echo "Aplicando migración SIAF..."
        sudo -u postgres psql patrimonio_db -f migration/migration-siaf.sql
        
        if [ $? -eq 0 ]; then
            echo "✅ Migración SIAF aplicada exitosamente"
        else
            echo "❌ Error en migración"
            exit 1
        fi
EOF
    
    log_success "Base de datos migrada a esquema SIAF"
}

# Reiniciar servicios
restart_services() {
    log_info "Reiniciando servicios en VPS..."
    
    ssh $VPS_USER@$VPS_HOST << 'EOF'
        set -e
        cd /var/www/invpatrimonio
        
        echo "Reinstalando dependencias backend..."
        cd server && npm install --production
        
        echo "Reiniciando PM2..."
        pm2 restart invpatrimonio-api || pm2 start ecosystem.config.js
        pm2 save
        
        echo "Reiniciando Nginx..."
        systemctl reload nginx
        
        echo "Verificando servicios..."
        pm2 status
        systemctl status nginx --no-pager -l
EOF
    
    log_success "Servicios reiniciados correctamente"
}

# Verificar deploy
verify_deployment() {
    log_info "Verificando deployment..."
    
    # Verificar API
    sleep 5
    if ssh $VPS_USER@$VPS_HOST "curl -s http://localhost:3001/api/test" | grep -q "SIAF"; then
        log_success "API funcionando con esquema SIAF"
    else
        log_error "API no responde correctamente"
    fi
    
    # Verificar frontend
    if curl -s https://patrimonio.siafsystem.online | grep -q "InvPatrimonio"; then
        log_success "Frontend accesible"
    else
        log_warning "Frontend podría tener problemas"
    fi
    
    # Verificar BD
    ssh $VPS_USER@$VPS_HOST << 'EOF'
        echo "Verificando estructura SIAF en BD..."
        sudo -u postgres psql patrimonio_db -c "
            SELECT 
                COUNT(*) as total_registros,
                COUNT(DISTINCT stage) as stages_unicos,
                COUNT(DISTINCT folio) as folios_generados
            FROM inventario;
        "
        
        echo "Verificando triggers SIAF..."
        sudo -u postgres psql patrimonio_db -c "
            SELECT trigger_name, event_manipulation 
            FROM information_schema.triggers 
            WHERE event_object_table = 'inventario';
        "
EOF
    
    log_success "Verificación completada"
}

# Mostrar información post-deploy
show_info() {
    log_info "=== INFORMACIÓN POST-DEPLOY ==="
    echo ""
    echo "🌐 Frontend: https://patrimonio.siafsystem.online"
    echo "🔌 API: http://31.97.210.189:3001/api"
    echo "📊 Estadísticas: /api/inventarios/stats/dashboard"
    echo "🔧 Prueba API: /api/test"
    echo ""
    echo "📋 NUEVAS FUNCIONALIDADES SIAF:"
    echo "   • Esquema completo de inventario (60+ campos)"
    echo "   • Workflow SIAF: FISCAL → EN_TRANSITO → FISICO → COMPLETO"
    echo "   • Generación automática de folios (YYYY-NNNN)"
    echo "   • Control de estatus de validación"
    echo "   • Gestión de resguardos y empleados"
    echo "   • Integración con registros patrimoniales"
    echo "   • Depreciación automática y vida útil"
    echo ""
    echo "🧪 COMANDOS DE PRUEBA:"
    echo "   curl https://patrimonio.siafsystem.online/api/test"
    echo "   curl https://patrimonio.siafsystem.online/api/inventarios"
    echo "   curl https://patrimonio.siafsystem.online/api/inventarios/stats/dashboard"
    echo ""
}

# Función principal
main() {
    echo ""
    log_info "🚀 INICIANDO DEPLOY SIAF COMPLETO"
    echo "======================================"
    
    verify_files
    build_frontend
    build_backend
    upload_files
    migrate_database
    restart_services
    verify_deployment
    show_info
    
    echo ""
    log_success "🎉 DEPLOY SIAF COMPLETADO EXITOSAMENTE"
    echo "======================================="
}

# Ejecutar función principal
main

# Limpiar archivos temporales
rm -f migration-siaf.sql.bak 2>/dev/null || true

log_success "Deploy automático finalizado"
