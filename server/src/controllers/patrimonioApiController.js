// =====================================================
// CONTROLADOR DE PATRIMONIO - API EXTERNA
// =====================================================
const patrimonioApiService = require('../services/patrimonioApiService');

/**
 * Obtener patrimonio por ID desde API externa
 */
const getPatrimonioById = async (req, res) => {
  try {
    const { id } = req.params;
    const umichSessionId = req.headers['x-umich-session'];
    
    console.log(`[Controller] Obteniendo patrimonio ${id} de API externa...`);
    
    const patrimonio = await patrimonioApiService.getPatrimonioById(id, umichSessionId);
    
    res.json({
      success: true,
      data: patrimonio
    });
  } catch (error) {
    console.error(`[Controller] Error:`, error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error al obtener patrimonio',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Listar patrimonios (limitado por la API)
 * NOTA: La API solo soporta consulta por ID individual
 */
const getAllPatrimonios = async (req, res) => {
  try {
    console.log('[Controller] Listado de patrimonios solicitado');
    const umichSessionId = req.headers['x-umich-session'];
    
    // Como la API no soporta listado, devolvemos ejemplos de prueba
    const testIds = [16932, 42]; // IDs de prueba disponibles
    
    const patrimonios = [];
    
    for (const id of testIds) {
      try {
        const item = await patrimonioApiService.getPatrimonioById(id, umichSessionId);
        patrimonios.push(item);
      } catch (error) {
        console.warn(`No se pudo obtener item ${id}:`, error.message);
      }
    }
    
    res.json({
      success: true,
      data: {
        items: patrimonios,
        total: patrimonios.length,
        pagination: {
          hasMore: false,
          nextCursor: null,
          isFiltered: false
        }
      },
      warning: 'La API externa solo soporta consulta por ID. Mostrando datos de prueba.'
    });
  } catch (error) {
    console.error(`[Controller] Error en listado:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Error al listar patrimonios',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Crear patrimonio en API externa
 */
const createPatrimonio = async (req, res) => {
  try {
    const data = req.body;
    const umichSessionId = req.headers['x-umich-session'];
    
    console.log('[Controller] Creando patrimonio en API externa...');
    
    const result = await patrimonioApiService.createPatrimonio(data, umichSessionId);
    
    res.status(201).json({
      success: true,
      message: 'Patrimonio creado exitosamente',
      data: result
    });
  } catch (error) {
    console.error(`[Controller] Error al crear:`, error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error al crear patrimonio',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Actualizar patrimonio en API externa
 */
const updatePatrimonio = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const umichSessionId = req.headers['x-umich-session'];
    
    console.log(`[Controller] Actualizando patrimonio ${id} en API externa...`);
    
    const result = await patrimonioApiService.updatePatrimonio(id, data, umichSessionId);
    
    res.json({
      success: true,
      message: 'Patrimonio actualizado exitosamente',
      data: result
    });
  } catch (error) {
    console.error(`[Controller] Error al actualizar:`, error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error al actualizar patrimonio',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Obtener marcas disponibles (placeholder)
 */
const getAvailableMarcas = async (req, res) => {
  res.json({
    success: true,
    data: ['No disponible en API externa']
  });
};

/**
 * Obtener ubicaciones disponibles (placeholder)
 */
const getAvailableUbicaciones = async (req, res) => {
  res.json({
    success: true,
    data: ['No disponible en API externa']
  });
};

/**
 * Buscar inventarios (placeholder)
 */
const searchInventarios = async (req, res) => {
  res.json({
    success: true,
    data: {
      items: [],
      total: 0
    },
    message: 'Búsqueda no disponible en API externa'
  });
};

/**
 * Obtener estadísticas del dashboard (placeholder)
 */
const getDashboardStats = async (req, res) => {
  res.json({
    success: true,
    data: {
      total: 1,
      activos: 1,
      baja: 0,
      valorTotal: 0
    },
    message: 'Estadísticas no disponibles en API externa'
  });
};

// =====================================================
// FUNCIONES ESPECÍFICAS PARA PATRIMONIO CI
// =====================================================

/**
 * Obtener PatrimonioCI por ID
 */
const getPatrimoniociById = async (req, res) => {
  try {
    const { id } = req.params;
    const umichSessionId = req.headers['x-umich-session'];
    
    console.log(`[Controller] Obteniendo patrimonioci ${id} de API externa...`);
    
    const patrimonioci = await patrimonioApiService.getPatrimoniociById(id, umichSessionId);
    
    res.json({
      success: true,
      data: patrimonioci
    });
  } catch (error) {
    console.error(`[Controller] Error:`, error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error al obtener patrimonioci',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Crear PatrimonioCI
 */
const createPatrimonioci = async (req, res) => {
  try {
    const data = req.body;
    const umichSessionId = req.headers['x-umich-session'];
    
    console.log('[Controller] Creando patrimonioci en API externa...');
    
    const result = await patrimonioApiService.createPatrimonioci(data, umichSessionId);
    
    res.status(201).json({
      success: true,
      message: 'PatrimonioCI creado exitosamente',
      data: result
    });
  } catch (error) {
    console.error(`[Controller] Error al crear:`, error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error al crear patrimonioci',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Actualizar PatrimonioCI
 */
const updatePatrimonioci = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const umichSessionId = req.headers['x-umich-session'];
    
    console.log(`[Controller] Actualizando patrimonioci ${id} en API externa...`);
    
    const result = await patrimonioApiService.updatePatrimonioci(id, data, umichSessionId);
    
    res.json({
      success: true,
      message: 'PatrimonioCI actualizado exitosamente',
      data: result
    });
  } catch (error) {
    console.error(`[Controller] Error al actualizar:`, error.message);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Error al actualizar patrimonioci',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = {
  getPatrimonioById,
  getAllPatrimonios,
  createPatrimonio,
  updatePatrimonio,
  getAvailableMarcas,
  getAvailableUbicaciones,
  searchInventarios,
  getDashboardStats,
  // Funciones PatrimonioCI
  getPatrimoniociById,
  createPatrimonioci,
  updatePatrimonioci
};