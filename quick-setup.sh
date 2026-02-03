#!/bin/bash

# Script de configuración rápida para VPS Ubuntu/Debian
# InvPatrimonio - Configuración automática de SSH y variables

set -e

# Colores para output  
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "🚀 InvPatrimonio - Configuración Rápida VPS"
echo "=========================================="

# Detectar información del servidor
VPS_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
CURRENT_USER=$(whoami)

log_info "Servidor detectado: $CURRENT_USER@$VPS_IP"

# Generar SSH keys para GitHub
log_info "Generando claves SSH para GitHub Deploy..."
ssh-keygen -t rsa -b 4096 -C "github-deploy-invpatrimonio" -f ~/.ssh/github_deploy -N "" -q

# Configurar SSH config
cat >> ~/.ssh/config << EOF

# InvPatrimonio GitHub Deploy
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_deploy
    StrictHostKeyChecking no
EOF

# Agregar clave pública a authorized_keys para GitHub Actions
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh

log_info "✅ Claves SSH generadas correctamente"

echo ""
echo "📋 CONFIGURACIÓN DE GITHUB SECRETS"
echo "=================================="
echo ""
echo "🔐 En tu repositorio GitHub, ve a: Settings → Secrets → Actions"
echo "    Agrega estos secrets:"
echo ""

echo -e "${GREEN}1. VPS_SSH_KEY${NC}"
echo "   Copia TODO el contenido de la clave PRIVADA:"
echo "   ╭─────────────────────────────────────────────────────"
cat ~/.ssh/github_deploy
echo "   ╰─────────────────────────────────────────────────────"
echo ""

echo -e "${GREEN}2. VPS_HOST${NC}"
echo "   Valor: $VPS_IP"
echo ""

echo -e "${GREEN}3. VPS_USER${NC}"  
echo "   Valor: $CURRENT_USER"
echo ""

echo -e "${GREEN}4. DEPLOYMENT_PATH${NC}"
echo "   Valor: /var/www/invpatrimonio"
echo ""

echo -e "${GREEN}5. HEALTH_URL${NC}"
echo "   Valor: https://patrimonio.siafsystem.online/health"
echo ""

echo "📌 OPCIONAL: SLACK_WEBHOOK_URL (para notificaciones)"
echo ""

# Crear directorio del proyecto si no existe
log_info "Preparando estructura de directorios..."
sudo mkdir -p /var/www/invpatrimonio
sudo chown -R $CURRENT_USER:$CURRENT_USER /var/www/
mkdir -p /var/backups/invpatrimonio

# Verificar instalaciones necesarias
log_info "Verificando dependencias básicas..."

# Node.js
if ! command -v node &> /dev/null; then
    log_warn "Node.js no instalado. Instalando..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
fi

NODE_VERSION=$(node --version)
log_info "Node.js version: $NODE_VERSION"

# PM2  
if ! command -v pm2 &> /dev/null; then
    log_warn "PM2 no instalado. Instalando..."
    sudo npm install -g pm2
    pm2 startup systemd -u $CURRENT_USER --hp /home/$CURRENT_USER
fi

# Git
if ! command -v git &> /dev/null; then
    log_warn "Git no instalado. Instalando..."
    sudo apt update
    sudo apt install -y git
fi

echo ""
echo "🎯 PRÓXIMOS PASOS"
echo "================"
echo ""
echo "✅ 1. Configura los GitHub Secrets mostrados arriba"
echo "✅ 2. Agrega esta clave PÚBLICA como Deploy Key en GitHub:"
echo "      Repositorio → Settings → Deploy keys → Add deploy key"
echo "      ✅ Marca 'Allow write access'"
echo ""
echo "   ╭─────────────────────────────────────────────────────"
cat ~/.ssh/github_deploy.pub  
echo "   ╰─────────────────────────────────────────────────────"
echo ""
echo "✅ 3. Ejecuta el auto-install completo:"
echo "      wget https://raw.githubusercontent.com/yourusername/InvPatrimonio/main/auto-install.sh"
echo "      chmod +x auto-install.sh"
echo "      nano auto-install.sh  # Editar variables"
echo "      ./auto-install.sh"
echo ""
echo "✅ 4. O haz push a main para deployment automático:"
echo "      git push origin main"
echo ""

# Test de conectividad a GitHub
log_info "Testing conectividad a GitHub..."
if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    log_info "✅ Conectividad a GitHub OK"
else
    log_warn "⚠️  Testing de GitHub connection..."
    ssh -T git@github.com 2>&1 || log_info "Respuesta normal de GitHub (expected)"
fi

echo ""
echo "📊 INFORMACIÓN DEL SISTEMA"
echo "=========================="
echo "🖥️  OS: $(lsb_release -d | cut -f2)"
echo "💾 RAM: $(free -h | grep '^Mem:' | awk '{print $2}')"  
echo "💽 Disk: $(df -h / | tail -1 | awk '{print $4}') disponible"
echo "🌐 IP: $VPS_IP"
echo "👤 User: $CURRENT_USER"
echo ""

log_info "🎉 Configuración inicial completada!"
log_warn "Recuerda: Configurar GitHub Secrets antes del primer deployment"

echo ""
echo "📞 SOPORTE"
echo "=========="
echo "Si tienes problemas:"
echo "• Verifica que todos los GitHub Secrets estén configurados"
echo "• Prueba conexión SSH: ssh $CURRENT_USER@$VPS_IP" 
echo "• Revisa logs: tail -f /var/log/nginx/error.log"
echo "• Monitor: pm2 logs"