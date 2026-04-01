/*
  App.js
  - Archivo principal del frontend con sistema de autenticación JWT
  - Se encarga de: 1) proveer contexto de autenticación, 2) definir las rutas protegidas,
    3) manejar login/logout y 4) renderizar la navegación.
*/

// Hooks de React para estado y efectos secundarios.
import { useEffect } from 'react'

// Componentes de react-router para manejo de rutas en el frontend.
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Contexto de autenticación
import { AuthProvider } from './context/AuthContext'

// Componentes de protección de rutas
import ProtectedRoute, { UserRoute } from './components/ProtectedRoute'

// Importamos las páginas que mostraremos según la URL.
import Login from './pages/Login'
import InternoView from './pages/InternoView'
import ExternoView from './pages/ExternoView'
import Layout from './components/Layout'

function App() {
  // useEffect se ejecuta una vez al montar el componente para configuraciones iniciales
  useEffect(() => {
    // Determinar la URL base según el entorno - usando variable de entorno de React
    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api'
    
    // Test de conectividad al servidor
    fetch(`${API_BASE_URL}/health`)
      .then(res => res.json())
      .then(data => console.log('[App] Servidor conectado:', data.message))
      .catch(() => console.log('[App] Servidor iniciando...'))
  }, [])

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Ruta pública de login */}
          <Route path="/login" element={<Login />} />
          
          {/* Rutas protegidas con Layout */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            {/* Ruta principal redirige a interno */}
            <Route index element={<Navigate to="/interno" replace />} />
            
            {/* Ruta de patrimonio interno (PatrimonioCI) */}
            <Route path="interno" element={
              <UserRoute>
                <InternoView />
              </UserRoute>
            } />
            
            {/* Ruta de patrimonio externo (Patrimonio - solo lectura) */}
            <Route path="externo" element={
              <UserRoute>
                <ExternoView />
              </UserRoute>
            } />
          </Route>

          {/* Redirigir rutas no encontradas */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
