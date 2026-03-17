// =====================================================
// CONTROLADOR OPTIMIZADO DE INVENTARIO
// =====================================================

const { pool } = require('../config/database');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { calcTipoInventario, getUmaForYear } = require('../services/umaService');

// =====================================================
// CONFIGURACIÓN DE MULTER
// =====================================================
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Formato no válido. Solo JPG, JPEG, PNG permitidos'), false);
  }
});

// =====================================================
// OPTIMIZAR IMAGEN A WEBP
// =====================================================
const optimizeImage = async (buffer, filename, quality = 80) => {
  try {
    const webpFilename = `img_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`;
    const optimizedBuffer = await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 6 })
      .toBuffer();

    const uploadsDir = path.join(__dirname, '../../uploads/patrimonio');
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(path.join(uploadsDir, webpFilename), optimizedBuffer);

    return { filename: webpFilename, path: `/uploads/patrimonio/${webpFilename}` };
  } catch (error) {
    throw new Error(`Error al procesar imagen: ${error.message}`);
  }
};

// =====================================================
// MAPEO FRONTEND → TABLAS NORMALIZADAS
// =====================================================
const hv = (v, num = false) => {
  if (v === undefined || v === null || v === '') return null;
  if (num) { const n = parseFloat(v); return isNaN(n) ? null : n; }
  return v;
};
const hi = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v); return isNaN(n) ? null : n;
};

/** Campos que permanecen en inventario */
const mapToInventario = (d) => ({
  descripcion:              hv(d.descripcion),
  descripcion_bien:         hv(d.descripcion_bien),
  marca:                    hv(d.marca),
  modelo:                   hv(d.modelo),
  numero_serie:             hv(d.numero_serie),
  numero_inventario:        hv(d.numero_inventario),
  numero_patrimonio:        hv(d.numero_patrimonio),
  uuid:                     hv(d.uuid),
  tipo_bien:                hv(d.tipo_bien),
  estado:                   hv(d.estado),
  estado_uso:               hv(d.estado_uso) || 'bueno',
  folio:                    hv(d.folio),
  ubicacion:                hv(d.ubicacion),
  ubicacion_id:             hi(d.ubicacion_id),
  ubicacion_especifica:     hv(d.ubicacion_especifica),
  numero_empleado:          hv(d.numero_empleado),
  usu_asig:                 hv(d.usu_asig),
  observaciones:            hv(d.observaciones),
  comentarios:              hv(d.comentarios),
  valor_actual:             hv(d.valor_actual, true),
  vida_util_anos:           hi(d.vida_util_anos),
  dependencia_id:           hi(d.dependencia_id),
  coordinacion_id:          hi(d.coordinacion_id),
  empleado_resguardante_id: hi(d.empleado_resguardante_id),
  responsable_entrega_id:   hi(d.responsable_entrega_id),
  // tipo_inventario se calcula automáticamente a partir de costo y UMA del ejercicio
  fecha_registro:           hv(d.fecha_registro),
  fecha_asignacion:         hv(d.fecha_asignacion),
  fecha_recepcion:          hv(d.fecha_recepcion),
  fecha_baja:               hv(d.fecha_baja),
});

/** Campos que van a inventario_adquisicion */
const mapToAdquisicion = (d) => ({
  proveedor:        hv(d.proveedor),
  factura:          hv(d.factura),
  fecha_adquisicion: hv(d.fecha_adquisicion),
  costo:            hv(d.costo, true),
  solicitud_compra: hv(d.solicitud_compra),
  cuenta_por_pagar: hv(d.cuenta_por_pagar),
});

/** Campos que van a inventario_datos_fiscales */
const mapToFiscal = (d) => ({
  uuid_fiscal:             hv(d.uuid_fiscal),
  id_patrimonio:           hv(d.id_patrimonio),
  clave_patrimonial:       hv(d.clave_patrimonial),
  ur:                      hv(d.ur),
  ures_gasto:              hv(d.ures_gasto),
  cog:                     hv(d.cog),
  fondo:                   hv(d.fondo),
  ejercicio:               hv(d.ejercicio) || new Date().getFullYear().toString(),
  idcon:                   hv(d.idcon),
  ures_asignacion:         hv(d.ures_asignacion),
  recurso:                 hv(d.recurso),
  elaboro_nombre:          hv(d.elaboro_nombre),
  fecha_elaboracion:       hv(d.fecha_elaboracion),
  registro_patrimonial:    hv(d.registro_patrimonial),
  registro_interno:        hv(d.registro_interno),
  numero_resguardo_interno: hv(d.numero_resguardo_interno),
});

// Alias para compatibilidad
const mapFrontendToDatabase = (d) => ({
  ...mapToInventario(d),
  ...mapToAdquisicion(d),
  ...mapToFiscal(d),
});

// =====================================================
// QUERY BASE REUTILIZABLE (inventario + 3 JOINs)
// =====================================================
const SELECT_FULL = `
  SELECT
    i.*,
    a.proveedor, a.factura, a.fecha_adquisicion, a.costo,
    a.solicitud_compra, a.cuenta_por_pagar,
    f.uuid_fiscal, f.id_patrimonio, f.clave_patrimonial,
    f.ur, f.ures_gasto, f.cog, f.fondo, f.ejercicio, f.idcon,
    f.ures_asignacion, f.recurso, f.elaboro_nombre, f.fecha_elaboracion,
    f.registro_patrimonial, f.registro_interno, f.numero_resguardo_interno,
    u.valor AS uma_valor_ejercicio,
    (u.año::text || ' → $' || u.valor::text || ' × 70 = $' || (u.valor * 70)::numeric(15,2)::text) AS uma_detalle,
    CASE
      WHEN a.costo IS NOT NULL AND u.valor IS NOT NULL AND a.costo > (u.valor * 70) THEN 'EXTERNO'
      ELSE 'INTERNO'
    END AS tipo_inventario_calculado,
    COALESCE(
      (SELECT json_agg(img.path ORDER BY img.id)
       FROM inventario_imagenes img WHERE img.inventario_id = i.id),
      '[]'::json
    ) AS imagenes
  FROM inventario i
  LEFT JOIN inventario_adquisicion     a ON a.inventario_id = i.id
  LEFT JOIN inventario_datos_fiscales  f ON f.inventario_id = i.id
  LEFT JOIN uma_valores                u ON u.año = CASE
    WHEN f.ejercicio ~ '^[0-9]{4}$' THEN f.ejercicio::integer
    ELSE EXTRACT(YEAR FROM i.created_at)::integer
  END
`;

// =====================================================
// HELPERS PARA ESCRIBIR TABLAS HIJAS
// =====================================================
const upsertTable = async (client, table, inventarioId, mapped) => {
  const hasData = Object.values(mapped).some(v => v !== null);
  if (!hasData) return;

  const cols = Object.keys(mapped);
  const vals = cols.map(k => mapped[k]);
  const setClause = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');

  await client.query(
    `INSERT INTO ${table} (inventario_id, ${cols.join(', ')})
     VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')})
     ON CONFLICT (inventario_id) DO UPDATE SET ${setClause}, updated_at = CURRENT_TIMESTAMP`,
    [inventarioId, ...vals]
  );
};

const insertImagenes = async (client, inventarioId, paths) => {
  for (const p of paths) {
    await client.query(
      `INSERT INTO inventario_imagenes (inventario_id, path) VALUES ($1, $2)`,
      [inventarioId, p]
    );
  }
};

// =====================================================
// CONTROLADORES
// =====================================================

const getAllInventarios = async (req, res) => {
  try {
    const {
      cursor, limit = 100, search = '',
      filter_marca = '', filter_estado = '', filter_ubicacion = ''
    } = req.query;

    let query = `${SELECT_FULL} WHERE 1=1`;
    const params = [];
    let p = 0;

    if (cursor)           { query += ` AND i.id > $${++p}`;                params.push(cursor); }
    if (filter_marca)     { query += ` AND i.marca ILIKE $${++p}`;          params.push(`%${filter_marca}%`); }
    if (filter_estado)    { query += ` AND i.estado_uso = $${++p}`;         params.push(filter_estado); }
    if (filter_ubicacion) { query += ` AND i.ubicacion_id = $${++p}`;       params.push(parseInt(filter_ubicacion)); }
    if (search?.trim()) {
      const s = `%${search.trim()}%`;
      query += ` AND (i.descripcion ILIKE $${++p} OR i.marca ILIKE $${p} OR i.modelo ILIKE $${p} OR i.numero_serie ILIKE $${p} OR i.folio ILIKE $${p})`;
      params.push(s);
    }

    const numericLimit = parseInt(limit);
    query += ` ORDER BY i.id ASC LIMIT $${++p}`;
    params.push(numericLimit + 1);

    const result = await pool.query(query, params);
    const hasMore = result.rows.length > numericLimit;
    const data = hasMore ? result.rows.slice(0, numericLimit) : result.rows;
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : null;

    // Conteo con mismos filtros
    let countQuery = `SELECT COUNT(*) FROM inventario i WHERE 1=1`;
    const countParams = [];
    let cp = 0;

    if (filter_marca)     { countQuery += ` AND i.marca ILIKE $${++cp}`;     countParams.push(`%${filter_marca}%`); }
    if (filter_estado)    { countQuery += ` AND i.estado_uso = $${++cp}`;    countParams.push(filter_estado); }
    if (filter_ubicacion) { countQuery += ` AND i.ubicacion_id = $${++cp}`;  countParams.push(parseInt(filter_ubicacion)); }
    if (search?.trim()) {
      const s = `%${search.trim()}%`;
      countQuery += ` AND (i.descripcion ILIKE $${++cp} OR i.marca ILIKE $${cp} OR i.modelo ILIKE $${cp} OR i.numero_serie ILIKE $${cp} OR i.folio ILIKE $${cp})`;
      countParams.push(s);
    }

    const totalFiltered = parseInt((await pool.query(countQuery, countParams)).rows[0].count);

    res.json({
      success: true,
      data: {
        items: data,
        pagination: {
          nextCursor, hasMore, limit: numericLimit,
          count: data.length, totalFiltered,
          isFiltered: !!(filter_marca || filter_estado || filter_ubicacion || search?.trim())
        }
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo inventarios:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

const createInventario = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const invData = mapToInventario(req.body);
    if (!invData.folio) delete invData.folio; // auto-generación serial

    // Calcular tipo_inventario automáticamente
    const ejercicio = req.body.ejercicio || new Date().getFullYear().toString();
    const umaValor  = await getUmaForYear(ejercicio);
    invData.tipo_inventario = calcTipoInventario(req.body.costo, umaValor);

    const fields = Object.keys(invData).filter(k => invData[k] !== null);
    const values = fields.map(k => invData[k]);
    const placeholders = fields.map((_, i) => `$${i + 1}`);

    const { rows } = await client.query(
      `INSERT INTO inventario (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
      values
    );
    const inventarioId = rows[0].id;

    await upsertTable(client, 'inventario_adquisicion', inventarioId, mapToAdquisicion(req.body));
    await upsertTable(client, 'inventario_datos_fiscales', inventarioId, mapToFiscal(req.body));

    if (req.files?.length > 0) {
      const paths = [];
      for (const file of req.files) {
        try { paths.push((await optimizeImage(file.buffer, file.originalname)).path); }
        catch (e) { console.error('❌ Imagen:', e.message); }
      }
      await insertImagenes(client, inventarioId, paths);
    }

    await client.query('COMMIT');

    const final = await pool.query(`${SELECT_FULL} WHERE i.id = $1`, [inventarioId]);
    res.status(201).json({ success: true, message: 'Inventario creado exitosamente', data: final.rows[0] });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creando inventario:', error);
    res.status(500).json({ success: false, message: 'Error al crear inventario', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  } finally {
    client.release();
  }
};

const updateInventario = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    const exists = await client.query('SELECT id FROM inventario WHERE id = $1', [id]);
    if (exists.rows.length === 0) return res.status(404).json({ success: false, message: 'Inventario no encontrado' });

    const invData = mapToInventario(req.body);

    // Recalcular tipo_inventario automáticamente
    const ejercicio = req.body.ejercicio || new Date().getFullYear().toString();
    const umaValor  = await getUmaForYear(ejercicio);
    invData.tipo_inventario = calcTipoInventario(req.body.costo, umaValor);

    const fields = Object.keys(invData).filter(k => invData[k] !== null);
    const values = fields.map(k => invData[k]);
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`);

    await client.query(
      `UPDATE inventario SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${fields.length + 1}`,
      [...values, id]
    );

    await upsertTable(client, 'inventario_adquisicion', id, mapToAdquisicion(req.body));
    await upsertTable(client, 'inventario_datos_fiscales', id, mapToFiscal(req.body));

    if (req.files?.length > 0) {
      const paths = [];
      for (const file of req.files) {
        try { paths.push((await optimizeImage(file.buffer, file.originalname)).path); }
        catch (e) { console.error('❌ Imagen:', e.message); }
      }
      await insertImagenes(client, id, paths);
    }

    await client.query('COMMIT');

    const final = await pool.query(`${SELECT_FULL} WHERE i.id = $1`, [id]);
    res.json({ success: true, message: 'Inventario actualizado exitosamente', data: final.rows[0] });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error actualizando inventario:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar inventario', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  } finally {
    client.release();
  }
};

const getInventarioById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`${SELECT_FULL} WHERE i.id = $1`, [id]);

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Inventario no encontrado' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('❌ Error obteniendo inventario:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

const deleteInventario = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      UPDATE inventario
      SET estado_uso = 'baja', fecha_baja = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING id, folio
    `, [id]);

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Inventario no encontrado' });
    res.json({ success: true, message: 'Inventario marcado como baja exitosamente', data: result.rows[0] });
  } catch (error) {
    console.error('❌ Error eliminando inventario:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

const searchInventarios = async (req, res) => {
  try {
    const { q, limit = 50 } = req.query;
    if (!q || q.trim().length < 2) return res.status(400).json({ success: false, message: 'Término de búsqueda debe tener al menos 2 caracteres' });

    const result = await pool.query(`SELECT * FROM buscar_inventario_texto($1, $2, 0)`, [q.trim(), parseInt(limit)]);
    res.json({ success: true, data: { items: result.rows, total: result.rows.length, query: q.trim() } });
  } catch (error) {
    console.error('❌ Error en búsqueda:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM get_estadisticas_dashboard()');
    const stats = {};
    result.rows.forEach(r => { stats[r.metric.toLowerCase()] = { value: parseInt(r.value), percentage: parseFloat(r.percentage) }; });
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

const checkDuplicate = async (req, res) => {
  try {
    const { field, value } = req.params;
    const { exclude } = req.query;

    // Mapeo campo → tabla donde vive ahora
    const fieldMap = {
      numero_serie:         { col: 'i.numero_serie',         join: '' },
      numero_patrimonio:    { col: 'i.numero_patrimonio',    join: '' },
      uuid:                 { col: 'i.uuid',                 join: '' },
      folio:                { col: 'i.folio',                join: '' },
      registro_patrimonial: { col: 'f.registro_patrimonial', join: 'JOIN inventario_datos_fiscales f ON f.inventario_id = i.id' },
      clave_patrimonial:    { col: 'f.clave_patrimonial',    join: 'JOIN inventario_datos_fiscales f ON f.inventario_id = i.id' },
      uuid_fiscal:          { col: 'f.uuid_fiscal',          join: 'JOIN inventario_datos_fiscales f ON f.inventario_id = i.id' },
    };

    if (!fieldMap[field]) return res.status(400).json({ success: false, message: 'Campo no válido para verificación de duplicados' });

    const { col, join } = fieldMap[field];
    let query = `SELECT i.id, i.folio, ${col} AS field_value, i.descripcion, i.marca, i.modelo, i.created_at FROM inventario i ${join} WHERE ${col} = $1 AND ${col} IS NOT NULL AND ${col} != ''`;
    const params = [value];

    if (exclude && exclude !== 'none') { query += ' AND i.id != $2'; params.push(exclude); }

    const result = await pool.query(query, params);
    const exists = result.rows.length > 0;
    const existing = result.rows[0] || null;

    res.json({
      success: true, exists, field, value,
      existing: existing ? { id: existing.id, folio: existing.folio, descripcion: existing.descripcion || 'Sin descripción', marca: existing.marca || 'Sin marca', modelo: existing.modelo || 'Sin modelo', created_at: existing.created_at } : null,
      message: exists ? `❌ DUPLICADO: ${field} "${value}" ya existe en el registro ${existing.folio || existing.id}` : 'Sin duplicados'
    });
  } catch (error) {
    console.error('❌ Error verificando duplicados:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

const getAvailableMarcas = async (req, res) => {
  try {
    const result = await pool.query(`SELECT DISTINCT marca FROM inventario WHERE marca IS NOT NULL AND marca != '' AND marca != '-' ORDER BY marca ASC`);
    const marcas = result.rows.map(r => r.marca);
    res.json({ success: true, data: marcas, count: marcas.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener marcas', error: error.message });
  }
};

const getAvailableUbicaciones = async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, nombre FROM ubicaciones WHERE activo = true ORDER BY nombre ASC`);
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener ubicaciones', error: error.message });
  }
};

const getDependencias = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, clave FROM dependencias WHERE activo = true ORDER BY nombre ASC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener dependencias', error: error.message });
  }
};

const getCoordinaciones = async (req, res) => {
  try {
    const { dependencia_id } = req.query;
    const params = [];
    let where = 'WHERE activo = true';
    if (dependencia_id) {
      where += ` AND dependencia_id = $1`;
      params.push(parseInt(dependencia_id));
    }
    const result = await pool.query(
      `SELECT id, nombre, clave, dependencia_id FROM coordinaciones ${where} ORDER BY nombre ASC`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener coordinaciones', error: error.message });
  }
};

const getEmpleados = async (req, res) => {
  try {
    const { coordinacion_id } = req.query;
    const params = [];
    let where = 'WHERE activo = true';
    if (coordinacion_id) {
      where += ` AND coordinacion_id = $1`;
      params.push(parseInt(coordinacion_id));
    }
    const result = await pool.query(
      `SELECT id, numero_empleado, nombre_completo FROM empleados ${where} ORDER BY nombre_completo ASC`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener empleados', error: error.message });
  }
};

const getUmaValor = async (req, res) => {
  try {
    const año = parseInt(req.query.año) || new Date().getFullYear();
    const result = await pool.query(
      'SELECT año, valor, fuente, fecha_actualizacion FROM uma_valores WHERE año = $1',
      [año]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Sin valor UMA para el año ${año}` });
    }
    const { valor } = result.rows[0];
    res.json({
      success: true,
      data: {
        ...result.rows[0],
        umbral_externo: parseFloat(valor) * 70,
        descripcion: `Bienes con costo > $${(parseFloat(valor) * 70).toFixed(2)} son EXTERNOS`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener valor UMA', error: error.message });
  }
};

const handleImageUpload = upload.array('images', 3);

module.exports = {
  getAllInventarios, createInventario, updateInventario,
  getInventarioById, deleteInventario, searchInventarios,
  getDashboardStats, checkDuplicate,
  getAvailableMarcas, getAvailableUbicaciones,
  getDependencias, getCoordinaciones, getEmpleados,
  getUmaValor,
  handleImageUpload, optimizeImage, mapFrontendToDatabase
};
