// ====================================================
// RUTAS API INVENTARIO - ESQUEMA SIAF COMPLETO
// ====================================================

import express from 'express';
import { Pool } from 'pg';
import { Inventario, CreateInventarioDTO, UpdateInventarioDTO, InventarioFilters } from '../models/Inventario.js';

const router = express.Router();

// Configuración de base de datos
const pool = new Pool({
  user: process.env.DB_USER || 'siaf_admin',
  password: process.env.DB_PASSWORD || 'siaf2024_secure!',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'patrimonio_db',
});

// ====================================================
// OBTENER TODOS LOS INVENTARIOS CON FILTROS AVANZADOS
// ====================================================
router.get('/inventarios', async (req, res) => {
  try {
    const filters: InventarioFilters = req.query as any;
    const {
      marca, modelo, estado, estado_uso, ubicacion, stage, 
      estatus_validacion, tipo_inventario, coordinacion_id, 
      dependencia_id, proveedor, fecha_desde, fecha_hasta,
      costo_min, costo_max, search, page = 1, limit = 10,
      sort = 'updated_at', order = 'DESC'
    } = filters;

    let query = `
      SELECT 
        id, folio, numero_patrimonio, numero_serie, marca, modelo,
        descripcion, estado, estado_uso, ubicacion, costo, proveedor,
        tipo_bien, stage, estatus_validacion, tipo_inventario,
        coordinacion_id, dependencia_id, fecha_adquisicion, created_at, updated_at,
        imagenes, comentarios, observaciones_tecnicas
      FROM inventario 
      WHERE 1=1
    `;
    
    const values: any[] = [];
    let paramCount = 0;

    // Filtros dinámicos
    if (marca) {
      values.push(`%${marca}%`);
      query += ` AND marca ILIKE $${++paramCount}`;
    }
    
    if (modelo) {
      values.push(`%${modelo}%`);
      query += ` AND modelo ILIKE $${++paramCount}`;
    }
    
    if (estado) {
      values.push(estado);
      query += ` AND estado = $${++paramCount}`;
    }
    
    if (estado_uso) {
      values.push(estado_uso);
      query += ` AND estado_uso = $${++paramCount}`;
    }
    
    if (ubicacion) {
      values.push(`%${ubicacion}%`);
      query += ` AND ubicacion ILIKE $${++paramCount}`;
    }
    
    if (stage) {
      values.push(stage);
      query += ` AND stage = $${++paramCount}`;
    }
    
    if (estatus_validacion) {
      values.push(estatus_validacion);
      query += ` AND estatus_validacion = $${++paramCount}`;
    }
    
    if (tipo_inventario) {
      values.push(tipo_inventario);
      query += ` AND tipo_inventario = $${++paramCount}`;
    }
    
    if (coordinacion_id) {
      values.push(coordinacion_id);
      query += ` AND coordinacion_id = $${++paramCount}`;
    }
    
    if (dependencia_id) {
      values.push(dependencia_id);
      query += ` AND dependencia_id = $${++paramCount}`;
    }
    
    if (proveedor) {
      values.push(`%${proveedor}%`);
      query += ` AND proveedor ILIKE $${++paramCount}`;
    }
    
    if (fecha_desde) {
      values.push(fecha_desde);
      query += ` AND fecha_adquisicion >= $${++paramCount}`;
    }
    
    if (fecha_hasta) {
      values.push(fecha_hasta);
      query += ` AND fecha_adquisicion <= $${++paramCount}`;
    }
    
    if (costo_min) {
      values.push(costo_min);
      query += ` AND costo >= $${++paramCount}`;
    }
    
    if (costo_max) {
      values.push(costo_max);
      query += ` AND costo <= $${++paramCount}`;
    }
    
    // Búsqueda general en múltiples campos
    if (search) {
      values.push(`%${search}%`);
      query += ` AND (
        marca ILIKE $${++paramCount} OR 
        modelo ILIKE $${++paramCount} OR 
        descripcion ILIKE $${++paramCount} OR 
        numero_patrimonio ILIKE $${++paramCount} OR
        numero_serie ILIKE $${++paramCount} OR
        folio ILIKE $${++paramCount}
      )`;
      // Duplicar el valor para todas las búsquedas
      for (let i = 0; i < 5; i++) values.push(`%${search}%`);
      paramCount += 5;
    }

    // Ordenamiento
    const allowedSortFields = ['id', 'marca', 'modelo', 'estado', 'costo', 'created_at', 'updated_at'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'updated_at';
    const sortOrder = order === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortField} ${sortOrder}`;

    // Paginación
    const offset = (Number(page) - 1) * Number(limit);
    values.push(Number(limit), offset);
    query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;

    // Ejecutar consulta principal
    const result = await pool.query(query, values);
    
    // Consulta para total de registros
    let countQuery = `SELECT COUNT(*) FROM inventario WHERE 1=1`;
    const countValues = values.slice(0, -2); // Quitar LIMIT y OFFSET
    
    // Aplicar mismos filtros para el conteo
    let countParamNum = 0;
    if (marca) countQuery += ` AND marca ILIKE $${++countParamNum}`;
    if (modelo) countQuery += ` AND modelo ILIKE $${++countParamNum}`;
    if (estado) countQuery += ` AND estado = $${++countParamNum}`;
    if (estado_uso) countQuery += ` AND estado_uso = $${++countParamNum}`;
    if (ubicacion) countQuery += ` AND ubicacion ILIKE $${++countParamNum}`;
    if (stage) countQuery += ` AND stage = $${++countParamNum}`;
    if (estatus_validacion) countQuery += ` AND estatus_validacion = $${++countParamNum}`;
    if (tipo_inventario) countQuery += ` AND tipo_inventario = $${++countParamNum}`;
    if (coordinacion_id) countQuery += ` AND coordinacion_id = $${++countParamNum}`;
    if (dependencia_id) countQuery += ` AND dependencia_id = $${++countParamNum}`;
    if (proveedor) countQuery += ` AND proveedor ILIKE $${++countParamNum}`;
    if (fecha_desde) countQuery += ` AND fecha_adquisicion >= $${++countParamNum}`;
    if (fecha_hasta) countQuery += ` AND fecha_adquisicion <= $${++countParamNum}`;
    if (costo_min) countQuery += ` AND costo >= $${++countParamNum}`;
    if (costo_max) countQuery += ` AND costo <= $${++countParamNum}`;
    if (search) {
      countQuery += ` AND (
        marca ILIKE $${++countParamNum} OR 
        modelo ILIKE $${++countParamNum} OR 
        descripcion ILIKE $${++countParamNum} OR 
        numero_patrimonio ILIKE $${++countParamNum} OR
        numero_serie ILIKE $${++countParamNum} OR
        folio ILIKE $${++countParamNum}
      )`;
    }

    const countResult = await pool.query(countQuery, countValues);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      data: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error('Error obteniendo inventarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ====================================================
// OBTENER INVENTARIO POR ID
// ====================================================
router.get('/inventarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT * FROM inventario 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventario no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo inventario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ====================================================
// CREAR NUEVO INVENTARIO
// ====================================================
router.post('/inventarios', async (req, res) => {
  try {
    const inventario: CreateInventarioDTO = req.body;
    
    const {
      marca, modelo, descripcion, estado = 'buena', ubicacion,
      numero_patrimonio, numero_serie, costo, proveedor,
      tipo_bien, estado_uso = 'operativo', coordinacion_id,
      dependencia_id, tipo_inventario, fecha_adquisicion,
      vida_util_anios = 5, garantia_meses, comentarios,
      observaciones_tecnicas, imagenes = []
    } = inventario;

    const query = `
      INSERT INTO inventario (
        marca, modelo, descripcion, estado, ubicacion,
        numero_patrimonio, numero_serie, costo, proveedor,
        tipo_bien, estado_uso, coordinacion_id, dependencia_id,
        tipo_inventario, fecha_adquisicion, vida_util_anios,
        garantia_meses, comentarios, observaciones_tecnicas, imagenes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      ) RETURNING *
    `;

    const values = [
      marca, modelo, descripcion, estado, ubicacion,
      numero_patrimonio, numero_serie, costo, proveedor,
      tipo_bien, estado_uso, coordinacion_id, dependencia_id,
      tipo_inventario, fecha_adquisicion, vida_util_anios,
      garantia_meses, comentarios, observaciones_tecnicas, JSON.stringify(imagenes)
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Error creando inventario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ====================================================
// ACTUALIZAR INVENTARIO
// ====================================================
router.put('/inventarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates: UpdateInventarioDTO = req.body;
    
    // Construir query dinámico con solo campos presentes
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && value !== undefined) {
        fields.push(`${key} = $${++paramCount}`);
        values.push(key === 'imagenes' ? JSON.stringify(value) : value);
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    // Agregar updated_at automático
    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `
      UPDATE inventario 
      SET ${fields.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING *
    `;

    values.push(id);

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventario no encontrado' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error actualizando inventario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ====================================================
// ELIMINAR INVENTARIO
// ====================================================
router.delete('/inventarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = 'DELETE FROM inventario WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventario no encontrado' });
    }

    res.json({ message: 'Inventario eliminado correctamente', id: result.rows[0].id });

  } catch (error) {
    console.error('Error eliminando inventario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ====================================================
// ESTADÍSTICAS SIAF
// ====================================================
router.get('/inventarios/stats/dashboard', async (req, res) => {
  try {
    const queries = {
      total: 'SELECT COUNT(*) as total FROM inventario',
      por_estado: `
        SELECT estado_uso, COUNT(*) as cantidad 
        FROM inventario 
        GROUP BY estado_uso 
        ORDER BY cantidad DESC
      `,
      por_stage: `
        SELECT stage, COUNT(*) as cantidad 
        FROM inventario 
        GROUP BY stage 
        ORDER BY cantidad DESC
      `,
      por_ubicacion: `
        SELECT ubicacion, COUNT(*) as cantidad 
        FROM inventario 
        WHERE ubicacion IS NOT NULL
        GROUP BY ubicacion 
        ORDER BY cantidad DESC 
        LIMIT 10
      `,
      valor_total: 'SELECT COALESCE(SUM(costo), 0) as valor_total FROM inventario WHERE costo IS NOT NULL',
      sin_patrimonio: 'SELECT COUNT(*) as total FROM inventario WHERE numero_patrimonio IS NULL',
      pendientes_validacion: `SELECT COUNT(*) as total FROM inventario WHERE estatus_validacion = 'borrador'`
    };

    const results = await Promise.all(
      Object.entries(queries).map(async ([key, query]) => {
        const result = await pool.query(query);
        return [key, result.rows];
      })
    );

    const stats = Object.fromEntries(results);

    res.json({
      resumen: {
        total_equipos: parseInt(stats.total[0].total),
        valor_total: parseFloat(stats.valor_total[0].valor_total),
        sin_patrimonio: parseInt(stats.sin_patrimonio[0].total),
        pendientes_validacion: parseInt(stats.pendientes_validacion[0].total)
      },
      por_estado_uso: stats.por_estado,
      por_stage_siaf: stats.por_stage,
      ubicaciones_top: stats.por_ubicacion
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Mantener ruta de prueba
router.get('/test', (req, res) => {
  res.json({ 
    message: 'API InvPatrimonio SIAF funcionando correctamente',
    timestamp: new Date().toISOString(),
    version: '2.0-SIAF'
  });
});

export default router;