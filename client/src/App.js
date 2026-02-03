/*
  App.tsx
  - Archivo principal del frontend que ahora actúa como 'Director de Tránsito'.
  - Se encarga de: 1) obtener un saludo del backend, 2) definir las rutas
    (qué página mostrar según la URL), y 3) renderizar la navegación.
*/

// Hooks de React para estado y efectos secundarios.
import { useEffect } from 'react'

// Componentes de react-router para manejo de rutas en el frontend.
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// Importamos las páginas que mostraremos según la URL.
import Home from './pages/Home'
import Inventario from './pages/Inventario'
import Layout from './components/Layout'

function App() {
  // Estado local para guardar el mensaje que llega del servidor.
  // Inicialmente mostramos un texto de carga.

  // useEffect se ejecuta una vez al montar el componente (comportamiento similar a componentDidMount).
  // Aquí hacemos una petición fetch al backend para obtener el saludo.
  useEffect(() => {
    // Determinar la URL base según el entorno - usando variable de entorno de React
    const API_BASE_URL = process.env.REACT_APP_API_URL 
      ? `${process.env.REACT_APP_API_URL}/api`
      : 'http://localhost:3001/api'
    
    // fetch solicita al servidor el endpoint /api/saludo
    fetch(`${API_BASE_URL}/saludo`)
      // Convertimos la respuesta a JSON para poder acceder a sus campos.
      .then(res => res.json())
      // En caso de error, actualizamos el estado con un mensaje de fallo.
      .catch(() => console.log("Servidor iniciando..."))
  }, [])

  // El componente renderiza la navegación, el encabezado con el mensaje,
  // y las rutas que determinan qué página mostrar según la URL.
  return (
    <BrowserRouter>
      <Routes>
        {/* Usamos Layout como componente global que contiene Sidebar/Topbar
            y un <Outlet/> donde se renderizan las páginas según la ruta. */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="inventario" element={<Inventario />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

// Exportamos App para que sea el componente raíz montado en main.tsx.
export default App
