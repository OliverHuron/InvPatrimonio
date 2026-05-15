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

  // Configurar axios para enviar cookies httpOnly automáticamente
  axios.defaults.withCredentials = true;

  // Al iniciar: verificar que la cookie (JSESSIONID/JWT) sigue activa antes de restaurar sesión.
  // Si el perfil devuelve 401, la sesión expiró → limpiar y dejar que ProtectedRoute redirija.
  // Si hay error de red/servidor, restaurar optimistamente para no bloquear sin necesidad.
  useEffect(() => {
    const validateAndRestore = async () => {
      const storedUser = localStorage.getItem('userData');
      if (!storedUser) {
        setLoading(false);
        return;
      }
      try {
        const parsedUser = JSON.parse(storedUser);
        const uresParam = parsedUser?.ures ? `?ures=${encodeURIComponent(parsedUser.ures)}` : '';
        await axios.get(`${API_BASE}/auth/verify${uresParam}`, { withCredentials: true });
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      } catch (err) {
        if (err.response?.status === 401) {
          console.log('[Auth] Sesión expirada en el servidor — redirigiendo al login');
          await axios.post(`${API_BASE}/auth/logout`, {}, { withCredentials: true }).catch(() => {});
          localStorage.removeItem('userData');
        } else {
          // Error de red o servidor caído — restaurar para no bloquear al usuario
          console.warn('[Auth] No se pudo verificar sesión (red/servidor), restaurando localmente:', err.message);
          try { setUser(JSON.parse(storedUser)); setIsAuthenticated(true); } catch (_) { localStorage.removeItem('userData'); }
        }
      } finally {
        setLoading(false);
      }
    };
    validateAndRestore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Función de login
  const login = async (credentials) => {
    try {
      setLoading(true);

      const response = await axios.post(
        `${API_BASE}/auth/login`,
        credentials,
        { withCredentials: true }
      ).catch(async (error) => {
        if (error.response?.status === 404) {
          return axios.post(`${API_BASE_LEGACY}/auth/login`, credentials, { withCredentials: true });
        }
        throw error;
      });

      if (response.data?.success) {
        const userData = response.data.user;

        // Guardar solo datos de usuario (no el token — el JSESSIONID/JWT vive en cookie httpOnly)
        const normalizedUser = {
          id: userData.id,
          username: userData.username || userData.usuario,
          ures: userData.ures ?? null
        };
        localStorage.setItem('userData', JSON.stringify(normalizedUser));
        setUser(normalizedUser);
        setIsAuthenticated(true);

        console.log(`Login exitoso (${response.data.source}):`, normalizedUser.username);
        return { success: true, data: userData };
      } else {
        return { success: false, error: response.data?.message || 'Credenciales inválidas' };
      }
    } catch (error) {
      console.error('Error en login:', error);
      if (!error.response) {
        return { success: false, error: 'No se pudo conectar con el servidor' };
      }
      if (error.response.status >= 500) {
        return { success: false, error: 'Servidor no disponible. Intenta más tarde.' };
      }
      // 401/400: credenciales incorrectas u otro error conocido
      return { success: false, error: error.response?.data?.message || 'Usuario o contraseña incorrectos' };
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
          return axios.post(`${API_BASE_LEGACY}/auth/logout`, {}, { withCredentials: true });
        }
        throw error;
      });
    } catch (error) {
      console.error('Error en logout:', error);
    } finally {
      clearAuth();
    }
  };

  const clearAuth = () => {
    localStorage.removeItem('userData');
    setUser(null);
    setIsAuthenticated(false);
  };

  // Interceptor: si una llamada devuelve 401, la sesión expiró → limpiar y redirigir
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && isAuthenticated) {
          console.log('Sesión expirada');
          clearAuth();
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [isAuthenticated]);

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    hasRole: (role) => user?.role === role,
    hasAnyRole: (roles) => roles.includes(user?.role),
    isAdmin: () => user?.role === 'administrador',
    isUser: () => user?.role === 'usuario'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
