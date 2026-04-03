// =====================================================
// CONTROLADOR DE PATRIMONIO - UNIFICADO (API/BD)
// =====================================================
const inventarioService = require('../services/inventarioService');
const fs = require('fs');
const path = require('path');

/**
 * Obtener patrimonio por ID (desde API o BD según configuración)
 */
const getPatrimonioById = async (req, res) => {
  try {
    const { id } = req.params;
    const umichSessionId = req.headers['x-umich-session'];
    
    console.log(`[Controller] Obteniendo patrimonio ${id}...`);
    
    const patrimonio = await inventarioService.getInventarioExternoById(id, umichSessionId);
    
    res.json({
      success: true,
      data: patrimonio,
      source: inventarioService.getDataSource()
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
 * Listar patrimonios (disponible solo en modo BD)
 */
const getAllPatrimonios = async (req, res) => {
  try {
    console.log('[Controller] Listado de patrimonios solicitado');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    
    const result = await inventarioService.getAllInventariosExternos(page, limit);
    
    res.json({
      success: true,
      data: result,
      source: inventarioService.getDataSource()
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
 * Crear patrimonio (en API o BD según configuración)
 */
const createPatrimonio = async (req, res) => {
  try {
    const data = req.body;
    const umichSessionId = req.headers['x-umich-session'];
    
    console.log('[Controller] Creando patrimonio...');
    
    const result = await inventarioService.createInventarioExterno(data, umichSessionId);
    
    res.status(201).json({
      success: true,
      message: 'Patrimonio creado exitosamente',
      data: result,
      source: inventarioService.getDataSource()
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
 * Actualizar patrimonio (en API o BD según configuración)
 */
const updatePatrimonio = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const umichSessionId = req.headers['x-umich-session'];
    
    console.log(`[Controller] Actualizando patrimonio ${id}...`);
    
    const result = await inventarioService.updateInventarioExterno(id, data, umichSessionId);
    
    res.json({
      success: true,
      message: 'Patrimonio actualizado exitosamente',
      data: result,
      source: inventarioService.getDataSource()
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
 * Obtener PatrimonioCI por ID (desde API o BD según configuración)
 */
const getPatrimoniociById = async (req, res) => {
  try {
    const { id } = req.params;
    const umichSessionId = req.headers['x-umich-session'];
    
    console.log(`[Controller] Obteniendo patrimonioci ${id}...`);
    
    const patrimonioci = await inventarioService.getInventarioInternoById(id, umichSessionId);
    
    res.json({
      success: true,
      data: patrimonioci,
      source: inventarioService.getDataSource()
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

const getAllPatrimonioci = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 200;
    const filters = {
      q: req.query.q || '',
      responsable: req.query.responsable || '',
      ubicacion: req.query.ubicacion || req.query.ubicacion_edificio || '',
      fecha_elaboracion: req.query.fecha_elaboracion || '',
      estado: req.query.estado || ''
    };
    const result = await inventarioService.getAllInventariosInternos(page, limit, filters);
    res.json({
      success: true,
      data: result,
      source: inventarioService.getDataSource()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al listar patrimonioci',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Crear PatrimonioCI (en API o BD según configuración)
 */
const createPatrimonioci = async (req, res) => {
  try {
    const data = req.body;
    const umichSessionId = req.headers['x-umich-session'];
    
    console.log('[Controller] Creando patrimonioci...');
    
    const result = await inventarioService.createInventarioInterno(data, umichSessionId);
    
    res.status(201).json({
      success: true,
      message: 'PatrimonioCI creado exitosamente',
      data: result,
      source: inventarioService.getDataSource()
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
 * Actualizar PatrimonioCI (en API o BD según configuración)
 */
const updatePatrimonioci = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const umichSessionId = req.headers['x-umich-session'];
    
    console.log(`[Controller] Actualizando patrimonioci ${id}...`);
    
    const result = await inventarioService.updateInventarioInterno(id, data, umichSessionId);
    
    res.json({
      success: true,
      message: 'PatrimonioCI actualizado exitosamente',
      data: result,
      source: inventarioService.getDataSource()
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

const getFotosPatrimonioci = async (req, res) => {
  try {
    const { id } = req.params;
    const fotos = await inventarioService.getFotosByItem('interno', id);
    res.json({ success: true, data: fotos });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener fotos'
    });
  }
};

const upsertFotoPatrimonioci = async (req, res) => {
  try {
    const { id, orden } = req.params;
    const ordenNum = parseInt(orden, 10);

    if (![1, 2, 3].includes(ordenNum)) {
      return res.status(400).json({ success: false, message: 'El orden debe ser 1, 2 o 3' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Debes enviar una imagen' });
    }

    const fotoAnterior = await inventarioService.deleteFotoByOrden('interno', id, ordenNum);
    const nuevaRutaRelativa = `uploads/patrimonio/${req.file.filename}`;
    if (fotoAnterior?.ruta_archivo && fotoAnterior.ruta_archivo !== nuevaRutaRelativa) {
      const previousAbsPath = path.join(__dirname, '..', '..', fotoAnterior.ruta_archivo);
      if (fs.existsSync(previousAbsPath)) {
        fs.unlinkSync(previousAbsPath);
      }
    }

    const nuevaFoto = await inventarioService.upsertFotoSlot({
      tipo_inventario: 'interno',
      inventario_id: parseInt(id, 10),
      ruta_archivo: nuevaRutaRelativa,
      nombre_archivo: req.file.filename,
      tamanio_bytes: req.file.size,
      mime_type: req.file.mimetype,
      orden: ordenNum,
      es_principal: ordenNum === 1,
      usuario_creacion: req.body?.usuario || 'system'
    });

    res.json({ success: true, data: nuevaFoto });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al guardar foto'
    });
  }
};

const deleteFotoPatrimonioci = async (req, res) => {
  try {
    const { id, orden } = req.params;
    const ordenNum = parseInt(orden, 10);

    if (![1, 2, 3].includes(ordenNum)) {
      return res.status(400).json({ success: false, message: 'El orden debe ser 1, 2 o 3' });
    }

    const foto = await inventarioService.deleteFotoByOrden('interno', id, ordenNum);
    if (foto?.ruta_archivo) {
      const absPath = path.join(__dirname, '..', '..', foto.ruta_archivo);
      if (fs.existsSync(absPath)) {
        fs.unlinkSync(absPath);
      }
    }

    res.json({ success: true, data: foto });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al eliminar foto'
    });
  }
};

/**
 * Obtener información del modo de datos actual
 */
const getDataSourceInfo = async (req, res) => {
  try {
    const info = inventarioService.getDataSourceInfo();
    res.json({
      success: true,
      data: info
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener información del sistema'
    });
  }
};

/**
 * Obtener catálogo de categorías para ENTREGA Responsable
 */
const getCategoriasEntrega = async (req, res) => {
  try {
    const categorias = await inventarioService.getAllCategorias();
    res.json({
      success: true,
      data: categorias
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener categorías'
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
  getAllPatrimonioci,
  getPatrimoniociById,
  createPatrimonioci,
  updatePatrimonioci,
  getFotosPatrimonioci,
  upsertFotoPatrimonioci,
  deleteFotoPatrimonioci,
  getCategoriasEntrega,
  // Info del sistema
  getDataSourceInfo
};
