// =====================================================
// CONTROLADOR OPTIMIZADO DE INVENTARIO CON IMAGENES
// ✅ MANEJO DE 38 CAMPOS UNIFICADOS
// ✅ SUBIDA DE IMAGENES OPTIMIZADA A WEBP
// ✅ INTEGRACIÓN CON POSTGRESQL + REDIS
// =====================================================

const { pool } = require('../config/database');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

// =====================================================
// CONFIGURACIÓN DE MULTER PARA IMÁGENES
// =====================================================
const storage = multer.memoryStorage(); // Guardar en memoria para procesamiento
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB máximo
    files: 3 // Máximo 3 archivos (SIAF)
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato no válido. Solo JPG, JPEG, PNG permitidos'), false);
    }
  }
});

// =====================================================
// FUNCIÓN PARA OPTIMIZAR IMÁGENES A WEBP
// =====================================================
const optimizeImage = async (buffer, filename, quality = 80) => {
  try {
    console.log(`📷 Optimizando imagen: ${filename}`);
    
    // Crear nombre de archivo único
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const webpFilename = `img_${timestamp}_${randomId}.webp`;
    
    // Optimizar imagen con Sharp
    const optimizedBuffer = await sharp(buffer)
      .resize(1200, 1200, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .webp({ 
        quality: quality,
        effort: 6 // Máxima compresión
      })
      .toBuffer();
    
    // Guardar archivo optimizado
    const uploadsDir = path.join(__dirname, '../../uploads/patrimonio');
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const filePath = path.join(uploadsDir, webpFilename);
    await fs.writeFile(filePath, optimizedBuffer);
    
    console.log(`✅ Imagen optimizada: ${webpFilename} (${optimizedBuffer.length} bytes)`);
    
    return {
      filename: webpFilename,
      path: `/uploads/patrimonio/${webpFilename}`,
      size: optimizedBuffer.length,
      format: 'webp'
    };
  } catch (error) {
    console.error('❌ Error optimizando imagen:', error);
    throw new Error(`Error al procesar imagen: ${error.message}`);
  }
};

// =====================================================
// MAPEO DE CAMPOS FRONTEND ↔ BASE DE DATOS
// =====================================================
const mapFrontendToDatabase = (data) => {
  console.log('🔄 Mapeando campos del frontend a BD...');
  console.log('📋 Campos recibidos del frontend:', Object.keys(data));
  
  // Helper para manejar strings vacíos vs null
  const handleValue = (value, shouldParseNumber = false) => {
    if (value === undefined || value === null) return null;
    if (value === '') return null; // String vacío -> null en BD
    if (shouldParseNumber) {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    }
    return value;
  };
  
  const handleIntValue = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = parseInt(value);
    return isNaN(parsed) ? null : parsed;
  };
  
  return {
    // Campos comunes (13) - VERIFICADOS ✅
    descripcion: handleValue(data.descripcion),
    marca: handleValue(data.marca),
    modelo: handleValue(data.modelo),
    numero_serie: handleValue(data.numero_serie),
    estado_uso: handleValue(data.estado_uso) || 'bueno',
    costo: handleValue(data.costo, true),
    proveedor: handleValue(data.proveedor),
    factura: handleValue(data.factura),
    fecha_adquisicion: handleValue(data.fecha_adquisicion),
    ubicacion: handleValue(data.ubicacion),
    numero_empleado: handleValue(data.numero_empleado),
    observaciones: handleValue(data.observaciones),
    ures_asignacion: handleValue(data.ures_asignacion),

    // Campos únicos INTERNO (10) - VERIFICADOS ✅
    registro_patrimonial: handleValue(data.registro_patrimonial),
    registro_interno: handleValue(data.registro_interno),
    elaboro_nombre: handleValue(data.elaboro_nombre),
    fecha_elaboracion: handleValue(data.fecha_elaboracion),
    recurso: handleValue(data.recurso),
    ur: handleValue(data.ur),
    folio: handleValue(data.folio),
    uuid: handleValue(data.uuid),
    dependencia_id: handleIntValue(data.dependencia_id),
    coordinacion_id: handleIntValue(data.coordinacion_id),

    // Campos únicos EXTERNO (15) - VERIFICADOS ✅
    id_patrimonio: handleValue(data.id_patrimonio),
    numero_patrimonio: handleValue(data.numero_patrimonio),
    clave_patrimonial: handleValue(data.clave_patrimonial),
    ures_gasto: handleValue(data.ures_gasto),
    cog: handleValue(data.cog),
    fondo: handleValue(data.fondo),
    cuenta_por_pagar: handleValue(data.cuenta_por_pagar),
    ejercicio: handleValue(data.ejercicio) || new Date().getFullYear().toString(),
    solicitud_compra: handleValue(data.solicitud_compra),
    idcon: handleValue(data.idcon),
    usu_asig: handleValue(data.usu_asig),
    numero_resguardo_interno: handleValue(data.numero_resguardo_interno),
    uuid_fiscal: handleValue(data.uuid_fiscal),
    empleado_resguardante_id: handleIntValue(data.empleado_resguardante_id),
    responsable_entrega_id: handleIntValue(data.responsable_entrega_id),

    // Campos de control - VERIFICADOS ✅
    tipo_inventario: handleValue(data.tipo_inventario) || 'INTERNO',
    estatus_validacion: handleValue(data.estatus_validacion) || 'borrador',
    stage: handleValue(data.stage) || 'COMPLETO'
  };
};

// =====================================================
// CONTROLADORES PRINCIPALES
// =====================================================

/**
 * Obtener todos los inventarios con paginación por cursor (estilo SIAF)
 */
const getAllInventarios = async (req, res) => {
  try {
    console.log('📋 Obteniendo inventarios con cursor pagination...');
    
    const {
      cursor,           // ID del último item visto
      limit = 100,      // Lotes de 100 como en SIAF
      search = '', 
      filter_marca = '', 
      filter_estado = '',
      filter_ubicacion = ''
    } = req.query;

    // 🔥 CAMBIO: Usar SELECT * para obtener TODOS los campos
    let query = 'SELECT * FROM inventario WHERE 1=1';
    const params = [];
    let paramCount = 0;

    // Cursor: Solo traer registros DESPUÉS del último ID visto
    if (cursor) {
      paramCount++;
      query += ` AND id > $${paramCount}`;
      params.push(cursor);
    }

    // Filtros opcionales
    if (filter_marca) {
      paramCount++;
      query += ` AND marca ILIKE $${paramCount}`;
      params.push(`%${filter_marca}%`);
    }

    if (filter_estado) {
      paramCount++;
      query += ` AND estado_uso = $${paramCount}`;
      params.push(filter_estado);
    }

    if (filter_ubicacion) {
      paramCount++;
      query += ` AND ubicacion ILIKE $${paramCount}`;
      params.push(`%${filter_ubicacion}%`);
    }

    if (search && search.trim()) {
      paramCount++;
      query += ` AND (
        descripcion ILIKE $${paramCount} OR 
        marca ILIKE $${paramCount} OR 
        modelo ILIKE $${paramCount} OR 
        numero_serie ILIKE $${paramCount} OR
        folio ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    // Ordenar por ID y limitar (traer 1 extra para detectar hasMore)
    query += ' ORDER BY id ASC';
    
    paramCount++;
    const numericLimit = parseInt(limit);
    query += ` LIMIT $${paramCount}`;
    params.push(numericLimit + 1); // +1 para detectar si hay más

    console.log('🔍 Query:', query);
    console.log('📊 Params:', params);

    const result = await pool.query(query, params);

    // Detectar si hay más registros
    const hasMore = result.rows.length > numericLimit;
    const data = hasMore ? result.rows.slice(0, numericLimit) : result.rows;
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : null;

    // Contar total de resultados aplicando los mismos filtros
    let countQuery = 'SELECT COUNT(*) FROM inventario WHERE 1=1';
    const countParams = [];
    let countParamCount = 0;

    // Aplicar los mismos filtros para el conteo
    if (filter_marca) {
      countParamCount++;
      countQuery += ` AND marca ILIKE $${countParamCount}`;
      countParams.push(`%${filter_marca}%`);
    }

    if (filter_estado) {
      countParamCount++;
      countQuery += ` AND estado_uso = $${countParamCount}`;
      countParams.push(filter_estado);
    }

    if (filter_ubicacion) {
      countParamCount++;
      countQuery += ` AND ubicacion ILIKE $${countParamCount}`;
      countParams.push(`%${filter_ubicacion}%`);
    }

    if (search && search.trim()) {
      countParamCount++;
      countQuery += ` AND (
        descripcion ILIKE $${countParamCount} OR 
        marca ILIKE $${countParamCount} OR 
        modelo ILIKE $${countParamCount} OR 
        numero_serie ILIKE $${countParamCount} OR
        folio ILIKE $${countParamCount}
      )`;
      countParams.push(`%${search}%`);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalFiltered = parseInt(countResult.rows[0].count);

    console.log(`✅ Obtenidos ${data.length} registros | hasMore: ${hasMore} | nextCursor: ${nextCursor}`);
    console.log(`📊 Total filtrado: ${totalFiltered} registros`);
    console.log('📋 Campos del primer registro:', data[0] ? Object.keys(data[0]).length : 0);

    res.json({
      success: true,
      data: {
        items: data,
        pagination: {
          nextCursor,
          hasMore,
          limit: numericLimit,
          count: data.length,
          totalFiltered: totalFiltered,
          isFiltered: !!(filter_marca || filter_estado || filter_ubicacion || (search && search.trim()))
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
 * Crear nuevo inventario con imágenes
 */
const createInventario = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('➕ Creando nuevo inventario...');

    // Mapear datos del frontend
    const inventoryData = mapFrontendToDatabase(req.body);
    
    // 🚨 IMPORTANTE: No incluir folio si está vacío para auto-generación
    if (!inventoryData.folio || inventoryData.folio.trim() === '') {
      delete inventoryData.folio;
      console.log('🔄 Folio omitido para auto-generación');
    }
    
    console.log('📋 Campos mapeados del frontend:', Object.keys(inventoryData));
    console.log('🔢 Total campos a insertar:', Object.keys(inventoryData).filter(key => inventoryData[key] !== null).length);
    
    // Debug: Mostrar todos los campos mapeados
    console.log('📝 TODOS los campos mapeados:', Object.keys(inventoryData));
    console.log('🎯 Campos con valores:', Object.entries(inventoryData).filter(([k,v]) => v !== null).map(([k,v]) => `${k}=${v}`));
    
    // Construir query dinámico
    const fields = Object.keys(inventoryData).filter(key => inventoryData[key] !== null);
    const values = fields.map(key => inventoryData[key]);
    const placeholders = fields.map((_, index) => `$${index + 1}`);

    console.log(`🗃️ INSERTANDO ${fields.length} campos en la BD:`, fields);

    const insertQuery = `
      INSERT INTO inventario (${fields.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    console.log('🔄 Ejecutando insert...', { fields: fields.length });
    const result = await client.query(insertQuery, values);
    const newInventario = result.rows[0];

    // Procesar imágenes si existen
    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      console.log(`📷 Procesando ${req.files.length} imágenes...`);
      
      for (const file of req.files) {
        try {
          const optimizedImage = await optimizeImage(file.buffer, file.originalname);
          imageUrls.push(optimizedImage.path);
          console.log(`✅ Imagen procesada: ${optimizedImage.filename}`);
        } catch (imageError) {
          console.error('❌ Error procesando imagen:', imageError);
          // Continuar con otras imágenes
        }
      }

      // Guardar rutas de imágenes en campo imagenes (JSONB) como JSON string
      if (imageUrls.length > 0) {
        await client.query(
          'UPDATE inventario SET imagenes = $1::jsonb WHERE id = $2',
          [JSON.stringify(imageUrls), newInventario.id]
        );
        console.log(`📷 ${imageUrls.length} imágenes guardadas en BD como JSON: ${JSON.stringify(imageUrls)}`);
      }
    }

    await client.query('COMMIT');

    // Refrescar datos con imágenes
    const refreshResult = await client.query('SELECT * FROM inventario WHERE id = $1', [newInventario.id]);
    const finalInventario = refreshResult.rows[0];

    console.log('✅ Inventario creado exitosamente:', finalInventario.id);
    console.log('📷 Imágenes en respuesta:', finalInventario.imagenes);
    res.status(201).json({
      success: true,
      message: 'Inventario creado exitosamente',
      data: finalInventario
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creando inventario:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error al crear inventario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

/**
 * Actualizar inventario existente
 */
const updateInventario = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    console.log('✏️ Actualizando inventario:', id);

    // Verificar que existe
    const existsResult = await client.query('SELECT id FROM inventario WHERE id = $1', [id]);
    if (existsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inventario no encontrado'
      });
    }

    // Mapear datos
    const inventoryData = mapFrontendToDatabase(req.body);
    
    // Construir query de actualización dinámico
    const fields = Object.keys(inventoryData).filter(key => inventoryData[key] !== null);
    const values = fields.map(key => inventoryData[key]);
    const setClause = fields.map((field, index) => `${field} = $${index + 1}`);

    const updateQuery = `
      UPDATE inventario 
      SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${fields.length + 1}
      RETURNING *
    `;

    const result = await client.query(updateQuery, [...values, id]);
    const updatedInventario = result.rows[0];

    // Procesar nuevas imágenes si existen
    const newImageUrls = [];
    if (req.files && req.files.length > 0) {
      console.log(`📷 Procesando ${req.files.length} nuevas imágenes...`);
      
      for (const file of req.files) {
        try {
          const optimizedImage = await optimizeImage(file.buffer, file.originalname);
          newImageUrls.push(optimizedImage.path);
        } catch (imageError) {
          console.error('❌ Error procesando imagen:', imageError);
        }
      }

      // Agregar nuevas imágenes a las existentes (sin sobrescribir)
      if (newImageUrls.length > 0) {
        const currentImages = updatedInventario.imagenes || [];
        const existingImages = Array.isArray(currentImages) ? currentImages : (typeof currentImages === 'string' ? JSON.parse(currentImages) : []);
        const allImages = [...existingImages, ...newImageUrls];
        await client.query(
          'UPDATE inventario SET imagenes = $1::jsonb WHERE id = $2',
          [JSON.stringify(allImages), id]
        );
        console.log(`📷 ${newImageUrls.length} nuevas imágenes agregadas (total: ${allImages.length})`);
      }
    }

    await client.query('COMMIT');

    // Refrescar datos con imágenes actualizadas
    const refreshResult = await client.query('SELECT * FROM inventario WHERE id = $1', [id]);
    const finalInventario = refreshResult.rows[0];

    console.log('✅ Inventario actualizado exitosamente:', id);
    console.log('📷 Imágenes en respuesta:', finalInventario.imagenes);
    res.json({
      success: true,
      message: 'Inventario actualizado exitosamente',
      data: finalInventario
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error actualizando inventario:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error al actualizar inventario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};

/**
 * Obtener un inventario específico
 */
const getInventarioById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Obteniendo inventario:', id);

    const result = await pool.query('SELECT * FROM inventario WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inventario no encontrado'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error obteniendo inventario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Eliminar inventario (soft delete)
 */
const deleteInventario = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Eliminando inventario:', id);

    const result = await pool.query(`
      UPDATE inventario 
      SET estado_uso = 'baja', 
          fecha_baja = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 
      RETURNING id, folio
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inventario no encontrado'
      });
    }

    console.log('✅ Inventario marcado como baja:', id);
    res.json({
      success: true,
      message: 'Inventario marcado como baja exitosamente',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error eliminando inventario:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Búsqueda optimizada de texto completo
 */
const searchInventarios = async (req, res) => {
  try {
    const { q, limit = 50 } = req.query;
    console.log('🔍 Búsqueda de texto:', q);

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Término de búsqueda debe tener al menos 2 caracteres'
      });
    }

    // Usar función optimizada de búsqueda
    const result = await pool.query(`
      SELECT * FROM buscar_inventario_texto($1, $2, 0)
    `, [q.trim(), parseInt(limit)]);

    res.json({
      success: true,
      data: {
        items: result.rows,
        total: result.rows.length,
        query: q.trim()
      }
    });

  } catch (error) {
    console.error('❌ Error en búsqueda:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Obtener estadísticas del dashboard
 */
const getDashboardStats = async (req, res) => {
  try {
    console.log('📊 Obteniendo estadísticas del dashboard...');

    const result = await pool.query('SELECT * FROM get_estadisticas_dashboard()');
    
    // Formatear estadísticas para el frontend
    const stats = {};
    result.rows.forEach(row => {
      stats[row.metric.toLowerCase()] = {
        value: parseInt(row.value),
        percentage: parseFloat(row.percentage)
      };
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Verificar duplicados
 */
const checkDuplicate = async (req, res) => {
  try {
    const { field, value } = req.params;
    const { exclude } = req.query; // ID a excluir en caso de edición
    
    console.log(`🔍 Verificando duplicado: ${field} = ${value}`);
    
    // Campos permitidos para verificación
    const allowedFields = ['numero_serie', 'registro_patrimonial', 'numero_patrimonio', 'clave_patrimonial', 'uuid', 'uuid_fiscal', 'folio'];
    
    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message: 'Campo no válido para verificación de duplicados'
      });
    }
    
    let query = `SELECT id, folio, ${field}, descripcion, marca, modelo, created_at FROM inventario WHERE ${field} = $1 AND ${field} IS NOT NULL AND ${field} != ''`;
    const params = [value];
    
    // Excluir ID si es edición
    if (exclude && exclude !== 'none') {
      query += ' AND id != $2';
      params.push(exclude);
    }
    
    const result = await pool.query(query, params);
    
    const exists = result.rows.length > 0;
    const existing = result.rows[0] || null;
    
    // Si existe, formatear información para el usuario
    let duplicateInfo = null;
    if (existing) {
      duplicateInfo = {
        id: existing.id,
        folio: existing.folio,
        descripcion: existing.descripcion || 'Sin descripción',
        marca: existing.marca || 'Sin marca',
        modelo: existing.modelo || 'Sin modelo',
        created_at: existing.created_at
      };
    }
    
    res.json({
      success: true,
      exists,
      existing: duplicateInfo,
      field,
      value,
      message: exists ? `❌ DUPLICADO ENCONTRADO: ${field} "${value}" ya existe en el registro ${duplicateInfo.folio || duplicateInfo.id}` : 'Sin duplicados'
    });
    
  } catch (error) {
    console.error('❌ Error verificando duplicados:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =====================================================
// MIDDLEWARE DE MANEJO DE IMÁGENES
// =====================================================
const handleImageUpload = upload.array('images', 3);

// =====================================================
// OBTENER MARCAS ÚNICAS PARA FILTROS
// =====================================================
const getAvailableMarcas = async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT marca 
      FROM inventario 
      WHERE marca IS NOT NULL 
        AND marca != '' 
        AND marca != '-'
      ORDER BY marca ASC
    `;

    const result = await pool.query(query);
    const marcas = result.rows.map(row => row.marca);

    res.json({
      success: true,
      data: marcas,
      count: marcas.length
    });
  } catch (error) {
    console.error('Error getting available marcas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener marcas disponibles',
      error: error.message
    });
  }
};

// =====================================================
// OBTENER UBICACIONES ÚNICAS PARA FILTROS
// =====================================================
const getAvailableUbicaciones = async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT ubicacion 
      FROM inventario 
      WHERE ubicacion IS NOT NULL 
        AND ubicacion != '' 
        AND ubicacion != '-'
      ORDER BY ubicacion ASC
    `;

    const result = await pool.query(query);
    const ubicaciones = result.rows.map(row => row.ubicacion);

    res.json({
      success: true,
      data: ubicaciones,
      count: ubicaciones.length
    });
  } catch (error) {
    console.error('Error getting available ubicaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ubicaciones disponibles',
      error: error.message
    });
  }
};

module.exports = {
  // Controladores principales
  getAllInventarios,
  createInventario,
  updateInventario,
  getInventarioById,
  deleteInventario,
  searchInventarios,
  getDashboardStats,
  checkDuplicate,
  getAvailableMarcas,
  getAvailableUbicaciones,
  
  // Middleware
  handleImageUpload,
  
  // Utilidades
  optimizeImage,
  mapFrontendToDatabase
};