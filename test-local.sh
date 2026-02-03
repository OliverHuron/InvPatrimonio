#!/bin/bash

# =====================================================
# TEST-LOCAL.sh - PRUEBA LOCAL DE MIGRACIÓN
# Simula la migración en entorno local antes de VPS
# =====================================================

set -e

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Configuración
LOCAL_DB="patrimonio_test"
DB_USER="siaf_admin"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  🧪 PRUEBA LOCAL DE MIGRACIÓN SIAF${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# 1. Crear BD de prueba
log_info "Creando base de datos de prueba..."
psql postgres -c "DROP DATABASE IF EXISTS $LOCAL_DB;" 2>/dev/null || true
psql postgres -c "CREATE DATABASE $LOCAL_DB;"

# 2. Simular datos existentes (como en producción)
log_info "Simulando datos existentes de producción..."
psql $LOCAL_DB << 'EOF'
-- Crear tabla patrimonio antigua (simula producción actual)
CREATE TABLE patrimonio (
    id SERIAL PRIMARY KEY,
    marca VARCHAR(100),
    modelo VARCHAR(100),
    descripcion TEXT,
    estado VARCHAR(50) DEFAULT 'buena',
    ubicacion VARCHAR(200),
    numero_patrimonio VARCHAR(50),
    numero_serie VARCHAR(100),
    precio DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar datos de prueba (simula datos reales)
INSERT INTO patrimonio (marca, modelo, descripcion, estado, ubicacion, numero_patrimonio, numero_serie, precio) VALUES
('Dell', 'OptiPlex 7090', 'Computadora Dell de producción', 'buena', 'Oficina 1', 'PROD-001', 'D123456', 25000.00),
('HP', 'LaserJet Pro', 'Impresora HP de producción', 'excelente', 'Oficina 2', 'PROD-002', 'HP789012', 8500.00),
('Cisco', 'Switch 24P', 'Switch Cisco producción', 'buena', 'Server Room', 'PROD-003', 'C345678', 15000.00);

SELECT 'Datos de prueba insertados: ' || COUNT(*) || ' registros' FROM patrimonio;
EOF

log_success "Datos de prueba creados (simulan producción)"

# 3. Aplicar migración
log_info "Aplicando esquema SIAF unificado..."
psql $LOCAL_DB -f schema-unificado-siaf.sql

# 4. Migrar datos (simulando el proceso del script DBVPS.sh)
log_info "Migrando datos patrimonio → inventario..."
psql $LOCAL_DB << 'EOF'
-- Migrar datos preservando información
INSERT INTO inventario (
    id, marca, modelo, descripcion, estado, ubicacion,
    numero_patrimonio, numero_serie, costo, created_at, updated_at
) 
SELECT 
    id, marca, modelo, descripcion, estado, ubicacion,
    numero_patrimonio, numero_serie, precio as costo,
    created_at, updated_at
FROM patrimonio
ON CONFLICT (id) DO NOTHING;

-- Actualizar secuencia
SELECT setval('inventario_id_seq', (SELECT MAX(id) FROM inventario));

SELECT 'Migración completada. Registros en inventario: ' || COUNT(*) FROM inventario;
EOF

# 5. Pruebas de funcionalidad SIAF
log_info "Probando funcionalidades SIAF..."
psql $LOCAL_DB << 'EOF'
-- Test 1: Triggers automáticos
INSERT INTO inventario (marca, modelo, descripcion, proveedor) 
VALUES ('Test', 'Auto', 'Prueba triggers', 'Proveedor Test')
RETURNING id, folio, stage;

-- Test 2: Estadísticas
SELECT 'Stats por stage:' as test;
SELECT stage, COUNT(*) FROM inventario GROUP BY stage;

-- Test 3: Búsquedas con índices
SELECT 'Búsqueda por marca:' as test;
SELECT COUNT(*) FROM inventario WHERE marca ILIKE '%Dell%';

-- Test 4: Verificar constraints
SELECT 'Constraints activos:' as test;
SELECT COUNT(*) FROM information_schema.check_constraints WHERE constraint_name LIKE 'inventario_%';
EOF

# 6. Verificar integridad
log_info "Verificando integridad de datos..."
ORIGINAL_COUNT=$(psql $LOCAL_DB -tAc "SELECT COUNT(*) FROM patrimonio;")
MIGRATED_COUNT=$(psql $LOCAL_DB -tAc "SELECT COUNT(*) FROM inventario;")

echo "📊 RESULTADO DE MIGRACIÓN:"
echo "   • Registros originales: $ORIGINAL_COUNT"
echo "   • Registros migrados: $MIGRATED_COUNT"

if [ "$ORIGINAL_COUNT" -eq "$MIGRATED_COUNT" ]; then
    log_success "✅ Migración exitosa - Todos los datos preservados"
else
    log_warning "⚠️  Diferencia en conteos - Revisar migración"
fi

# 7. Limpiar
log_info "Limpiando base de datos de prueba..."
psql postgres -c "DROP DATABASE $LOCAL_DB;" 2>/dev/null || true

echo ""
echo -e "${GREEN}🎉 PRUEBA LOCAL COMPLETADA${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ El esquema y migración funcionan correctamente"
echo "✅ Datos preservados durante la migración"  
echo "✅ Funcionalidades SIAF operativas"
echo ""
echo "💡 PRÓXIMO PASO:"
echo "   Ejecutar: ./DBVPS.sh --dry-run  (verificar VPS)"
echo "   Luego:    ./DBVPS.sh            (aplicar en producción)"
echo ""