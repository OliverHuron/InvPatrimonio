// =====================================================
// GENERADOR MASIVO DE DATOS DE PRUEBA - 50M REGISTROS
// 🚀 OPTIMIZADO PARA RENDIMIENTO MÁXIMO
// =====================================================

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuración de base de datos - usar la misma que el proyecto
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'patrimonio_db',
  password: process.env.DB_PASSWORD || '1234',
  port: process.env.DB_PORT || 5432,
  max: 20, // Pool de conexiones
});

// Configuración del generador
const TOTAL_RECORDS = 10_000_000; // 10 millones
const BATCH_SIZE = 5_000; // Insertar de 5k en 5k (optimizado)
const PROGRESS_INTERVAL = 50_000; // Mostrar progreso cada 50k

// Arrays de datos para generar variaciones
const MARCAS = [
  'HP', 'Dell', 'Lenovo', 'ASUS', 'Acer', 'Apple', 'Samsung', 'LG', 'Sony', 'Canon',
  'Epson', 'Brother', 'Xerox', 'Cisco', 'D-Link', 'TP-Link', 'Huawei', 'Microsoft',
  'Intel', 'AMD', 'NVIDIA', 'Logitech', 'Corsair', 'Kingston', 'Seagate', 'WD'
];

const MODELOS = [
  'Elite', 'Pro', 'Max', 'Ultra', 'Standard', 'Basic', 'Advanced', 'Premium', 'Business', 'Home',
  '3000', '5000', '7000', '9000', 'X1', 'X5', 'T480', 'T490', 'Latitude', 'Inspiron',
  'ThinkPad', 'Pavilion', 'EliteBook', 'ZBook', 'MacBook', 'iMac', 'LaserJet', 'OfficeJet'
];

const DESCRIPCIONES = [
  'Laptop', 'Desktop', 'Monitor', 'Impresora', 'Scanner', 'Proyector', 'Tablet', 'Smartphone',
  'Router', 'Switch', 'Access Point', 'UPS', 'Servidor', 'Disco Duro', 'Memoria RAM',
  'Teclado', 'Mouse', 'Webcam', 'Audífonos', 'Bocinas', 'Micrófono', 'Cámara Digital'
];

const UBICACIONES = [
  'Oficina Principal - Piso 1', 'Oficina Principal - Piso 2', 'Oficina Principal - Piso 3',
  'Sala de Juntas A', 'Sala de Juntas B', 'Centro de Datos', 'Almacén TI',
  'Recepción', 'Contabilidad', 'Recursos Humanos', 'Gerencia', 'Sistemas',
  'Ventas', 'Marketing', 'Compras', 'Archivo', 'Biblioteca'
];

const PROVEEDORES = [
  'COMPUTADORAS Y TECNOLOGIA SA DE CV', 'SOLUCIONES INTEGRALES DE TI', 'GRUPO TECNOLOGICO EMPRESARIAL',
  'SISTEMAS Y EQUIPOS PROFESIONALES', 'INNOVACION TECNOLOGICA MEXICANA', 'DISTRIBUIDOR AUTORIZADO HP',
  'DELL TECHNOLOGIES MEXICO', 'LENOVO PARTNER GOLD', 'MICROSIP DISTRIBUIDOR'
];

const ESTADOS_USO = ['bueno', 'regular', 'malo'];
const TIPOS_INVENTARIO = ['INTERNO', 'EXTERNO'];
const STAGES = ['COMPLETO', 'EN_TRANSITO', 'FISCAL', 'FISICO'];

// Función para generar datos aleatorios
const random = {
  choice: (arr) => arr[Math.floor(Math.random() * arr.length)],
  int: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
  float: (min, max) => +(Math.random() * (max - min) + min).toFixed(2),
  bool: () => Math.random() < 0.5,
  string: (length) => Math.random().toString(36).substring(2, 2 + length),
  date: () => {
    const start = new Date(2020, 0, 1);
    const end = new Date();
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString().split('T')[0];
  }
};

// Función para generar un registro
function generateRecord(index) {
  const year = new Date().getFullYear();
  const uniqueId = 1000000 + index; // Empezar desde 1M para evitar duplicados
  const isInterno = random.choice(TIPOS_INVENTARIO) === 'INTERNO';
  
  return {
    // Campos básicos - Folio único garantizado
    folio: `${year}-${String(uniqueId).padStart(8, '0')}`,
    descripcion: random.choice(DESCRIPCIONES),
    marca: random.choice(MARCAS),
    modelo: random.choice(MODELOS),
    numero_serie: `${random.choice(MARCAS).substr(0,2)}${random.int(100000, 999999)}-${index}`,
    estado_uso: random.choice(ESTADOS_USO),
    ubicacion: random.choice(UBICACIONES),
    costo: random.float(500, 50000),
    proveedor: random.choice(PROVEEDORES),
    factura: `FAC-${year}-${uniqueId}`,
    fecha_adquisicion: random.date(),
    numero_empleado: random.int(1000, 9999).toString(),
    observaciones: `Equipo adquirido para ${random.choice(['oficina', 'laboratorio', 'sala de juntas', 'departamento'])} - ID:${index}`,
    ures_asignacion: `URES-${random.int(100, 999)}`,
    
    // Campos específicos
    ...(isInterno ? {
      registro_patrimonial: `RP-${year}-${String(uniqueId).padStart(8, '0')}`,
      registro_interno: `RI-${year}-${String(uniqueId).padStart(8, '0')}`,
      elaboro_nombre: `Usuario${random.int(1, 100)}`,
      fecha_elaboracion: random.date(),
      recurso: random.choice(['Federal', 'Estatal', 'Municipal', 'Propio']),
      ur: `UR-${random.int(100, 999)}`,
      uuid: `uuid-interno-${uniqueId}-${random.string(8)}`,
      dependencia_id: random.int(1, 50),
      coordinacion_id: random.int(1, 100)
    } : {
      id_patrimonio: `PAT-${year}-${String(uniqueId).padStart(8, '0')}`,
      numero_patrimonio: `NP-${year}-${String(uniqueId).padStart(8, '0')}`,
      clave_patrimonial: `CP-${uniqueId}`,
      ures_gasto: `UG-${random.int(100, 999)}`,
      cog: (1000 + (index % 9000)).toString(),
      fondo: `FONDO-${1000 + (index % 9000)}`,
      cuenta_por_pagar: `CPP-${10000 + (index % 90000)}`,
      ejercicio: year.toString(),
      solicitud_compra: `SC-${10000 + (index % 90000)}`,
      idcon: `IDCON-${1000 + (index % 9000)}`,
      usu_asig: `Usuario${random.int(1, 200)}`,
      numero_resguardo_interno: `NRI-${10000 + (index % 90000)}`,
      uuid_fiscal: `uuid-fiscal-${uniqueId}-${random.string(8)}`,
      empleado_resguardante_id: random.int(1, 1000),
      responsable_entrega_id: random.int(1, 1000)
    }),
    
    // Control
    tipo_inventario: isInterno ? 'INTERNO' : 'EXTERNO',
    estatus_validacion: random.choice(['borrador', 'validado', 'revision']),
    stage: random.choice(STAGES)
  };
}

// Función para construir query de inserción (simplificada)
function buildInsertQuery(records) {
  if (!records || records.length === 0) return null;
  
  const fields = Object.keys(records[0]).filter(key => records[0][key] !== undefined);
  const placeholders = fields.map((_, index) => `$${index + 1}`).join(',');
  
  const query = `INSERT INTO inventario (${fields.join(',')}) VALUES (${placeholders})`;
  
  return { query, fields };
}

// Función principal
async function generateMassData() {
  console.log('🚀 GENERADOR MASIVO DE DATOS DE PRUEBA');
  console.log('='.repeat(60));
  console.log(`📊 Total registros: ${TOTAL_RECORDS.toLocaleString()}`);
  console.log(`📦 Tamaño de lote: ${BATCH_SIZE.toLocaleString()}`);
  console.log(`💾 Estimado espacio BD: ~${Math.round(TOTAL_RECORDS * 600 / 1024 / 1024)}MB (~${(TOTAL_RECORDS * 600 / 1024 / 1024 / 1024).toFixed(2)}GB)`);
  console.log(`🔥 Tu NVMe 80GB es más que suficiente para este dataset`);
  console.log(`⚡ Tiempo estimado: ~${Math.round(TOTAL_RECORDS / 25000)} minutos`);
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  let insertedRecords = 0;
  
  try {
    // Verificar conexión
    await pool.query('SELECT 1');
    console.log('✅ Conexión a BD establecida');
    
    // Optimizar configuración BD para inserción masiva (solo parámetros de sesión)
    console.log('⚡ Optimizando configuración BD para inserción masiva...');
    await pool.query('BEGIN');
    await pool.query('SET synchronous_commit = off');
    await pool.query('SET random_page_cost = 1.0');
    await pool.query('SET work_mem = "64MB"');
    await pool.query('SET maintenance_work_mem = "256MB"');
    console.log('✅ BD optimizada para inserción masiva');
    
    console.log('🏁 Iniciando generación...\n');
    
    // Procesar en lotes
    for (let i = 0; i < TOTAL_RECORDS; i += BATCH_SIZE) {
      const batchSize = Math.min(BATCH_SIZE, TOTAL_RECORDS - i);
      const batchStartTime = Date.now();
      
      // Generar e insertar registros del lote uno por uno
      const { query, fields } = buildInsertQuery([generateRecord(1)]);
      
      for (let j = 0; j < batchSize; j++) {
        const record = generateRecord(i + j + 1);
        const params = fields.map(field => record[field] || null);
        await pool.query(query, params);
      }
      
      insertedRecords += batchSize;
      
      // Mostrar progreso
      if (insertedRecords % PROGRESS_INTERVAL === 0 || insertedRecords >= TOTAL_RECORDS) {
        const elapsed = Date.now() - startTime;
        const batchTime = Date.now() - batchStartTime;
        const rate = Math.round(insertedRecords / (elapsed / 1000));
        const progress = ((insertedRecords / TOTAL_RECORDS) * 100).toFixed(1);
        const eta = insertedRecords > 0 ? Math.round((TOTAL_RECORDS - insertedRecords) / rate) : 0;
        
        console.log(`📈 ${insertedRecords.toLocaleString()}/${TOTAL_RECORDS.toLocaleString()} (${progress}%) | ` +
                   `${rate.toLocaleString()} rec/s | Lote: ${batchTime}ms | ETA: ${eta}s`);
      }
    }
    
    console.log('\n🔄 Commit final...');
    await pool.query('COMMIT');
    
    const totalTime = Date.now() - startTime;
    const avgRate = Math.round(TOTAL_RECORDS / (totalTime / 1000));
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ GENERACIÓN COMPLETADA');
    console.log(`⏱️  Tiempo total: ${Math.round(totalTime / 1000)}s`);
    console.log(`📊 Registros insertados: ${insertedRecords.toLocaleString()}`);
    console.log(`🚀 Velocidad promedio: ${avgRate.toLocaleString()} rec/s`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Error durante la generación:', error);
    await pool.query('ROLLBACK');
  } finally {
    await pool.end();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  generateMassData().catch(console.error);
}

module.exports = { generateMassData };