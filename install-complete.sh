#!/bin/bash

# =======================================================================
# InvPatrimonio - Instalación Completa Automatizada
# Script único que configura SSH + instala todo el sistema
# =======================================================================

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# =======================================================================
# CONFIGURACIÓN - EDITAR ANTES DE EJECUTAR
# =======================================================================
DOMAIN="patrimonio.siafsystem.online"
DB_PASSWORD="SiafProd2024Secure#"
REDIS_PASSWORD="InvPat2026_Redis_Secure"
JWT_SECRET="9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08f1a2b3c4d5e6f7890abcdef1234567890"
GITHUB_REPO="https://github.com/OliverHuron/InvPatrimonio.git"

# Detectar información del servidor
VPS_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
CURRENT_USER=$(whoami)

echo "🚀 InvPatrimonio - Instalación Completa Automatizada"
echo "===================================================="
echo "🖥️  Servidor: $CURRENT_USER@$VPS_IP"
echo "🌐 Dominio: $DOMAIN"
echo "📦 Repositorio: $GITHUB_REPO"
echo ""

# =======================================================================
# STEP 1: CONFIGURAR SSH PARA GITHUB
# =======================================================================
log_step "1/10: Configurando SSH Keys para GitHub"

if [ ! -f ~/.ssh/github_deploy ]; then
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

    # Agregar clave pública a authorized_keys
    cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys
    chmod 700 ~/.ssh

    echo ""
    echo "🔐 CONFIGURAR EN GITHUB - PASO REQUERIDO:"
    echo "========================================"
    echo ""
    echo "1. Ve a: https://github.com/OliverHuron/InvPatrimonio/settings/keys"
    echo "2. Click 'Add deploy key'"
    echo "3. Title: VPS InvPatrimonio Deploy Key"
    echo "4. ✅ Marca 'Allow write access'"
    echo "5. Key (copia esta clave PÚBLICA):"
    echo ""
    echo "╭─────────────────────────────────────────────────────"
    cat ~/.ssh/github_deploy.pub
    echo "╰─────────────────────────────────────────────────────"
    echo ""
    echo "6. Configura GitHub Secrets en:"
    echo "   https://github.com/OliverHuron/InvPatrimonio/settings/secrets/actions"
    echo ""
    echo "   VPS_SSH_KEY = (copia la clave PRIVADA completa):"
    echo "   ╭─────────────────────────────────────────────────────"
    cat ~/.ssh/github_deploy
    echo "   ╰─────────────────────────────────────────────────────"
    echo ""
    echo "   VPS_HOST = $VPS_IP"
    echo "   VPS_USER = $CURRENT_USER"
    echo "   DEPLOYMENT_PATH = /var/www/invpatrimonio"
    echo "   HEALTH_URL = https://$DOMAIN/health"
    echo ""
    
    read -p "¿Has configurado la Deploy Key y los Secrets en GitHub? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "Por favor configura GitHub primero y vuelve a ejecutar el script"
        exit 1
    fi
else
    log_info "Claves SSH ya configuradas"
fi

# =======================================================================
# STEP 2: ACTUALIZAR SISTEMA E INSTALAR DEPENDENCIAS
# =======================================================================
log_step "2/10: Actualizando sistema e instalando dependencias"

apt update && apt upgrade -y
apt install -y curl wget git nginx software-properties-common gnupg2 lsb-release ca-certificates

# =======================================================================
# STEP 3: INSTALAR NODE.JS 18+
# =======================================================================
log_step "3/10: Instalando Node.js 18 LTS"

if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    apt install -y nodejs
fi

NODE_VERSION=$(node --version)
log_info "Node.js instalado: $NODE_VERSION"

# Instalar PM2
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    pm2 startup systemd -u $CURRENT_USER --hp /home/$CURRENT_USER
fi

# =======================================================================
# STEP 4: INSTALAR POSTGRESQL 16
# =======================================================================
log_step "4/10: Instalando PostgreSQL 16"

# Agregar repositorio oficial
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list

apt update
apt install -y postgresql-16 postgresql-client-16 postgresql-contrib-16

# Iniciar servicio
systemctl start postgresql
systemctl enable postgresql

# Crear base de datos y usuario
log_info "Configurando base de datos..."
sudo -u postgres psql << EOF
CREATE DATABASE patrimonio_db;
-- Usuario siaf_admin ya existe, solo asignar privilegios
GRANT ALL PRIVILEGES ON DATABASE patrimonio_db TO siaf_admin;
ALTER USER siaf_admin CREATEDB;
\q
EOF

# Configurar postgresql.conf para rendimiento
POSTGRES_VERSION="16"
POSTGRES_CONF="/etc/postgresql/$POSTGRES_VERSION/main/postgresql.conf"

log_info "Optimizando configuración PostgreSQL..."
cp $POSTGRES_CONF $POSTGRES_CONF.backup

cat >> $POSTGRES_CONF << EOF

# ===== InvPatrimonio Performance Optimizations =====
shared_buffers = 2GB
work_mem = 256MB
maintenance_work_mem = 1GB
effective_cache_size = 6GB
random_page_cost = 1.1
seq_page_cost = 1.0

# Connections
max_connections = 200
superuser_reserved_connections = 3

# WAL and Checkpoints
wal_buffers = 64MB
checkpoint_timeout = 15min
max_wal_size = 4GB
min_wal_size = 1GB

# Logging for monitoring
log_destination = 'stderr'
logging_collector = on
log_directory = 'log'
log_min_duration_statement = 1000
EOF

systemctl restart postgresql
log_info "PostgreSQL 16 configurado correctamente"

# =======================================================================
# STEP 5: INSTALAR REDIS CLUSTER
# =======================================================================
log_step "5/10: Instalando Redis Cluster"

apt install -y redis-server redis-tools

# Crear directorios para cluster
mkdir -p /etc/redis/cluster/{7000,7001,7002}

# Configurar nodos del cluster
for port in 7000 7001 7002; do
cat > /etc/redis/cluster/$port/redis.conf << EOF
port $port
cluster-enabled yes
cluster-config-file nodes-$port.conf
cluster-node-timeout 5000
appendonly yes
dir /var/lib/redis/$port
bind 127.0.0.1
protected-mode yes
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
EOF

# Crear directorio de datos
mkdir -p /var/lib/redis/$port
chown redis:redis /var/lib/redis/$port

# Crear servicio systemd
cat > /etc/systemd/system/redis-$port.service << EOF
[Unit]
Description=Redis In-Memory Data Store (Port $port)
After=network.target

[Service]
User=redis
Group=redis
ExecStart=/usr/bin/redis-server /etc/redis/cluster/$port/redis.conf
ExecStop=/usr/bin/redis-cli -p $port shutdown
TimeoutStopSec=0
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl enable redis-$port
systemctl start redis-$port
done

# Crear cluster
sleep 3
log_info "Creando cluster Redis..."
redis-cli --cluster create 127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 --cluster-replicas 0 --cluster-yes

log_info "Redis Cluster configurado correctamente"

# =======================================================================
# STEP 6: CLONAR PROYECTO DESDE GITHUB
# =======================================================================
log_step "6/10: Clonando proyecto desde GitHub"

mkdir -p /var/www
cd /var/www

if [ -d "invpatrimonio" ]; then
    log_info "Actualizando código existente..."
    cd invpatrimonio
    git fetch origin
    git reset --hard origin/main
else
    log_info "Clonando repositorio..."
    git clone $GITHUB_REPO invpatrimonio
    cd invpatrimonio
fi

chown -R $CURRENT_USER:$CURRENT_USER /var/www/invpatrimonio

# =======================================================================
# STEP 7: APLICAR ESQUEMA DE BASE DE DATOS
# =======================================================================
log_step "7/10: Aplicando esquema optimizado de base de datos"

if [ -f "IMPLEMENTACION_COMPLETA.sql" ]; then
    log_info "Aplicando schema desde IMPLEMENTACION_COMPLETA.sql..."
    sudo -u postgres psql patrimonio_db < IMPLEMENTACION_COMPLETA.sql
else
    log_error "Archivo IMPLEMENTACION_COMPLETA.sql no encontrado"
    exit 1
fi

# =======================================================================
# STEP 8: CONFIGURAR VARIABLES DE ENTORNO
# =======================================================================
log_step "8/10: Configurando variables de entorno"

cd /var/www/invpatrimonio/server

cat > .env << EOF
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://$DOMAIN

DB_HOST=localhost
DB_NAME=patrimonio_db
DB_USER=siaf_admin
DB_PASSWORD=$DB_PASSWORD

REDIS_NODES=127.0.0.1:7000,127.0.0.1:7001,127.0.0.1:7002
REDIS_PASSWORD=

JWT_SECRET=$JWT_SECRET

# Cache settings
CACHE_TTL=3600
SESSION_TTL=86400

# Upload settings
MAX_FILE_SIZE=10485760
UPLOAD_PATH=/var/www/invpatrimonio/uploads
EOF

# =======================================================================
# STEP 9: INSTALAR DEPENDENCIAS Y BUILD
# =======================================================================
log_step "9/10: Instalando dependencias y compilando"

log_info "Instalando dependencias del servidor..."
npm ci --production || npm install --production

log_info "Building servidor..."
npm run build

log_info "Instalando dependencias del cliente..."
cd ../client
npm ci || npm install

log_info "Building cliente..."
npm run build

# =======================================================================
# STEP 10: CONFIGURAR NGINX + SSL
# =======================================================================
log_step "10/10: Configurando Nginx + SSL"

# Configurar nginx
cat > /etc/nginx/sites-available/$DOMAIN << EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;

    # Frontend (Static Files)
    location / {
        root /var/www/invpatrimonio/client/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3001;
        access_log off;
    }

    access_log /var/log/nginx/${DOMAIN}_access.log;
    error_log /var/log/nginx/${DOMAIN}_error.log;
}
EOF

# Habilitar sitio
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx config
nginx -t

# Instalar Certbot para SSL
apt install -y certbot python3-certbot-nginx

# Obtener certificado SSL
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

# Auto-renovación
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -

systemctl restart nginx

# =======================================================================
# FINALIZACIÓN: INICIAR SERVICIOS
# =======================================================================
log_info "Iniciando servicios..."

cd /var/www/invpatrimonio/server
pm2 start ecosystem.config.js --env production
pm2 save

# Crear script de backup
cat > /var/www/invpatrimonio/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/invpatrimonio"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Database backup
sudo -u postgres pg_dump invpatrimonio > $BACKUP_DIR/db_$DATE.sql

# Files backup  
tar -czf $BACKUP_DIR/files_$DATE.tar.gz -C /var/www/invpatrimonio .

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
echo "Backup completed: $DATE"
EOF

chmod +x /var/www/invpatrimonio/backup.sh

# Backup diario
echo "0 2 * * * /var/www/invpatrimonio/backup.sh" | crontab -

# =======================================================================
# RESUMEN FINAL
# =======================================================================
echo ""
echo "🎉 ¡INSTALACIÓN COMPLETADA EXITOSAMENTE!"
echo "======================================="
echo ""
echo "✅ PostgreSQL 16 configurado y optimizado"
echo "✅ Redis Cluster (3 nodos) funcionando"
echo "✅ Node.js + PM2 ejecutando la aplicación"
echo "✅ Nginx + SSL configurado"
echo "✅ Backup automático programado"
echo ""
echo "🌐 URLs del sistema:"
echo "   Frontend: https://$DOMAIN"
echo "   API: https://$DOMAIN/api"
echo "   Health: https://$DOMAIN/health"
echo ""
echo "🔐 Credenciales por defecto:"
echo "   Usuario: admin"
echo "   Password: admin123"
echo "   ⚠️  CAMBIAR INMEDIATAMENTE EN PRODUCCIÓN"
echo ""
echo "📊 Verificar servicios:"
echo "   pm2 status"
echo "   systemctl status postgresql nginx redis-7000"
echo "   curl https://$DOMAIN/health"
echo ""
echo "📦 Auto-deployment configurado:"
echo "   git push origin main → Deploy automático"
echo ""

log_info "🚀 InvPatrimonio está listo para producción!"