import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { FaBars, FaBell } from 'react-icons/fa'
import '../styles/layout.css'

const API_BASE = (process.env.REACT_APP_API_URL || '/api').replace(/\/$/, '')

const Topbar = ({ title = 'Sistema Integral de Administración Facultaria', onToggleSidebar }) => {
  const { user, logout } = useAuth()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [empleadoNombre, setEmpleadoNombre] = useState(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch nombre al montar para usarlo también en el avatar
  useEffect(() => {
    if (!user?.username) return
    fetch(`${API_BASE}/empleado/${user.username}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          const d = data.data
          const nombre = d.usua_nombre || d.nombre || d.name || d.nombreCompleto || d.nombre_completo ||
            [d.nombres, d.apellido_paterno, d.apellido_materno].filter(Boolean).join(' ') || ''
          setEmpleadoNombre(nombre || '')
        } else {
          setEmpleadoNombre('')
        }
      })
      .catch(() => setEmpleadoNombre(''))
  }, [user?.username])

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Error en logout:', error)
    }
  }

  const getInitials = (nombre) => {
    if (!nombre) return 'U'
    const parts = nombre.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }

  return (
    <header className="siaf-topbar">
      <div className="siaf-topbar-left">
        <button
          type="button"
          className="siaf-sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label="Abrir menú"
        >
          <FaBars />
        </button>
        <h3>{title}</h3>
      </div>
      <div className="siaf-topbar-right">
        <button className="siaf-bell-btn" aria-label="Notificaciones">
          <FaBell />
        </button>
        <div className="siaf-profile" ref={dropdownRef} onClick={() => setShowProfileMenu(!showProfileMenu)}>
          <div className="siaf-avatar">
            {getInitials(empleadoNombre || user?.username)}
          </div>
          <div className="siaf-username">
            {user?.username || 'Usuario'}
          </div>

          {showProfileMenu && (
            <div className="profile-dropdown">
              <div className="profile-info">
                <p style={{ margin: '0 0 4px', fontSize: '0.82rem', color: '#555' }}>
                  <span style={{ fontWeight: 600 }}>Usuario:</span> {user?.username}
                </p>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#555' }}>
                  <span style={{ fontWeight: 600 }}>Nombre:</span>{' '}
                  {empleadoNombre === null ? 'Cargando…' : empleadoNombre || '—'}
                </p>
              </div>
              <hr />
              <button className="dropdown-item logout-btn" onClick={handleLogout}>
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Topbar
