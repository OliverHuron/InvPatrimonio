#!/bin/bash
# Script para ejecutar la tabla de usuarios en la base de datos

echo "🚀 Creando tabla de usuarios para InvPatrimonio..."

# Variables de conexión (lee del .env o usa valores por defecto)
DB_HOST="${DB_HOST:-localhost}"
DB_NAME="${DB_NAME:-patrimonio_db}"
DB_USER="${DB_USER:-postgres}"
DB_PORT="${DB_PORT:-5432}"

# Ejecutar el script SQL
PGPASSWORD="${DB_PASSWORD:-1234}" psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -U "$DB_USER" -f database/users_table.sql

if [ $? -eq 0 ]; then
    echo "✅ Tabla de usuarios creada exitosamente"
    echo "👤 Usuario admin creado: admin@siaf.edu / admin123"
    echo "⚠️  IMPORTANTE: Cambia la contraseña por defecto en producción"
else
    echo "❌ Error al crear la tabla de usuarios"
    exit 1
fi