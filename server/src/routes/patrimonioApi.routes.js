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

// NOTE: removed in-memory session->user mapping to simplify auth flow (no role mapping)

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'patrimonio');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const xmlDir = path.join(__dirname, '..', '..', 'uploads', 'xml');
if (!fs.existsSync(xmlDir)) {
  fs.mkdirSync(xmlDir, { recursive: true });
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

const uploadXml = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, xmlDir),
    filename: (req, _file, cb) => {
      const { id } = req.params;
      // use id.xml as filename for easy identification
      cb(null, `${id}.xml`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['text/xml', 'application/xml', 'application/octet-stream'];
    // allow .xml and common xml mime types
    if (!file.mimetype || !allowed.includes(file.mimetype)) {
      // also accept files with .xml extension as a fallback
      const ext = path.extname(file.originalname || '').toLowerCase();
      if (ext !== '.xml') return cb(new Error('Solo se permiten archivos XML'));
    }
    cb(null, true);
  }
});

// Obtener modo de datos
const getDataSource = () => {
  const source = process.env.INVENTARIO_DATA_SOURCE || 'bd';
  return source.toLowerCase();
};

// Obtener modo de autenticación (puede ser distinto de la fuente de datos)
const getAuthSource = () => {
  const source = process.env.INVENTARIO_AUTH_SOURCE || process.env.INVENTARIO_DATA_SOURCE || 'bd';
  return source.toLowerCase();
};

// =====================================================
// LOGIN DUAL - BD (JWT httpOnly) o API (sessionId)
// =====================================================
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const authSource = getAuthSource();
    
    console.log(`[Auth] Auth Modo: ${authSource.toUpperCase()}`);
    
    // MODO BD: Autenticación local con JWT httpOnly cookies
    if (authSource === 'bd') {
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
          // Establecer cookie httpOnly con el token de sesión proveniente de UMICH
          const cookieOpts = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 horas
          };
          try {
            // Set both `auth_token` (app conventions) and `JSESSIONID` (UMICH convention)
            res.cookie('auth_token', jsessionId, cookieOpts);
            res.cookie('JSESSIONID', jsessionId, cookieOpts);
          } catch (errCookie) {
            console.warn('[Proxy Login] No se pudo establecer cookie:', errCookie.message || errCookie);
          }

          // Simplificar: devolver lo que la API externa entregue (sin intentar enriquecer rol)
          let userPayload = response.data?.user || { username };
          if (!userPayload.username && userPayload.usuario) userPayload.username = userPayload.usuario;
          if (!userPayload.usuario && userPayload.username) userPayload.usuario = userPayload.username;

          return res.json({
            success: true,
            message: 'Login exitoso',
            sessionId: jsessionId,
            user: userPayload,
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

// === XML para Patrimonio CI ===
router.get('/patrimonioci/:id/xml', patrimonioApiController.getXmlPatrimonioci);
router.get('/patrimonioci/:id/xml/proxy', patrimonioApiController.getXmlPatrimoniociProxy);
router.post('/patrimonioci/:id/xml', uploadXml.single('xmlfile'), patrimonioApiController.uploadXmlPatrimonioci);
router.delete('/patrimonioci/:id/xml', patrimonioApiController.deleteXmlPatrimonioci);

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
// Only match numeric IDs to avoid catching other static routes like /health
router.get('/:id(\\d+)', patrimonioApiController.getPatrimonioById);

// Crear nuevo inventario
router.post('/', patrimonioApiController.createPatrimonio);

// Actualizar inventario
// Only match numeric IDs
router.put('/:id(\\d+)', patrimonioApiController.updatePatrimonio);

// =====================================================
// LOGOUT DUAL
// =====================================================
router.post('/auth/logout', async (req, res) => {
  const authSource = getAuthSource();
  
  if (authSource === 'bd') {
    // Limpiar cookie JWT
    res.clearCookie('auth_token');
    return res.json({ success: true, message: 'Logout exitoso' });
  } else {
    // Logout de API externa (si existe)
    try {
      const configuredBase = process.env.UMICH_API_BASE_URL || process.env.EXTERNAL_API_BASE_URL || 'https://api-patrimonio.umich.mx/api-patrimonio';
      const baseUrl = configuredBase;
      // Obtener JSESSIONID desde cookie o header
      const jsession = req.cookies?.auth_token || req.cookies?.JSESSIONID || req.headers['x-umich-session'] || null;
      if (jsession) {
        // Llamar al endpoint de logout de UMICH pasando la cookie
        await axios.post(`${baseUrl}/auth/logout`, {}, {
          headers: { Cookie: `JSESSIONID=${jsession}` },
          timeout: parseInt(process.env.EXTERNAL_API_TIMEOUT || '10000', 10),
          validateStatus: () => true
        });
      }
    } catch (err) {
      console.warn('[Proxy Logout] Error llamando logout externo:', err.message || err);
    } finally {
      // Limpiar cookies locales

      res.clearCookie('auth_token');
      res.clearCookie('JSESSIONID');
    }

    return res.json({ success: true, message: 'Logout exitoso' });
  }
});

// =====================================================
// PERFIL DE USUARIO (soporta BD y API externa)
// =====================================================
router.get('/auth/profile', async (req, res) => {
  const authSource = getAuthSource();
  if (authSource === 'bd') {
    // Usar verificación JWT local
    return authController.verifyToken(req, res, () => authController.getProfile(req, res));
  }

  // Modo API: obtener perfil desde UMICH usando la cookie de sesión
  try {
    const configuredBase = process.env.UMICH_API_BASE_URL || process.env.EXTERNAL_API_BASE_URL || 'https://api-patrimonio.umich.mx/api-patrimonio';
    const baseUrl = configuredBase;
    const jsession = req.cookies?.auth_token || req.cookies?.JSESSIONID || req.headers['x-umich-session'] || null;
    if (!jsession) return res.status(401).json({ success: false, message: 'No autenticado' });

    const response = await axios.get(`${baseUrl}/auth/profile`, {
      headers: { Cookie: `JSESSIONID=${jsession}` },
      timeout: parseInt(process.env.EXTERNAL_API_TIMEOUT || '10000', 10),
      validateStatus: () => true
    });
    if (response.status !== 200) {
      return res.status(response.status).json({ success: false, message: response.data?.message || 'No autenticado' });
    }

    // Normalizar forma de respuesta para que el frontend reciba `response.data.user`
    const external = response.data || {};
    const userFromExternal = external.user || external.data || external || {};

    const mappedUser = {
      id: userFromExternal.id || userFromExternal.id_usuario || userFromExternal.userId || null,
      usuario: userFromExternal.usuario || userFromExternal.username || userFromExternal.user || null,
      username: userFromExternal.username || userFromExternal.usuario || userFromExternal.user || null,
      // No forzamos rol: devolver lo que venga (si no viene, frontend debe aceptar sesión sin rol)
      rol: userFromExternal.rol || userFromExternal.role || (Array.isArray(userFromExternal.roles) ? userFromExternal.roles[0] : null) || null,
      ures: userFromExternal.ures || userFromExternal.ures_id || null,
      raw: userFromExternal
    };

    return res.json({ success: true, user: mappedUser });
  } catch (error) {
    console.error('[Auth Profile] Error obteniendo perfil externo:', error.message || error);
    return res.status(500).json({ success: false, message: 'Error obteniendo perfil' });
  }
});

module.exports = router;
