const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'invpatrimonio',
  user: 'postgres',
  password: 'postgres'
});

(async () => {
  try {
    console.log('📊 Verificando estructura de tabla inventario...\n');
    
    // Consultar columnas con límites de caracteres
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'inventario' 
      AND character_maximum_length IS NOT NULL
      ORDER BY ordinal_position
    `);
    
    console.log('Columnas con límite de caracteres:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}(${row.character_maximum_length})`);
    });
    
    console.log('\n==========================================\n');
    
    // Consultar todas las columnas para ver la estructura completa
    const allColumns = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'inventario' 
      ORDER BY ordinal_position
    `);
    
    console.log('Estructura completa de la tabla:');
    allColumns.rows.forEach(row => {
      const maxLength = row.character_maximum_length ? `(${row.character_maximum_length})` : '';
      const nullable = row.is_nullable === 'YES' ? ' NULL' : ' NOT NULL';
      console.log(`  ${row.column_name}: ${row.data_type}${maxLength}${nullable}`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error('Código de error:', error.code);
    }
  }
})();