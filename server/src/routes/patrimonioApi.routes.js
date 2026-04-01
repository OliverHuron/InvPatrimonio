// =====================================================
// RUTAS DE PATRIMONIO - API EXTERNA
// =====================================================
const express = require('express');
const router = express.Router();
const patrimonioApiController = require('../controllers/patrimonioApiController');
const axios = require('axios');

// =====================================================
// LOGIN PROXY - Captura JSESSIONID de UMICH
// =====================================================
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const configuredBase = process.env.EXTERNAL_API_BASE_URL || 'https://api-patrimonio.umich.mx/api-patrimonio';
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
    
    console.log('[Proxy Login] Intentando login con UMICH...');

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
            user: response.data?.user || { username }
          });
        }

        lastErrorMessage = response.data?.message || response.data?.error || `HTTP ${response.status}`;
      }
    }

    console.log('[Proxy Login] Login fallido:', finalResponse?.data || lastErrorMessage);
    res.status(401).json({
      success: false,
      message: lastErrorMessage || 'Credenciales inválidas'
    });
  } catch (error) {
    console.error('[Proxy Login] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al conectar con UMICH'
    });
  }
});

// =====================================================
// RUTAS QUE CONSUMEN LA API EXTERNA
// =====================================================

// === PATRIMONIO CI (Interno) ===
router.get('/patrimonioci/:id', patrimonioApiController.getPatrimoniociById);
router.post('/patrimonioci/insertar', patrimonioApiController.createPatrimonioci);
router.put('/patrimonioci/actualizar/:id', patrimonioApiController.updatePatrimonioci);

// === PATRIMONIO (Externo - solo lectura) ===
router.get('/patrimonio/:id', patrimonioApiController.getPatrimonioById);

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

module.exports = router;
