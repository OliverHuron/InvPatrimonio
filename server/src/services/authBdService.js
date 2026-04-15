// =====================================================
// SERVICIO DE AUTENTICACIÓN - BASE DE DATOS LOCAL
// =====================================================

const { pool } = require('../config/database');
const bcrypt = require('bcrypt');

/**
 * Autenticar usuario con BD local
 */
const loginLocal = async (usuario, contrasena) => {
  try {
    // Buscar usuario
    const result = await pool.query(
      'SELECT * FROM public.usuarios WHERE usuario = $1 AND activo = true',
      [usuario]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    
    const user = result.rows[0];
    
    // Verificar contraseña
    const isValid = await bcrypt.compare(contrasena, user.contrasena);
    
    if (!isValid) {
      throw new Error('Contraseña incorrecta');
    }
    
    // Actualizar último acceso
    await pool.query(
      'UPDATE public.usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );
    
    // Retornar datos del usuario (sin contraseña)
    return {
      id: user.id,
      usuario: user.usuario,
      rol: user.rol,
      ures: user.ures,
      activo: user.activo
    };
  } catch (error) {
    console.error('[Auth BD] Error en login:', error.message);
    throw error;
  }
};

/**
 * Crear nuevo usuario
 */
const createUser = async (data) => {
  try {
    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(data.contrasena, 12);
    
    const query = `
      INSERT INTO public.usuarios (usuario, contrasena, rol, ures)
      VALUES ($1, $2, $3, $4)
      RETURNING id, usuario, rol, ures, activo
    `;
    
    const values = [
      data.usuario,
      hashedPassword,
      data.rol || 'usuario',
      data.ures
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[Auth BD] Error creando usuario:', error.message);
    throw error;
  }
};

/**
 * Verificar si existe un usuario
 */
const userExists = async (usuario) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM public.usuarios WHERE usuario = $1',
      [usuario]
    );
    
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    console.error('[Auth BD] Error verificando usuario:', error.message);
    throw error;
  }
};

/**
 * Cambiar contraseña
 */
const changePassword = async (usuario, nuevaContrasena) => {
  try {
    const hashedPassword = await bcrypt.hash(nuevaContrasena, 12);
    
    await pool.query(
      'UPDATE public.usuarios SET contrasena = $1 WHERE usuario = $2',
      [hashedPassword, usuario]
    );
    
    return true;
  } catch (error) {
    console.error('[Auth BD] Error cambiando contraseña:', error.message);
    throw error;
  }
};

module.exports = {
  loginLocal,
  createUser,
  userExists,
  changePassword
};

/**
 * Obtener usuario (sin contraseña) por nombre de usuario
 */
const getUserByUsername = async (usuario) => {
  try {
    const result = await pool.query(
      'SELECT id, usuario, rol, ures, activo FROM public.usuarios WHERE usuario = $1',
      [usuario]
    );

    if (result.rows.length === 0) return null;
    const u = result.rows[0];
    return { id: u.id, usuario: u.usuario, rol: u.rol, ures: u.ures, activo: u.activo };
  } catch (error) {
    console.error('[Auth BD] Error obteniendo usuario:', error.message);
    throw error;
  }
};

module.exports.getUserByUsername = getUserByUsername;
