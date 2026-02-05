import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  MdDashboard, 
  MdInventory, 
  MdAdd, 
  MdRemove, 
  MdAssessment, 
  MdSettings 
} from 'react-icons/md'
import '../styles/layout.css'

const Sidebar = () => {
  // Hook que nos dice en qué URL estamos actualmente
  const location = useLocation()
  
  return (
    <aside className="siaf-sidebar">
      <div className="siaf-brand" ><img className="siaf-logo" src="https://png.pngtree.com/png-vector/20221030/ourmid/pngtree-book-logo-template-vector-illustration-studying-sign-page-vector-png-image_39898376.png" alt="UMSNH Logo" /></div>
      <nav className="siaf-menu">
        <ul className="siaf-menu-list">
          <li className={location.pathname === '/' ? 'active' : ''}>
            <Link to="/" className="menu-link">
              <MdDashboard size={18} />
              Dashboard
            </Link>
          </li>
          <li className={location.pathname === '/inventario' ? 'active' : ''}>
            <Link to="/inventario" className="menu-link">
              <MdInventory size={18} />
              Inventario
            </Link>
          </li>
          <li>
            <Link to="/agregar" className="menu-link">
              <MdAdd size={18} />
              Agregar
            </Link>
          </li>
          <li>
            <Link to="/bajas" className="menu-link">
              <MdRemove size={18} />
              Bajas
            </Link>
          </li>
          <li>
            <Link to="/reportes" className="menu-link">
              <MdAssessment size={18} />
              Reportes
            </Link>
          </li>
          <li>
            <Link to="/configuracion" className="menu-link">
              <MdSettings size={18} />
              Configuración
            </Link>
          </li>
        </ul>
      </nav>
    </aside>
  )
}

export default Sidebar