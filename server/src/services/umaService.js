// =====================================================
// SERVICIO: Actualización automática de valores UMA
// =====================================================
// La UMA (Unidad de Medida y Actualización) se actualiza
// cada 1 de febrero por el INEGI.
// Fuente oficial: INEGI BIE, indicador 628229
// API docs: https://www.inegi.org.mx/servicios/api_indicadores.html
// =====================================================

const axios = require('axios');
const { pool } = require('../config/database');

// Configurar via .env:
//   INEGI_API_KEY=tu_token_aqui
//   INEGI_UMA_INDICATOR=628229  (opcional, default 628229)
const INEGI_TOKEN     = process.env.INEGI_API_KEY;
const INEGI_INDICATOR = process.env.INEGI_UMA_INDICATOR || '628229';
const INEGI_URL       = `https://www.inegi.org.mx/app/api/indicadores/desarrolladores/jsonxml/INDICATOR/${INEGI_INDICATOR}/es/0700/false/BIE/2.0/${INEGI_TOKEN}?type=json`;

// Multiplicador umbral para EXTERNO
const UMA_THRESHOLD = 70;

/**
 * Calcula tipo_inventario dado el costo y el valor UMA del año.
 * @returns {'EXTERNO'|'INTERNO'}
 */
const calcTipoInventario = (costo, umaValor) => {
  if (!costo || !umaValor) return 'INTERNO';
  const c = parseFloat(costo);
  const u = parseFloat(umaValor);
  if (isNaN(c) || isNaN(u) || u <= 0) return 'INTERNO';
  return c > (u * UMA_THRESHOLD) ? 'EXTERNO' : 'INTERNO';
};

/**
 * Obtiene el valor UMA para un año desde la BD.
 * Si no existe, devuelve null.
 */
const getUmaForYear = async (año) => {
  try {
    const result = await pool.query(
      'SELECT valor FROM uma_valores WHERE año = $1',
      [parseInt(año)]
    );
    return result.rows[0]?.valor || null;
  } catch (err) {
    console.error('❌ [UMA] Error consultando BD:', err.message);
    return null;
  }
};

/**
 * Llama al API del INEGI y actualiza la tabla uma_valores con los
 * valores más recientes. Extrae el año de TIME_PERIOD y el valor de OBS_VALUE.
 */
const fetchAndUpdateUma = async () => {
  if (!INEGI_TOKEN) {
    console.warn('⚠️  [UMA] INEGI_API_KEY no configurada. Omitiendo actualización automática.');
    return;
  }

  console.log('🔄 [UMA] Consultando API del INEGI...');
  try {
    const response = await axios.get(INEGI_URL, { timeout: 15000 });
    const series = response.data?.Series?.[0]?.OBS;

    if (!Array.isArray(series) || series.length === 0) {
      console.warn('⚠️  [UMA] Respuesta inesperada del INEGI:', JSON.stringify(response.data).slice(0, 200));
      return;
    }

    // Agrupar: para cada año quedarse con la UMA de febrero (mes 02) o la más reciente
    const porAño = {};
    for (const obs of series) {
      const period = obs.TIME_PERIOD || '';  // e.g. "2026-02" o "2026"
      const value  = obs.OBS_VALUE;
      if (!value || value === 'null') continue;

      const año = parseInt(period.split('-')[0]);
      if (isNaN(año) || año < 2016) continue;

      // Priorizar febrero (cuando se actualiza la UMA), pero aceptar cualquier mes
      const mes = period.split('-')[1] || '01';
      if (!porAño[año] || mes === '02') {
        porAño[año] = parseFloat(value);
      }
    }

    if (Object.keys(porAño).length === 0) {
      console.warn('⚠️  [UMA] No se obtuvieron valores del INEGI.');
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [año, valor] of Object.entries(porAño)) {
        await client.query(
          `INSERT INTO uma_valores (año, valor, fuente, fecha_actualizacion)
           VALUES ($1, $2, 'INEGI', CURRENT_TIMESTAMP)
           ON CONFLICT (año) DO UPDATE
             SET valor = EXCLUDED.valor,
                 fecha_actualizacion = CURRENT_TIMESTAMP`,
          [parseInt(año), valor]
        );
      }
      await client.query('COMMIT');
      console.log(`✅ [UMA] ${Object.keys(porAño).length} años actualizados en BD:`, porAño);
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error('❌ [UMA] Error al consultar INEGI:', err.message);
  }
};

/**
 * Inicia el cron que actualiza la UMA cada 3 meses (1ro de enero, abril, julio, octubre).
 * También ejecuta una verificación al inicio para asegurar que el año actual esté en BD.
 */
const startUmaCron = () => {
  try {
    const cron = require('node-cron');

    // Ejecuta el 1ro de enero, abril, julio y octubre a las 03:00 AM
    cron.schedule('0 3 1 1,4,7,10 *', async () => {
      console.log('⏰ [UMA] Cron trimestral iniciado...');
      await fetchAndUpdateUma();
    });

    console.log('✅ [UMA] Cron trimestral registrado (1 ene, abr, jul, oct a las 03:00)');

    // Verificar al arrancar: si el año actual no está en BD, actualizar
    (async () => {
      const currentYear = new Date().getFullYear();
      const existing = await getUmaForYear(currentYear);
      if (!existing) {
        console.log(`🔄 [UMA] Sin valor para ${currentYear}, consultando INEGI al arranque...`);
        await fetchAndUpdateUma();
      } else {
        console.log(`✅ [UMA] Valor ${currentYear}: $${existing} MXN/día`);
      }
    })();

  } catch (err) {
    // node-cron no instalado aún — funciona igual sin el cron
    console.warn('⚠️  [UMA] node-cron no disponible. Cron omitido. (npm install en server/)');
  }
};

module.exports = { startUmaCron, fetchAndUpdateUma, getUmaForYear, calcTipoInventario, UMA_THRESHOLD };
