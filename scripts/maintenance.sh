#!/bin/bash
# Script para activar/desactivar modo mantenimiento manualmente
# Lee MAINTENANCE_MODE del .env del servidor

ENV_FILE="/var/www/siaf-patrimonio/server/.env"
LOCK_FILE="/var/www/html/en_mantenimiento.lock"

if [ -f "$ENV_FILE" ]; then
    MAINTENANCE_MODE=$(grep -E "^MAINTENANCE_MODE=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '[:space:]"')
fi

if [ "$MAINTENANCE_MODE" = "true" ]; then
    sudo touch "$LOCK_FILE"
    echo "✅ Modo mantenimiento ACTIVADO ($LOCK_FILE creado)"
elif [ "$MAINTENANCE_MODE" = "false" ]; then
    sudo rm -f "$LOCK_FILE"
    echo "✅ Modo mantenimiento DESACTIVADO ($LOCK_FILE eliminado)"
else
    echo "❌ Error: define MAINTENANCE_MODE=true o MAINTENANCE_MODE=false"
    exit 1
fi
