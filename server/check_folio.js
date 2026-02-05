const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
})

async function checkFolio() {
  try {
    const res = await pool.query(
      `SELECT id, folio, marca, modelo, imagenes 
       FROM inventario 
       WHERE folio = '2026-01000001'`
    )
    
    console.log('Registro encontrado:', res.rows[0])
    
    if (res.rows[0]) {
      console.log('\n=== Imágenes guardadas ===')
      console.log(JSON.stringify(res.rows[0].imagenes, null, 2))
      
      if (Array.isArray(res.rows[0].imagenes)) {
        console.log(`\nTotal imágenes: ${res.rows[0].imagenes.length}`)
        res.rows[0].imagenes.forEach((img, idx) => {
          console.log(`  ${idx + 1}. ${img}`)
        })
      }
    } else {
      console.log('No se encontró el registro con ese folio')
    }
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await pool.end()
  }
}

checkFolio()
