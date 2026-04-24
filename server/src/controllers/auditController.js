// =====================================================
// CONTROLADOR: Auditoría de Campo
// Rutas públicas: /api/auditoria/:token/*   (token UUID + cookie audit_access)
// Rutas admin:    /api/auditoria/sesiones/* (JWT requerido)
// =====================================================

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const sseService = require('../services/sseService');

// ── Configuración ────────────────────────────────────────────
const SAFE_COLUMNS = `
  i.id,
  i.folio,
  i.clave_patrimonial,
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

const ESTADOS_VALIDOS = ['Sin asignar', 'Localizado', 'Baja', 'No Localizado'];

const AUDIT_ACCESS_SECRET =
  process.env.AUDIT_ACCESS_SECRET ||
  process.env.JWT_SECRET ||
  'cambia_este_secreto_audit';

const ACCESS_COOKIE_TTL_MS = 30 * 60 * 1000; // 30 min de inactividad

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Helpers ──────────────────────────────────────────────────

function hashToken(plain) {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

function randomString(len, alphabet) {
  const out = new Array(len);
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) out[i] = alphabet[bytes[i] % alphabet.length];
  return out.join('');
}

function generateUsername() {
  const tail = randomString(4, '23456789abcdefghjkmnpqrstuvwxyz');
  return `aud-${tail}`;
}

function generatePassword() {
  return randomString(8, PASSWORD_ALPHABET);
}

async function generateUniqueUsername() {
  for (let i = 0; i < 5; i++) {
    const u = generateUsername();
    const { rows } = await pool.query(
      'SELECT 1 FROM audit_sessions WHERE username = $1 LIMIT 1',
      [u]
    );
    if (!rows.length) return u;
  }
  return `aud-${randomString(8, '23456789abcdefghjkmnpqrstuvwxyz')}`;
}

function signAccessCookie(sessionId) {
  const exp = Date.now() + ACCESS_COOKIE_TTL_MS;
  const payload = `${sessionId}.${exp}`;
  const sig = crypto
    .createHmac('sha256', AUDIT_ACCESS_SECRET)
    .update(payload)
    .digest('hex');
  return `${payload}.${sig}`;
}

function verifyAccessCookie(value) {
  if (!value || typeof value !== 'string') return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [sessionId, expMs, sig] = parts;
  const expected = crypto
    .createHmac('sha256', AUDIT_ACCESS_SECRET)
    .update(`${sessionId}.${expMs}`)
    .digest('hex');
  let ok = false;
  try {
    ok =
      sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return null;
  }
  if (!ok) return null;
  if (Date.now() > Number(expMs)) return null;
  return Number(sessionId);
}

function setAccessCookie(res, sessionId) {
  const value = signAccessCookie(sessionId);
  res.cookie('audit_access', value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ACCESS_COOKIE_TTL_MS,
    path: '/api/auditoria',
  });
}

function clearAccessCookie(res) {
  res.clearCookie('audit_access', { path: '/api/auditoria' });
}

// Construye el base URL público para el link de auditoría.
// Prioriza:
//   1) PUBLIC_BASE_URL (override explícito p.ej. https://miapp.com)
//   2) CLIENT_URL (CSV — toma el primero)
//   3) Header Origin del request (cuando admin es la misma SPA)
//   4) Header Referer
//   5) Forwarded host del proxy (X-Forwarded-Proto + X-Forwarded-Host) — Railway/Render/Nginx
//   6) Host del request (último recurso)
function resolveBaseUrl(req) {
  const fromEnv =
    process.env.PUBLIC_BASE_URL?.trim() ||
    process.env.CLIENT_URL?.split(',')[0]?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const origin = req.get('origin');
  if (origin) return origin.replace(/\/$/, '');

  const referer = req.get('referer');
  if (referer) {
    try {
      const u = new URL(referer);
      return `${u.protocol}//${u.host}`;
    } catch { /* ignore */ }
  }

  const fwdProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const fwdHost  = (req.get('x-forwarded-host')  || '').split(',')[0].trim();
  if (fwdHost) return `${fwdProto || req.protocol}://${fwdHost}`;

  return `${req.protocol}://${req.get('host')}`;
}

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

// ── Middlewares ──────────────────────────────────────────────

async function requireAuditTokenOnly(req, res, next) {
  const { token } = req.params;
  if (!token) return res.status(401).json({ success: false, message: 'Token requerido' });
  try {
    const session = await loadSession(token);
    if (!session) {
      return res
        .status(401)
        .json({ success: false, message: 'Enlace inválido, expirado o revocado' });
    }
    req.auditSession = session;
    next();
  } catch (err) {
    console.error('[Audit] requireAuditTokenOnly:', err.message);
    return res.status(500).json({ success: false, message: 'Error validando enlace' });
  }
}

async function requireAuditToken(req, res, next) {
  const { token } = req.params;
  if (!token) return res.status(401).json({ success: false, message: 'Token requerido' });
  try {
    const session = await loadSession(token);
    if (!session) {
      return res
        .status(401)
        .json({ success: false, message: 'Enlace inválido, expirado o revocado' });
    }

    const requiresLogin = !!session.password_hash;
    if (requiresLogin) {
      const cookieSessionId = verifyAccessCookie(req.cookies?.audit_access);
      if (cookieSessionId !== session.id) {
        return res
          .status(401)
          .json({ success: false, message: 'Acceso requerido', requires_login: true });
      }
      setAccessCookie(res, session.id);
    }

    req.auditSession = session;

    pool
      .query(
        'UPDATE audit_sessions SET last_seen_at = NOW(), last_activity_at = NOW() WHERE id = $1',
        [session.id]
      )
      .catch(() => {});

    next();
  } catch (err) {
    console.error('[Audit] requireAuditToken:', err.message);
    return res.status(500).json({ success: false, message: 'Error validando sesión' });
  }
}

// ── Endpoints públicos (practicante) ─────────────────────────

async function loginPublic(req, res) {
  const session = req.auditSession;
  const { username, password } = req.body || {};

  if (!session.password_hash || !session.username) {
    setAccessCookie(res, session.id);
    return res.json({
      success: true,
      session: { intern_name: session.intern_name, expires_at: session.expires_at },
    });
  }

  if (!username || !password) {
    return res
      .status(400)
      .json({ success: false, message: 'Usuario y contraseña requeridos' });
  }

  if (String(username).toLowerCase() !== String(session.username).toLowerCase()) {
    return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
  }

  const ok = await bcrypt.compare(String(password), session.password_hash);
  if (!ok) {
    return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
  }

  setAccessCookie(res, session.id);
  return res.json({
    success: true,
    session: { intern_name: session.intern_name, expires_at: session.expires_at },
  });
}

async function logoutPublic(req, res) {
  clearAccessCookie(res);
  return res.json({ success: true });
}

async function getSession(req, res) {
  const s = req.auditSession;
  return res.json({
    success: true,
    session: { intern_name: s.intern_name, expires_at: s.expires_at },
  });
}

async function getFilterOptions(req, res) {
  try {
    const [ubicRes, respRes] = await Promise.all([
      pool.query(
        `SELECT DISTINCT ubicacion FROM inventario_interno
         WHERE ubicacion IS NOT NULL AND ubicacion <> ''
         ORDER BY ubicacion`
      ),
      pool.query(
        `SELECT DISTINCT usu_asig FROM inventario_interno
         WHERE usu_asig IS NOT NULL AND usu_asig <> ''
         ORDER BY usu_asig`
      ),
    ]);
    res.set('Cache-Control', 'no-store');
    return res.json({
      success: true,
      ubicaciones: ubicRes.rows.map(r => r.ubicacion),
      responsables: respRes.rows.map(r => r.usu_asig),
    });
  } catch (err) {
    console.error('[Audit] getFilterOptions:', err.message);
    return res.status(500).json({ success: false, message: 'Error obteniendo opciones' });
  }
}

async function getItems(req, res) {
  try {
    const page     = Math.max(1, parseInt(req.query.page     || '1',  10));
    const per_page = Math.min(100, Math.max(1, parseInt(req.query.per_page || '50', 10)));
    const offset   = (page - 1) * per_page;
    const { search, estado, ubicacion, responsable, id } = req.query;

    const conditions = [];
    const params     = [];

    if (search) {
      params.push(search);           // $N   — match exacto para identificadores
      params.push(`%${search}%`);    // $N+1 — substring para campos descriptivos
      const eN = params.length - 1;
      const lN = params.length;
      conditions.push(
        `(i.folio                ILIKE $${eN}
          OR i.clave_patrimonial ILIKE $${lN}
          OR i.no_serie          ILIKE $${lN}
          OR CAST(i.id AS TEXT)  = $${eN}
          OR i.descripcion       ILIKE $${lN}
          OR i.marca             ILIKE $${lN})`
      );
    }

    if (id !== undefined && id !== '') {
      const idNum = parseInt(id, 10);
      if (Number.isFinite(idNum)) {
        params.push(idNum);
        conditions.push(`i.id = $${params.length}`);
      }
    }

    if (estado && ESTADOS_VALIDOS.includes(estado)) {
      params.push(estado);
      conditions.push(`i.estado = $${params.length}`);
    }

    if (ubicacion) {
      params.push(`%${ubicacion}%`);
      conditions.push(`i.ubicacion ILIKE $${params.length}`);
    }

    if (responsable) {
      params.push(`%${responsable}%`);
      conditions.push(
        `(i.usu_asig ILIKE $${params.length}
          OR i.numero_empleado_usuario ILIKE $${params.length})`
      );
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM inventario_interno i ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

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
        total_pages: Math.ceil(total / per_page),
      },
    });
  } catch (err) {
    console.error('[Audit] getItems:', err.message);
    return res.status(500).json({ success: false, message: 'Error obteniendo bienes' });
  }
}

async function updateEstado(req, res) {
  const { id } = req.params;
  const { estado, observaciones, client_change_id, metadata } = req.body || {};
  const session = req.auditSession;

  if (!estado || !ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({
      success: false,
      message: `Estado inválido. Permitidos: ${ESTADOS_VALIDOS.join(', ')}`,
    });
  }

  let ccid = null;
  if (client_change_id !== undefined && client_change_id !== null && client_change_id !== '') {
    if (!UUID_RE.test(String(client_change_id))) {
      return res
        .status(400)
        .json({ success: false, message: 'client_change_id debe ser UUID v4' });
    }
    ccid = String(client_change_id).toLowerCase();
  }

  let meta = null;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const m = {};
    if (Number.isFinite(metadata.lat))      m.lat = metadata.lat;
    if (Number.isFinite(metadata.lng))      m.lng = metadata.lng;
    if (Number.isFinite(metadata.accuracy)) m.accuracy = metadata.accuracy;
    if (metadata.source && typeof metadata.source === 'string') {
      m.source = metadata.source.slice(0, 30);
    }
    if (Object.keys(m).length) meta = m;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (ccid) {
      const dup = await client.query(
        `SELECT valor_nuevo FROM audit_events
         WHERE audit_session_id = $1 AND client_change_id = $2
         LIMIT 1`,
        [session.id, ccid]
      );
      if (dup.rows.length) {
        await client.query('COMMIT');
        return res.json({
          success: true,
          estado: dup.rows[0].valor_nuevo,
          deduped: true,
        });
      }
    }

    const prev = await client.query(
      'SELECT estado FROM inventario_interno WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (!prev.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Bien no encontrado' });
    }
    const valor_anterior = prev.rows[0].estado;

    if (valor_anterior !== estado) {
      await client.query(
        'UPDATE inventario_interno SET estado = $1, fecha_actualizacion = NOW() WHERE id = $2',
        [estado, id]
      );
    }

    await client.query(
      `INSERT INTO audit_events
         (audit_session_id, inventario_id, campo, valor_anterior, valor_nuevo,
          observaciones, metadata, client_change_id)
       VALUES ($1, $2, 'estado', $3, $4, $5, $6, $7)`,
      [
        session.id,
        id,
        valor_anterior,
        estado,
        observaciones || null,
        meta ? JSON.stringify(meta) : null,
        ccid,
      ]
    );

    await client.query('COMMIT');

    // SSE broadcast: notifica a admin (InternoView) y a otros auditores
    if (valor_anterior !== estado) {
      try {
        const clientCount = sseService.broadcast('inventory_updated', {
          action: 'audit_estado',
          id: parseInt(id, 10),
          estado,
          session_id: session.id,
        });
        console.log(`[SSE] inventory_updated broadcast id=${id} estado=${estado} → ${clientCount ?? '?'} clientes`);
      } catch (e) { console.error('[SSE] broadcast falló:', e.message); }
    }

    return res.json({ success: true, estado, no_change: valor_anterior === estado });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505' && err.constraint?.includes('idempotency')) {
      return res.json({ success: true, estado, deduped: true });
    }
    console.error('[Audit] updateEstado:', err.message);
    return res.status(500).json({ success: false, message: 'Error actualizando estado' });
  } finally {
    client.release();
  }
}

// ── Endpoints admin ──────────────────────────────────────────

async function createSesion(req, res) {
  const { intern_name } = req.body || {};
  if (!intern_name || !String(intern_name).trim()) {
    return res.status(400).json({ success: false, message: 'intern_name es requerido' });
  }

  let hours;
  if (req.body?.expires_in_hours !== undefined) {
    hours = parseInt(req.body.expires_in_hours, 10);
  } else if (req.body?.expires_in_days !== undefined) {
    hours = parseInt(req.body.expires_in_days, 10) * 24;
  } else {
    hours = 8;
  }
  if (!Number.isFinite(hours)) hours = 8;
  hours = Math.min(24, Math.max(1, hours));

  const plain = crypto.randomUUID();
  const hash  = hashToken(plain);
  const created_by = req.user?.usuario || req.user?.username || 'admin';

  const username = await generateUniqueUsername();
  const password = generatePassword();
  const password_hash = await bcrypt.hash(password, 10);

  let inserted;
  try {
    inserted = await pool.query(
      `INSERT INTO audit_sessions
         (token_hash, intern_name, created_by, expires_at,
          username, password_hash, expires_in_hours)
       VALUES ($1, $2, $3, NOW() + make_interval(hours => $4), $5, $6, $4)
       RETURNING id, expires_at`,
      [hash, String(intern_name).trim(), created_by, hours, username, password_hash]
    );
  } catch (err) {
    console.error('[Audit] createSesion:', err.message);
    return res
      .status(500)
      .json({ success: false, message: 'Error al crear sesión: ' + err.message });
  }

  const baseUrl = resolveBaseUrl(req);
  const link = `${baseUrl}/auditoria/${plain}`;

  return res.status(201).json({
    success: true,
    id: inserted.rows[0].id,
    link,
    intern_name: String(intern_name).trim(),
    username,
    password, // se devuelve UNA sola vez (no se guarda en plano)
    expires_in_hours: hours,
    expires_at: inserted.rows[0].expires_at,
  });
}

async function getSesiones(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT
        s.id,
        s.intern_name,
        s.created_by,
        s.created_at,
        s.expires_at,
        s.expires_in_hours,
        s.revoked_at,
        s.last_seen_at,
        s.last_activity_at,
        s.username,
        (s.password_hash IS NOT NULL)                    AS has_credentials,
        (s.revoked_at IS NOT NULL)                       AS revocada,
        (s.expires_at <= NOW() AND s.revoked_at IS NULL) AS expirada,
        COUNT(DISTINCT ae.inventario_id)::INTEGER        AS items_revisados
      FROM audit_sessions s
      LEFT JOIN audit_events ae ON ae.audit_session_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);

    const totalRes = await pool.query(
      'SELECT COUNT(*)::INTEGER AS total FROM inventario_interno'
    );
    const total_items = totalRes.rows[0].total;

    const sesiones = rows.map((s) => ({
      ...s,
      total_items,
      porcentaje:
        total_items > 0 ? Math.round((s.items_revisados / total_items) * 100) : 0,
    }));

    return res.json({ success: true, data: sesiones, total_items });
  } catch (err) {
    console.error('[Audit] getSesiones:', err.message);
    return res.status(500).json({ success: false, message: 'Error obteniendo sesiones' });
  }
}

// GET /auditoria/sesiones/:id/access
// El token plain NO se persiste; solo username y metadatos.
// El link completo solo se reexpone tras "regenerate".
async function getSesionAccess(req, res) {
  const { id } = req.params;
  const { rows } = await pool.query(
    `SELECT id, intern_name, username, expires_at, expires_in_hours,
            (password_hash IS NOT NULL) AS has_password,
            revoked_at, created_at
     FROM audit_sessions WHERE id = $1`,
    [id]
  );
  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
  }
  return res.json({ success: true, data: rows[0] });
}

// POST /auditoria/sesiones/:id/regenerate
// Genera nuevo token + nuevo password (mantiene username e intern_name)
async function regenerateCredentials(req, res) {
  const { id } = req.params;

  const baseRow = await pool.query(
    'SELECT id, username, expires_in_hours, revoked_at FROM audit_sessions WHERE id = $1',
    [id]
  );
  if (!baseRow.rows.length) {
    return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
  }
  if (baseRow.rows[0].revoked_at) {
    return res
      .status(400)
      .json({ success: false, message: 'Sesión revocada, crea una nueva' });
  }

  const hours = Math.min(24, Math.max(1, baseRow.rows[0].expires_in_hours || 8));
  const plain = crypto.randomUUID();
  const hash  = hashToken(plain);
  const password = generatePassword();
  const password_hash = await bcrypt.hash(password, 10);

  let username = baseRow.rows[0].username;
  if (!username) username = await generateUniqueUsername();

  await pool.query(
    `UPDATE audit_sessions
     SET token_hash = $1,
         password_hash = $2,
         username = $3,
         expires_at = NOW() + make_interval(hours => $4),
         expires_in_hours = $4,
         last_activity_at = NULL,
         last_seen_at = NULL
     WHERE id = $5`,
    [hash, password_hash, username, hours, id]
  );

  const baseUrl = resolveBaseUrl(req);
  const link = `${baseUrl}/auditoria/${plain}`;

  return res.json({
    success: true,
    link,
    username,
    password,
    expires_in_hours: hours,
  });
}

async function revokeSesion(req, res) {
  const { id } = req.params;
  const { rowCount } = await pool.query(
    `UPDATE audit_sessions SET revoked_at = NOW()
     WHERE id = $1 AND revoked_at IS NULL`,
    [id]
  );
  if (!rowCount) {
    return res
      .status(404)
      .json({ success: false, message: 'Sesión no encontrada o ya revocada' });
  }
  return res.json({ success: true, message: 'Sesión revocada' });
}

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
         ae.metadata,
         ae.ts
       FROM audit_events ae
       JOIN inventario_interno i ON i.id = ae.inventario_id
       WHERE ae.audit_session_id = $1
       ORDER BY ae.ts DESC`,
      [id]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Audit] getSesionEventos:', err.message);
    return res.status(500).json({ success: false, message: 'Error obteniendo eventos' });
  }
}

module.exports = {
  requireAuditToken,
  requireAuditTokenOnly,
  loginPublic,
  logoutPublic,
  getSession,
  getFilterOptions,
  getItems,
  updateEstado,
  createSesion,
  getSesiones,
  getSesionAccess,
  regenerateCredentials,
  revokeSesion,
  getSesionEventos,
};
