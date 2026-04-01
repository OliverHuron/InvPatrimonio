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
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  // Función para cargar el usuario desde localStorage al iniciar
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedAuth = localStorage.getItem('isAuthenticated');
        const storedUser = localStorage.getItem('userData');

        if (storedAuth === 'true' && storedUser) {
          // Configurar axios para enviar cookies
          axios.defaults.withCredentials = true;
          
          setUser(JSON.parse(storedUser));
          setIsAuthenticated(true);
          console.log('Sesion restaurada desde localStorage');
        }
      } catch (error) {
        console.error('Error verificando autenticación:', error);
        clearAuth();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Función de login - AHORA USA PROXY DEL BACKEND para capturar JSESSIONID
  const login = async (credentials) => {
    try {
      setLoading(true);
      
      // Login a través del backend proxy (captura la cookie JSESSIONID)
      const response = await axios.post(`${API_BASE_URL}/patrimonio-api/auth/login`, credentials, {
        validateStatus: () => true
      });
      
      if (response.data?.success && response.data?.sessionId) {
        const sessionId = response.data.sessionId;
        
        const userData = response.data.user || { 
          username: credentials.username,
          role: 'user'
        };
        
        if (!userData.role) {
          userData.role = 'user';
        }
        
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userData', JSON.stringify(userData));
        localStorage.setItem('sessionId', sessionId);
        
        setUser(userData);
        setIsAuthenticated(true);
        
        console.log('Login exitoso - JSESSIONID capturado:', sessionId.substring(0, 10) + '...');
        return { success: true, data: userData };
      } else {
        console.error('Login fallido:', response.data);
        return { 
          success: false, 
          error: response.data?.message || 'Credenciales inválidas' 
        };
      }
    } catch (error) {
      console.error('Error en login:', error);
      return { 
        success: false, 
        error: error.message || 'Error de conexión' 
      };
    } finally {
      setLoading(false);
    }
  };

  // Función de logout
  const logout = async () => {
    try {
      // Llamar al endpoint de logout en la API UMICH
      const API_UMICH = 'http://api-patrimonio.umich.mx/api-patrimonio';
      await axios.post(`${API_UMICH}/auth/logout`, {}, {
        withCredentials: true
      });
    } catch (error) {
      console.error('Error en logout:', error);
    } finally {
      clearAuth();
    }
  };

  // Función para limpiar autenticación
  const clearAuth = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userData');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  // Función para obtener perfil actualizado
  const refreshProfile = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/auth/profile`);
      
      if (response.data.success) {
        const updatedUser = response.data.data;
        setUser(updatedUser);
        localStorage.setItem('userData', JSON.stringify(updatedUser));
        return updatedUser;
      }
    } catch (error) {
      console.error('Error refrescando perfil:', error);
      if (error.response?.status === 401) {
        // Token expirado o inválido
        clearAuth();
      }
    }
  };

  // Función para cambiar contraseña
  const changePassword = async (passwordData) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/auth/change-password`, passwordData);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Error cambiando contraseña' 
      };
    }
  };

  // Interceptor para manejar tokens expirados
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && isAuthenticated) {
          console.log('Token expirado, redirigiendo a login...');
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
    token,
    loading,
    isAuthenticated,
    
    // Funciones
    login,
    logout,
    refreshProfile,
    changePassword,
    
    // Utilidades
    hasRole: (role) => user?.role === role,
    hasAnyRole: (roles) => roles.includes(user?.role),
    isAdmin: () => user?.role === 'admin',
    isUser: () => user?.role === 'user',
    isViewer: () => user?.role === 'viewer'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;