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
        const storedToken = localStorage.getItem('authToken');
        const storedUser = localStorage.getItem('userData');

        if (storedToken && storedUser) {
          // Configurar axios con el token
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          
          try {
            // Verificar que el token siga siendo válido
            const response = await axios.get(`${API_BASE_URL}/auth/verify`);
            
            if (response.data.success) {
              setToken(storedToken);
              setUser(JSON.parse(storedUser));
              setIsAuthenticated(true);
            } else {
              // Token inválido, limpiar
              clearAuth();
            }
          } catch (verifyError) {
            // Si hay error del servidor (500) pero tenemos token válido en localStorage,
            // confiar temporalmente en el token local
            console.warn('⚠️ No se pudo verificar token con el servidor, usando datos locales');
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
            setIsAuthenticated(true);
          }
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

  // Función de login
  const login = async (credentials) => {
    try {
      setLoading(true);
      
      const response = await axios.post(`${API_BASE_URL}/auth/login`, credentials);
      
      if (response.data.success) {
        const { token: newToken, user: userData } = response.data.data;
        
        // Guardar en localStorage
        localStorage.setItem('authToken', newToken);
        localStorage.setItem('userData', JSON.stringify(userData));
        
        // Configurar axios
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        
        // Actualizar estado
        setToken(newToken);
        setUser(userData);
        setIsAuthenticated(true);
        
        return { success: true, data: userData };
      }
    } catch (error) {
      console.error('Error en login:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Error de autenticación' 
      };
    } finally {
      setLoading(false);
    }
  };

  // Función de logout
  const logout = async () => {
    try {
      // Llamar al endpoint de logout (opcional)
      if (token) {
        await axios.post(`${API_BASE_URL}/auth/logout`);
      }
    } catch (error) {
      console.error('Error en logout:', error);
    } finally {
      clearAuth();
    }
  };

  // Función para limpiar autenticación
  const clearAuth = () => {
    localStorage.removeItem('authToken');
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