// =====================================================
// CLIENTE HTTP PARA API EXTERNA UMICH
// =====================================================
const axios = require('axios');
require('dotenv').config();

// =====================================================
// CONFIGURACIÓN BASE
// =====================================================
const API_BASE_URL = process.env.EXTERNAL_API_BASE_URL || 'http://api-patrimonio.umich.mx/api-patrimonio';
const API_TIMEOUT = parseInt(process.env.EXTERNAL_API_TIMEOUT) || 10000;

// Crear instancia de axios configurada
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// =====================================================
// INTERCEPTOR DE REQUESTS (se ejecuta ANTES de cada llamada)
// =====================================================
apiClient.interceptors.request.use(
  (config) => {
    console.log(`[API Client] ${config.method.toUpperCase()} ${config.url}`);
    
    config.withCredentials = true;
    
    if (config.umichSessionId) {
      config.headers = config.headers || {};
      config.headers['Cookie'] = `JSESSIONID=${config.umichSessionId}`;
      console.log(`[API Client] Enviando JSESSIONID: ${config.umichSessionId.substring(0, 10)}...`);
    }
    
    return config;
  },
  (error) => {
    console.error('[API Client] Error en request:', error.message);
    return Promise.reject(error);
  }
);
// =====================================================
// INTERCEPTOR DE RESPONSES (se ejecuta DESPUÉS de cada llamada)
// =====================================================
apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API Client] Response OK - Status: ${response.status}`);
    return response;
  },
  (error) => {
    if (error.response) {
      console.error(`[API Client] Error ${error.response.status}:`, error.response.data);
      
      const customError = new Error(error.response.data.message || 'Error en la API externa');
      customError.status = error.response.status;
      customError.data = error.response.data;
      
      return Promise.reject(customError);
      
    } else if (error.request) {
      console.error('[API Client] Sin respuesta del servidor:', error.message);
      
      const customError = new Error('No se pudo conectar con la API externa. Verifica tu conexión.');
      customError.status = 503; // Service Unavailable
      
      return Promise.reject(customError);
      
    } else {
      console.error('[API Client] Error de configuración:', error.message);
      return Promise.reject(error);
    }
  }
);

// =====================================================
// FUNCIONES HELPER
// =====================================================

/**
 * GET request con manejo de errores
 * @param {string} url - URL del endpoint
 * @param {object} config - Configuración axios (incluye umichSessionId)
 */
const get = async (url, config = {}) => {
  try {
    const response = await apiClient.get(url, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * POST request con manejo de errores
 * @param {string} url - URL del endpoint
 * @param {object} data - Datos a enviar
 * @param {object} config - Configuración axios (incluye umichSessionId)
 */
const post = async (url, data, config = {}) => {
  try {
    const response = await apiClient.post(url, data, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * PUT request con manejo de errores
 * @param {string} url - URL del endpoint
 * @param {object} data - Datos a enviar
 * @param {object} config - Configuración axios (incluye umichSessionId)
 */
const put = async (url, data, config = {}) => {
  try {
    const response = await apiClient.put(url, data, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * DELETE request con manejo de errores
 * @param {string} url - URL del endpoint
 * @param {object} config - Configuración axios (incluye umichSessionId)
 */
const del = async (url, config = {}) => {
  try {
    const response = await apiClient.delete(url, config);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// =====================================================
// EXPORTAR FUNCIONES
// =====================================================
module.exports = {
  apiClient,
  get,
  post,
  put,
  delete: del
};