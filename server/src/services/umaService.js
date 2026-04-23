// =====================================================
// SERVICIO UMA — Unidad de Medida y Actualización
// Tabla: public.umas (id, anio, valor, activo, ...)
// Cron: 20 enero 03:00 (antes del 1 feb cuando INEGI publica el nuevo UMA)
// =====================================================

const cron  = require('node-cron');
const axios = require('axios');
const { pool } = require('../config/database');

// Indicador BIE de INEGI para el valor diario de UMA
// 628229 = UMA valor diario (actualizado cada 1 de febrero)
const INEGI_INDICATOR = process.env.INEGI_UMA_INDICATOR || '628229';
const INEGI_API_KEY   = process.env.INEGI_API_KEY || null;

// Factor estándar: 70 UMAs es el umbral para clasificar un bien como "externo"
const UMBRAL_UMAS = 70;

// ---------------------------------------------------------
// Obtener valor UMA de la tabla local por año
// Retorna el valor numérico o null si no existe
// ---------------------------------------------------------
async function getUmaByAnio(anio) {
  const year = parseInt(anio, 10);
  if (!year || isNaN(year)) return null;
  const { rows } = await pool.query(
    'SELECT valor FROM umas WHERE anio = $1 AND activo = true ORDER BY fecha_actualizacion DESC LIMIT 1',
    [year]
  );
  return rows[0]?.valor != null ? parseFloat(rows[0].valor) : null;
}

// ---------------------------------------------------------
// Consultar INEGI BIE API y devolver { anio, valor }
// La UMA se publica el 1 de febrero de cada año
// Endpoint: /app/api/indicadores/desarrolladores/jsonxml/INDICATOR/{id}/es/0700/false/BIE/2.0/{key}
// ---------------------------------------------------------
async function fetchUmaFromINEGI() {
  if (!INEGI_API_KEY) {
    console.warn('[UMA] INEGI_API_KEY no configurada — se omite consulta a API INEGI');
    return null;
  }

  const url = `https://www.inegi.org.mx/app/api/indicadores/desarrolladores/jsonxml/INDICATOR/${INEGI_INDICATOR}/es/0700/false/BIE/2.0/${INEGI_API_KEY}?type=json`;

  try {
    const res = await axios.get(url, { timeout: 15000 });
    // Formato BIE: { Series: [{ OBSERVATIONS: [{ TIME_PERIOD: "2025/01", OBS_VALUE: "113.14" }] }] }
    const observations = res.data?.Series?.[0]?.OBSERVATIONS;
    if (!Array.isArray(observations) || observations.length === 0) {
      throw new Error('Respuesta INEGI sin observaciones');
    }

    // El último registro es el más reciente
    const last  = observations[observations.length - 1];
    // TIME_PERIOD puede ser "2025/01" o "2025" — tomamos solo el año
    const anio  = parseInt((last.TIME_PERIOD ?? '').toString().split('/')[0], 10);
    const valor = parseFloat(last.OBS_VALUE);

    if (!anio || isNaN(valor)) throw new Error(`Datos INEGI inválidos: ${JSON.stringify(last)}`);

    return { anio, valor };
  } catch (err) {
    console.error('[UMA] Error consultando INEGI:', err.message);
    return null;
  }
}

// ---------------------------------------------------------
// Guardar o actualizar el valor UMA en la tabla local
// Usa UPDATE + INSERT para evitar dependencia de secuencias
// ---------------------------------------------------------
async function upsertUma(anio, valor) {
  const { rowCount } = await pool.query(
    'UPDATE umas SET valor = $1, activo = true, fecha_actualizacion = NOW() WHERE anio = $2',
    [valor, anio]
  );
  if (rowCount === 0) {
    // Año nuevo: calcular siguiente ID manualmente (la tabla no siempre tiene SERIAL)
    const { rows } = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM umas');
    await pool.query(
      'INSERT INTO umas (id, anio, valor, activo) VALUES ($1, $2, $3, true)',
      [rows[0].next_id, anio, valor]
    );
  }
  console.log(`[UMA] Guardado: año ${anio} → $${valor}`);
}

// ---------------------------------------------------------
// Flujo completo: consultar INEGI y guardar en BD
// ---------------------------------------------------------
async function updateCurrentYearUma() {
  console.log('[UMA] Iniciando actualización desde INEGI…');
  const data = await fetchUmaFromINEGI();
  if (!data) {
    console.warn('[UMA] Sin datos de INEGI — se conserva valor local');
    return;
  }
  await upsertUma(data.anio, data.valor);
}

// ---------------------------------------------------------
// Verificar al arranque si el año actual ya tiene UMA
// Si no, intentar actualizar (solo si hay API key)
// ---------------------------------------------------------
async function checkStartup() {
  const thisYear = new Date().getFullYear();
  const val = await getUmaByAnio(thisYear);
  if (val) {
    console.log(`[UMA] Año ${thisYear}: $${val} (tabla local OK)`);
  } else {
    console.warn(`[UMA] Año ${thisYear} no encontrado en tabla umas — intentando INEGI`);
    await updateCurrentYearUma();
  }
}

// ---------------------------------------------------------
// Iniciar cron: 20 enero 03:00 (Mexico City)
// La UMA oficial se publica el 1 de febrero;
// consultamos el 20 de enero para capturar el borrador/
// confirmación previa y el 1 de febrero para la oficial.
// ---------------------------------------------------------
function startUmaCron() {
  // 20 enero a las 03:00 — captura borrador previo
  cron.schedule('0 3 20 1 *', () => {
    console.log('[UMA] Cron: 20 enero — consultando INEGI');
    updateCurrentYearUma().catch(err => console.error('[UMA] Cron error:', err.message));
  }, { timezone: 'America/Mexico_City' });

  // 1 febrero a las 06:00 — captura valor oficial publicado
  cron.schedule('0 6 1 2 *', () => {
    console.log('[UMA] Cron: 1 febrero — actualizando valor oficial INEGI');
    updateCurrentYearUma().catch(err => console.error('[UMA] Cron error:', err.message));
  }, { timezone: 'America/Mexico_City' });

  console.log('[UMA] Cron configurado: 20 ene 03:00 + 1 feb 06:00 (America/Mexico_City)');
}

module.exports = { getUmaByAnio, fetchUmaFromINEGI, upsertUma, updateCurrentYearUma, checkStartup, startUmaCron, UMBRAL_UMAS };
