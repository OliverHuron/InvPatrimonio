# 🚀 GUÍA PASO A PASO - InvPatrimonio

## **PASO 1: Crear y Configurar Repositorio GitHub** ⬅️ **EMPEZAMOS AQUÍ**

### 1.1 Crear Repositorio en GitHub
```bash
# 1. Ve a GitHub.com
# 2. Click "New repository"
# 3. Nombre: "InvPatrimonio" 
# 4. Descripción: "Sistema de Inventario Patrimonial Optimizado"
# 5. ✅ Public (o Private si prefieres)
# 6. ✅ Add README file
# 7. ✅ Add .gitignore → Node
# 8. Click "Create repository"
```

### 1.2 Preparar Proyecto Local
```bash
# En tu carpeta InvPatrimonio local
cd "c:\Users\Darcketo\Desktop\InvPatrimonio"

# Inicializar git si no existe
git init

# Agregar archivo .gitignore importante
echo "node_modules/" > .gitignore
echo "*.log" >> .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo "dist/" >> .gitignore
echo "build/" >> .gitignore

# Agregar todos los archivos optimizados
git add .
git commit -m "feat: initial InvPatrimonio optimized system"

# Conectar con tu repositorio (CAMBIAR por tu URL real)
git remote add origin https://github.com/TU-USUARIO/InvPatrimonio.git

# Subir código
git push -u origin main
```

### 1.3 Verificar Subida
```bash
# Ve a tu repositorio en GitHub y verifica que están estos archivos:
# ✅ server/ (con archivos TypeScript optimizados)
# ✅ client/ (con archivos React)  
# ✅ database_optimized.sql
# ✅ auto-install.sh
# ✅ .github/workflows/deploy.yml
# ✅ DEPLOYMENT_GUIDE.md
# ✅ todos los archivos de configuración
```

## **PASO 2: Preparar VPS** ⬅️ **SIGUIENTE**

### 2.1 Conectar a VPS
```bash
# Conectar por SSH a tu VPS
ssh root@TU-IP-VPS

# O si tienes usuario diferente:
ssh tu-usuario@TU-IP-VPS
```

### 2.2 Configuración Rápida SSH
```bash
# Ejecutar script de configuración rápida
wget https://raw.githubusercontent.com/TU-USUARIO/InvPatrimonio/main/quick-setup.sh
chmod +x quick-setup.sh
./quick-setup.sh

# Esto configurará:
# ✅ SSH keys para GitHub
# ✅ Estructura de directorios
# ✅ Dependencias básicas
```

## **PASO 3: Configurar GitHub Secrets** ⬅️ **DESPUÉS DEL PASO 2**

### 3.1 SSH Keys
```bash
# El script anterior te mostrará las claves SSH
# Copiar la CLAVE PÚBLICA y agregar como Deploy Key en GitHub:
# GitHub repo → Settings → Deploy keys → Add deploy key
```

### 3.2 Secrets de GitHub Actions  
```bash
# En GitHub: Settings → Secrets and variables → Actions
# Agregar estos secrets:

VPS_SSH_KEY=contenido-clave-privada-ssh
VPS_HOST=tu-ip-vps
VPS_USER=root-o-tu-usuario
DEPLOYMENT_PATH=/var/www/invpatrimonio
HEALTH_URL=https://patrimonio.siafsystem.online/health
```

## **PASO 4: Ejecutar Instalación Completa** ⬅️ **FINAL**

### 4.1 Editar Variables del Script
```bash
# En tu VPS, descargar y editar el auto-install
wget https://raw.githubusercontent.com/TU-USUARIO/InvPatrimonio/main/auto-install.sh
nano auto-install.sh

# Cambiar estas variables:
DOMAIN="patrimonio.siafsystem.online"  # Tu dominio real
DB_PASSWORD="password-seguro-db"       # Password PostgreSQL
REDIS_PASSWORD="password-seguro-redis" # Password Redis  
JWT_SECRET="clave-super-segura-jwt"    # JWT secret
GITHUB_REPO="https://github.com/TU-USUARIO/InvPatrimonio.git"
```

### 4.2 Ejecutar Instalación
```bash
chmod +x auto-install.sh
./auto-install.sh

# Esto instalará automáticamente:
# ✅ PostgreSQL optimizado
# ✅ Redis Cluster (3 nodos)
# ✅ Node.js + PM2
# ✅ Nginx + SSL
# ✅ El proyecto InvPatrimonio
```

---

## **📌 EMPEZAR AHORA**

**¿Dónde empezamos?**

1. **¿Ya tienes cuenta en GitHub?** 
   - ✅ Sí → Ve al PASO 1.2 (git init en tu carpeta local)
   - ❌ No → Crea cuenta en GitHub.com primero

2. **¿Ya tienes VPS con Ubuntu/Debian?**
   - ✅ Sí → Anota la IP del VPS
   - ❌ No → Contrata VPS (DigitalOcean, AWS, etc)

3. **¿Ya tienes dominio patrimonio.siafsystem.online configurado?**
   - ✅ Sí → Perfecto
   - ❌ No → Podemos usar la IP por ahora

**DIME:**
- ✅ ¿Tienes GitHub? ¿Cómo se llama tu usuario?
- ✅ ¿Tienes VPS? ¿Cuál es la IP?
- ✅ ¿El dominio patrimonio.siafsystem.online apunta a tu VPS?

Con esa info empezamos con el PASO 1 inmediatamente. 🚀