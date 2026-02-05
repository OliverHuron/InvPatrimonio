const express = require('express');
const { body } = require('express-validator');
const AuthController = require('../controllers/authController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Validaciones para login
const loginValidation = [
  body('username')
    .notEmpty()
    .withMessage('Username o email es requerido')
    .trim()
    .escape(),
  body('password')
    .notEmpty()
    .withMessage('Contraseña es requerida')
    .isLength({ min: 1 })
    .withMessage('Contraseña no puede estar vacía')
];

// Validaciones para registro
const registerValidation = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username debe tener entre 3 y 50 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username solo puede contener letras, números y guiones bajos')
    .trim()
    .escape(),
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail()
    .trim(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Contraseña debe tener al menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Contraseña debe contener al menos una minúscula, una mayúscula y un número'),
  body('fullName')
    .isLength({ min: 2, max: 100 })
    .withMessage('Nombre completo debe tener entre 2 y 100 caracteres')
    .trim()
    .escape(),
  body('role')
    .optional()
    .isIn(['admin', 'user', 'viewer'])
    .withMessage('Rol inválido'),
  body('department')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Departamento no puede exceder 100 caracteres')
    .trim()
    .escape(),
  body('position')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Posición no puede exceder 100 caracteres')
    .trim()
    .escape()
];

// Validaciones para cambio de contraseña
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Contraseña actual es requerida'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Nueva contraseña debe tener al menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Nueva contraseña debe contener al menos una minúscula, una mayúscula y un número')
];

// ===== RUTAS PÚBLICAS =====

// POST /auth/login - Login de usuario
router.post('/login', loginValidation, AuthController.login);

// ===== RUTAS PROTEGIDAS =====

// POST /auth/register - Registro de usuario (solo admin)
router.post('/register', authenticateToken, requireAdmin, registerValidation, AuthController.register);

// GET /auth/profile - Obtener perfil del usuario actual
router.get('/profile', authenticateToken, AuthController.getProfile);

// PUT /auth/change-password - Cambiar contraseña
router.put('/change-password', authenticateToken, changePasswordValidation, AuthController.changePassword);

// POST /auth/logout - Logout
router.post('/logout', authenticateToken, AuthController.logout);

// GET /auth/verify - Verificar token válido
router.get('/verify', authenticateToken, AuthController.verifyToken);

// ===== RUTAS DE INFORMACIÓN =====

// GET /auth/status - Estado del servicio de autenticación
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'Servicio de autenticación funcionando',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;