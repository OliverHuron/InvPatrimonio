const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'patrimonio_db',
  user: 'postgres',
  password: '1234'
});

async function resetAdmin() {
  try {
    const password = 'admin123';
    const hash = await bcrypt.hash(password, 10);
    
    console.log('🔐 Generando hash para password:', password);
    console.log('📝 Hash:', hash);
    
    // Verificar si el usuario admin existe
    const checkUser = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    
    if (checkUser.rows.length === 0) {
      console.log('❌ Usuario admin no existe. Creándolo...');
      await pool.query(`
        INSERT INTO users (username, email, password_hash, full_name, role, department, position) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, ['admin', 'admin@siaf.edu', hash, 'Administrador SIAF', 'admin', 'Infraestructura Informática', 'Administrador del Sistema']);
      console.log('✅ Usuario admin creado exitosamente');
    } else {
      console.log('✅ Usuario admin existe. Actualizando contraseña...');
      await pool.query('UPDATE users SET password_hash = $1 WHERE username = $2', [hash, 'admin']);
      console.log('✅ Contraseña actualizada exitosamente');
    }
    
    // Verificar
    const result = await pool.query('SELECT username, email, role FROM users WHERE username = $1', ['admin']);
    console.log('\n📊 Usuario admin:');
    console.log(result.rows[0]);
    console.log('\n🔑 Credenciales de acceso:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resetAdmin();
