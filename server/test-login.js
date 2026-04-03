// Script temporal para verificar el login
const bcrypt = require('bcrypt');
const { pool } = require('./src/config/database');

async function testLogin() {
  try {
    console.log('🔍 Verificando tabla usuarios...');
    
    // Ver todos los usuarios
    const allUsers = await pool.query('SELECT id, usuario, rol, ures FROM usuarios');
    console.log('📋 Usuarios en la base de datos:');
    console.log(allUsers.rows);
    
    console.log('\n🔐 Probando login con admin/admin123...');
    
    // Buscar usuario admin
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE usuario = $1',
      ['admin']
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Usuario admin NO EXISTE en la base de datos');
      console.log('\n💡 Ejecuta este SQL para crearlo:');
      console.log(`
INSERT INTO usuarios (usuario, contrasena, rol, ures) 
VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5NU3KL9RgQMpO', 'administrador', '0');
      `);
      process.exit(1);
    }
    
    const user = result.rows[0];
    console.log('✅ Usuario encontrado:', {
      id: user.id,
      usuario: user.usuario,
      rol: user.rol,
      ures: user.ures,
      activo: user.activo
    });
    
    // Verificar contraseña
    const isValid = await bcrypt.compare('admin123', user.contrasena);
    
    if (isValid) {
      console.log('✅ CONTRASEÑA VÁLIDA - Login debería funcionar');
    } else {
      console.log('❌ CONTRASEÑA INVÁLIDA');
      console.log('Hash en BD:', user.contrasena);
      
      // Generar nuevo hash
      const newHash = await bcrypt.hash('admin123', 12);
      console.log('\n💡 Usa este SQL para actualizar la contraseña:');
      console.log(`
UPDATE usuarios 
SET contrasena = '${newHash}' 
WHERE usuario = 'admin';
      `);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testLogin();
