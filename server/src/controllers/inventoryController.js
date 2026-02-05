// =====================================================
// CONTROLADOR: Inventario InvPatrimonio
// Archivo: server/src/controllers/inventoryController.js
// Propósito: CRUD optimizado para inventario patrimonial
// =====================================================

const { pool } = require('../config/database');

/**
 * Mapea los campos de la base de datos al formato del frontend
 */
const mapDatabaseToFrontend = (item) => {
  const mapped = { ...item };
  if (mapped.comentarios) {
    mapped.observaciones = mapped.comentarios;
    delete mapped.comentarios;
  }
  if (mapped.costo) {
    mapped.valor_unitario = mapped.costo;
    // No eliminamos costo por si se necesita
  }
  
  // Mapear valores de estado_uso de la base de datos al frontend
  if (mapped.estado_uso) {
    const estadoMapping = {
      'operativo': 'bueno',
      'en_reparacion': 'malo', 
      'de_baja': 'malo',
      'obsoleto': 'malo',
      'resguardo_temporal': 'regular'
    };
    
    mapped.estado_uso = estadoMapping[mapped.estado_uso] || mapped.estado_uso;
  }
  
  return mapped;
};

/**
 * Mapea los campos del frontend al formato de la base de datos
 */
const mapFrontendToDatabase = (item) => {
  const mapped = { ...item };
  
  // Mapeo de campos
  if (mapped.observaciones) {
    mapped.comentarios = mapped.observaciones;
    delete mapped.observaciones;
  }
  
  if (mapped.valor_unitario) {
    mapped.costo = mapped.valor_unitario;
    delete mapped.valor_unitario;
  }
  
  // Mapear valores de estado_uso del frontend a la base de datos
  if (mapped.estado_uso) {
    const estadoMapping = {
      'bueno': 'operativo',
      'malo': 'en_reparacion',
      'regular': 'operativo',
      'operativo': 'operativo',
      'en_reparacion': 'en_reparacion',
      'de_baja': 'de_baja',
      'obsoleto': 'obsoleto',
      'resguardo_temporal': 'resguardo_temporal'
    };
    
    mapped.estado_uso = estadoMapping[mapped.estado_uso] || 'operativo';
  }
  
  // Filtrar campos que definitivamente no existen en la base de datos o están vacíos
  const fieldsToRemove = [
    'ubicacion_fisica', 'coordinacion', 'ejercicio', 'solicitud_compra',
    'cuenta_por_pagar', 'idcon', 'usu_asig', 'fecha_registro', 'fecha_asignacion'
  ];
  
  fieldsToRemove.forEach(field => {
    delete mapped[field];
  });
  
  // Eliminar campos vacíos, null o undefined de todos los campos
  Object.keys(mapped).forEach(key => {
    if (mapped[key] === '' || mapped[key] === null || mapped[key] === undefined) {
      delete mapped[key];
    }
  });
  
  return mapped;
};

/**
 * Obtener todos los inventarios con paginación y filtros
 */
const getAllInventory = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', stage = '', estado = '' } = req.query;
    const offset = (page - 1) * limit;

    console.log('📊 Obteniendo inventarios:', { page, limit, search, stage, estado });

    let query = 'SELECT * FROM inventario WHERE 1=1';
    let queryParams = [];
    let paramIndex = 1;

    // Filtros de búsqueda
    if (search) {
      query += ` AND (folio ILIKE $${paramIndex} OR descripcion ILIKE $${paramIndex} OR marca ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (stage) {
      query += ` AND stage = $${paramIndex}`;
      queryParams.push(stage);
      paramIndex++;
    }

    if (estado) {
      query += ` AND estado = $${paramIndex}`;
      queryParams.push(estado);
      paramIndex++;
    }

    query += ` ORDER BY updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    // Contar total para paginación
    let countQuery = 'SELECT COUNT(*) FROM inventario WHERE 1=1';
    let countParams = [];
    let countParamIndex = 1;

    if (search) {
      countQuery += ` AND (folio ILIKE $${countParamIndex} OR descripcion ILIKE $${countParamIndex} OR marca ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    if (stage) {
      countQuery += ` AND stage = $${countParamIndex}`;
      countParams.push(stage);
      countParamIndex++;
    }

    if (estado) {
      countQuery += ` AND estado = $${countParamIndex}`;
      countParams.push(estado);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    console.log(`✅ Encontrados ${result.rows.length} de ${total} inventarios`);

    res.json({
      success: true,
      data: {
        items: result.rows.map(mapDatabaseToFrontend),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo inventarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Obtener inventario por ID
 */
const getInventoryById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📋 Obteniendo inventario por ID:', id);

    const result = await pool.query('SELECT * FROM inventario WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inventario no encontrado'
      });
    }

    console.log('✅ Inventario encontrado');
    res.json({
      success: true,
      data: mapDatabaseToFrontend(result.rows[0])
    });

  } catch (error) {
    console.error('❌ Error obteniendo inventario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Crear nuevo inventario
 */
const createInventory = async (req, res) => {
  try {
    const inventoryData = req.body;
    console.log('➕ Creando nuevo inventario:', inventoryData);

    // Validaciones básicas
    if (!inventoryData.descripcion) {
      return res.status(400).json({
        success: false,
        message: 'La descripción es requerida'
      });
    }

    // Mapear campos del frontend a la base de datos
    const mappedData = mapFrontendToDatabase(inventoryData);

    // Establecer valores por defecto
    const dataToInsert = {
      estado: 'buena',
      stage: 'INTERNO',
      ...mappedData
    };

    // Crear query dinámico basado en los campos presentes
    const fields = Object.keys(dataToInsert);
    const values = Object.values(dataToInsert);
    const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ');
    const fieldNames = fields.join(', ');

    const query = `
      INSERT INTO inventario (${fieldNames})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await pool.query(query, values);
    console.log('✅ Inventario creado con ID:', result.rows[0].id);

    res.status(201).json({
      success: true,
      message: 'Inventario creado exitosamente',
      data: mapDatabaseToFrontend(result.rows[0])
    });

  } catch (error) {
    console.error('❌ Error creando inventario:', error);
    
    if (error.code === '23505') { // Duplicate key
      res.status(400).json({
        success: false,
        message: 'Ya existe un registro con estos datos únicos'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
};

/**
 * Actualizar inventario
 */
const updateInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const inventoryData = req.body;
    console.log('✏️ Actualizando inventario ID:', id);

    // Remover campos que no se deben actualizar
    delete inventoryData.id;
    delete inventoryData.created_at;

    // Mapear campos del frontend a la base de datos
    const mappedData = mapFrontendToDatabase(inventoryData);

    if (Object.keys(mappedData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay datos para actualizar'
      });
    }

    // Crear query dinámico
    const fields = Object.keys(mappedData);
    const values = Object.values(mappedData);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

    const query = `
      UPDATE inventario 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id, ...values]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inventario no encontrado'
      });
    }

    console.log('✅ Inventario actualizado');
    res.json({
      success: true,
      message: 'Inventario actualizado exitosamente',
      data: mapDatabaseToFrontend(result.rows[0])
    });

  } catch (error) {
    console.error('❌ Error actualizando inventario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Eliminar inventario
 */
const deleteInventory = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Eliminando inventario ID:', id);

    const result = await pool.query('DELETE FROM inventario WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inventario no encontrado'
      });
    }

    console.log('✅ Inventario eliminado');
    res.json({
      success: true,
      message: 'Inventario eliminado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error eliminando inventario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getAllInventory,
  getInventoryById,
  createInventory,
  updateInventory,
  deleteInventory
};