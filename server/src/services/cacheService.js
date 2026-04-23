// =====================================================
// CACHE SERVICE — L1 (in-memory) + L2 (Redis opcional)
// TTL por defecto: 45 segundos
// =====================================================

const redis = require('./redis.service');

const DEFAULT_TTL = 45; // segundos

// L1: mapa en memoria  key → { data, expiresAt }
const memCache = new Map();

/**
 * Obtener valor del cache (L1 → L2)
 */
async function get(key) {
  // L1: memoria
  const entry = memCache.get(key);
  if (entry) {
    if (Date.now() < entry.expiresAt) return entry.data;
    memCache.delete(key);
  }

  // L2: Redis
  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      // Poblar L1 con lo encontrado en Redis
      memCache.set(key, { data: cached, expiresAt: Date.now() + DEFAULT_TTL * 1000 });
      return cached;
    }
  } catch (_) { /* Redis no disponible */ }

  return null;
}

/**
 * Guardar valor en cache (L1 + L2)
 */
async function set(key, data, ttl = DEFAULT_TTL) {
  memCache.set(key, { data, expiresAt: Date.now() + ttl * 1000 });
  try {
    await redis.set(key, data, ttl);
  } catch (_) { /* Redis no disponible */ }
}

/**
 * Eliminar todas las entradas cuyo key empiece con `prefix`
 */
function invalidatePrefix(prefix) {
  for (const key of memCache.keys()) {
    if (key.startsWith(prefix + ':')) memCache.delete(key);
  }
  // Redis: el TTL es corto (45 s), no hace falta pattern-delete activo
}

/**
 * Construir clave de cache reproducible a partir de un objeto de parámetros
 */
function buildKey(prefix, params) {
  return `${prefix}:${JSON.stringify(params)}`;
}

module.exports = { get, set, invalidatePrefix, buildKey, DEFAULT_TTL };
