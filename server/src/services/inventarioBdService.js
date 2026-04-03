// =====================================================
// SERVICIO DE BASE DE DATOS LOCAL - INVENTARIO
// Gestiona datos desde PostgreSQL local
// =====================================================

const { pool } = require('../config/database');

const parseActivo = (value, defaultValue = true) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 't', 'yes', 'si', 'sí'].includes(normalized);
  }
  return defaultValue;
};

const parseDateOrNull = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
};

// =====================================================
// INVENTARIO INTERNO
// =====================================================

/**
 * Obtener inventario interno por ID
 */
const getInventarioInternoById = async (id) => {
  try {
    const result = await pool.query(
      'SELECT * FROM inventario_interno WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[BD Local] Error obteniendo inventario interno:', error);
    throw error;
  }
};

/**
 * Listar inventarios internos (con paginación)
 */
const getAllInventariosInternos = async (page = 1, limit = 50, filters = {}) => {
  try {
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM inventario_interno WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    // Filtros opcionales
    if (filters.marca) {
      query += ` AND marca ILIKE $${paramIndex}`;
      params.push(`%${filters.marca}%`);
      paramIndex++;
    }
    
    if (filters.modelo) {
      query += ` AND modelo ILIKE $${paramIndex}`;
      params.push(`%${filters.modelo}%`);
      paramIndex++;
    }
    
    if (filters.ubicacion_edificio) {
      query += ` AND ubicacion_edificio = $${paramIndex}`;
      params.push(filters.ubicacion_edificio);
      paramIndex++;
    }

    if (filters.responsable) {
      query += ` AND entrega_responsable = $${paramIndex}`;
      params.push(filters.responsable);
      paramIndex++;
    }

    if (filters.fecha_elaboracion) {
      query += ` AND fecha_elaboracion = $${paramIndex}`;
      params.push(filters.fecha_elaboracion);
      paramIndex++;
    }

    if (filters.estado) {
      const isActivo = String(filters.estado).toLowerCase() === 'activo';
      query += ` AND activo = $${paramIndex}`;
      params.push(isActivo);
      paramIndex++;
    }

    if (filters.q) {
      query += ` AND (
        COALESCE(numero_registro_patrimonial, '') ILIKE $${paramIndex}
        OR COALESCE(no_registro, '') ILIKE $${paramIndex}
        OR COALESCE(descripcion, '') ILIKE $${paramIndex}
        OR COALESCE(marca, '') ILIKE $${paramIndex}
        OR COALESCE(modelo, '') ILIKE $${paramIndex}
        OR COALESCE(no_serie, '') ILIKE $${paramIndex}
        OR COALESCE(no_factura, '') ILIKE $${paramIndex}
        OR COALESCE(ures_asignacion, '') ILIKE $${paramIndex}
        OR COALESCE(recurso, '') ILIKE $${paramIndex}
        OR COALESCE(proveedor, '') ILIKE $${paramIndex}
        OR COALESCE(observaciones, '') ILIKE $${paramIndex}
        OR COALESCE(responsable_usuario, '') ILIKE $${paramIndex}
        OR COALESCE(numero_empleado_usuario, '') ILIKE $${paramIndex}
        OR COALESCE(ur, '') ILIKE $${paramIndex}
        OR COALESCE(estado_uso, '') ILIKE $${paramIndex}
        OR COALESCE(costo::text, '') ILIKE $${paramIndex}
      )`;
      params.push(`%${filters.q}%`);
      paramIndex++;
    }
    
    // Contar total
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    
    // Agregar paginación
    query += ` ORDER BY fecha_creacion DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    return {
      items: result.rows,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    };
  } catch (error) {
    console.error('[BD Local] Error listando inventarios internos:', error);
    throw error;
  }
};

/**
 * Crear inventario interno
 */
const createInventarioInterno = async (data) => {
  try {
    const query = `
      INSERT INTO inventario_interno (
        numero_registro_patrimonial, no_registro, descripcion, marca, modelo,
        no_serie, no_factura, costo, ures_asignacion,
        ubicacion_edificio, recurso, proveedor, fecha_elaboracion, observaciones,
        estado_uso, entrega_responsable, responsable_usuario, numero_empleado_usuario, ur, activo,
        usuario_creacion
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20,
        $21
      )
      RETURNING *
    `;
    
    const values = [
      data.numero_registro_patrimonial,
      data.no_registro,
      data.descripcion,
      data.marca,
      data.modelo,
      data.no_serie,
      data.no_factura,
      data.costo,
      data.ures_asignacion,
      data.ubicacion_edificio,
      data.recurso,
      data.proveedor,
      parseDateOrNull(data.fecha_elaboracion),
      data.observaciones,
      data.estado_uso || '1-Bueno',
      data.entrega_responsable,
      data.responsable_usuario,
      data.numero_empleado_usuario,
      data.ur,
      parseActivo(data.activo, true),
      data.usuario_creacion || 'system'
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[BD Local] Error creando inventario interno:', error);
    throw error;
  }
};

/**
 * Actualizar inventario interno
 */
const updateInventarioInterno = async (id, data) => {
  try {
    const query = `
      UPDATE inventario_interno SET
        numero_registro_patrimonial = COALESCE($1, numero_registro_patrimonial),
        no_registro = COALESCE($2, no_registro),
        descripcion = COALESCE($3, descripcion),
        marca = COALESCE($4, marca),
        modelo = COALESCE($5, modelo),
        no_serie = COALESCE($6, no_serie),
        no_factura = COALESCE($7, no_factura),
        costo = COALESCE($8, costo),
        ures_asignacion = COALESCE($9, ures_asignacion),
        ubicacion_edificio = COALESCE($10, ubicacion_edificio),
        recurso = COALESCE($11, recurso),
        proveedor = COALESCE($12, proveedor),
        fecha_elaboracion = COALESCE($13, fecha_elaboracion),
        observaciones = COALESCE($14, observaciones),
        estado_uso = COALESCE($15, estado_uso),
        entrega_responsable = COALESCE($16, entrega_responsable),
        responsable_usuario = COALESCE($17, responsable_usuario),
        numero_empleado_usuario = COALESCE($18, numero_empleado_usuario),
        ur = COALESCE($19, ur),
        activo = COALESCE($20, activo),
        usuario_actualizacion = $21,
        fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id = $22
      RETURNING *
    `;
    
    const values = [
      data.numero_registro_patrimonial,
      data.no_registro,
      data.descripcion,
      data.marca,
      data.modelo,
      data.no_serie,
      data.no_factura,
      data.costo,
      data.ures_asignacion,
      data.ubicacion_edificio,
      data.recurso,
      data.proveedor,
      parseDateOrNull(data.fecha_elaboracion),
      data.observaciones,
      data.estado_uso,
      data.entrega_responsable,
      data.responsable_usuario,
      data.numero_empleado_usuario,
      data.ur,
      data.activo === undefined ? null : parseActivo(data.activo, true),
      data.usuario_actualizacion || 'system',
      id
    ];
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[BD Local] Error actualizando inventario interno:', error);
    throw error;
  }
};

// =====================================================
// INVENTARIO EXTERNO
// =====================================================

/**
 * Obtener inventario externo por ID
 */
const getInventarioExternoById = async (id) => {
  try {
    const result = await pool.query(
      'SELECT * FROM inventario_externo WHERE id = $1 AND activo = true',
      [id]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[BD Local] Error obteniendo inventario externo:', error);
    throw error;
  }
};

/**
 * Listar inventarios externos (con paginación)
 */
const getAllInventariosExternos = async (page = 1, limit = 50, filters = {}) => {
  try {
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM inventario_externo WHERE activo = true';
    const params = [];
    let paramIndex = 1;
    
    // Filtros opcionales
    if (filters.id_patrimonio) {
      query += ` AND id_patrimonio ILIKE $${paramIndex}`;
      params.push(`%${filters.id_patrimonio}%`);
      paramIndex++;
    }
    
    if (filters.marca) {
      query += ` AND marca ILIKE $${paramIndex}`;
      params.push(`%${filters.marca}%`);
      paramIndex++;
    }
    
    // Contar total
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    
    // Agregar paginación
    query += ` ORDER BY fecha_creacion DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    return {
      items: result.rows,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    };
  } catch (error) {
    console.error('[BD Local] Error listando inventarios externos:', error);
    throw error;
  }
};

/**
 * Crear inventario externo
 */
const createInventarioExterno = async (data) => {
  try {
    const query = `
      INSERT INTO inventario_externo (
        id_patrimonio, folio, no_inventario, descripcion, comentarios, entrega_responsable,
        areas_calculo, o_res_asignacion, folio_2, codigo, tipo_bien, desc_text, porc_desc,
        muo, equipo, marca, modelo, serie, ejercicio, adquisicion_compra, proveedor_prov,
        mycm, proveedor, anio_alta, fec_reg_registros, nvo_costo, ubicacion_edificio, ubicacion_salon,
        estado_uso, responsable_usuario, numero_empleado_usuario, usu_reg, activo, usuario_creacion
      ) VALUES (
        COALESCE(NULLIF($1, ''), nextval('inventario_externo_id_seq')::text), $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26, $27, $28,
        $29, $30, $31, $32, $33, $34
      )
      RETURNING *
    `;
    
    const values = [
      data.id_patrimonio ?? null,
      data.folio,
      data.no_inventario,
      data.descripcion,
      data.comentarios,
      data.entrega_responsable,
      data.areas_calculo,
      data.o_res_asignacion,
      data.folio_2,
      data.codigo,
      data.tipo_bien,
      data.desc_text,
      data.porc_desc,
      data.muo,
      data.equipo,
      data.marca,
      data.modelo,
      data.serie,
      data.ejercicio,
      data.adquisicion_compra,
      data.proveedor_prov,
      data.mycm,
      data.proveedor,
      data.anio_alta,
      parseDateOrNull(data.fec_reg_registros),
      data.nvo_costo ?? data.costo,
      data.ubicacion_edificio,
      data.ubicacion_salon,
      data.estado_uso || '1-Bueno',
      data.responsable_usuario,
      data.numero_empleado_usuario,
      data.usu_reg,
      parseActivo(data.activo, true),
      data.usuario_creacion || 'system'
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[BD Local] Error creando inventario externo:', error);
    throw error;
  }
};

/**
 * Actualizar inventario externo
 */
const updateInventarioExterno = async (id, data) => {
  try {
    const query = `
      UPDATE inventario_externo SET
        folio = COALESCE($1, folio),
        no_inventario = COALESCE($2, no_inventario),
        descripcion = COALESCE($3, descripcion),
        comentarios = COALESCE($4, comentarios),
        entrega_responsable = COALESCE($5, entrega_responsable),
        areas_calculo = COALESCE($6, areas_calculo),
        o_res_asignacion = COALESCE($7, o_res_asignacion),
        folio_2 = COALESCE($8, folio_2),
        codigo = COALESCE($9, codigo),
        tipo_bien = COALESCE($10, tipo_bien),
        desc_text = COALESCE($11, desc_text),
        porc_desc = COALESCE($12, porc_desc),
        muo = COALESCE($13, muo),
        equipo = COALESCE($14, equipo),
        marca = COALESCE($15, marca),
        modelo = COALESCE($16, modelo),
        serie = COALESCE($17, serie),
        ejercicio = COALESCE($18, ejercicio),
        adquisicion_compra = COALESCE($19, adquisicion_compra),
        proveedor_prov = COALESCE($20, proveedor_prov),
        mycm = COALESCE($21, mycm),
        proveedor = COALESCE($22, proveedor),
        anio_alta = COALESCE($23, anio_alta),
        fec_reg_registros = COALESCE($24, fec_reg_registros),
        nvo_costo = COALESCE($25, nvo_costo),
        ubicacion_edificio = COALESCE($26, ubicacion_edificio),
        ubicacion_salon = COALESCE($27, ubicacion_salon),
        estado_uso = COALESCE($28, estado_uso),
        responsable_usuario = COALESCE($29, responsable_usuario),
        numero_empleado_usuario = COALESCE($30, numero_empleado_usuario),
        usu_reg = COALESCE($31, usu_reg),
        activo = COALESCE($32, activo),
        usuario_actualizacion = $33,
        fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id = $34
      RETURNING *
    `;
    
    const values = [
      data.folio,
      data.no_inventario,
      data.descripcion,
      data.comentarios,
      data.entrega_responsable,
      data.areas_calculo,
      data.o_res_asignacion,
      data.folio_2,
      data.codigo,
      data.tipo_bien,
      data.desc_text,
      data.porc_desc,
      data.muo,
      data.equipo,
      data.marca,
      data.modelo,
      data.serie,
      data.ejercicio,
      data.adquisicion_compra,
      data.proveedor_prov,
      data.mycm,
      data.proveedor,
      data.anio_alta,
      parseDateOrNull(data.fec_reg_registros),
      data.nvo_costo ?? data.costo,
      data.ubicacion_edificio,
      data.ubicacion_salon,
      data.estado_uso,
      data.responsable_usuario,
      data.numero_empleado_usuario,
      data.usu_reg,
      data.activo === undefined ? null : parseActivo(data.activo, true),
      data.usuario_actualizacion || 'system',
      id
    ];
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('[BD Local] Error actualizando inventario externo:', error);
    throw error;
  }
};

// =====================================================
// FOTOS
// =====================================================

/**
 * Obtener fotos de un item
 */
const getFotosByItem = async (tipoInventario, inventarioId) => {
  try {
    const result = await pool.query(
      `SELECT * FROM fotos_patrimonio 
       WHERE tipo_inventario = $1 AND inventario_id = $2 
       ORDER BY orden`,
      [tipoInventario, inventarioId]
    );
    
    return result.rows;
  } catch (error) {
    console.error('[BD Local] Error obteniendo fotos:', error);
    throw error;
  }
};

/**
 * Agregar foto a un item
 */
const addFotoToItem = async (data) => {
  try {
    const query = `
      INSERT INTO fotos_patrimonio (
        tipo_inventario, inventario_id, ruta_archivo, nombre_archivo,
        tamanio_bytes, mime_type, orden, es_principal, descripcion,
        usuario_creacion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    const values = [
      data.tipo_inventario,
      data.inventario_id,
      data.ruta_archivo,
      data.nombre_archivo,
      data.tamanio_bytes,
      data.mime_type,
      data.orden,
      data.es_principal || false,
      data.descripcion,
      data.usuario_creacion || 'system'
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[BD Local] Error agregando foto:', error);
    throw error;
  }
};

/**
 * Eliminar foto por orden de un item
 */
const deleteFotoByOrden = async (tipoInventario, inventarioId, orden) => {
  try {
    const result = await pool.query(
      `DELETE FROM fotos_patrimonio
       WHERE tipo_inventario = $1 AND inventario_id = $2 AND orden = $3
       RETURNING *`,
      [tipoInventario, inventarioId, orden]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('[BD Local] Error eliminando foto por orden:', error);
    throw error;
  }
};

/**
 * Reemplazar o crear foto en un slot (orden 1..3)
 */
const upsertFotoSlot = async (data) => {
  try {
    const query = `
      INSERT INTO fotos_patrimonio (
        tipo_inventario, inventario_id, ruta_archivo, nombre_archivo,
        tamanio_bytes, mime_type, orden, es_principal, descripcion, usuario_creacion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (tipo_inventario, inventario_id, orden)
      DO UPDATE SET
        ruta_archivo = EXCLUDED.ruta_archivo,
        nombre_archivo = EXCLUDED.nombre_archivo,
        tamanio_bytes = EXCLUDED.tamanio_bytes,
        mime_type = EXCLUDED.mime_type,
        es_principal = EXCLUDED.es_principal,
        descripcion = EXCLUDED.descripcion,
        fecha_actualizacion = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      data.tipo_inventario,
      data.inventario_id,
      data.ruta_archivo,
      data.nombre_archivo,
      data.tamanio_bytes || null,
      data.mime_type || null,
      data.orden,
      data.es_principal || false,
      data.descripcion || null,
      data.usuario_creacion || 'system'
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[BD Local] Error upsert foto slot:', error);
    throw error;
  }
};

// =====================================================
// CATEGORÍAS
// =====================================================

/**
 * Obtener todas las categorías activas
 */
const getAllCategorias = async () => {
  try {
    const result = await pool.query(
      'SELECT * FROM categorias WHERE activo = true ORDER BY path_completo'
    );
    
    return result.rows;
  } catch (error) {
    console.error('[BD Local] Error obteniendo categorías:', error);
    throw error;
  }
};

/**
 * Obtener categorías por nivel
 */
const getCategoriasByNivel = async (nivel) => {
  try {
    const result = await pool.query(
      'SELECT * FROM categorias WHERE nivel = $1 AND activo = true ORDER BY orden',
      [nivel]
    );
    
    return result.rows;
  } catch (error) {
    console.error('[BD Local] Error obteniendo categorías por nivel:', error);
    throw error;
  }
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
  deleteFotoByOrden,
  upsertFotoSlot,
  
  // Categorías
  getAllCategorias,
  getCategoriasByNivel
};
