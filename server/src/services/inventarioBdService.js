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
const getAllInventariosInternos = async (page = 1, limit = 500, filters = {}) => {
  try {
    const offset = (page - 1) * limit;
    console.log('[BD] getAllInventariosInternos filters:', filters);
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
    
    if (filters.ubicacion) {
      query += ` AND ubicacion = $${paramIndex}`;
      params.push(filters.ubicacion);
      paramIndex++;
    }

    if (filters.resguardante) {
      // 'resguardante' in UI corresponds to `usu_asig` column in DB
      query += ` AND COALESCE(usu_asig, '') = $${paramIndex}`;
      params.push(filters.resguardante);
      paramIndex++;
    }

    if (filters.responsable) {
      query += ` AND responsable = $${paramIndex}`;
      params.push(filters.responsable);
      paramIndex++;
    }

    // Filtrado por año/ejercicio: preferir `ejercicio`, aceptar también `anio_elaboracion` por compatibilidad
    // Normalizar comparaciones: recortar espacios y comparar como texto
    if (filters.ejercicio) {
      query += ` AND COALESCE(TRIM(ejercicio::text), '') = $${paramIndex}`;
      params.push(String(filters.ejercicio).trim());
      paramIndex++;
    } else if (filters.anio_elaboracion) {
      // Compatibilidad: aceptar `anio_elaboracion` y buscar por columna `ejercicio`
      query += ` AND COALESCE(TRIM(ejercicio::text), '') = $${paramIndex}`;
      params.push(String(filters.anio_elaboracion).trim());
      paramIndex++;
    }

    if (filters.estado) {
      query += ` AND estado = $${paramIndex}`;
      params.push(filters.estado);
      paramIndex++;
    }

    if (filters.q) {
      // Búsqueda inteligente: revisar los campos solicitados por el usuario
      query += ` AND (
        COALESCE(id::text, '') ILIKE $${paramIndex}
        OR COALESCE(folio, '') ILIKE $${paramIndex}
        OR COALESCE(clave_patrimonial, '') ILIKE $${paramIndex}
        OR COALESCE(descripcion, '') ILIKE $${paramIndex}
        OR COALESCE(comentarios, '') ILIKE $${paramIndex}
        OR COALESCE(responsable, '') ILIKE $${paramIndex}
        OR COALESCE(ures_gasto, '') ILIKE $${paramIndex}
        OR COALESCE(ures_asignacion, '') ILIKE $${paramIndex}
        OR COALESCE(ubicacion, '') ILIKE $${paramIndex}
        OR COALESCE(costo::text, '') ILIKE $${paramIndex}
        OR COALESCE(cog, '') ILIKE $${paramIndex}
        OR COALESCE(cuenta, '') ILIKE $${paramIndex}
        OR COALESCE(descripcion_cuenta, '') ILIKE $${paramIndex}
        OR COALESCE(tipo_bien, '') ILIKE $${paramIndex}
        OR COALESCE(no_factura, '') ILIKE $${paramIndex}
        OR COALESCE(fec_fact::text, '') ILIKE $${paramIndex}
        OR COALESCE(uuid::text, '') ILIKE $${paramIndex}
        OR COALESCE(marca, '') ILIKE $${paramIndex}
        OR COALESCE(modelo, '') ILIKE $${paramIndex}
        OR COALESCE(no_serie, '') ILIKE $${paramIndex}
        OR COALESCE(ejercicio::text, '') ILIKE $${paramIndex}
        OR COALESCE(solicitud_orden_compra, '') ILIKE $${paramIndex}
        OR COALESCE(fondo, '') ILIKE $${paramIndex}
        OR COALESCE(cuenta_por_pagar, '') ILIKE $${paramIndex}
        OR COALESCE(idcon::text, '') ILIKE $${paramIndex}
        OR COALESCE(proveedor, '') ILIKE $${paramIndex}
        OR COALESCE(usu_asig, '') ILIKE $${paramIndex}
        OR COALESCE(usuario_registro, '') ILIKE $${paramIndex}
        OR COALESCE(fecha_registro::text, '') ILIKE $${paramIndex}
        OR COALESCE(fecha_asignacion::text, '') ILIKE $${paramIndex}
        OR COALESCE(fecha_aprobacion::text, '') ILIKE $${paramIndex}
      )`;
      params.push(`%${filters.q}%`);
      paramIndex++;
    }
    
    // Contar total
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    console.log('[BD] countQuery:', countQuery);
    console.log('[BD] countParams:', params);
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    
    // Agregar paginación
    query += ` ORDER BY fecha_creacion DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    console.log('[BD] finalQuery:', query);
    console.log('[BD] finalParams:', params);
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
        clave_patrimonial, folio, descripcion, marca, modelo,
        no_serie, no_factura, fec_fact, costo, ures_asignacion,
        ures_gasto, ubicacion, cog, proveedor, comentarios,
        responsable, usu_asig, numero_empleado_usuario,
        cuenta, descripcion_cuenta, tipo_bien, ejercicio, solicitud_orden_compra,
        fondo, cuenta_por_pagar, idcon, usuario_registro,
        fecha_registro, fecha_asignacion, fecha_aprobacion,
        estado, usuario_creacion
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25,
        $26, $27, $28, $29, $30,
        $31, $32
      )
      RETURNING *
    `;

    const values = [
      data.clave_patrimonial || data.numero_registro_patrimonial,
      data.folio || data.no_registro,
      data.descripcion,
      data.marca,
      data.modelo,
      data.no_serie,
      data.no_factura,
      parseDateOrNull(data.fec_fact || data.fecha_factura),
      data.costo,
      data.ures_asignacion,
      data.ures_gasto || data.ur || data.ures,
      data.ubicacion,
      data.cog || data.recurso,
      data.proveedor,
      data.comentarios || data.observaciones,
      data.responsable || data.entrega_responsable,
      data.usu_asig || data.responsable_usuario,
      data.numero_empleado_usuario,
      data.cuenta,
      data.descripcion_cuenta,
      data.tipo_bien,
      data.ejercicio,
      data.solicitud_orden_compra,
      data.fondo,
      data.cuenta_por_pagar,
      data.idcon,
      data.usuario_registro,
      parseDateOrNull(data.fecha_registro),
      parseDateOrNull(data.fecha_asignacion),
      parseDateOrNull(data.fecha_aprobacion),
      data.estado || 'Sin asignar',
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
        clave_patrimonial = COALESCE($1, clave_patrimonial),
        folio = COALESCE($2, folio),
        descripcion = COALESCE($3, descripcion),
        marca = COALESCE($4, marca),
        modelo = COALESCE($5, modelo),
        no_serie = COALESCE($6, no_serie),
        no_factura = COALESCE($7, no_factura),
        fec_fact = COALESCE($8, fec_fact),
        costo = COALESCE($9, costo),
        ures_asignacion = COALESCE($10, ures_asignacion),
        ures_gasto = COALESCE($11, ures_gasto),
        ubicacion = COALESCE($12, ubicacion),
        cog = COALESCE($13, cog),
        proveedor = COALESCE($14, proveedor),
        cuenta = COALESCE($15, cuenta),
        descripcion_cuenta = COALESCE($16, descripcion_cuenta),
        tipo_bien = COALESCE($17, tipo_bien),
        ejercicio = COALESCE($18, ejercicio),
        solicitud_orden_compra = COALESCE($19, solicitud_orden_compra),
        fondo = COALESCE($20, fondo),
        cuenta_por_pagar = COALESCE($21, cuenta_por_pagar),
        idcon = COALESCE($22, idcon),
        usuario_registro = COALESCE($23, usuario_registro),
        fecha_registro = COALESCE($24, fecha_registro),
        fecha_asignacion = COALESCE($25, fecha_asignacion),
        fecha_aprobacion = COALESCE($26, fecha_aprobacion),
        comentarios = COALESCE($27, comentarios),
        responsable = COALESCE($28, responsable),
        usu_asig = COALESCE($29, usu_asig),
        numero_empleado_usuario = COALESCE($30, numero_empleado_usuario),
        estado = COALESCE($31, estado),
        usuario_actualizacion = $32,
        fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id = $33
      RETURNING *
    `;

    const values = [
      data.clave_patrimonial,
      data.folio,
      data.descripcion,
      data.marca,
      data.modelo,
      data.no_serie,
      data.no_factura,
      parseDateOrNull(data.fec_fact || data.fecha_factura),
      data.costo,
      data.ures_asignacion,
      data.ures_gasto || data.ur,
      data.ubicacion,
      data.cog || data.recurso,
      data.proveedor,
      data.cuenta,
      data.descripcion_cuenta,
      data.tipo_bien,
      data.ejercicio,
      data.solicitud_orden_compra,
      data.fondo,
      data.cuenta_por_pagar,
      data.idcon,
      data.usuario_registro,
      parseDateOrNull(data.fecha_registro),
      parseDateOrNull(data.fecha_asignacion),
      parseDateOrNull(data.fecha_aprobacion),
      data.comentarios,
      data.responsable,
      data.usu_asig,
      data.numero_empleado_usuario,
      data.estado,
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
        mycm, proveedor, anio_alta, fec_reg_registros, nvo_costo, ubicacion,
        estado_uso, responsable_usuario, numero_empleado_usuario, usu_reg, activo, usuario_creacion
      ) VALUES (
        COALESCE(NULLIF($1, ''), nextval('inventario_externo_id_seq')::text), $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26, $27,
        $28, $29, $30, $31, $32, $33
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
      data.ubicacion,
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
        ubicacion = COALESCE($26, ubicacion),
        estado_uso = COALESCE($27, estado_uso),
        responsable_usuario = COALESCE($28, responsable_usuario),
        numero_empleado_usuario = COALESCE($29, numero_empleado_usuario),
        usu_reg = COALESCE($30, usu_reg),
        activo = COALESCE($31, activo),
        usuario_actualizacion = $32,
        fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id = $33
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
      data.ubicacion,
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
