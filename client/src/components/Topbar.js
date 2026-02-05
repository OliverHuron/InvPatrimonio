import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import '../styles/layout.css'

const Topbar = ({ title = 'Sistema Integral de Administración Facultaria' }) => {
  const { user, logout } = useAuth()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const dropdownRef = useRef(null)

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
      // El contexto se encargará de redirigir al login
    } catch (error) {
      console.error('Error en logout:', error)
    }
  }

  const getUserInitials = (fullName) => {
    if (!fullName) return 'U'
    return fullName.split(' ')
      .map(name => name.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  return (
    <header className="siaf-topbar">
      <div className="siaf-topbar-left">
        <h3>{title}</h3>
      </div>
      <div className="siaf-topbar-right">
        <div className="siaf-notification">🔔<span className="badge">1</span></div>
        <div className="siaf-profile" ref={dropdownRef} onClick={() => setShowProfileMenu(!showProfileMenu)}>
          <div className="siaf-avatar">
            {user ? getUserInitials(user.fullName) : '👤'}
          </div>
          <div className="siaf-username">
            {user ? user.fullName || user.username : 'Usuario'}
          </div>
          
          {/* Dropdown Menu */}
          {showProfileMenu && (
            <div className="profile-dropdown">
              <div className="profile-info">
                <strong>{user?.fullName || user?.username}</strong>
                <p>{user?.email}</p>
                <span className="user-role">{user?.role}</span>
              </div>
              <hr />
              <button className="dropdown-item" onClick={() => setShowProfileMenu(false)}>
                👤 Ver Perfil
              </button>
              <button className="dropdown-item" onClick={() => setShowProfileMenu(false)}>
                ⚙️ Configuración
              </button>
              <hr />
              <button className="dropdown-item logout-btn" onClick={handleLogout}>
                🚪 Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Topbar