import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MdInventory, MdAssignmentTurnedIn } from 'react-icons/md'
import '../styles/layout.css'
import logo from '../assets/Logo_UMSNH_Color.png'

const Sidebar = ({ isOpen = false, onClose = () => {} }) => {
  const location = useLocation()

  return (
    <>
      <div className={`siaf-sidebar-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <aside className={`siaf-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="siaf-brand">
        <img className="siaf-logo" src={logo} alt="UMSNH Logo" />
        <div className="siaf-brand-text">
          <p className="siaf-brand-name">UMSNH</p>
          <p className="siaf-brand-subtitle">
            Universidad Michoacana<br />de San Nicolás de Hidalgo
          </p>
        </div>
      </div>
      <nav className="siaf-menu">
        <ul className="siaf-menu-list">
          <li className={location.pathname === '/inventario' ? 'active' : ''}>
            <Link to="/inventario" className="menu-link" onClick={onClose}>
              <MdInventory size={18} />
              Inventario
            </Link>
          </li>
          <li className={location.pathname === '/auditoria' ? 'active' : ''}>
            <Link to="/auditoria" className="menu-link" onClick={onClose}>
              <MdAssignmentTurnedIn size={18} />
              Auditoría de Campo
            </Link>
          </li>
        </ul>
      </nav>
      </aside>
    </>
  )
}

export default Sidebar
