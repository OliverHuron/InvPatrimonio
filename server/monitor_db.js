// =====================================================
// MONITOR DE ESPACIO Y RENDIMIENTO BD
// 🔍 Monitoreo en tiempo real durante generación masiva
// =====================================================

const { Pool } = require('pg');
const fs = require('fs');
const os = require('os');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'patrimonio_db',
  password: 'postgres',
  port: 5432,
});

// Función para obtener estadísticas de la base de datos
async function getDatabaseStats() {
  try {
    // Tamaño total de la BD
    const sizeQuery = `
      SELECT 
        pg_size_pretty(pg_database_size('patrimonio_db')) as database_size,
        pg_database_size('patrimonio_db') as size_bytes
    `;
    const sizeResult = await pool.query(sizeQuery);
    
    // Estadísticas de la tabla inventario
    const tableQuery = `
      SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation
      FROM pg_stats 
      WHERE tablename = 'inventario' 
      LIMIT 10
    `;
    
    const countQuery = `
      SELECT 
        COUNT(*) as total_records,
        pg_size_pretty(pg_total_relation_size('inventario')) as table_size,
        pg_total_relation_size('inventario') as table_size_bytes
      FROM inventario
    `;
    const countResult = await pool.query(countQuery);
    
    // Información de índices
    const indexQuery = `
      SELECT 
        indexname,
        pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
      FROM pg_indexes 
      WHERE tablename = 'inventario'
    `;
    const indexResult = await pool.query(indexQuery);
    
    // Actividad de BD
    const activityQuery = `
      SELECT 
        datname,
        numbackends,
        xact_commit,
        xact_rollback,
        blks_read,
        blks_hit,
        tup_returned,
        tup_fetched,
        tup_inserted,
        tup_updated,
        tup_deleted
      FROM pg_stat_database 
      WHERE datname = 'patrimonio_db'
    `;
    const activityResult = await pool.query(activityQuery);
    
    return {
      database: sizeResult.rows[0],
      table: countResult.rows[0],
      indexes: indexResult.rows,
      activity: activityResult.rows[0]
    };
    
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error.message);
    return null;
  }
}

// Función para obtener información del sistema
function getSystemInfo() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  return {
    platform: os.platform(),
    arch: os.arch(),
    cpu: os.cpus()[0].model,
    cores: os.cpus().length,
    totalMemory: (totalMem / 1024 / 1024 / 1024).toFixed(1) + ' GB',
    usedMemory: (usedMem / 1024 / 1024 / 1024).toFixed(1) + ' GB',
    freeMemory: (freeMem / 1024 / 1024 / 1024).toFixed(1) + ' GB',
    memUsage: ((usedMem / totalMem) * 100).toFixed(1) + '%',
    uptime: Math.round(os.uptime() / 3600) + ' horas'
  };
}

// Función para calcular velocidad de inserción
let lastRecordCount = 0;
let lastCheckTime = Date.now();

function calculateInsertRate(currentCount) {
  const currentTime = Date.now();
  const timeDiff = (currentTime - lastCheckTime) / 1000; // segundos
  const recordDiff = currentCount - lastRecordCount;
  
  const rate = timeDiff > 0 ? Math.round(recordDiff / timeDiff) : 0;
  
  lastRecordCount = currentCount;
  lastCheckTime = currentTime;
  
  return rate;
}

// Función principal de monitoreo
async function monitorDatabase() {
  console.clear();
  console.log('🔍 MONITOR DE BASE DE DATOS - PATRIMONIO');
  console.log('=' * 80);
  
  try {
    const stats = await getDatabaseStats();
    const systemInfo = getSystemInfo();
    
    if (!stats) {
      console.log('❌ No se pudieron obtener estadísticas');
      return;
    }
    
    const insertRate = calculateInsertRate(parseInt(stats.table.total_records));
    
    // Información del sistema
    console.log('\n💻 INFORMACIÓN DEL SISTEMA:');
    console.log(`   SO: ${systemInfo.platform} ${systemInfo.arch}`);
    console.log(`   CPU: ${systemInfo.cpu} (${systemInfo.cores} cores)`);
    console.log(`   RAM: ${systemInfo.usedMemory}/${systemInfo.totalMemory} (${systemInfo.memUsage})`);
    console.log(`   Uptime: ${systemInfo.uptime}`);
    
    // Base de datos
    console.log('\n🗄️  BASE DE DATOS:');
    console.log(`   Tamaño total: ${stats.database.database_size}`);
    console.log(`   Tamaño bytes: ${stats.database.size_bytes.toLocaleString()}`);
    
    // Tabla inventario
    console.log('\n📊 TABLA INVENTARIO:');
    console.log(`   Registros: ${parseInt(stats.table.total_records).toLocaleString()}`);
    console.log(`   Tamaño tabla: ${stats.table.table_size}`);
    console.log(`   Tamaño bytes: ${stats.table.table_size_bytes.toLocaleString()}`);
    console.log(`   Velocidad actual: ${insertRate.toLocaleString()} reg/s`);
    
    // Índices
    console.log('\n🔍 ÍNDICES:');
    stats.indexes.forEach(idx => {
      console.log(`   ${idx.indexname}: ${idx.index_size}`);
    });
    
    // Actividad
    console.log('\n⚡ ACTIVIDAD BD:');
    console.log(`   Conexiones activas: ${stats.activity.numbackends}`);
    console.log(`   Commits: ${parseInt(stats.activity.xact_commit).toLocaleString()}`);
    console.log(`   Rollbacks: ${parseInt(stats.activity.xact_rollback).toLocaleString()}`);
    console.log(`   Registros insertados: ${parseInt(stats.activity.tup_inserted).toLocaleString()}`);
    console.log(`   Cache hit ratio: ${((stats.activity.blks_hit / (stats.activity.blks_hit + stats.activity.blks_read)) * 100).toFixed(1)}%`);
    
    // Estimación de espacio
    const avgBytesPerRecord = stats.table.table_size_bytes / parseInt(stats.table.total_records);
    const estimated50M = (avgBytesPerRecord * 50_000_000) / 1024 / 1024 / 1024;
    
    console.log('\n📈 PROYECCIÓN 50M REGISTROS:');
    console.log(`   Bytes por registro: ${Math.round(avgBytesPerRecord)}`);
    console.log(`   Espacio estimado: ${estimated50M.toFixed(1)} GB`);
    console.log(`   Progreso: ${((parseInt(stats.table.total_records) / 50_000_000) * 100).toFixed(2)}%`);
    
    console.log('\n' + '=' * 80);
    console.log(`⏰ Última actualización: ${new Date().toLocaleTimeString()}`);
    
  } catch (error) {
    console.error('Error en el monitoreo:', error.message);
  }
}

// Función para monitoreo continuo
function startMonitoring(intervalSeconds = 5) {
  console.log(`🚀 Iniciando monitoreo cada ${intervalSeconds} segundos...`);
  console.log('Presiona Ctrl+C para detener\n');
  
  // Primera ejecución inmediata
  monitorDatabase();
  
  // Ejecutar cada X segundos
  const interval = setInterval(monitorDatabase, intervalSeconds * 1000);
  
  // Manejar Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Deteniendo monitor...');
    clearInterval(interval);
    pool.end();
    process.exit(0);
  });
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  const interval = process.argv[2] ? parseInt(process.argv[2]) : 5;
  startMonitoring(interval);
}

module.exports = { monitorDatabase, startMonitoring };