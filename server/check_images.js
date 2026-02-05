const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'patrimonio_db',
  user: 'postgres',
  password: '1234'
});

async function checkImages() {
  try {
    const result = await pool.query(`
      SELECT id, folio, marca, modelo, imagenes 
      FROM inventario 
      WHERE imagenes IS NOT NULL 
      ORDER BY id DESC 
      LIMIT 10
    `);
    
    console.log('📋 Registros con imágenes:\n');
    
    if (result.rows.length === 0) {
      console.log('❌ No hay registros con imágenes guardadas');
    } else {
      result.rows.forEach(row => {
        const imgs = row.imagenes || [];
        console.log(`  ID ${row.id}: ${row.marca || 'Sin marca'} ${row.modelo || 'Sin modelo'}`);
        console.log(`    Folio: ${row.folio || 'Sin folio'}`);
        console.log(`    Imágenes (${Array.isArray(imgs) ? imgs.length : 0}):`);
        if (imgs.length > 0) {
          imgs.forEach((img, idx) => console.log(`      ${idx + 1}. ${img}`));
        }
        console.log('');
      });
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkImages();
