// =====================================================
// SERVICIO UNIFICADO DE INVENTARIO
// Gestiona el switch entre API y Base de Datos
// Usa variable de entorno INVENTARIO_DATA_SOURCE
// =====================================================

const patrimonioApiService = require('./patrimonioApiService');
const inventarioBdService = require('./inventarioBdService');

// Obtener modo de datos desde variable de entorno
const getDataSource = () => {
  const source = process.env.INVENTARIO_DATA_SOURCE || 'bd';
  return source.toLowerCase(); // 'api' o 'bd'
};

// Log del modo actual
const logSource = (operation) => {
  const source = getDataSource();
  console.log(`[Inventario Service] ${operation} - Usando ${source.toUpperCase()}`);
};

// =====================================================
// INVENTARIO INTERNO
// =====================================================

/**
 * Obtener inventario interno por ID
 */
const getInventarioInternoById = async (id, umichSessionId = null) => {
  logSource('getInventarioInternoById');
  const source = getDataSource();
  
  if (source === 'api') {
    // Usar API externa
    return await patrimonioApiService.getPatrimoniociById(id, umichSessionId);
  } else {
    // Usar Base de Datos local
    const item = await inventarioBdService.getInventarioInternoById(id);
    
    // Transformar al formato esperado por el frontend
    if (item) {
      return {
        id: item.id,
        id_pat_ci: item.id,
        numero_registro_patrimonial: item.numero_registro_patrimonial,
        no_registro: item.no_registro,
        descripcion: item.descripcion,
        usuario_creacion: item.usuario_creacion,
        marca: item.marca,
        modelo: item.modelo,
        no_serie: item.no_serie,
        no_factura: item.no_factura,
        uuid: item.uuid,
        ures_asignacion: item.ures_asignacion,
        ubicacion: item.ubicacion,
        recurso: item.recurso,
        dependencia: item.entrega_responsable,
        ures: item.ur,
        ur: item.ur,
        proveedor: item.proveedor,
        observaciones: item.observaciones,
        fecha_elaboracion: item.fecha_elaboracion,
        entrega_responsable: item.entrega_responsable,
        responsable_usuario: item.responsable_usuario,
        numero_empleado_usuario: item.numero_empleado_usuario,
        estado_uso: item.estado_uso,
        costo: item.costo,
        activo: item.activo ? 1 : 0,
        _source: 'bd_local'
      };
    }
    return null;
  }
};

/**
 * Listar inventarios internos
 */
const getAllInventariosInternos = async (page = 1, limit = 50, filters = {}) => {
  logSource('getAllInventariosInternos');
  const source = getDataSource();
  
  if (source === 'api') {
    // API no soporta listado completo, retornar mensaje
    return {
      items: [],
      total: 0,
      page: 1,
      pages: 0,
      message: 'Listado no disponible en modo API'
    };
  } else {
    return await inventarioBdService.getAllInventariosInternos(page, limit, filters);
  }
};

/**
 * Crear inventario interno
 */
const createInventarioInterno = async (data, umichSessionId = null) => {
  logSource('createInventarioInterno');
  const source = getDataSource();
  
  if (source === 'api') {
    return await patrimonioApiService.createPatrimonioci(data, umichSessionId);
  } else {
    return await inventarioBdService.createInventarioInterno(data);
  }
};

/**
 * Actualizar inventario interno
 */
const updateInventarioInterno = async (id, data, umichSessionId = null) => {
  logSource('updateInventarioInterno');
  const source = getDataSource();
  
  if (source === 'api') {
    return await patrimonioApiService.updatePatrimonioci(id, data, umichSessionId);
  } else {
    return await inventarioBdService.updateInventarioInterno(id, data);
  }
};

// =====================================================
// INVENTARIO EXTERNO
// =====================================================

/**
 * Obtener inventario externo por ID
 */
const getInventarioExternoById = async (id, umichSessionId = null) => {
  logSource('getInventarioExternoById');
  const source = getDataSource();
  
  if (source === 'api') {
    return await patrimonioApiService.getPatrimonioById(id, umichSessionId);
  } else {
    const item = await inventarioBdService.getInventarioExternoById(id);
    
    // Transformar al formato esperado por el frontend
    if (item) {
      return {
        id: item.id,
        id_patrimonio: item.id_patrimonio,
        no_inventario: item.no_inventario,
        folio: item.folio,
        descripcion: item.descripcion,
        comentarios: item.comentarios,
        entrega_responsable: item.entrega_responsable,
        areas_calculo: item.areas_calculo,
        o_res_asignacion: item.o_res_asignacion,
        folio_2: item.folio_2,
        codigo: item.codigo,
        marca: item.marca,
        modelo: item.modelo,
        serie: item.serie,
        tipo_bien: item.tipo_bien,
        desc_text: item.desc_text,
        porc_desc: item.porc_desc,
        muo: item.muo,
        equipo: item.equipo,
        ejercicio: item.ejercicio,
        adquisicion_compra: item.adquisicion_compra,
        proveedor_prov: item.proveedor_prov,
        mycm: item.mycm,
        proveedor: item.proveedor,
        anio_alta: item.anio_alta,
        fec_reg_registros: item.fec_reg_registros,
        nvo_costo: item.nvo_costo,
        ubicacion: item.ubicacion,
        estado_uso: item.estado_uso,
        responsable_usuario: item.responsable_usuario,
        numero_empleado_usuario: item.numero_empleado_usuario,
        usu_reg: item.usu_reg,
        activo: item.activo,
        _source: 'bd_local'
      };
    }
    return null;
  }
};

/**
 * Listar inventarios externos
 */
const getAllInventariosExternos = async (page = 1, limit = 50) => {
  logSource('getAllInventariosExternos');
  const source = getDataSource();
  
  if (source === 'api') {
    return {
      items: [],
      total: 0,
      page: 1,
      pages: 0,
      message: 'Listado no disponible en modo API'
    };
  } else {
    return await inventarioBdService.getAllInventariosExternos(page, limit);
  }
};

/**
 * Crear inventario externo
 */
const createInventarioExterno = async (data, umichSessionId = null) => {
  logSource('createInventarioExterno');
  const source = getDataSource();
  
  if (source === 'api') {
    return await patrimonioApiService.createPatrimonio(data, umichSessionId);
  } else {
    return await inventarioBdService.createInventarioExterno(data);
  }
};

/**
 * Actualizar inventario externo
 */
const updateInventarioExterno = async (id, data, umichSessionId = null) => {
  logSource('updateInventarioExterno');
  const source = getDataSource();
  
  if (source === 'api') {
    return await patrimonioApiService.updatePatrimonio(id, data, umichSessionId);
  } else {
    return await inventarioBdService.updateInventarioExterno(id, data);
  }
};

// =====================================================
// FOTOS (Solo disponible en BD local)
// =====================================================

/**
 * Obtener fotos de un item
 */
const getFotosByItem = async (tipoInventario, inventarioId) => {
  const source = getDataSource();
  
  if (source === 'api') {
    console.warn('[Inventario Service] Fotos no disponibles en modo API');
    return [];
  } else {
    return await inventarioBdService.getFotosByItem(tipoInventario, inventarioId);
  }
};

/**
 * Agregar foto a un item
 */
const addFotoToItem = async (data) => {
  const source = getDataSource();
  
  if (source === 'api') {
    throw new Error('Gestión de fotos no disponible en modo API');
  } else {
    return await inventarioBdService.addFotoToItem(data);
  }
};

const upsertFotoSlot = async (data) => {
  const source = getDataSource();
  if (source === 'api') {
    throw new Error('Gestión de fotos no disponible en modo API');
  }
  return await inventarioBdService.upsertFotoSlot(data);
};

const deleteFotoByOrden = async (tipoInventario, inventarioId, orden) => {
  const source = getDataSource();
  if (source === 'api') {
    throw new Error('Gestión de fotos no disponible en modo API');
  }
  return await inventarioBdService.deleteFotoByOrden(tipoInventario, inventarioId, orden);
};

// =====================================================
// CATEGORÍAS (Solo disponible en BD local)
// =====================================================

/**
 * Obtener todas las categorías
 */
const getAllCategorias = async () => {
  return await inventarioBdService.getAllCategorias();
};

/**
 * Obtener categorías por nivel
 */
const getCategoriasByNivel = async (nivel) => {
  return await inventarioBdService.getCategoriasByNivel(nivel);
};

// =====================================================
// UTILIDADES
// =====================================================

/**
 * Obtener información del modo actual
 */
const getDataSourceInfo = () => {
  const source = getDataSource();
  return {
    mode: source,
    description: source === 'api' 
      ? 'Consumiendo API externa de UMICH' 
      : 'Usando Base de Datos PostgreSQL local',
    features: {
      listado: source === 'bd',
      fotos: source === 'bd',
      categorias: source === 'bd',
      busqueda: source === 'bd'
    }
  };
};

// =====================================================
// EXPORTAR FUNCIONES
// =====================================================
module.exports = {
  // Inventario Interno
  getInventarioInternoById,
  getAllInventariosInternos,
  createInventarioInterno,
  updateInventarioInterno,
  
  // Inventario Externo
  getInventarioExternoById,
  getAllInventariosExternos,
  createInventarioExterno,
  updateInventarioExterno,
  
  // Fotos
  getFotosByItem,
  addFotoToItem,
  upsertFotoSlot,
  deleteFotoByOrden,
  
  // Categorías
  getAllCategorias,
  getCategoriasByNivel,
  
  // Utilidades
  getDataSourceInfo,
  getDataSource
};
