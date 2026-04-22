// =====================================================
// CONTROLADOR: Auditoría de Campo
// Rutas públicas: /api/auditoria/:token/*   (token UUID)
// Rutas admin:    /api/auditoria/sesiones/* (JWT requerido)
// =====================================================

const crypto = require('crypto');
const { pool } = require('../config/database');

// Columnas seguras expuestas al practicante (sin datos fiscales ni costos)
const SAFE_COLUMNS = `
  i.id,
  i.folio,
  i.descripcion,
  i.marca,
  i.modelo,
  i.no_serie,
  i.ubicacion,
  i.usu_asig,
  i.numero_empleado_usuario,
  i.tipo_bien,
  i.ures_asignacion,
  i.estado
`;

// Valores permitidos para el campo estado
const ESTADOS_VALIDOS = ['Sin asignar', 'Localizado', 'Baja', 'No Localizado'];

// ---------------------------------------------------------
// Helper: hash SHA-256 del token plain
// ---------------------------------------------------------
function hashToken(plain) {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

// ---------------------------------------------------------
// Helper: cargar sesión validada desde el token plain
// ---------------------------------------------------------
async function loadSession(tokenPlain) {
  const hash = hashToken(tokenPlain);
  const { rows } = await pool.query(
    `SELECT * FROM audit_sessions
     WHERE token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()`,
    [hash]
  );
  return rows[0] || null;
}

// ---------------------------------------------------------
// Middleware: valida el token en la URL y adjunta la sesión
// ---------------------------------------------------------
async function requireAuditToken(req, res, next) {
  const { token } = req.params;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token requerido' });
  }
  try {
    const session = await loadSession(token);
    if (!session) {
      return res.status(401).json({ success: false, message: 'Enlace inválido, expirado o revocado' });
    }
    req.auditSession = session;

    // Actualizar last_seen (sin await para no bloquear)
    pool.query(
      'UPDATE audit_sessions SET last_seen_at = NOW() WHERE id = $1',
      [session.id]
    ).catch(() => {});

    next();
  } catch (err) {
    console.error('[Audit] requireAuditToken error:', err.message);
    return res.status(500).json({ success: false, message: 'Error validando sesión' });
  }
}

// ---------------------------------------------------------
// GET /auditoria/:token
// Devuelve info de la sesión (sin datos sensibles)
// ---------------------------------------------------------
async function getSession(req, res) {
  const { auditSession: s } = req;
  return res.json({
    success: true,
    session: {
      intern_name: s.intern_name,
      expires_at:  s.expires_at,
    }
  });
}

// ---------------------------------------------------------
// GET /auditoria/:token/items
// Lista paginada de bienes con columnas seguras
// Query params: page, per_page, search, estado, ubicacion
// ---------------------------------------------------------
async function getItems(req, res) {
  try {
    const page     = Math.max(1, parseInt(req.query.page     || '1',  10));
    const per_page = Math.min(100, Math.max(1, parseInt(req.query.per_page || '50', 10)));
    const offset   = (page - 1) * per_page;
    const { search, estado, ubicacion } = req.query;

    const conditions = [];
    const params     = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(i.folio ILIKE $${params.length}
          OR i.descripcion ILIKE $${params.length}
          OR i.no_serie    ILIKE $${params.length}
          OR i.marca       ILIKE $${params.length})`
      );
    }

    if (estado && ESTADOS_VALIDOS.includes(estado)) {
      params.push(estado);
      conditions.push(`i.estado = $${params.length}`);
    }

    if (ubicacion) {
      params.push(`%${ubicacion}%`);
      conditions.push(`i.ubicacion ILIKE $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    // Conteo total
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM inventario_interno i ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    // Datos paginados
    params.push(per_page, offset);
    const dataRes = await pool.query(
      `SELECT ${SAFE_COLUMNS}
       FROM inventario_interno i
       ${where}
       ORDER BY i.folio ASC NULLS LAST, i.id ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        total,
        page,
        per_page,
        total_pages: Math.ceil(total / per_page)
      }
    });
  } catch (err) {
    console.error('[Audit] getItems error:', err.message);
    return res.status(500).json({ success: false, message: 'Error obteniendo bienes' });
  }
}

// ---------------------------------------------------------
// PATCH /auditoria/:token/items/:id/estado
// Actualiza el estado de un bien y registra el evento
// Body: { estado, observaciones? }
// ---------------------------------------------------------
async function updateEstado(req, res) {
  const { id } = req.params;
  const { estado, observaciones } = req.body;
  const session = req.auditSession;

  if (!estado || !ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({
      success: false,
      message: `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Leer valor anterior
    const prev = await client.query(
      'SELECT estado FROM inventario_interno WHERE id = $1',
      [id]
    );
    if (!prev.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Bien no encontrado' });
    }
    const valor_anterior = prev.rows[0].estado;

    // Actualizar estado
    await client.query(
      'UPDATE inventario_interno SET estado = $1, fecha_actualizacion = NOW() WHERE id = $2',
      [estado, id]
    );

    // Registrar evento
    await client.query(
      `INSERT INTO audit_events
         (audit_session_id, inventario_id, campo, valor_anterior, valor_nuevo, observaciones)
       VALUES ($1, $2, 'estado', $3, $4, $5)`,
      [session.id, id, valor_anterior, estado, observaciones || null]
    );

    await client.query('COMMIT');

    return res.json({ success: true, estado });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Audit] updateEstado error:', err.message);
    return res.status(500).json({ success: false, message: 'Error actualizando estado' });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------
// POST /auditoria/sesiones  (admin, JWT requerido)
// Crea una nueva sesión/token para un practicante
// Body: { intern_name, expires_in_days? }
// ---------------------------------------------------------
async function createSesion(req, res) {
  const { intern_name, expires_in_days = 7 } = req.body;
  if (!intern_name || !intern_name.trim()) {
    return res.status(400).json({ success: false, message: 'intern_name es requerido' });
  }

  const days = Math.min(30, Math.max(1, parseInt(expires_in_days, 10) || 7));
  const plain = crypto.randomUUID();
  const hash  = hashToken(plain);
  const created_by = req.user?.usuario || req.user?.username || 'admin';

  try {
    await pool.query(
      `INSERT INTO audit_sessions (token_hash, intern_name, created_by, expires_at)
       VALUES ($1, $2, $3, NOW() + make_interval(days => $4))`,
      [hash, intern_name.trim(), created_by, days]
    );
  } catch (err) {
    console.error('[Audit] createSesion error:', err.message);
    return res.status(500).json({ success: false, message: 'Error al crear sesión: ' + err.message });
  }

  // Construir URL del frontend (configurable por env)
  const baseUrl = process.env.CLIENT_URL?.split(',')[0]?.trim() || 'http://localhost:3000';
  const link = `${baseUrl}/auditoria/${plain}`;

  return res.status(201).json({
    success: true,
    link,
    intern_name: intern_name.trim(),
    expires_in_days: days
  });
}

// ---------------------------------------------------------
// GET /auditoria/sesiones  (admin, JWT requerido)
// Lista sesiones con progreso por practicante
// ---------------------------------------------------------
async function getSesiones(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT
        s.id,
        s.intern_name,
        s.created_by,
        s.created_at,
        s.expires_at,
        s.revoked_at,
        s.last_seen_at,
        (s.revoked_at IS NOT NULL)                   AS revocada,
        (s.expires_at <= NOW() AND s.revoked_at IS NULL) AS expirada,
        COUNT(DISTINCT ae.inventario_id)::INTEGER     AS items_revisados
      FROM audit_sessions s
      LEFT JOIN audit_events ae ON ae.audit_session_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);

    // Total de bienes activos (mismo denominador para todos)
    const totalRes = await pool.query(
      'SELECT COUNT(*)::INTEGER AS total FROM inventario_interno'
    );
    const total_items = totalRes.rows[0].total;

    const sesiones = rows.map(s => ({
      ...s,
      total_items,
      porcentaje: total_items > 0
        ? Math.round((s.items_revisados / total_items) * 100)
        : 0
    }));

    return res.json({ success: true, data: sesiones, total_items });
  } catch (err) {
    console.error('[Audit] getSesiones error:', err.message);
    return res.status(500).json({ success: false, message: 'Error obteniendo sesiones' });
  }
}

// ---------------------------------------------------------
// DELETE /auditoria/sesiones/:id  (admin, JWT requerido)
// Revoca (inhabilita) una sesión sin borrarla
// ---------------------------------------------------------
async function revokeSesion(req, res) {
  const { id } = req.params;
  const { rowCount } = await pool.query(
    `UPDATE audit_sessions SET revoked_at = NOW()
     WHERE id = $1 AND revoked_at IS NULL`,
    [id]
  );
  if (!rowCount) {
    return res.status(404).json({ success: false, message: 'Sesión no encontrada o ya revocada' });
  }
  return res.json({ success: true, message: 'Sesión revocada' });
}

// ---------------------------------------------------------
// GET /auditoria/sesiones/:id/eventos  (admin, JWT requerido)
// Detalle de eventos de una sesión (quién marcó qué y cuándo)
// ---------------------------------------------------------
async function getSesionEventos(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT
         ae.id,
         ae.inventario_id,
         i.folio,
         i.descripcion,
         ae.campo,
         ae.valor_anterior,
         ae.valor_nuevo,
         ae.observaciones,
         ae.ts
       FROM audit_events ae
       JOIN inventario_interno i ON i.id = ae.inventario_id
       WHERE ae.audit_session_id = $1
       ORDER BY ae.ts DESC`,
      [id]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Audit] getSesionEventos error:', err.message);
    return res.status(500).json({ success: false, message: 'Error obteniendo eventos' });
  }
}

module.exports = {
  requireAuditToken,
  getSession,
  getItems,
  updateEstado,
  createSesion,
  getSesiones,
  revokeSesion,
  getSesionEventos,
};
