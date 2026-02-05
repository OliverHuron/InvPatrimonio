const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { validationResult } = require('express-validator');

class AuthController {
  // Login de usuario
  static async login(req, res) {
    try {
      // Validar errores de entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array()
        });
      }

      const { username, password } = req.body;

      // Buscar usuario por username o email
      const userQuery = `
        SELECT id, username, email, password_hash, full_name, role, department, position, is_active
        FROM users 
        WHERE (username = $1 OR email = $1) AND is_active = true
      `;
      const userResult = await pool.query(userQuery, [username]);

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales incorrectas'
        });
      }

      const user = userResult.rows[0];

      // Verificar contraseña
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales incorrectas'
        });
      }

      // Generar JWT token
      const token = jwt.sign(
        { 
          userId: user.id,
          username: user.username,
          email: user.email,
          role: user.role 
        },
        process.env.JWT_SECRET,
        { 
          expiresIn: process.env.JWT_EXPIRES_IN || '24h',
          issuer: 'InvPatrimonio-SIAF'
        }
      );

      // Actualizar last_login
      await pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      // Preparar datos del usuario (sin contraseña)
      const userData = {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        department: user.department,
        position: user.position
      };

      res.json({
        success: true,
        message: 'Login exitoso',
        data: {
          user: userData,
          token,
          expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        }
      });

    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Registro de nuevo usuario (solo admin)
  static async register(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array()
        });
      }

      const { username, email, password, fullName, role = 'user', department, position } = req.body;

      // Verificar si el usuario o email ya existen
      const existingUserQuery = 'SELECT id FROM users WHERE username = $1 OR email = $2';
      const existingUser = await pool.query(existingUserQuery, [username, email]);

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'El usuario o email ya existe'
        });
      }

      // Hashear contraseña
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Crear nuevo usuario
      const insertQuery = `
        INSERT INTO users (username, email, password_hash, full_name, role, department, position)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, username, email, full_name, role, department, position, created_at
      `;
      
      const newUser = await pool.query(insertQuery, [
        username, email, passwordHash, fullName, role, department, position
      ]);

      res.status(201).json({
        success: true,
        message: 'Usuario creado exitosamente',
        data: newUser.rows[0]
      });

    } catch (error) {
      console.error('Error en registro:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener perfil del usuario actual
  static async getProfile(req, res) {
    try {
      const userId = req.user.userId;

      const userQuery = `
        SELECT id, username, email, full_name, role, department, position, last_login, created_at
        FROM users 
        WHERE id = $1 AND is_active = true
      `;
      
      const userResult = await pool.query(userQuery, [userId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      const userData = {
        id: userResult.rows[0].id,
        username: userResult.rows[0].username,
        email: userResult.rows[0].email,
        fullName: userResult.rows[0].full_name,
        role: userResult.rows[0].role,
        department: userResult.rows[0].department,
        position: userResult.rows[0].position,
        lastLogin: userResult.rows[0].last_login,
        createdAt: userResult.rows[0].created_at
      };

      res.json({
        success: true,
        data: userData
      });

    } catch (error) {
      console.error('Error obteniendo perfil:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Cambiar contraseña
  static async changePassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array()
        });
      }

      const userId = req.user.userId;
      const { currentPassword, newPassword } = req.body;

      // Obtener contraseña actual del usuario
      const userQuery = 'SELECT password_hash FROM users WHERE id = $1 AND is_active = true';
      const userResult = await pool.query(userQuery, [userId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Verificar contraseña actual
      const isValidCurrentPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
      
      if (!isValidCurrentPassword) {
        return res.status(401).json({
          success: false,
          message: 'Contraseña actual incorrecta'
        });
      }

      // Hashear nueva contraseña
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Actualizar contraseña
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newPasswordHash, userId]
      );

      res.json({
        success: true,
        message: 'Contraseña actualizada exitosamente'
      });

    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Logout (invalidar token - opcional, depende de implementación)
  static async logout(req, res) {
    try {
      // En implementaciones más avanzadas, aquí se podría invalidar el token
      // agregándolo a una blacklist en Redis o similar
      
      res.json({
        success: true,
        message: 'Logout exitoso'
      });

    } catch (error) {
      console.error('Error en logout:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Verificar si el token es válido
  static async verifyToken(req, res) {
    try {
      const userId = req.user.userId;

      // Verificar que el usuario siga activo
      const userQuery = 'SELECT id, username, role FROM users WHERE id = $1 AND is_active = true';
      const userResult = await pool.query(userQuery, [userId]);

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Token inválido o usuario inactivo'
        });
      }

      res.json({
        success: true,
        message: 'Token válido',
        data: {
          userId: userResult.rows[0].id,
          username: userResult.rows[0].username,
          role: userResult.rows[0].role
        }
      });

    } catch (error) {
      console.error('Error verificando token:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = AuthController;