// =====================================================
// SCRIPT DE PREPARACIÓN Y LIMPIEZA BD
// 🧹 Prepara la BD para generación masiva
// =====================================================

const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'patrimonio_db',
  password: 'postgres',
  port: 5432,
});

async function cleanAndPrepare() {
  console.log('🧹 PREPARACIÓN DE BASE DE DATOS');
  console.log('=' * 50);
  
  try {
    // Verificar conexión
    await pool.query('SELECT 1');
    console.log('✅ Conexión establecida');
    
    // Obtener información actual
    const countResult = await pool.query('SELECT COUNT(*) as count FROM inventario');
    const currentCount = parseInt(countResult.rows[0].count);
    console.log(`📊 Registros actuales: ${currentCount.toLocaleString()}`);
    
    if (currentCount > 0) {
      console.log('\n❓ ¿Deseas limpiar la tabla? (Escribe "CONFIRMAR" para proceder)');
      
      // En un entorno real, usarías readline, pero para simplificar:
      const confirm = process.argv[2];
      if (confirm === 'CONFIRMAR') {
        console.log('🗑️  Eliminando registros existentes...');
        await pool.query('TRUNCATE TABLE inventario RESTART IDENTITY CASCADE');
        console.log('✅ Tabla limpiada');
      } else {
        console.log('ℹ️  Conservando datos existentes');
      }
    }
    
    // Optimizar configuración para inserción masiva
    console.log('\n⚡ Optimizando configuración...');
    
    // Configuraciones temporales para mejor rendimiento
    const optimizations = [
      "SET maintenance_work_mem = '1GB'",
      "SET checkpoint_completion_target = 0.9", 
      "SET wal_buffers = '16MB'",
      "SET synchronous_commit = off",
      "SET fsync = off", // ⚠️ Solo para carga masiva
      "SET random_page_cost = 1.0"
    ];
    
    for (const config of optimizations) {
      await pool.query(config);
      console.log(`   ✓ ${config.split('=')[0].trim()}`);
    }
    
    // Crear índices optimizados para búsqueda (después de carga)
    console.log('\n📝 Verificando estructura de índices...');
    
    const indexes = [
      {
        name: 'idx_inventario_folio',
        sql: 'CREATE INDEX IF NOT EXISTS idx_inventario_folio ON inventario(folio)'
      },
      {
        name: 'idx_inventario_tipo',
        sql: 'CREATE INDEX IF NOT EXISTS idx_inventario_tipo ON inventario(tipo_inventario)'
      },
      {
        name: 'idx_inventario_marca_modelo',
        sql: 'CREATE INDEX IF NOT EXISTS idx_inventario_marca_modelo ON inventario(marca, modelo)'
      },
      {
        name: 'idx_inventario_ubicacion',
        sql: 'CREATE INDEX IF NOT EXISTS idx_inventario_ubicacion ON inventario(ubicacion)'
      },
      {
        name: 'idx_inventario_fecha_adquisicion',
        sql: 'CREATE INDEX IF NOT EXISTS idx_inventario_fecha_adquisicion ON inventario(fecha_adquisicion)'
      }
    ];
    
    // Eliminar índices temporalmente para mejorar velocidad de inserción
    console.log('   🔄 Eliminando índices temporalmente...');
    for (const index of indexes) {
      try {
        await pool.query(`DROP INDEX IF EXISTS ${index.name}`);
        console.log(`   ✓ Eliminado ${index.name}`);
      } catch (error) {
        console.log(`   ⚠️  Error eliminando ${index.name}: ${error.message}`);
      }
    }
    
    // Información de espacio disponible
    const spaceQuery = `
      SELECT 
        pg_size_pretty(pg_total_relation_size('inventario')) as current_size,
        pg_database_size('patrimonio_db') as db_size_bytes
    `;
    const spaceResult = await pool.query(spaceQuery);
    
    console.log('\n💾 INFORMACIÓN DE ESPACIO:');
    console.log(`   Tabla actual: ${spaceResult.rows[0].current_size}`);
    console.log(`   BD total: ${(spaceResult.rows[0].db_size_bytes / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`   Estimado 50M: ~25-30 GB`);
    
    console.log('\n✅ PREPARACIÓN COMPLETADA');
    console.log('🚀 Listo para generar 50M registros');
    console.log('\n💡 Para iniciar generación: node generate_mass_data.js');
    console.log('💡 Para monitoreo: node monitor_db.js');
    
  } catch (error) {
    console.error('❌ Error durante preparación:', error);
  } finally {
    await pool.end();
  }
}

// Función para recrear índices después de carga
async function recreateIndexes() {
  console.log('🔧 RECREANDO ÍNDICES...');
  
  try {
    await pool.query('SELECT 1');
    
    const indexes = [
      'CREATE INDEX idx_inventario_folio ON inventario(folio)',
      'CREATE INDEX idx_inventario_tipo ON inventario(tipo_inventario)', 
      'CREATE INDEX idx_inventario_marca_modelo ON inventario(marca, modelo)',
      'CREATE INDEX idx_inventario_ubicacion ON inventario(ubicacion)',
      'CREATE INDEX idx_inventario_fecha_adquisicion ON inventario(fecha_adquisicion)'
    ];
    
    for (const indexSQL of indexes) {
      const startTime = Date.now();
      await pool.query(indexSQL);
      const duration = Date.now() - startTime;
      console.log(`   ✅ ${indexSQL.split(' ')[2]} (${duration}ms)`);
    }
    
    // Analizar tabla para optimizar consultas
    console.log('📊 Analizando tabla...');
    await pool.query('ANALYZE inventario');
    
    console.log('✅ Índices recreados');
    
  } catch (error) {
    console.error('❌ Error recreando índices:', error);
  } finally {
    await pool.end();
  }
}

// Ejecutar según parámetro
if (require.main === module) {
  const action = process.argv[2];
  
  if (action === 'indexes') {
    recreateIndexes();
  } else {
    cleanAndPrepare();
  }
}

module.exports = { cleanAndPrepare, recreateIndexes };