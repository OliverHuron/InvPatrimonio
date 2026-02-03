# Configuración de GitHub Secrets para Deployment

Para configurar el auto-deployment de InvPatrimonio, necesitas agregar los siguientes secrets en tu repositorio de GitHub:

## 📋 Cómo configurar GitHub Secrets

1. Ve a tu repositorio en GitHub
2. Settings → Secrets and variables → Actions
3. Click "New repository secret" para cada uno:

---

## 🔐 Secrets Requeridos

### **VPS_SSH_KEY**
**Valor:** La clave SSH privada para conectar a tu VPS
```bash
# En tu VPS, generar clave SSH:
ssh-keygen -t rsa -b 4096 -C "github-deploy" -f ~/.ssh/github_deploy

# Mostrar clave privada (copiar TODO el contenido):
cat ~/.ssh/github_deploy

# Agregar clave pública a authorized_keys:
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
```

### **VPS_HOST** 
**Valor:** La IP de tu VPS
```
Ejemplo: 192.168.1.100
```

### **VPS_USER**
**Valor:** Usuario para conectar al VPS
```
Ejemplo: root
```

### **DEPLOYMENT_PATH**
**Valor:** Ruta donde está instalado InvPatrimonio
```
/var/www/invpatrimonio
```

### **HEALTH_URL**
**Valor:** URL para verificar que el deployment funcionó
```
https://patrimonio.siafsystem.online/health
```

### **SLACK_WEBHOOK_URL** (Opcional)
**Valor:** URL de webhook de Slack para notificaciones
```bash
# Para configurar Slack webhook:
# 1. Ve a tu workspace de Slack
# 2. Apps → Incoming Webhooks
# 3. Add to Slack → Choose channel
# 4. Copy Webhook URL
```

---

## 🛠️ Script de configuración automática

Ejecuta este script en tu VPS para configurar todo automáticamente:

```bash
#!/bin/bash

# Variables - EDITAR ESTOS VALORES
GITHUB_USERNAME="tu-username"
REPO_NAME="InvPatrimonio"

echo "🔧 Configurando GitHub Deploy Keys..."

# Generar SSH key para deployment
ssh-keygen -t rsa -b 4096 -C "github-deploy-${REPO_NAME}" -f ~/.ssh/github_deploy -N ""

# Mostrar clave pública
echo ""
echo "📋 Copia esta CLAVE PÚBLICA y agrégala como Deploy Key en GitHub:"
echo "   Repositorio → Settings → Deploy keys → Add deploy key"
echo "   ✅ Marca 'Allow write access'"
echo ""
echo "===== CLAVE PÚBLICA (Deploy Key) ====="
cat ~/.ssh/github_deploy.pub
echo "======================================"

echo ""
echo "🔐 Copia esta CLAVE PRIVADA como Secret VPS_SSH_KEY en GitHub:"
echo "   Repositorio → Settings → Secrets → New repository secret"
echo "   Name: VPS_SSH_KEY"
echo ""
echo "===== CLAVE PRIVADA (GitHub Secret) ====="
cat ~/.ssh/github_deploy
echo "=========================================="

# Configurar SSH config
cat >> ~/.ssh/config << EOF

Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_deploy
    StrictHostKeyChecking no
EOF

# Agregar clave pública a authorized_keys
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

echo ""
echo "✅ Configuración SSH completada!"
echo ""
echo "📌 PRÓXIMOS PASOS:"
echo "1. Agregar la clave pública como Deploy Key en GitHub"
echo "2. Agregar la clave privada como Secret VPS_SSH_KEY"  
echo "3. Configurar los otros secrets:"
echo "   - VPS_HOST: $(curl -s ifconfig.me || hostname -I | awk '{print $1}')"
echo "   - VPS_USER: $(whoami)"
echo "   - DEPLOYMENT_PATH: /var/www/invpatrimonio"
echo "   - HEALTH_URL: https://patrimonio.siafsystem.online/health"
```

---

## ✅ Verificar configuración

Una vez configurados todos los secrets, puedes probar el deployment:

1. **Hacer un push a main:**
```bash
git add .
git commit -m "test: auto-deployment"
git push origin main
```

2. **Verificar en GitHub:**
   - Ve a Actions tab
   - Verifica que el workflow se ejecute correctamente
   - Revisa los logs si hay errores

3. **Verificar en el VPS:**
```bash
# Ver logs de PM2
pm2 logs

# Verificar servicios
systemctl status nginx postgresql redis-7000

# Test manual
curl https://patrimonio.siafsystem.online/health
```

---

## 🚨 Troubleshooting

### **Error de SSH:**
```bash
# Verificar conectividad SSH desde GitHub
ssh -T git@github.com

# Verificar permisos
chmod 700 ~/.ssh
chmod 600 ~/.ssh/github_deploy
chmod 644 ~/.ssh/github_deploy.pub
```

### **Error de permisos:**
```bash
# Ajustar ownership
chown -R www-data:www-data /var/www/invpatrimonio
chmod +x /var/www/invpatrimonio/deploy.sh
```

### **Error de servicios:**
```bash
# Restart todos los servicios
systemctl restart postgresql nginx
pm2 restart all

# Verificar logs
tail -f /var/log/nginx/patrimonio.siafsystem.online_error.log
```

---

## 📊 Monitoreo post-deployment

### **Verificar deployment exitoso:**
```bash
# Health check
curl -s https://patrimonio.siafsystem.online/health | jq

# Ver últimos deployments
pm2 describe invpatrimonio-server

# Verificar Git
cd /var/www/invpatrimonio && git log --oneline -5
```

### **Logs útiles:**
```bash
# Logs de aplicación
tail -f /var/www/invpatrimonio/server/logs/combined.log

# Logs de Nginx
tail -f /var/log/nginx/patrimonio.siafsystem.online_access.log

# Logs de PM2
pm2 logs --lines 50
```

¡Con esta configuración tendrás deployment automático cada vez que hagas push a main! 🚀