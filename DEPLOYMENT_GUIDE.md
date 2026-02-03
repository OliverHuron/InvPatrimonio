# 🚀 Guía Completa de Deployment InvPatrimonio en VPS

## 📋 Resumen del Deployment

Esta guía te llevará paso a paso para configurar InvPatrimonio en tu VPS con:
- ✅ **Redis Cluster** para cache de alto rendimiento
- ✅ **Nginx** con subdominio `patrimonio.siafsystem.online`  
- ✅ **SSL/TLS** con Certbot (Let's Encrypt)
- ✅ **Auto-deployment** desde GitHub
- ✅ **PM2** para gestión de procesos
- ✅ **PostgreSQL** optimizado

---

## 🔧 **PARTE 1: Preparación del Servidor VPS**

### **1.1 Actualizar el Sistema**
```bash
# Conectar a tu VPS
ssh root@tu-vps-ip

# Actualizar sistema
apt update && apt upgrade -y

# Instalar dependencias básicas
apt install -y curl wget git nginx software-properties-common gnupg2
```

### **1.2 Instalar Node.js 18+ LTS**
```bash
# Instalar NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Instalar Node.js
apt install -y nodejs

# Verificar instalación
node --version  # Debe ser v18.x.x o superior
npm --version
```

### **1.3 Instalar PM2 Globalmente**
```bash
npm install -g pm2
pm2 startup  # Configurar auto-start en boot
```

---

## 🗄️ **PARTE 2: Configurar PostgreSQL Optimizado**

### **2.1 Instalar PostgreSQL 15+**
```bash
# Agregar repositorio oficial
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list

# Instalar
apt update
apt install -y postgresql-15 postgresql-client-15 postgresql-contrib-15

# Iniciar servicio
systemctl start postgresql
systemctl enable postgresql
```

### **2.2 Configurar Base de Datos**
```bash
# Cambiar a usuario postgres
sudo -u postgres psql

# Crear base de datos y usuario
CREATE DATABASE invpatrimonio;
CREATE USER invpatrimonio_user WITH ENCRYPTED PASSWORD 'tu_password_seguro_aqui';
GRANT ALL PRIVILEGES ON DATABASE invpatrimonio TO invpatrimonio_user;
\q

# Configurar postgresql.conf para rendimiento
sudo nano /etc/postgresql/15/main/postgresql.conf
```

**Agregar configuraciones optimizadas:**
```conf
# CONFIGURACIÓN OPTIMIZADA PARA INVPATRIMONIO
shared_buffers = 2GB                    # 25% de RAM total
work_mem = 256MB
maintenance_work_mem = 1GB
effective_cache_size = 6GB              # 75% de RAM total
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
log_min_duration_statement = 1000       # Log queries > 1 second
```

### **2.3 Aplicar Esquema Optimizado**
```bash
# Descargar schema optimizado
cd /tmp
wget https://github.com/yourusername/InvPatrimonio/raw/main/database_optimized.sql

# Aplicar schema
sudo -u postgres psql invpatrimonio < database_optimized.sql
```

---

## 🔴 **PARTE 3: Configurar Redis Cluster**

### **3.1 Instalar Redis**
```bash
# Instalar Redis
apt install -y redis-server redis-tools

# Crear directorios para cluster
mkdir -p /etc/redis/cluster/{7000,7001,7002}
```

### **3.2 Configurar Nodos del Cluster**
```bash
# Configurar nodo 7000
cat > /etc/redis/cluster/7000/redis.conf << EOF
port 7000
cluster-enabled yes
cluster-config-file nodes-7000.conf
cluster-node-timeout 5000
appendonly yes
dir /var/lib/redis/7000
bind 127.0.0.1
protected-mode yes
requirepass tu_redis_password_aqui
masterauth tu_redis_password_aqui
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
EOF

# Configurar nodo 7001  
sed 's/7000/7001/g' /etc/redis/cluster/7000/redis.conf > /etc/redis/cluster/7001/redis.conf

# Configurar nodo 7002
sed 's/7000/7002/g' /etc/redis/cluster/7000/redis.conf > /etc/redis/cluster/7002/redis.conf

# Crear directorios de datos
mkdir -p /var/lib/redis/{7000,7001,7002}
chown redis:redis /var/lib/redis/{7000,7001,7002}
```

### **3.3 Crear Servicios Systemd**
```bash
# Servicio para nodo 7000
cat > /etc/systemd/system/redis-7000.service << EOF
[Unit]
Description=Redis In-Memory Data Store (Port 7000)
After=network.target

[Service]
User=redis
Group=redis
ExecStart=/usr/bin/redis-server /etc/redis/cluster/7000/redis.conf
ExecStop=/usr/bin/redis-cli -p 7000 -a tu_redis_password_aqui shutdown
TimeoutStopSec=0
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Copiar para otros nodos
sed 's/7000/7001/g' /etc/systemd/system/redis-7000.service > /etc/systemd/system/redis-7001.service  
sed 's/7000/7002/g' /etc/systemd/system/redis-7000.service > /etc/systemd/system/redis-7002.service

# Habilitar servicios
systemctl daemon-reload
systemctl enable redis-7000 redis-7001 redis-7002
systemctl start redis-7000 redis-7001 redis-7002

# Verificar que están corriendo
systemctl status redis-7000 redis-7001 redis-7002
```

### **3.4 Crear el Cluster**
```bash
# Instalar redis-cli cluster tools
apt install -y redis-tools

# Crear cluster (ejecutar desde cualquier nodo)
redis-cli -a tu_redis_password_aqui --cluster create 127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 --cluster-replicas 0

# Verificar cluster
redis-cli -c -p 7000 -a tu_redis_password_aqui cluster nodes
```

---

## 🌐 **PARTE 4: Configurar Nginx y SSL**

### **4.1 Configurar Nginx para InvPatrimonio**
```bash
# Crear configuración del sitio
cat > /etc/nginx/sites-available/patrimonio.siafsystem.online << EOF
# InvPatrimonio - High Performance Configuration
server {
    listen 80;
    server_name patrimonio.siafsystem.online;
    
    # Redirect to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name patrimonio.siafsystem.online;

    # SSL Configuration (will be added by Certbot)
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        application/atom+xml
        application/javascript
        application/json
        application/rss+xml
        application/vnd.ms-fontobject
        application/x-font-ttf
        application/x-web-app-manifest+json
        application/xhtml+xml
        application/xml
        font/opentype
        image/svg+xml
        image/x-icon
        text/css
        text/plain
        text/x-component;

    # Frontend (Static Files)
    location / {
        root /var/www/invpatrimonio/client/dist;
        index index.html index.htm;
        
        # SPA routing - all routes go to index.html
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            access_log off;
        }
        
        # Cache HTML files for short period
        location ~* \.html$ {
            expires 5m;
            add_header Cache-Control "public";
        }
    }

    # Backend API
    location /api/ {
        # Rate limiting
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3001;
        access_log off;
    }
    
    # File uploads
    location /uploads/ {
        root /var/www/invpatrimonio;
        expires 30d;
        add_header Cache-Control "public";
    }

    # Logs
    access_log /var/log/nginx/patrimonio_access.log;
    error_log /var/log/nginx/patrimonio_error.log;
}
EOF

# Configurar rate limiting
cat >> /etc/nginx/nginx.conf << EOF

# Rate limiting zones
http {
    limit_req_zone \$binary_remote_addr zone=api:10m rate=100r/m;
    limit_req_zone \$binary_remote_addr zone=login:10m rate=5r/m;
}
EOF
```

### **4.2 Habilitar Sitio y Configurar SSL**
```bash
# Habilitar sitio
ln -s /etc/nginx/sites-available/patrimonio.siafsystem.online /etc/nginx/sites-enabled/

# Probar configuración
nginx -t

# Instalar Certbot
apt install -y certbot python3-certbot-nginx

# Obtener certificado SSL
certbot --nginx -d patrimonio.siafsystem.online

# Configurar auto-renovación
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -

# Reiniciar nginx
systemctl restart nginx
```

---

## 📦 **PARTE 5: Setup GitHub Auto-Deploy**

### **5.1 Configurar SSH Keys para GitHub**
```bash
# Generar SSH key para el servidor
ssh-keygen -t rsa -b 4096 -C "server@patrimonio.siafsystem.online" -f ~/.ssh/github_deploy

# Mostrar clave pública (agregar a GitHub Deploy Keys)
cat ~/.ssh/github_deploy.pub

# Configurar SSH para GitHub
cat >> ~/.ssh/config << EOF
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_deploy
    StrictHostKeyChecking no
EOF
```

### **5.2 Script de Deployment Automático**
```bash
# Crear directorio del proyecto
mkdir -p /var/www/invpatrimonio
cd /var/www/invpatrimonio

# Script de deploy
cat > deploy.sh << EOF
#!/bin/bash
set -e

echo "🚀 Starting InvPatrimonio deployment..."

# Variables
REPO_URL="git@github.com:yourusername/InvPatrimonio.git"
PROJECT_DIR="/var/www/invpatrimonio"
BACKUP_DIR="/var/backups/invpatrimonio"

# Create backup
echo "📦 Creating backup..."
mkdir -p \$BACKUP_DIR
tar -czf \$BACKUP_DIR/backup-\$(date +%Y%m%d_%H%M%S).tar.gz -C \$PROJECT_DIR . 2>/dev/null || true

# Pull latest code
echo "⬇️ Pulling latest code..."
cd \$PROJECT_DIR

if [ ! -d ".git" ]; then
    git clone \$REPO_URL .
else
    git fetch origin
    git reset --hard origin/main
fi

# Install server dependencies
echo "📚 Installing server dependencies..."
cd server
npm ci --production

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Install client dependencies and build
echo "🎨 Building frontend..."
cd ../client
npm ci
npm run build

# Apply database migrations if needed
echo "🗄️ Applying database migrations..."
cd ../
if [ -f "database_optimized.sql" ]; then
    sudo -u postgres psql invpatrimonio < database_optimized.sql || true
fi

# Restart services
echo "🔄 Restarting services..."
cd server
pm2 restart ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production

# Restart nginx
sudo systemctl reload nginx

# Clear Redis cache
echo "🗑️ Clearing cache..."
redis-cli -c -p 7000 -a tu_redis_password_aqui FLUSHALL

echo "✅ Deployment completed successfully!"
echo "🌐 Site available at: https://patrimonio.siafsystem.online"
EOF

chmod +x deploy.sh
```

### **5.3 Webhook para Auto-Deploy (Opcional)**
```bash
# Instalar webhook listener
npm install -g github-webhook-handler

# Script de webhook
cat > webhook-server.js << EOF
const http = require('http');
const createHandler = require('github-webhook-handler');
const { exec } = require('child_process');

const handler = createHandler({ path: '/webhook', secret: 'your-webhook-secret' });

http.createServer((req, res) => {
    handler(req, res, (err) => {
        res.statusCode = 404;
        res.end('no such location');
    });
}).listen(7777);

handler.on('error', (err) => {
    console.error('Error:', err.message);
});

handler.on('push', (event) => {
    console.log('Received a push event for %s to %s',
        event.payload.repository.name,
        event.payload.ref);
    
    if (event.payload.ref === 'refs/heads/main') {
        exec('/var/www/invpatrimonio/deploy.sh', (error, stdout, stderr) => {
            if (error) {
                console.error('Deployment failed:', error);
                return;
            }
            console.log('Deployment successful:', stdout);
        });
    }
});

console.log('Webhook server listening on port 7777');
EOF

# Configurar como servicio PM2
pm2 start webhook-server.js --name "invpatrimonio-webhook"
pm2 save
```

---

## ⚙️ **PARTE 6: Configuración Final y Testing**

### **6.1 Variables de Entorno**
```bash
cd /var/www/invpatrimonio/server

# Copiar y configurar variables de entorno
cp .env.example .env

# Editar con tus valores reales
nano .env
```

**Configurar valores en `.env`:**
```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://patrimonio.siafsystem.online

DB_HOST=localhost
DB_NAME=invpatrimonio  
DB_USER=invpatrimonio_user
DB_PASSWORD=tu_password_db_real

REDIS_NODES=127.0.0.1:7000,127.0.0.1:7001,127.0.0.1:7002
REDIS_PASSWORD=tu_redis_password_aqui

JWT_SECRET=genera_un_secreto_muy_seguro_de_al_menos_256_bits_aqui
```

### **6.2 Configurar Permisos**
```bash
# Ownership correcto
chown -R www-data:www-data /var/www/invpatrimonio
chmod -R 755 /var/www/invpatrimonio
chmod +x /var/www/invpatrimonio/deploy.sh

# Logs directory
mkdir -p /var/www/invpatrimonio/server/logs
chown -R www-data:www-data /var/www/invpatrimonio/server/logs
```

### **6.3 Deploy Inicial**
```bash
cd /var/www/invpatrimonio
./deploy.sh
```

### **6.4 Verificar Deployment**
```bash
# Verificar servicios
systemctl status postgresql
systemctl status redis-7000 redis-7001 redis-7002
systemctl status nginx
pm2 status

# Verificar conectividad
curl http://localhost:3001/health
curl https://patrimonio.siafsystem.online/health

# Verificar Redis cluster
redis-cli -c -p 7000 -a tu_redis_password_aqui ping

# Verificar logs
tail -f /var/www/invpatrimonio/server/logs/combined.log
```

---

## 🔍 **PARTE 7: Monitoreo y Mantenimiento**

### **7.1 Script de Monitoreo**
```bash
cat > /var/www/invpatrimonio/monitor.sh << EOF
#!/bin/bash

echo "=== InvPatrimonio System Status ==="
echo "Date: \$(date)"
echo

echo "🐘 PostgreSQL Status:"
sudo -u postgres psql -c "SELECT version();" -d invpatrimonio | head -3

echo
echo "🔴 Redis Cluster Status:"
redis-cli -c -p 7000 -a tu_redis_password_aqui cluster nodes | grep master

echo  
echo "⚙️ PM2 Processes:"
pm2 status

echo
echo "🌐 Nginx Status:"
systemctl is-active nginx

echo
echo "💾 Disk Usage:"
df -h /var/www/invpatrimonio

echo
echo "🧠 Memory Usage:"
free -h

echo
echo "📊 Application Health:"
curl -s http://localhost:3001/health | jq .
EOF

chmod +x /var/www/invpatrimonio/monitor.sh
```

### **7.2 Backup Automático**
```bash
cat > /var/www/invpatrimonio/backup.sh << EOF
#!/bin/bash

BACKUP_DIR="/var/backups/invpatrimonio"
DATE=\$(date +%Y%m%d_%H%M%S)

mkdir -p \$BACKUP_DIR

# Database backup
sudo -u postgres pg_dump invpatrimonio > \$BACKUP_DIR/db_\$DATE.sql

# Files backup
tar -czf \$BACKUP_DIR/files_\$DATE.tar.gz -C /var/www/invpatrimonio .

# Keep only last 7 days of backups
find \$BACKUP_DIR -name "*.sql" -mtime +7 -delete
find \$BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: \$DATE"
EOF

chmod +x /var/www/invpatrimonio/backup.sh

# Configurar backup diario
echo "0 2 * * * /var/www/invpatrimonio/backup.sh" | crontab -
```

---

## 🎯 **RESUMEN FINAL**

✅ **Backend optimizado** con Redis cluster y PostgreSQL  
✅ **Frontend** servido por Nginx con compresión y cache  
✅ **SSL/HTTPS** configurado con Let's Encrypt  
✅ **Auto-deployment** desde GitHub  
✅ **Monitoreo** y backup automatizado  

### **URLs del Sistema:**
- 🌐 **Frontend**: https://patrimonio.siafsystem.online
- 🔗 **API**: https://patrimonio.siafsystem.online/api
- 💚 **Health Check**: https://patrimonio.siafsystem.online/health

### **Comandos Útiles:**
```bash
# Deploy manual
cd /var/www/invpatrimonio && ./deploy.sh

# Ver logs en tiempo real
tail -f /var/www/invpatrimonio/server/logs/combined.log

# Verificar status
/var/www/invpatrimonio/monitor.sh

# Backup manual
/var/www/invpatrimonio/backup.sh

# Restart completo
pm2 restart all && systemctl restart nginx
```

¡Tu sistema InvPatrimonio está ahora desplegado con arquitectura de alto rendimiento! 🚀