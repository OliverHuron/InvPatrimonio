import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requiredRole = null, allowedRoles = null }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div className="loading-container" style={loadingStyle}>
        <div className="loading-spinner" style={spinnerStyle}></div>
        <p>Verificando autenticación...</p>
      </div>
    );
  }

  // Si no está autenticado, redirigir a login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Verificar rol específico requerido
  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div className="access-denied" style={accessDeniedStyle}>
        <div style={messageBoxStyle}>
          <h3>Acceso Denegado</h3>
          <p>No tienes permisos suficientes para acceder a esta página.</p>
          <p>Rol requerido: <strong>{requiredRole}</strong></p>
          <p>Tu rol: <strong>{user?.role}</strong></p>
        </div>
      </div>
    );
  }

  // Verificar lista de roles permitidos
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return (
      <div className="access-denied" style={accessDeniedStyle}>
        <div style={messageBoxStyle}>
          <h3>Acceso Denegado</h3>
          <p>No tienes permisos suficientes para acceder a esta página.</p>
          <p>Roles permitidos: <strong>{allowedRoles.join(', ')}</strong></p>
          <p>Tu rol: <strong>{user?.role}</strong></p>
        </div>
      </div>
    );
  }

  // Si todo está bien, renderizar el componente hijo
  return children;
};

// Componente específico para rutas de administrador
export const AdminRoute = ({ children }) => (
  <ProtectedRoute requiredRole="admin">
    {children}
  </ProtectedRoute>
);

// Componente para rutas que requieren admin o user
export const UserRoute = ({ children }) => (
  <ProtectedRoute allowedRoles={['admin', 'user']}>
    {children}
  </ProtectedRoute>
);

// Componente para rutas que requieren cualquier rol autenticado
export const AuthenticatedRoute = ({ children }) => (
  <ProtectedRoute>
    {children}
  </ProtectedRoute>
);

// Estilos inline para evitar dependencias externas
const loadingStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  gap: '16px',
  color: '#64748b',
  fontFamily: 'Arial, sans-serif'
};

const spinnerStyle = {
  width: '32px',
  height: '32px',
  border: '3px solid #f1f5f9',
  borderTop: '3px solid #9e2f41',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite'
};

const accessDeniedStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: '20px',
  backgroundColor: '#f8fafc',
  fontFamily: 'Arial, sans-serif'
};

const messageBoxStyle = {
  background: '#ffffff',
  padding: '32px',
  borderRadius: '12px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  textAlign: 'center',
  maxWidth: '500px',
  border: '1px solid #e2e8f0'
};

// Agregar animación CSS si no existe
if (!document.querySelector('#protected-route-styles')) {
  const style = document.createElement('style');
  style.id = 'protected-route-styles';
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

export default ProtectedRoute;