// =====================================================
// CONTROLADOR: Auditoría de Campo
// Rutas públicas: /api/auditoria/:token/*   (token UUID + cookie audit_access)
// Rutas admin:    /api/auditoria/sesiones/* (JWT requerido)
// Almacenamiento: SQLite (server/data/audit.db) — sin dependencia de PostgreSQL
// =====================================================

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { getDb } = require('../services/sqliteService');
const sseService = require('../services/sseService');
const inventarioService = require('../services/inventarioService');

// ── Configuración ────────────────────────────────────────────
const ESTADOS_VALIDOS = ['Sin asignar', 'Localizado', 'Baja', 'No Localizado'];

function resolveArchiUrl(archi) {
  if (!archi) return null;
  const url = String(archi).trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const apiBase = (process.env.EXTERNAL_API_BASE_URL || 'http://api-patrimonio.umich.mx/api-patrimonio').replace(/\/$/, '');
  return url.startsWith('/') ? `${apiBase.split('/').slice(0, 3).join('/')}${url}` : `${apiBase}/${url}`;
}

const AUDIT_ACCESS_SECRET =
  process.env.AUDIT_ACCESS_SECRET ||
  process.env.JWT_SECRET ||
  'cambia_este_secreto_audit';

const ACCESS_COOKIE_TTL_MS = 30 * 60 * 1000;

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseUresCodes(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch { return []; }
}

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

function generateUniqueUsername() {
  const db = getDb();
  const stmt = db.prepare('SELECT 1 FROM audit_sessions WHERE username = ? LIMIT 1');
  for (let i = 0; i < 5; i++) {
    const u = generateUsername();
    if (!stmt.get(u)) return u;
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

function loadSession(tokenPlain) {
  const hash = hashToken(tokenPlain);
  const db = getDb();
  return db.prepare(
    `SELECT * FROM audit_sessions
     WHERE token_hash = ?
       AND revoked_at IS NULL
       AND expires_at > datetime('now')`
  ).get(hash) || null;
}

// ── Middlewares ──────────────────────────────────────────────

async function requireAuditTokenOnly(req, res, next) {
  const { token } = req.params;
  if (!token) return res.status(401).json({ success: false, message: 'Token requerido' });
  try {
    const session = loadSession(token);
    if (!session) {
      return res.status(401).json({ success: false, message: 'Enlace inválido, expirado o revocado' });
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
    const session = loadSession(token);
    if (!session) {
      return res.status(401).json({ success: false, message: 'Enlace inválido, expirado o revocado' });
    }
    req.auditSession = session;

    try {
      getDb().prepare(
        `UPDATE audit_sessions SET last_seen_at = datetime('now'), last_activity_at = datetime('now') WHERE id = ?`
      ).run(session.id);
    } catch (_) {}

    next();
  } catch (err) {
    console.error('[Audit] requireAuditToken:', err.message);
    return res.status(500).json({ success: false, message: 'Error validando sesión' });
  }
}

// ── Endpoints públicos (practicante) ─────────────────────────

async function loginPublic(req, res) {
  const session = req.auditSession;
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
    const source = inventarioService.getDataSource();

    if (source === 'api') {
      const session = req.auditSession;
      const uresCodes = parseUresCodes(session.ures_codes);
      if (!uresCodes.length) return res.json({ success: true, ubicaciones: [], responsables: [] });

      const { items } = await inventarioService.getAllInventariosInternos(
        1, 10000, { ures: uresCodes.join(',') }, session.umich_jsession || null
      );
      const ubicaciones = [...new Set(
        items.map(i => i.ubicacion || i._raw?.ubica).filter(Boolean)
      )].sort();
      const responsables = [...new Set(
        items.map(i => i.usu_asig || i._raw?.persona).filter(Boolean)
      )].sort();
      res.set('Cache-Control', 'no-store');
      return res.json({ success: true, ubicaciones, responsables });
    }

    // Modo BD: leer de inventario_interno via inventarioService
    const { items } = await inventarioService.getAllInventariosInternos(1, 10000, {});
    const ubicaciones = [...new Set(items.map(i => i.ubicacion).filter(Boolean))].sort();
    const responsables = [...new Set(items.map(i => i.responsable || i.usu_asig).filter(Boolean))].sort();
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, ubicaciones, responsables });
  } catch (err) {
    console.error('[Audit] getFilterOptions:', err.message);
    return res.status(500).json({ success: false, message: 'Error obteniendo opciones' });
  }
}

async function getItems(req, res) {
  try {
    const page     = Math.max(1, parseInt(req.query.page     || '1',  10));
    const per_page = Math.min(100, Math.max(1, parseInt(req.query.per_page || '50', 10)));
    const { search, estado, ubicacion, responsable, id } = req.query;

    const source = inventarioService.getDataSource();
    const db = getDb();

    // ── API mode ────────────────────────────────────────────────
    if (source === 'api') {
      const session = req.auditSession;
      const uresCodes = parseUresCodes(session.ures_codes);
      if (!uresCodes.length) {
        return res.json({
          success: false,
          message: 'Sesión sin URES configuradas. Pide al administrador que regenere el enlace.',
          data: [],
          pagination: { total: 0, page, per_page, total_pages: 0 },
        });
      }

      const { items: apiItems } = await inventarioService.getAllInventariosInternos(
        1, 10000, { ures: uresCodes.join(','), q: search || '' }, session.umich_jsession || null
      );

      // Overlay estado auditado desde item_estados
      const ids = apiItems.map(i => i.id).filter(v => v != null);
      const estadoMap = {};
      if (ids.length) {
        const placeholders = ids.map(() => '?').join(',');
        db.prepare(
          `SELECT inventario_id, estado FROM item_estados WHERE inventario_id IN (${placeholders})`
        ).all(...ids).forEach(r => { estadoMap[r.inventario_id] = r.estado; });
      }

      let items = apiItems.map(item => ({
        id:                      item.id,
        folio:                   item.folio        || item._raw?.folio,
        clave_patrimonial:       item.numero_patrimonio || item._raw?.clavePat,
        descripcion:             item.descripcion,
        marca:                   item.marca,
        modelo:                  item.modelo,
        no_serie:                item.numero_serie || item._raw?.serie,
        ubicacion:               item.ubicacion    || item._raw?.ubica,
        responsable:             item.usu_asig     || item._raw?.persona,
        usu_asig:                item.usu_asig     || item._raw?.persona,
        numero_empleado_usuario: item.numero_empleado || null,
        tipo_bien:               item.tipo_bien,
        ures_asignacion:         String(item.ubicacion_id || ''),
        estado:                  estadoMap[item.id] || 'Sin asignar',
        archi:                   resolveArchiUrl(item.archi || item._raw?.archi),
      }));

      if (id !== undefined && id !== '') {
        const idNum = parseInt(id, 10);
        if (Number.isFinite(idNum)) items = items.filter(i => i.id === idNum);
      }
      if (estado && ESTADOS_VALIDOS.includes(estado)) {
        items = items.filter(i => i.estado === estado);
      }
      if (ubicacion) {
        const ub = ubicacion.toLowerCase();
        items = items.filter(i => i.ubicacion?.toLowerCase().includes(ub));
      }
      if (responsable) {
        const rp = responsable.toLowerCase();
        items = items.filter(i =>
          [i.responsable, i.usu_asig, i.numero_empleado_usuario]
            .some(v => v?.toLowerCase().includes(rp))
        );
      }

      const total  = items.length;
      const offset = (page - 1) * per_page;
      return res.json({
        success: true,
        data: items.slice(offset, offset + per_page),
        pagination: { total, page, per_page, total_pages: Math.ceil(total / per_page) || 1 },
      });
    }

    // ── BD mode: leer de inventario_interno via inventarioService ──
    const filters = { q: search || '', estado, ubicacion, responsable };
    const { items: bdItems, total } = await inventarioService.getAllInventariosInternos(
      page, per_page, filters
    );

    // Overlay estado auditado
    const ids = bdItems.map(i => i.id).filter(v => v != null);
    const estadoMap = {};
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(
        `SELECT inventario_id, estado FROM item_estados WHERE inventario_id IN (${placeholders})`
      ).all(...ids).forEach(r => { estadoMap[r.inventario_id] = r.estado; });
    }

    const data = bdItems.map(i => ({
      ...i,
      estado: estadoMap[i.id] || i.estado || 'Sin asignar',
    }));

    return res.json({
      success: true,
      data,
      pagination: { total, page, per_page, total_pages: Math.ceil(total / per_page) || 1 },
    });
  } catch (err) {
    console.error('[Audit] getItems:', err.message);
    if (err.status === 403 || err.status === 401) {
      return res.status(503).json({
        success: false,
        error_code: 'UMICH_SESSION_EXPIRED',
        message: 'La sesión del administrador en UMICH ha expirado. Pide al administrador que regenere el enlace de auditoría.',
      });
    }
    return res.status(500).json({ success: false, message: 'Error obteniendo bienes: ' + err.message });
  }
}

async function updateEstado(req, res) {
  const { id } = req.params;
  const { estado, observaciones, client_change_id, metadata, item_descripcion, item_folio } = req.body || {};
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
      return res.status(400).json({ success: false, message: 'client_change_id debe ser UUID v4' });
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

  const db = getDb();

  try {
    const doUpdate = db.transaction(() => {
      // Deduplicación
      if (ccid) {
        const dup = db.prepare(
          `SELECT valor_nuevo FROM audit_events
           WHERE audit_session_id = ? AND client_change_id = ? LIMIT 1`
        ).get(session.id, ccid);
        if (dup) return { deduped: true, estado: dup.valor_nuevo };
      }

      // Valor anterior desde último evento en SQLite
      const prevEvent = db.prepare(
        `SELECT valor_nuevo FROM audit_events
         WHERE inventario_id = ? ORDER BY ts DESC LIMIT 1`
      ).get(id);
      const valor_anterior = prevEvent?.valor_nuevo || 'Sin asignar';

      db.prepare(
        `INSERT INTO audit_events
           (audit_session_id, inventario_id, campo, valor_anterior, valor_nuevo,
            observaciones, metadata, client_change_id, item_folio, item_descripcion)
         VALUES (?, ?, 'estado', ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        session.id,
        id,
        valor_anterior,
        estado,
        observaciones || null,
        meta ? JSON.stringify(meta) : null,
        ccid,
        item_folio       || null,
        item_descripcion || null,
      );

      // Upsert estado actual del bien
      db.prepare(
        `INSERT INTO item_estados (inventario_id, estado, audit_session_id, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(inventario_id) DO UPDATE SET
           estado = excluded.estado,
           audit_session_id = excluded.audit_session_id,
           updated_at = excluded.updated_at`
      ).run(id, estado, session.id);

      return { deduped: false, valor_anterior };
    });

    const result = doUpdate();

    if (result.deduped) {
      return res.json({ success: true, estado: result.estado, deduped: true });
    }

    if (result.valor_anterior !== estado) {
      try {
        sseService.broadcast('inventory_updated', {
          action: 'audit_estado',
          id: parseInt(id, 10),
          estado,
          session_id: session.id,
        });
      } catch (e) { console.error('[SSE] broadcast falló:', e.message); }
    }

    return res.json({ success: true, estado, no_change: result.valor_anterior === estado });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.json({ success: true, estado, deduped: true });
    }
    console.error('[Audit] updateEstado:', err.message);
    return res.status(500).json({ success: false, message: 'Error actualizando estado' });
  }
}

// ── Endpoints admin ──────────────────────────────────────────

async function createSesion(req, res) {
  const { intern_name, ures_codes } = req.body || {};
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

  let uresCodesJson = null;
  if (Array.isArray(ures_codes) && ures_codes.length) {
    uresCodesJson = JSON.stringify(ures_codes.map(String));
  } else if (typeof ures_codes === 'string' && ures_codes.trim()) {
    try { JSON.parse(ures_codes); uresCodesJson = ures_codes; } catch { /* ignore */ }
  }

  const umichJsession = req.cookies?.JSESSIONID || req.cookies?.auth_token || null;
  const plain = crypto.randomUUID();
  const hash  = hashToken(plain);
  const created_by = req.user?.usuario || req.user?.username || req.body?.admin_username || 'admin';

  try {
    const db = getDb();
    const stmt = db.prepare(
      `INSERT INTO audit_sessions
         (token_hash, token_plain, intern_name, created_by, expires_at,
          expires_in_hours, ures_codes, umich_jsession)
       VALUES (?, ?, ?, ?, datetime('now', (? || ' hours')), ?, ?, ?)`
    );
    const result = stmt.run(
      hash, plain, String(intern_name).trim(), created_by,
      String(hours), hours, uresCodesJson, umichJsession
    );
    const inserted = db.prepare('SELECT id, expires_at FROM audit_sessions WHERE id = ?')
      .get(result.lastInsertRowid);

    const baseUrl = resolveBaseUrl(req);
    const link = `${baseUrl}/auditoria/${plain}`;

    return res.status(201).json({
      success: true,
      id: inserted.id,
      link,
      intern_name: String(intern_name).trim(),
      expires_in_hours: hours,
      expires_at: inserted.expires_at,
    });
  } catch (err) {
    console.error('[Audit] createSesion:', err.message);
    return res.status(500).json({ success: false, message: 'Error al crear sesión: ' + err.message });
  }
}

async function getSesiones(req, res) {
  try {
    const db = getDb();
    const adminUser = req.user?.usuario || req.user?.username || req.query?.admin_username || null;
    const rows = db.prepare(`
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
        s.ures_codes,
        (s.revoked_at IS NOT NULL)                            AS revocada,
        (s.expires_at <= datetime('now') AND s.revoked_at IS NULL) AS expirada,
        COUNT(DISTINCT ae.inventario_id)                      AS items_revisados
      FROM audit_sessions s
      LEFT JOIN audit_events ae ON ae.audit_session_id = s.id
      WHERE s.created_by = ?
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `).all(adminUser);

    let total_items = 0;
    const source = inventarioService.getDataSource();

    if (source === 'api') {
      const uresParam = req.query.ures;
      if (uresParam) {
        const codes = String(uresParam).split(',').map(s => s.trim()).filter(Boolean);
        try {
          const result = await inventarioService.getAllInventariosInternos(
            1, 1, { ures: codes.join(',') }, null
          );
          total_items = result.total || 0;
        } catch { /* leave 0 */ }
      }
    } else {
      try {
        const result = await inventarioService.getAllInventariosInternos(1, 1, {});
        total_items = result.total || 0;
      } catch { /* leave 0 */ }
    }

    const sesiones = rows.map(s => ({
      ...s,
      has_credentials: !!s.has_credentials,
      revocada:        !!s.revocada,
      expirada:        !!s.expirada,
      items_revisados: s.items_revisados || 0,
      total_items,
      porcentaje: total_items > 0
        ? Math.round(((s.items_revisados || 0) / total_items) * 100)
        : 0,
    }));

    return res.json({ success: true, data: sesiones, total_items });
  } catch (err) {
    console.error('[Audit] getSesiones:', err.message);
    return res.status(500).json({ success: false, message: 'Error obteniendo sesiones' });
  }
}

async function getSesionAccess(req, res) {
  const { id } = req.params;
  const db = getDb();
  const row = db.prepare(
    `SELECT id, intern_name, expires_at, expires_in_hours, revoked_at, created_at, token_plain
     FROM audit_sessions WHERE id = ?`
  ).get(id);
  if (!row) {
    return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
  }
  const baseUrl = resolveBaseUrl(req);
  const link = row.token_plain ? `${baseUrl}/auditoria/${row.token_plain}` : null;
  return res.json({ success: true, data: { ...row, link } });
}

async function regenerateCredentials(req, res) {
  const { id } = req.params;
  const db = getDb();

  const baseRow = db.prepare(
    'SELECT id, expires_in_hours, revoked_at FROM audit_sessions WHERE id = ?'
  ).get(id);
  if (!baseRow) {
    return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
  }
  if (baseRow.revoked_at) {
    return res.status(400).json({ success: false, message: 'Sesión revocada, crea una nueva' });
  }

  const hours = Math.min(24, Math.max(1, baseRow.expires_in_hours || 8));
  const plain = crypto.randomUUID();
  const hash  = hashToken(plain);

  // Capturar el JSESSIONID actual del admin al regenerar
  const umichJsession = req.cookies?.JSESSIONID || req.cookies?.auth_token || null;

  db.prepare(
    `UPDATE audit_sessions
     SET token_hash = ?, token_plain = ?,
         expires_at = datetime('now', (? || ' hours')),
         expires_in_hours = ?,
         last_activity_at = NULL, last_seen_at = NULL,
         umich_jsession = ?
     WHERE id = ?`
  ).run(hash, plain, String(hours), hours, umichJsession, id);

  const baseUrl = resolveBaseUrl(req);
  const link = `${baseUrl}/auditoria/${plain}`;

  // Fetch updated expires_at
  const updated = db.prepare('SELECT expires_at FROM audit_sessions WHERE id = ?').get(id);

  return res.json({ success: true, link, expires_in_hours: hours, expires_at: updated?.expires_at });
}

async function refreshJsession(req, res) {
  const { id } = req.params;
  const db = getDb();

  const row = db.prepare('SELECT id, revoked_at FROM audit_sessions WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ success: false, message: 'Sesión no encontrada' });
  if (row.revoked_at) return res.status(400).json({ success: false, message: 'Sesión revocada' });

  const umichJsession = req.cookies?.JSESSIONID || req.cookies?.auth_token || null;
  if (!umichJsession) return res.status(400).json({ success: false, message: 'No hay sesión UMICH activa en tu navegador' });

  db.prepare('UPDATE audit_sessions SET umich_jsession = ? WHERE id = ?').run(umichJsession, id);
  return res.json({ success: true, message: 'Sesión UMICH actualizada' });
}

async function revokeSesion(req, res) {
  const { id } = req.params;
  const db = getDb();
  const result = db.prepare(
    `UPDATE audit_sessions SET revoked_at = datetime('now')
     WHERE id = ? AND revoked_at IS NULL`
  ).run(id);
  if (!result.changes) {
    return res.status(404).json({ success: false, message: 'Sesión no encontrada o ya revocada' });
  }
  return res.json({ success: true, message: 'Sesión revocada' });
}

async function getSesionEventos(req, res) {
  const { id } = req.params;
  try {
    const db = getDb();
    const rows = db.prepare(
      `SELECT
         ae.id,
         ae.inventario_id,
         ae.item_folio       AS folio,
         ae.item_descripcion AS descripcion,
         ae.campo,
         ae.valor_anterior,
         ae.valor_nuevo,
         ae.observaciones,
         ae.metadata,
         ae.ts
       FROM audit_events ae
       WHERE ae.audit_session_id = ?
       ORDER BY ae.ts DESC`
    ).all(id);
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
  refreshJsession,
  revokeSesion,
  getSesionEventos,
};
