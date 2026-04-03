import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MdHome, MdBusiness } from 'react-icons/md'
import '../styles/layout.css'
import logo from '../assets/UMSNHLogo1.png'

const Sidebar = ({ isOpen = false, onClose = () => {} }) => {
  const location = useLocation()
  
  return (
    <>
      <div className={`siaf-sidebar-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <aside className={`siaf-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="siaf-brand">
        <img className="siaf-logo" src={logo} alt="UMSNH Logo" />
      </div>
      <nav className="siaf-menu">
        <ul className="siaf-menu-list">
          <li className={location.pathname === '/interno' ? 'active' : ''}>
            <Link to="/interno" className="menu-link" onClick={onClose}>
              <MdHome size={18} />
              Interno
            </Link>
          </li>
          <li className={location.pathname === '/externo' ? 'active' : ''}>
            <Link to="/externo" className="menu-link" onClick={onClose}>
              <MdBusiness size={18} />
              Externo
            </Link>
          </li>
        </ul>
      </nav>
      </aside>
    </>
  )
}

export default Sidebar
