const Redis = require('ioredis');

let redisClient = null;
let isInitialized = false;

// Función para inicializar Redis
async function initializeRedis() {
  if (isInitialized) {
    return;
  }

  try {
    // Configuración simple para desarrollo
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy: (times) => {
        // Para desarrollo, permitir estrategia de reintentos flexible
        if (times > 3) {
          console.warn('Redis: falló después de 3 intentos, continuando sin cache');
          return null; // Dejar de intentar
        }
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    // Eventos de conexión
    redisClient.on('connect', () => {
      console.log('✅ Redis conectado');
    });

    redisClient.on('error', (error) => {
      console.error('❌ Error de Redis:', error.message);
    });

    redisClient.on('close', () => {
      console.warn('⚠️  Conexión Redis cerrada');
    });

    // Probar conexión
    try {
      await redisClient.ping();
      console.log('✅ Redis ping exitoso');
    } catch (error) {
      console.warn('⚠️  Redis ping falló, continuando sin cache:', error.message);
    }
    
    isInitialized = true;

  } catch (error) {
    console.error('❌ Error inicializando Redis:', error);
    throw error;
  }
}

// Operaciones de cache
async function get(key) {
  if (!redisClient) return null;
  
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('Error obteniendo cache:', error);
    return null;
  }
}

async function set(key, value, ttlSeconds = 3600) {
  if (!redisClient) return false;
  
  try {
    await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Error guardando en cache:', error);
    return false;
  }
}

async function del(key) {
  if (!redisClient) return false;
  
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('Error eliminando de cache:', error);
    return false;
  }
}

async function exists(key) {
  if (!redisClient) return false;
  
  try {
    const result = await redisClient.exists(key);
    return result === 1;
  } catch (error) {
    console.error('Error verificando cache:', error);
    return false;
  }
}

// Función para obtener estadísticas de Redis
async function getHealth() {
  if (!redisClient) {
    return {
      status: 'disconnected',
      message: 'Redis no inicializado'
    };
  }

  try {
    const start = Date.now();
    await redisClient.ping();
    const latency = Date.now() - start;

    return {
      status: 'healthy',
      latency: `${latency}ms`
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

// Cerrar conexión
async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isInitialized = false;
  }
}

module.exports = {
  initializeRedis,
  get,
  set,
  del,
  exists,
  getHealth,
  closeRedis
};