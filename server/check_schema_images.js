const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'patrimonio_db',
  user: 'postgres',
  password: '1234'
});

async function checkSchema() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'inventario' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Columnas de la tabla inventario:\n');
    result.rows.forEach(row => {
      const length = row.character_maximum_length ? ` (${row.character_maximum_length})` : '';
      console.log(`  ${row.column_name}: ${row.data_type}${length}`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkSchema();
