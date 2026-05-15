// =====================================================
// RUTAS DE PATRIMONIO - API EXTERNA
// =====================================================
const express = require('express');
const router = express.Router();
const redisService = require('../services/redis.service');
const Joi = require('joi');
const patrimonioApiController = require('../controllers/patrimonioApiController');
const sseService = require('../services/sseService');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Esquema de validación para login
const loginSchema = Joi.object({
  username: Joi.string().trim().min(1).max(100).required()
    .messages({ 'any.required': 'El campo usuario es requerido', 'string.max': 'Usuario demasiado largo' }),
  password: Joi.string().min(1).max(128).required()
    .messages({ 'any.required': 'El campo contraseña es requerido', 'string.max': 'Contraseña demasiado larga' })
});

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

// =====================================================
// LOGIN — Proxy a UMICH (API mode)
// =====================================================
router.post('/auth/login', async (req, res) => {
  try {
    // Validar inputs antes de procesar
    const { error: validationError } = loginSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError.details[0].message });
    }

    const { username, password } = req.body;
    console.log('[Proxy Login] Intentando login con UMICH...');

    const configuredBase = process.env.UMICH_API_BASE_URL || process.env.EXTERNAL_API_BASE_URL || 'http://api-patrimonio.umich.mx/api-patrimonio';
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
        try {
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
            maxAge: 8 * 60 * 60 * 1000 // 8 horas (sesión laboral)
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
        } catch (attemptErr) {
          console.warn(`[Proxy Login] Fallo en ${baseUrl}:`, attemptErr.message);
          lastErrorMessage = lastErrorMessage || 'No se pudo conectar con el servidor';
        }
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

// =====================================================
// VALIDAR URES — proxy a la API externa con sesión
// =====================================================
router.get('/ures/:code', async (req, res) => {
  const { code } = req.params;

  // Validar formato numérico (evita path injection)
  if (!/^[1-9]\d{0,19}$/.test(code)) {
    return res.status(400).json({ error: 'Código URES inválido' });
  }

  // Modo API: usar SOLO el JSESSIONID real de UMICH desde cookie httpOnly
  const jsession = req.cookies?.JSESSIONID || null;
  if (!jsession) {
    return res.status(401).json({ error: 'No autenticado con UMICH' });
  }

  try {
    const configuredBase = process.env.UMICH_API_BASE_URL || process.env.EXTERNAL_API_BASE_URL || 'http://api-patrimonio.umich.mx/api-patrimonio';
    const timeout = parseInt(process.env.EXTERNAL_API_TIMEOUT || '10000', 10);
    const headers = { Cookie: `JSESSIONID=${jsession}` };

    // Paso 1: verificar existencia de la URES (status 200 Y datos no vacíos)
    const existsRes = await axios.get(`${configuredBase}/api/ures/${code}`, {
      headers,
      timeout,
      validateStatus: () => true
    });

    const existsData = Array.isArray(existsRes.data) ? existsRes.data : [];
    if (existsRes.status !== 200 || String(existsData[0]?.ures_ures) !== '1') {
      return res.status(404).json({ error: 'URES no existe en el sistema' });
    }

    // Paso 2: verificar acceso a datos (inventarioXures)
    const dataRes = await axios.get(`${configuredBase}/api/patrimonio/inventarioXures/${code}`, {
      headers,
      timeout,
      validateStatus: () => true
    });

    if (dataRes.status === 403) {
      return res.status(403).json({ error: 'Sin permiso para esta URES' });
    }

    const items = Array.isArray(dataRes.data) ? dataRes.data : (dataRes.data?.data || []);

    if (items.length === 0) {
      return res.status(403).json({ error: 'Sin acceso a datos de esta URES' });
    }

    return res.json([{ ures_ures: '1' }]);
  } catch (err) {
    console.error('[URES Proxy] Error:', err.message);
    return res.status(503).json({ error: 'No se pudo contactar la API externa' });
  }
});
// === PATRIMONIO CI (Interno) ===
// SSE: stream de actualizaciones en tiempo real (debe ir ANTES de /:id)
router.get('/patrimonioci/stream', (req, res) => {
  // Evitar que el middleware `compression()` bufferee los eventos.
  // El filtro por defecto de `compression` respeta `Cache-Control: no-transform`.
  // Además X-Accel-Buffering=no desactiva el buffering en proxies tipo Nginx.
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  sseService.addClient(res);
  res.write('event: connected\ndata: {}\n\n');
  console.log(`[SSE] Cliente conectado (total: ${sseService.clientCount()})`);

  // Keepalive cada 25 s para evitar timeouts de proxy/nginx
  const keepalive = setInterval(() => {
    try { res.write(':ping\n\n'); } catch (_) { clearInterval(keepalive); }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepalive);
    sseService.removeClient(res);
    console.log(`[SSE] Cliente desconectado (total: ${sseService.clientCount()})`);
  });
});

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

// === Imagen (archi) para Patrimonio CI ===
router.get('/patrimonioci/:id/archi', patrimonioApiController.getArchiPatrimonioci);

// === Estado de bien (SQLite item_estados) ===
router.get('/patrimonioci/:id/estado', patrimonioApiController.getEstadoBien);
router.patch('/patrimonioci/:id/estado', patrimonioApiController.setEstadoBien);

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
// VERIFY SESSION — verifica contra UMICH con URES (cacheado 5 min)
// =====================================================
router.get('/auth/verify', async (req, res) => {
  const jsession = req.cookies?.JSESSIONID || req.cookies?.auth_token;
  if (!jsession) return res.status(401).json({ ok: false });

  // Si se pasa ?ures=, verificar contra UMICH que la sesión siga activa
  const uresCode = req.query?.ures;
  if (uresCode && /^\d+$/.test(uresCode)) {
    const cacheKey = `verify:${jsession.slice(0, 16)}:${uresCode}`;
    const cached = await redisService.get(cacheKey);
    if (cached) {
      if (cached.ok) return res.json({ ok: true, cached: true });
      res.clearCookie('auth_token');
      res.clearCookie('JSESSIONID');
      return res.status(401).json({ ok: false, reason: 'umich_session_expired' });
    }

    try {
      const configuredBase = process.env.UMICH_API_BASE_URL || process.env.EXTERNAL_API_BASE_URL || 'http://api-patrimonio.umich.mx/api-patrimonio';
      const umichRes = await axios.get(`${configuredBase}/api/patrimonio/inventarioXures/${uresCode}`, {
        headers: { Cookie: `JSESSIONID=${jsession}` },
        timeout: 5000,
        validateStatus: () => true
      });
      if (umichRes.status === 403) {
        console.log('[Verify] Sesión UMICH expirada (403) — limpiando cookies');
        // No cachear la expiración — la próxima vez igual fallará sin cache
        res.clearCookie('auth_token');
        res.clearCookie('JSESSIONID');
        return res.status(401).json({ ok: false, reason: 'umich_session_expired' });
      }
      // Sesión válida — cachear 5 minutos
      await redisService.set(cacheKey, { ok: true }, 300);
    } catch (err) {
      console.warn('[Verify] No se pudo contactar UMICH:', err.message);
      // Error de red — no invalidar, dejar pasar
    }
  }

  return res.json({ ok: true });
});

// =====================================================
// LOGOUT
// =====================================================
router.post('/auth/logout', async (req, res) => {
  try {
    const configuredBase = process.env.UMICH_API_BASE_URL || process.env.EXTERNAL_API_BASE_URL || 'http://api-patrimonio.umich.mx/api-patrimonio';
    const jsession = req.cookies?.auth_token || req.cookies?.JSESSIONID || req.headers['x-umich-session'] || null;
    if (jsession) {
      const uresFromQuery = req.query?.ures || req.body?.ures;
      if (uresFromQuery) await redisService.del(`verify:${jsession.slice(0, 16)}:${uresFromQuery}`).catch(() => {});
      await axios.post(`${configuredBase}/auth/logout`, {}, {
        headers: { Cookie: `JSESSIONID=${jsession}` },
        timeout: parseInt(process.env.EXTERNAL_API_TIMEOUT || '10000', 10),
        validateStatus: () => true
      });
    }
  } catch (err) {
    console.warn('[Proxy Logout] Error llamando logout externo:', err.message || err);
  } finally {
    res.clearCookie('auth_token');
    res.clearCookie('JSESSIONID');
  }
  return res.json({ success: true, message: 'Logout exitoso' });
});

// =====================================================
// PERFIL DE USUARIO
// =====================================================
router.get('/auth/profile', async (req, res) => {

  // Modo API: obtener perfil desde UMICH usando la cookie de sesión
  try {
    const configuredBase = process.env.UMICH_API_BASE_URL || process.env.EXTERNAL_API_BASE_URL || 'http://api-patrimonio.umich.mx/api-patrimonio';
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
