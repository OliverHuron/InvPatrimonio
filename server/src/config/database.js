const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'invpatrimonio',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

console.log('Configuracion de DB:', {
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.user,
  ssl: !!dbConfig.ssl
});

// Pool de conexiones
const pool = new Pool(dbConfig);

// Función para inicializar la base de datos
async function initializeDatabase() {
  try {
    const client = await pool.connect();
    await client.query('SET search_path TO public');
    const result = await client.query('SELECT NOW()');
    console.log('Conexion a PostgreSQL exitosa:', result.rows[0].now);

    const migrationPath = path.join(__dirname, '..', '..', 'database', 'migrations', '001_schema_unificada.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await client.query(sql);
      console.log('Migracion unificada aplicada/verificada');
    } else {
      console.warn('No se encontro 001_schema_unificada.sql, se omite auto-migracion');
    }

    client.release();
  } catch (error) {
    console.error('Error conectando a PostgreSQL:', error);
    throw error;
  }
}

// Función para obtener cliente de la base de datos
function getDbClient() {
  return pool;
}

// Función para cerrar pool
async function closeDatabase() {
  await pool.end();
}

module.exports = {
  pool,
  initializeDatabase,
  getDbClient,
  closeDatabase
};
