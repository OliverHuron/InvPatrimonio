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

const Sidebar: React.FC = () => {
  // Hook que nos dice en qué URL estamos actualmente
  const location = useLocation()
  
  return (
    <aside className="siaf-sidebar">
      <div className="siaf-brand">SIAF</div>
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
          <li className='menu-link'>
            <MdAdd size={18} />
            Altas
          </li>
          <li className='menu-link'>
            <MdRemove size={18} />
            Bajas
          </li>
          <li className='menu-link'>
            <MdAssessment size={18} />
            Reportes
          </li>
          <li className='menu-link'>
            <MdSettings size={18} />
            Configuración
          </li>
        </ul>
      </nav>
    </aside>
  )
}

export default Sidebar
