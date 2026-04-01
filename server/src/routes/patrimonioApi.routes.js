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
    const API_UMICH = process.env.EXTERNAL_API_BASE_URL || 'http://api-patrimonio.umich.mx/api-patrimonio';
    
    console.log('[Proxy Login] Intentando login con UMICH...');
    
    const response = await axios.post(`${API_UMICH}/auth/login`, {
      username,
      password
    }, {
      validateStatus: () => true,
    });
    
    const setCookieHeader = response.headers['set-cookie'];
    let jsessionId = null;
    
    if (setCookieHeader) {
      for (const cookie of setCookieHeader) {
        const match = cookie.match(/JSESSIONID=([^;]+)/);
        if (match) {
          jsessionId = match[1];
          console.log('[Proxy Login] JSESSIONID capturado:', jsessionId.substring(0, 10) + '...');
          break;
        }
      }
    }
    
    const isSuccess = response.data?.message === 'Login exitoso' || 
                     response.status === 200 ||
                     jsessionId;
    
    if (isSuccess && jsessionId) {
      console.log('[Proxy Login] Login exitoso con UMICH');
      res.json({
        success: true,
        message: 'Login exitoso',
        sessionId: jsessionId,
        user: response.data?.user || { username }
      });
    } else {
      console.log('[Proxy Login] Login fallido:', response.data);
      res.status(401).json({
        success: false,
        message: response.data?.message || 'Credenciales inválidas'
      });
    }
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
