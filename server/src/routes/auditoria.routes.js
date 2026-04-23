// =====================================================
// RUTAS: Auditoría de Campo
// Públicas  → /api/auditoria/:token/*    (token UUID)
// Admin     → /api/auditoria/sesiones/*  (cookie de sesión)
// =====================================================

const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const router = express.Router();
const auditController = require('../controllers/auditController');

const JWT_SECRET = process.env.JWT_SECRET || 'tu_super_secreto_cambialo_en_produccion';

// Middleware de admin que funciona en AMBOS modos (BD con JWT y API con JSESSIONID)
function requireAdmin(req, res, next) {
  const cookie = req.cookies?.auth_token || req.cookies?.JSESSIONID;
  if (!cookie) {
    return res.status(401).json({ success: false, message: 'No autenticado' });
  }

  const authSource = (process.env.INVENTARIO_AUTH_SOURCE || process.env.INVENTARIO_DATA_SOURCE || 'bd').toLowerCase();

  if (authSource === 'bd') {
    // Modo BD: verificar JWT
    try {
      req.user = jwt.verify(cookie, JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Sesión inválida o expirada' });
    }
  } else {
    // Modo API: solo verificar que la cookie existe (JSESSIONID = sesión activa)
    req.user = { usuario: 'admin' };
  }

  next();
}

// Rate limit para escrituras (PATCH estado)
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, message: 'Demasiadas peticiones, espera un momento' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit estricto para login público (anti fuerza bruta)
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, message: 'Demasiados intentos de login, espera un minuto' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Rutas ADMIN ────────────────────────────────────────────

router.post('/sesiones',                requireAdmin, auditController.createSesion);
router.get('/sesiones',                 requireAdmin, auditController.getSesiones);
router.get('/sesiones/:id/access',      requireAdmin, auditController.getSesionAccess);
router.post('/sesiones/:id/regenerate', requireAdmin, auditController.regenerateCredentials);
router.get('/sesiones/:id/eventos',     requireAdmin, auditController.getSesionEventos);
router.delete('/sesiones/:id',          requireAdmin, auditController.revokeSesion);

// ── Rutas PÚBLICAS del practicante (token + cookie audit_access) ─────

// Login y logout solo requieren token (no cookie)
router.post('/:token/login',  loginLimiter, auditController.requireAuditTokenOnly, auditController.loginPublic);
router.post('/:token/logout',               auditController.requireAuditTokenOnly, auditController.logoutPublic);

router.get('/:token',                  auditController.requireAuditToken, auditController.getSession);
router.get('/:token/items',            auditController.requireAuditToken, auditController.getItems);
router.patch(
  '/:token/items/:id/estado',
  writeLimiter,
  auditController.requireAuditToken,
  auditController.updateEstado
);

module.exports = router;

