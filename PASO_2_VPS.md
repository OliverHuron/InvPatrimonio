## 🚀 PASO 2: Configurar VPS (root@31.97.210.189)

### **COMANDOS PARA EJECUTAR EN TU VPS:**

```bash
# 1. Conectar a tu VPS
ssh root@31.97.210.189

# 2. Actualizar sistema
apt update && apt upgrade -y

# 3. Descargar script de configuración rápida
wget https://raw.githubusercontent.com/OliverHuron/InvPatrimonio/main/quick-setup.sh
chmod +x quick-setup.sh
./quick-setup.sh

# 4. Configurar GitHub SSH Keys (el script te mostrará las claves)
# Ve a: https://github.com/OliverHuron/InvPatrimonio/settings/keys
# Click "Add deploy key" y pega la CLAVE PÚBLICA
# ✅ Marca "Allow write access"

# 5. Descargar e instalar todo automáticamente
wget https://raw.githubusercontent.com/OliverHuron/InvPatrimonio/main/auto-install.sh
chmod +x auto-install.sh
./auto-install.sh
```

### **CONFIGURACIÓN GITHUB SECRETS:**

Ve a: https://github.com/OliverHuron/InvPatrimonio/settings/secrets/actions

Agrega estos secrets:

| Secret Name | Valor |
|-------------|--------|
| `VPS_SSH_KEY` | Clave privada SSH (la que mostrará quick-setup.sh) |
| `VPS_HOST` | `31.97.210.189` |
| `VPS_USER` | `root` |
| `DEPLOYMENT_PATH` | `/var/www/invpatrimonio` |
| `HEALTH_URL` | `https://patrimonio.siafsystem.online/health` |

---

## **🎯 PRÓXIMO PASO:**

**Ejecuta estos comandos en tu VPS y avísame cuando termines:**

1. `ssh root@31.97.210.189`
2. `wget https://raw.githubusercontent.com/OliverHuron/InvPatrimonio/main/quick-setup.sh && chmod +x quick-setup.sh && ./quick-setup.sh`

El script te mostrará las claves SSH que necesitas agregar a GitHub.

**¿Ya ejecutaste el quick-setup.sh en tu VPS?**