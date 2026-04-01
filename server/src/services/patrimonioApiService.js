
// SERVICIO DE PATRIMONIO - API EXTERNA UMICH
const { get, post, put } = require('./apiClient');
const redisService = require('./redis.service');

// FUNCIONES DE TRANSFORMACIÓN DE DATOS


// Transforma datos de la API externa al formato interno

const transformApiToInternal = (apiData) => {
  if (!apiData) return null;

  return {
    // Campos de identificación
    id: apiData.invpId || null,
    folio: apiData.folio || null,
    numero_patrimonio: apiData.clavePat || null,
    uuid: apiData.uuid || null,
    
    // Descripciones
    descripcion: apiData.descrip || null,
    descripcion_bien: apiData.texto || null,
    
    // Marca y modelo
    marca: apiData.marca || null,
    modelo: apiData.modelo || null,
    numero_serie: apiData.serie || null,
    
    // Ubicación y asignación
    ubicacion_id: apiData.ures || null,
    ubicacion: apiData.ubica || null,
    usu_asig: apiData.persona || null,
    numero_empleado: apiData.persona || null,
    
    // Información financiera
    costo: apiData.costo || null,
    valor_actual: apiData.costo || null,
    
    // Tipo de bien
    tipo_bien: apiData.tipoBien || null,
    
    // Factura y adquisición
    factura: apiData.numFact || null,
    fecha_adquisicion: apiData.ffactura || null,
    
    // Campos contables (solo en API externa)
    cog: apiData.cog || null,
    cuenta_contable: apiData.cnta || null,
    cuenta_descripcion: apiData.cntaDescr || null,
    ejercicio: apiData.ejercicio || null,
    documento: apiData.docu || null,
    fondo: apiData.fondo || null,
    
    // Metadatos
    id_concepto: apiData.idCon || null,
    ultimo_usuario: apiData.lusu || null,
    
    // Campos que NO vienen de la API (valores por defecto)
    estado: 'activo',
    estado_uso: 'bueno',
    observaciones: null,
    comentarios: null,
    
    // Metadatos de origen
    _source: 'api_externa',
    _fecha_sincronizacion: new Date().toISOString()
  };
};

/**
 * Transforma datos internos al formato de la API externa
 * Se usa para POST/PUT hacia la API
 */
const transformInternalToApi = (internalData) => {
  return {
    invpId: internalData.id || 0,
    folio: internalData.folio || '',
    clavePat: internalData.numero_patrimonio || 0,
    descrip: internalData.descripcion || '',
    texto: internalData.descripcion_bien || '',
    persona: internalData.usu_asig || internalData.numero_empleado || '',
    ures: internalData.ubicacion_id || 0,
    ubica: internalData.ubicacion || '',
    costo: internalData.costo || internalData.valor_actual || 0,
    cog: internalData.cog || '',
    cnta: internalData.cuenta_contable || '',
    cntaDescr: internalData.cuenta_descripcion || '',
    tipoBien: internalData.tipo_bien || '',
    numFact: internalData.factura || '',
    ffactura: internalData.fecha_adquisicion || '',
    uuid: internalData.uuid || '',
    marca: internalData.marca || '',
    modelo: internalData.modelo || '',
    serie: internalData.numero_serie || '',
    ejercicio: internalData.ejercicio || new Date().getFullYear(),
    docu: internalData.documento || '',
    fondo: internalData.fondo || '',
    idCon: internalData.id_concepto || 0,
    lusu: internalData.ultimo_usuario || ''
  };
};

/**
 * Transforma datos del frontend al formato de PatrimonioCI de UMICH
 * El frontend usa: descrip, marca, modelo, num_serie, depenadsc, ures, id_pat_ci, activo
 */
const transformToPatrimoniociApi = (data) => {
  // Convertir activo a entero correctamente (maneja "0", "1", 0, 1, true, false)
  let activo = 0;
  if (data.activo !== undefined && data.activo !== null) {
    activo = parseInt(data.activo, 10) || 0;
  }
  
  return {
    id_pat_ci: data.id_pat_ci || data.id || 0,
    descrip: data.descrip || data.descripcion || null,
    marca: data.marca || null,
    modelo: data.modelo || null,
    num_serie: data.num_serie || data.numero_serie || null,
    depenadsc: data.depenadsc || data.dependencia || null,
    ures: data.ures || data.ubicacion || '0',
    activo: activo
  };
};

// =====================================================
// FUNCIONES DE CACHE
// =====================================================

/**
 * Genera clave de cache única para patrimonio
 */
const getCacheKey = (id) => `patrimonio:api:${id}`;

/**
 * Obtiene dato de cache o de la API
 * @param {string|number} id - ID del patrimonio
 * @param {string} umichSessionId - SessionId de UMICH para autenticación
 * @param {number} ttl - Tiempo de vida del cache en segundos
 */
const getWithCache = async (id, umichSessionId = null, ttl = 300) => {
  const cacheKey = getCacheKey(id);
  
  try {
    const cached = await redisService.get(cacheKey);
    if (cached) {
      console.log(`[Patrimonio API] Cache HIT para ID ${id}`);
      return JSON.parse(cached);
    }
    
    console.log(`[Patrimonio API] Cache MISS - Consultando API para ID ${id}`);
    
    const config = umichSessionId ? { umichSessionId } : {};
    const apiData = await get(`/api/patrimonio/${id}`, config);
    
    // UMICH puede devolver un array - tomar el primer elemento
    const raw = Array.isArray(apiData) ? apiData[0] : (apiData.data ? apiData.data[0] || apiData.data : apiData);
    
    if (!raw) {
      console.log(`[Patrimonio API] No se encontro registro con ID ${id}`);
      return null;
    }
    
    const transformed = transformApiToInternal(raw);
    
    await redisService.set(cacheKey, JSON.stringify(transformed), ttl);
    
    return transformed;
  } catch (error) {
    console.error(`[Patrimonio API] Error obteniendo patrimonio ${id}:`, error.message);
    throw error;
  }
};

/**
 * Invalida cache de un patrimonio específico
 */
const invalidateCache = async (id) => {
  const cacheKey = getCacheKey(id);
  await redisService.del(cacheKey);
  console.log(`[Patrimonio API] 🗑️ Cache invalidado para ID ${id}`);
};

// =====================================================
// OPERACIONES CRUD CON LA API
// =====================================================

/**
 * Obtener patrimonio por ID
 * @param {string|number} id - ID del patrimonio
 * @param {string} umichSessionId - SessionId de UMICH
 */
const getPatrimonioById = async (id, umichSessionId = null) => {
  try {
    return await getWithCache(id, umichSessionId);
  } catch (error) {
    throw new Error(`Error al obtener patrimonio ${id}: ${error.message}`);
  }
};

// =====================================================
// OPERACIONES ESPECÍFICAS PARA PATRIMONIOCI
// =====================================================

/**
 * Obtener patrimonio CI por ID
 * @param {string|number} id - ID del patrimonio CI
 * @param {string} umichSessionId - SessionId de UMICH
 */
const getPatrimoniociById = async (id, umichSessionId = null) => {
  try {
    const cacheKey = `patrimonioci:api:${id}`;
    
    // Intentar cache
    const cached = await redisService.get(cacheKey);
    if (cached) {
      console.log(`[PatrimonioCI API] Cache HIT para ID ${id}`);
      return JSON.parse(cached);
    }
    
    const config = umichSessionId ? { umichSessionId } : {};
    const apiData = await get(`/api/patrimonioci/${id}`, config);
    
    console.log(`[PatrimonioCI API] Respuesta cruda de UMICH:`, JSON.stringify(apiData, null, 2));
    
    const raw = Array.isArray(apiData) ? apiData[0] : (apiData.data ? apiData.data[0] || apiData.data : apiData);
    
    if (!raw) {
      console.log(`[PatrimonioCI API] No se encontro registro con ID ${id}`);
      return null;
    }
    
    // Transformar formato - MANTENER campos UMICH + campos transformados para compatibilidad
    const transformed = {
      // Campos originales UMICH (para enviar de vuelta al actualizar)
      id_pat_ci: raw.id_pat_ci || parseInt(id),
      descrip: raw.descrip || null,
      marca: raw.marca || null,
      modelo: raw.modelo || null,
      num_serie: raw.num_serie || null,
      depenadsc: raw.depenadsc || null,
      ures: raw.ures || '0',
      activo: raw.activo,
      // Campos transformados (para mostrar en UI)
      id: raw.id_pat_ci || id,
      descripcion: raw.descrip || null,
      numero_serie: raw.num_serie || null,
      dependencia: raw.depenadsc || null,
      ubicacion: raw.ures || null,
      _source: 'api_externa_ci',
      _raw: raw
    };
    
    console.log(`[PatrimonioCI API] Datos transformados:`, transformed);
    
    // Guardar en cache
    await redisService.set(cacheKey, JSON.stringify(transformed), 300);
    
    return transformed;
  } catch (error) {
    throw new Error(`Error al obtener patrimonioCI ${id}: ${error.message}`);
  }
};

/**
 * Crear nuevo PatrimonioCI (POST)
 * @param {object} data - Datos del patrimonio
 * @param {string} umichSessionId - SessionId de UMICH
 */
const createPatrimonioci = async (data, umichSessionId = null) => {
  try {
    const apiData = transformToPatrimoniociApi(data);
    const config = umichSessionId ? { umichSessionId } : {};
    
    console.log('[PatrimonioCI API] Enviando POST insertar:', JSON.stringify(apiData));
    const response = await post('/api/patrimonioci/insertar', apiData, config);
    
    console.log('[PatrimonioCI API] PatrimonioCI creado:', response);
    return response;
  } catch (error) {
    throw new Error(`Error al crear patrimonioci: ${error.message}`);
  }
};

/**
 * Actualizar PatrimonioCI existente (PUT)
 * @param {string|number} id - ID del patrimonio
 * @param {object} data - Datos a actualizar
 * @param {string} umichSessionId - SessionId de UMICH
 */
const updatePatrimonioci = async (id, data, umichSessionId = null) => {
  try {
    const apiData = transformToPatrimoniociApi(data);
    const config = umichSessionId ? { umichSessionId } : {};
    
    console.log('[PatrimonioCI API] Enviando PUT actualizar:', JSON.stringify(apiData));
    const response = await put(`/api/patrimonioci/actualizar/${id}`, apiData, config);
    
    // Invalidar cache
    const cacheKey = `patrimonioci:api:${id}`;
    await redisService.del(cacheKey);
    
    console.log(`[PatrimonioCI API] PatrimonioCI ${id} actualizado`);
    return response;
  } catch (error) {
    throw new Error(`Error al actualizar patrimonioci ${id}: ${error.message}`);
  }
};

// =====================================================
// OPERACIONES LEGACY (para compatibilidad)
// =====================================================

/**
 * Crear nuevo patrimonio (POST) - Alias de createPatrimonioci
 * @param {object} data - Datos del patrimonio
 * @param {string} umichSessionId - SessionId de UMICH
 */
const createPatrimonio = async (data, umichSessionId = null) => {
  return await createPatrimonioci(data, umichSessionId);
};

/**
 * Actualizar patrimonio existente (PUT) - Alias de updatePatrimonioci
 * @param {string|number} id - ID del patrimonio
 * @param {object} data - Datos a actualizar
 * @param {string} umichSessionId - SessionId de UMICH
 */
const updatePatrimonio = async (id, data, umichSessionId = null) => {
  return await updatePatrimonioci(id, data, umichSessionId);
};

/**
 * Buscar múltiples patrimonios
 * NOTA: La API no soporta búsqueda masiva, esta función es un placeholder
 */
const searchPatrimonios = async (query) => {
  console.warn('[Patrimonio API] ⚠️ La API externa no soporta búsqueda. Retornando array vacío.');
  return {
    items: [],
    total: 0,
    message: 'Búsqueda no disponible en API externa'
  };
};

/**
 * Obtener lista de patrimonios
 * NOTA: La API no soporta listado, esta función es un placeholder
 */
const getAllPatrimonios = async (page = 1, limit = 50) => {
  console.warn('[Patrimonio API] ⚠️ La API externa no soporta paginación. Retornando array vacío.');
  return {
    items: [],
    total: 0,
    page: 1,
    pages: 0,
    message: 'Listado no disponible en API externa'
  };
};

// =====================================================
// EXPORTAR FUNCIONES
// =====================================================
module.exports = {
  // Operaciones principales
  getPatrimonioById,
  getPatrimoniociById,
  createPatrimonioci,
  updatePatrimonioci,
  // Alias para compatibilidad
  getPatrimonioCiById: getPatrimoniociById,
  createPatrimonio,
  updatePatrimonio,
  searchPatrimonios,
  getAllPatrimonios,
  
  // Utilidades
  transformApiToInternal,
  transformInternalToApi,
  invalidateCache,
  
  // IDs de prueba (útil para testing)
  TEST_IDS: {
    patrimonio: 16932,
    patrimonioci: 42
  }
};