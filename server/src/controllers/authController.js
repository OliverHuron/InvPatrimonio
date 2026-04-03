// =====================================================
// CONTROLADOR DE AUTENTICACIÓN - MODO BD
// Genera JWT con httpOnly cookies
// =====================================================

const jwt = require('jsonwebtoken');
const authBdService = require('../services/authBdService');

const JWT_SECRET = process.env.JWT_SECRET || 'tu_super_secreto_cambialo_en_produccion';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Login con BD - Genera JWT httpOnly cookie
 */
const loginBd = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Autenticar con BD
    const user = await authBdService.loginLocal(username, password);
    
    // Generar JWT
    const token = jwt.sign(
      {
        id: user.id,
        usuario: user.usuario,
        rol: user.rol,
        ures: user.ures
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    // Establecer cookie httpOnly
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 horas
    });
    
    console.log('[Auth BD] Login exitoso:', user.usuario);
    
    return res.json({
      success: true,
      message: 'Login exitoso',
      user: {
        id: user.id,
        username: user.usuario,
        rol: user.rol,
        ures: user.ures
      },
      source: 'bd'
    });
  } catch (error) {
    console.error('[Auth BD] Error en login:', error.message);
    return res.status(401).json({
      success: false,
      message: error.message || 'Credenciales inválidas'
    });
  }
};

/**
 * Logout - Limpia cookie
 */
const logoutBd = async (req, res) => {
  try {
    res.clearCookie('auth_token');
    
    return res.json({
      success: true,
      message: 'Logout exitoso'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error en logout'
    });
  }
};

/**
 * Verificar token - Middleware
 */
const verifyToken = (req, res, next) => {
  try {
    const token = req.cookies.auth_token;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado'
      });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido o expirado'
    });
  }
};

/**
 * Obtener perfil actual
 */
const getProfile = async (req, res) => {
  try {
    return res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error obteniendo perfil'
    });
  }
};

module.exports = {
  loginBd,
  logoutBd,
  verifyToken,
  getProfile
};
