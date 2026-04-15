import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  const API_BASE = API_BASE_URL.replace(/\/$/, '');
  const API_BASE_LEGACY = `${API_BASE}/patrimonio-api`;

  // Configurar axios para enviar cookies
  axios.defaults.withCredentials = true;

  // Verificar autenticación al iniciar
  useEffect(() => {
    const initAuth = async () => {
      // Si hay sessionId en localStorage, añadir header para fallback
      try {
        const stored = localStorage.getItem('sessionId');
        if (stored) axios.defaults.headers.common['X-UMICH-Session'] = stored;
      } catch (err) {
        console.warn('No se pudo setear X-UMICH-Session header:', err);
      }
      try {
        // Intentar obtener perfil desde la cookie
        let response;
        try {
          response = await axios.get(`${API_BASE}/auth/profile`);
        } catch (error) {
          if (error.response?.status === 404) {
            response = await axios.get(`${API_BASE_LEGACY}/auth/profile`);
          } else {
            throw error;
          }
        }
        
        if (response.data?.success) {
          const userData = response.data.user;
          setUser({
            id: userData.id,
            username: userData.usuario,
            role: userData.rol, // Mapear 'rol' de BD a 'role' para frontend
            ures: userData.ures
          });
          setIsAuthenticated(true);
          console.log('Sesión restaurada desde cookie');
        }
      } catch (error) {
        console.log('No hay sesión activa');
        clearAuth();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Función de login - JWT con httpOnly cookies o sessionId según modo
  const login = async (credentials) => {
    try {
      setLoading(true);
      
      const response = await axios.post(
        `${API_BASE}/auth/login`,
        credentials,
        { withCredentials: true }
      ).catch(async (error) => {
        if (error.response?.status === 404) {
          return axios.post(
            `${API_BASE_LEGACY}/auth/login`,
            credentials,
            { withCredentials: true }
          );
        }
        throw error;
      });
      
      if (response.data?.success) {
        const userData = response.data.user;
        
        // Modo BD: Cookie JWT automática
        // Modo API: Guardar sessionId
        if (response.data.source === 'api' && response.data.sessionId) {
          localStorage.setItem('sessionId', response.data.sessionId);
          // Añadir header por defecto para futuras peticiones cuando la cookie no esté disponible
          axios.defaults.headers.common['X-UMICH-Session'] = response.data.sessionId;
        }
        
        setUser({
          id: userData.id,
          username: userData.username,
          role: userData.rol, // Mapear 'rol' de BD a 'role' para frontend
          ures: userData.ures
        });
        setIsAuthenticated(true);
        
        console.log(`Login exitoso (${response.data.source}):`, userData.username);
        return { success: true, data: userData };
      } else {
        return {
          success: false,
          error: response.data?.message || 'Credenciales inválidas'
        };
      }
    } catch (error) {
      console.error('Error en login:', error);

      if (error.response?.status >= 500) {
        return {
          success: false,
          error: 'Servidor no disponible'
        };
      }

      return { 
        success: false, 
        error: error.response?.data?.message || 'Error de conexión' 
      };
    } finally {
      setLoading(false);
    }
  };

  // Función de logout
  const logout = async () => {
    try {
      await axios.post(
        `${API_BASE}/auth/logout`,
        {},
        { withCredentials: true }
      ).catch(async (error) => {
        if (error.response?.status === 404) {
          return axios.post(
            `${API_BASE_LEGACY}/auth/logout`,
            {},
            { withCredentials: true }
          );
        }
        throw error;
      });
    } catch (error) {
      console.error('Error en logout:', error);
    } finally {
      clearAuth();
      // Remover header fallback
      try {
        delete axios.defaults.headers.common['X-UMICH-Session'];
      } catch (err) {
        console.warn('No se pudo borrar X-UMICH-Session header:', err);
      }
    }
  };

  // Función para limpiar autenticación
  const clearAuth = () => {
    localStorage.removeItem('sessionId');
    setUser(null);
    setIsAuthenticated(false);
  };

  // Interceptor para manejar tokens expirados
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && isAuthenticated) {
          console.log('Sesión expirada, redirigiendo a login...');
          clearAuth();
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, [isAuthenticated]);

  const value = {
    // Estado
    user,
    loading,
    isAuthenticated,
    
    // Funciones
    login,
    logout,
    
    // Utilidades
    hasRole: (role) => user?.role === role,
    hasAnyRole: (roles) => roles.includes(user?.role),
    isAdmin: () => user?.role === 'administrador', // Cambiado para coincidir con BD
    isUser: () => user?.role === 'usuario'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
