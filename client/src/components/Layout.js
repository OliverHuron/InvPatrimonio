import React, { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import '../styles/layout.css'

const URES_STORAGE_KEY = 'patrimonio_ures_config'

const Layout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const hasUres = () => {
    try {
      const stored = localStorage.getItem(URES_STORAGE_KEY)
      return stored ? JSON.parse(stored).length > 0 : false
    } catch { return false }
  }

  useEffect(() => {
    if (!hasUres() && location.pathname !== '/utilidades') {
      navigate('/utilidades', { replace: true })
    }
  }, [location.pathname])

  return (
    <div className="siaf-app">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        hasUres={hasUres()}
      />
      <div className="siaf-main-area">
        <Topbar onToggleSidebar={() => setSidebarOpen(prev => !prev)} />
        <main className="siaf-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
