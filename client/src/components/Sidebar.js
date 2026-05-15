import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MdInventory, MdAssignmentTurnedIn, MdBusiness, MdLock } from 'react-icons/md'
import '../styles/layout.css'
import logo from '../assets/Logo_UMSNH_Color.png'

const Sidebar = ({ isOpen = false, onClose = () => {}, hasUres = false }) => {
  const location = useLocation()

  const DisabledItem = ({ icon, label }) => (
    <li className="disabled" title="Configura al menos una URES para acceder">
      <span className="menu-link menu-link--disabled">
        {icon}
        {label}
        <span className="menu-lock"><MdLock size={14} /></span>
      </span>
    </li>
  )

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
            {hasUres ? (
              <li className={location.pathname === '/inventario' ? 'active' : ''}>
                <Link to="/inventario" className="menu-link" onClick={onClose}>
                  <MdInventory size={18} />
                  Inventario
                </Link>
              </li>
            ) : (
              <DisabledItem icon={<MdInventory size={18} />} label="Inventario" />
            )}

            {hasUres ? (
              <li className={location.pathname === '/auditoria' ? 'active' : ''}>
                <Link to="/auditoria" className="menu-link" onClick={onClose}>
                  <MdAssignmentTurnedIn size={18} />
                  Auditoría
                </Link>
              </li>
            ) : (
              <DisabledItem icon={<MdAssignmentTurnedIn size={18} />} label="Auditoría" />
            )}

            <li className={location.pathname === '/utilidades' ? 'active' : ''}>
              <Link to="/utilidades" className="menu-link" onClick={onClose}>
                <MdBusiness size={18} />
                Utilidades
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
    </>
  )
}

export default Sidebar
