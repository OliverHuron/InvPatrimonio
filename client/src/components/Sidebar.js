import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MdHome, MdBusiness } from 'react-icons/md'
import '../styles/layout.css'
import logo from '../assets/UMSNHLogo1.png'

const Sidebar = () => {
  const location = useLocation()
  
  return (
    <aside className="siaf-sidebar">
      <div className="siaf-brand">
        <img className="siaf-logo" src={logo} alt="UMSNH Logo" />
      </div>
      <nav className="siaf-menu">
        <ul className="siaf-menu-list">
          <li className={location.pathname === '/interno' ? 'active' : ''}>
            <Link to="/interno" className="menu-link">
              <MdHome size={18} />
              Interno
            </Link>
          </li>
          <li className={location.pathname === '/externo' ? 'active' : ''}>
            <Link to="/externo" className="menu-link">
              <MdBusiness size={18} />
              Externo
            </Link>
          </li>
        </ul>
      </nav>
    </aside>
  )
}

export default Sidebar