#!/bin/bash

# InvPatrimonio Auto-Deploy Script for VPS
# Este script instala todo lo necesario automáticamente

set -e

echo "🚀 Instalación Automática de InvPatrimonio"
echo "========================================"

# Variables (CONFIGURADAS AUTOMÁTICAMENTE)
DOMAIN="patrimonio.siafsystem.online"
DB_PASSWORD="InvPat2026_DB_Secure"
REDIS_PASSWORD="InvPat2026_Redis_Secure"
JWT_SECRET="9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08f1a2b3c4d5e6f7890abcdef1234567890"
GITHUB_REPO="https://github.com/OliverHuron/InvPatrimonio.git"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 1. PREPARACIÓN DEL SISTEMA
log_info "Actualizando sistema..."
apt update && apt upgrade -y

log_info "Instalando dependencias básicas..."
apt install -y curl wget git nginx software-properties-common gnupg2 ufw fail2ban

# 2. CONFIGURAR FIREWALL
log_info "Configurando firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

# 3. INSTALAR NODE.JS
log_info "Instalando Node.js 18 LTS..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# Verificar instalación
node_version=$(node --version)
log_info "Node.js instalado: $node_version"

# 4. INSTALAR PM2
log_info "Instalando PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root

# 5. INSTALAR POSTGRESQL
log_info "Instalando PostgreSQL..."
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
apt update
apt install -y postgresql-15 postgresql-client-15 postgresql-contrib-15

# Iniciar PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Configurar base de datos
log_info "Configurando base de datos..."
sudo -u postgres psql -c "CREATE DATABASE invpatrimonio;"
sudo -u postgres psql -c "CREATE USER invpatrimonio_user WITH ENCRYPTED PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE invpatrimonio TO invpatrimonio_user;"

# Optimizar PostgreSQL
log_info "Optimizando PostgreSQL..."
PG_CONFIG="/etc/postgresql/15/main/postgresql.conf"
cp $PG_CONFIG $PG_CONFIG.backup

cat >> $PG_CONFIG << EOF

# InvPatrimonio Optimizations
shared_buffers = 2GB
work_mem = 256MB
maintenance_work_mem = 1GB
effective_cache_size = 6GB
random_page_cost = 1.1
seq_page_cost = 1.0
max_connections = 200
wal_buffers = 64MB
checkpoint_timeout = 15min
max_wal_size = 4GB
min_wal_size = 1GB
log_min_duration_statement = 1000
EOF

systemctl restart postgresql

# 6. INSTALAR REDIS CLUSTER
log_info "Instalando Redis Cluster..."
apt install -y redis-server redis-tools

# Crear configuraciones de cluster
mkdir -p /etc/redis/cluster/{7000,7001,7002}
mkdir -p /var/lib/redis/{7000,7001,7002}
chown -R redis:redis /var/lib/redis/

# Configurar nodos
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
requirepass $REDIS_PASSWORD
masterauth $REDIS_PASSWORD
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
EOF

    # Crear servicio systemd
    cat > /etc/systemd/system/redis-$port.service << EOF
[Unit]
Description=Redis In-Memory Data Store (Port $port)
After=network.target

[Service]
User=redis
Group=redis
ExecStart=/usr/bin/redis-server /etc/redis/cluster/$port/redis.conf
ExecStop=/usr/bin/redis-cli -p $port -a $REDIS_PASSWORD shutdown
TimeoutStopSec=0
Restart=always

[Install]
WantedBy=multi-user.target
EOF
done

# Iniciar servicios Redis
systemctl daemon-reload
systemctl enable redis-7000 redis-7001 redis-7002
systemctl start redis-7000 redis-7001 redis-7002

# Crear cluster
log_info "Creando Redis cluster..."
sleep 5
echo "yes" | redis-cli -a $REDIS_PASSWORD --cluster create 127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 --cluster-replicas 0

# 7. CONFIGURAR PROYECTO
log_info "Clonando proyecto InvPatrimonio..."
mkdir -p /var/www
cd /var/www
git clone $GITHUB_REPO invpatrimonio
cd invpatrimonio

# Configurar permisos
chown -R www-data:www-data /var/www/invpatrimonio

# 8. CONFIGURAR VARIABLES DE ENTORNO
log_info "Configurando variables de entorno..."
cd /var/www/invpatrimonio/server
cat > .env << EOF
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://$DOMAIN

DB_HOST=localhost
DB_NAME=invpatrimonio
DB_USER=invpatrimonio_user
DB_PASSWORD=$DB_PASSWORD

REDIS_NODES=127.0.0.1:7000,127.0.0.1:7001,127.0.0.1:7002
REDIS_PASSWORD=$REDIS_PASSWORD

JWT_SECRET=$JWT_SECRET

# Cache settings
CACHE_TTL=3600
SESSION_TTL=86400

# Upload settings
MAX_FILE_SIZE=10485760
UPLOAD_PATH=/var/www/invpatrimonio/uploads
EOF

# 9. INSTALAR DEPENDENCIAS Y BUILD
log_info "Instalando dependencias del servidor..."
npm ci --production

log_info "Building servidor..."
npm run build

log_info "Instalando dependencias del cliente..."
cd ../client
npm ci

log_info "Building cliente..."
npm run build

# 10. APLICAR ESQUEMA DE BASE DE DATOS
log_info "Aplicando esquema optimizado de base de datos..."
cd /var/www/invpatrimonio
if [ -f "database_optimized.sql" ]; then
    sudo -u postgres psql invpatrimonio < database_optimized.sql
fi

# 11. CONFIGURAR NGINX
log_info "Configurando Nginx..."
cat > /etc/nginx/sites-available/$DOMAIN << EOF
# Rate limiting
limit_req_zone \$binary_remote_addr zone=api:10m rate=100r/m;
limit_req_zone \$binary_remote_addr zone=login:10m rate=5r/m;

server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL Configuration (will be updated by Certbot)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types application/javascript application/json text/css text/plain;

    # Frontend
    location / {
        root /var/www/invpatrimonio/client/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
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
nginx -t
systemctl restart nginx

# 12. CONFIGURAR SSL CON CERTBOT
log_info "Instalando Certbot y configurando SSL..."
apt install -y certbot python3-certbot-nginx

# Obtener certificado SSL
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

# Configurar auto-renovación
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -

# 13. INICIAR APLICACIÓN CON PM2
log_info "Iniciando aplicación..."
cd /var/www/invpatrimonio/server
pm2 start ecosystem.config.js --env production
pm2 save

# 14. CREAR SCRIPTS DE MANTENIMIENTO
log_info "Creando scripts de mantenimiento..."

# Deploy script
cat > /var/www/invpatrimonio/deploy.sh << 'EOF'
#!/bin/bash
set -e

cd /var/www/invpatrimonio

# Pull latest code
git fetch origin
git reset --hard origin/main

# Install dependencies
cd server && npm ci --production && npm run build
cd ../client && npm ci && npm run build

# Restart services
cd ../server
pm2 restart all
systemctl reload nginx

echo "✅ Deploy completed successfully!"
EOF

# Monitor script
cat > /var/www/invpatrimonio/monitor.sh << 'EOF'
#!/bin/bash

echo "=== InvPatrimonio Status ==="
echo "Date: $(date)"
echo

echo "🐘 PostgreSQL:"
sudo -u postgres psql -c "SELECT version();" invpatrimonio | head -1

echo
echo "🔴 Redis Cluster:"
redis-cli -c -p 7000 -a $REDIS_PASSWORD ping

echo
echo "⚙️ PM2 Status:"
pm2 status

echo  
echo "🌐 Nginx:"
systemctl is-active nginx

echo
echo "💾 Disk:"
df -h /var/www/invpatrimonio

echo
echo "🧠 Memory:"
free -h
EOF

# Backup script
cat > /var/www/invpatrimonio/backup.sh << EOF
#!/bin/bash

BACKUP_DIR="/var/backups/invpatrimonio"
DATE=\$(date +%Y%m%d_%H%M%S)
mkdir -p \$BACKUP_DIR

# Database backup
sudo -u postgres pg_dump invpatrimonio > \$BACKUP_DIR/db_\$DATE.sql

# Files backup
tar -czf \$BACKUP_DIR/files_\$DATE.tar.gz -C /var/www/invpatrimonio .

# Keep only 7 days
find \$BACKUP_DIR -mtime +7 -delete

echo "Backup completed: \$DATE"
EOF

chmod +x /var/www/invpatrimonio/*.sh

# Configurar backup diario
echo "0 2 * * * /var/www/invpatrimonio/backup.sh" | crontab -

# 15. VERIFICACIONES FINALES
log_info "Realizando verificaciones finales..."

# Verificar servicios
systemctl is-active postgresql || log_error "PostgreSQL no está activo"
systemctl is-active nginx || log_error "Nginx no está activo"
systemctl is-active redis-7000 || log_error "Redis cluster no está activo"

# Test de conectividad
sleep 10
curl -f http://localhost:3001/health || log_warn "API no responde aún (normal en primera instalación)"

log_info "🎉 ¡Instalación completada!"
echo "================================"
echo "🌐 URL: https://$DOMAIN"
echo "💚 Health: https://$DOMAIN/health"
echo ""
echo "📊 Monitoreo: /var/www/invpatrimonio/monitor.sh"
echo "🔄 Deploy: /var/www/invpatrimonio/deploy.sh"  
echo "💾 Backup: /var/www/invpatrimonio/backup.sh"
echo ""
echo "📝 Logs:"
echo "  - App: /var/www/invpatrimonio/server/logs/"
echo "  - Nginx: /var/log/nginx/${DOMAIN}_*.log"
echo "  - PM2: pm2 logs"
echo ""
log_warn "IMPORTANTE: El servicio puede tardar 1-2 minutos en estar completamente disponible."