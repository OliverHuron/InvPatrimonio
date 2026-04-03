// =====================================================
// RUTAS DE PATRIMONIO - API EXTERNA
// =====================================================
const express = require('express');
const router = express.Router();
const patrimonioApiController = require('../controllers/patrimonioApiController');
const authController = require('../controllers/authController');
const authBdService = require('../services/authBdService');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const JWT_SECRET = process.env.JWT_SECRET || 'tu_super_secreto_cambialo_en_produccion';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'patrimonio');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (req, _file, cb) => {
      const { id, orden } = req.params;
      cb(null, `${id}_${orden}.webp`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten imágenes'));
    }
    cb(null, true);
  }
});

// Obtener modo de datos
const getDataSource = () => {
  const source = process.env.INVENTARIO_DATA_SOURCE || 'bd';
  return source.toLowerCase();
};

// =====================================================
// LOGIN DUAL - BD (JWT httpOnly) o API (sessionId)
// =====================================================
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const dataSource = getDataSource();
    
    console.log(`[Auth] Modo: ${dataSource.toUpperCase()}`);
    
    // MODO BD: Autenticación local con JWT httpOnly cookies
    if (dataSource === 'bd') {
      try {
        const user = await authBdService.loginLocal(username, password);
        
        // Generar JWT
        const token = jwt.sign(
          {
            id: user.id,
            usuario: user.usuario,
            rol: user.rol,
            ures: user.ures
          },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );
        
        // Establecer cookie httpOnly
        res.cookie('auth_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 24 * 60 * 60 * 1000 // 24 horas
        });
        
        console.log('[Auth BD] Login exitoso:', user.usuario);
        
        return res.json({
          success: true,
          message: 'Login exitoso',
          user: {
            id: user.id,
            username: user.usuario,
            rol: user.rol,
            ures: user.ures
          },
          source: 'bd'
        });
      } catch (error) {
        console.log('[Auth BD] Login fallido:', error.message);
        if (error && error.code === '42P01') {
          return res.status(500).json({
            success: false,
            message: 'La tabla de usuarios no existe en esta base de datos. Ejecuta migraciones en producción.',
            source: 'bd'
          });
        }
        return res.status(401).json({
          success: false,
          message: error.message || 'Credenciales inválidas',
          source: 'bd'
        });
      }
    }
    
    // MODO API: Proxy a UMICH
    console.log('[Proxy Login] Intentando login con UMICH...');
    
    const configuredBase = process.env.UMICH_API_BASE_URL || process.env.EXTERNAL_API_BASE_URL || 'https://api-patrimonio.umich.mx/api-patrimonio';
    const baseCandidates = [configuredBase];
    if (configuredBase.startsWith('http://')) {
      baseCandidates.push(configuredBase.replace('http://', 'https://'));
    } else if (configuredBase.startsWith('https://')) {
      baseCandidates.push(configuredBase.replace('https://', 'http://'));
    }
    const uniqueBases = [...new Set(baseCandidates)];
    const payloadCandidates = [
      { username, password },
      { usuario: username, password },
      { user: username, password },
      { username: username?.trim(), password }
    ];

    let finalResponse = null;
    let jsessionId = null;
    let lastErrorMessage = null;

    for (const baseUrl of uniqueBases) {
      for (const payload of payloadCandidates) {
        const response = await axios.post(`${baseUrl}/auth/login`, payload, {
          validateStatus: () => true,
          timeout: parseInt(process.env.EXTERNAL_API_TIMEOUT || '10000', 10)
        });

        const setCookieHeader = response.headers['set-cookie'];
        jsessionId = null;
        if (setCookieHeader) {
          for (const cookie of setCookieHeader) {
            const match = cookie.match(/JSESSIONID=([^;]+)/);
            if (match) {
              jsessionId = match[1];
              break;
            }
          }
        }

        finalResponse = response;
        const isSuccess = response.data?.message === 'Login exitoso' ||
          response.status === 200 ||
          !!jsessionId;

        if (isSuccess && jsessionId) {
          console.log('[Proxy Login] Login exitoso con UMICH');
          console.log('[Proxy Login] Base exitosa:', baseUrl);
          return res.json({
            success: true,
            message: 'Login exitoso',
            sessionId: jsessionId,
            user: response.data?.user || { username },
            source: 'api'
          });
        }

        lastErrorMessage = response.data?.message || response.data?.error || `HTTP ${response.status}`;
      }
    }

    console.log('[Proxy Login] Login fallido:', finalResponse?.data || lastErrorMessage);
    res.status(401).json({
      success: false,
      message: lastErrorMessage || 'Credenciales inválidas',
      source: 'api'
    });
  } catch (error) {
    console.error('[Auth] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error en autenticación'
    });
  }
});

// =====================================================
// RUTAS QUE CONSUMEN LA API EXTERNA
// =====================================================

// Info del sistema (modo API/BD)
router.get('/info', patrimonioApiController.getDataSourceInfo);
router.get('/categorias/entrega', patrimonioApiController.getCategoriasEntrega);

// === PATRIMONIO CI (Interno) ===
router.get('/patrimonioci', patrimonioApiController.getAllPatrimonioci);
router.get('/patrimonioci/:id', patrimonioApiController.getPatrimoniociById);
router.post('/patrimonioci/insertar', patrimonioApiController.createPatrimonioci);
router.put('/patrimonioci/actualizar/:id', patrimonioApiController.updatePatrimonioci);
router.get('/patrimonioci/:id/fotos', patrimonioApiController.getFotosPatrimonioci);
router.post('/patrimonioci/:id/fotos/:orden', upload.single('foto'), patrimonioApiController.upsertFotoPatrimonioci);
router.delete('/patrimonioci/:id/fotos/:orden', patrimonioApiController.deleteFotoPatrimonioci);

// === PATRIMONIO (Externo) ===
router.get('/patrimonio', patrimonioApiController.getAllPatrimonios);
router.get('/patrimonio/:id', patrimonioApiController.getPatrimonioById);
router.post('/patrimonio/insertar', patrimonioApiController.createPatrimonio);
router.put('/patrimonio/actualizar/:id', patrimonioApiController.updatePatrimonio);

// === Rutas antiguas (mantener por compatibilidad) ===
// Obtener todos los inventarios (limitado a IDs de prueba)
router.get('/', patrimonioApiController.getAllPatrimonios);

// Búsqueda de texto completo (no disponible)
router.get('/search', patrimonioApiController.searchInventarios);

// Estadísticas del dashboard (no disponible)
router.get('/stats', patrimonioApiController.getDashboardStats);

// Obtener marcas únicas para filtros (no disponible)
router.get('/marcas', patrimonioApiController.getAvailableMarcas);

// Obtener ubicaciones únicas para filtros (no disponible)
router.get('/ubicaciones', patrimonioApiController.getAvailableUbicaciones);

// Obtener un inventario específico (DEBE IR AL FINAL)
router.get('/:id', patrimonioApiController.getPatrimonioById);

// Crear nuevo inventario
router.post('/', patrimonioApiController.createPatrimonio);

// Actualizar inventario
router.put('/:id', patrimonioApiController.updatePatrimonio);

// =====================================================
// LOGOUT DUAL
// =====================================================
router.post('/auth/logout', async (req, res) => {
  const dataSource = getDataSource();
  
  if (dataSource === 'bd') {
    // Limpiar cookie JWT
    res.clearCookie('auth_token');
    return res.json({ success: true, message: 'Logout exitoso' });
  } else {
    // Logout de API externa (si existe)
    return res.json({ success: true, message: 'Logout exitoso' });
  }
});

// =====================================================
// PERFIL DE USUARIO
// =====================================================
router.get('/auth/profile', authController.verifyToken, authController.getProfile);

module.exports = router;
