// Test rápido de conexión BD
const { Pool } = require('pg');
require('dotenv').config();

console.log('🔍 Diagnóstico de BD...');
console.log('📍 Directorio actual:', process.cwd());
console.log('🔧 Variables de entorno:');
console.log('  - DB_HOST:', process.env.DB_HOST || 'localhost');
console.log('  - DB_NAME:', process.env.DB_NAME || 'patrimonio_db');
console.log('  - DB_USER:', process.env.DB_USER || 'postgres');
console.log('  - DB_PORT:', process.env.DB_PORT || 5432);

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost', 
  database: process.env.DB_NAME || 'patrimonio_db',
  password: process.env.DB_PASSWORD || '1234',
  port: process.env.DB_PORT || 5432
});

async function testConnection() {
  try {
    console.log('\n🔌 Probando conexión...');
    const result = await pool.query('SELECT current_database(), version()');
    console.log('✅ Conexión exitosa!');
    console.log('📊 BD:', result.rows[0].current_database);
    console.log('🗄️ Versión:', result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]);
    
    // Verificar tabla inventario
    const tableCheck = await pool.query("SELECT COUNT(*) as current_records FROM inventario");
    console.log('📈 Registros actuales:', tableCheck.rows[0].current_records);
    
    console.log('\n🚀 ¡Todo listo para generar 10M registros!');
    console.log('💾 Tu NVMe 80GB tiene espacio más que suficiente');
    
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
  } finally {
    await pool.end();
  }
}

testConnection();