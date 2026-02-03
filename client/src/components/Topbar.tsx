import React from 'react'
import '../styles/layout.css'

const Topbar: React.FC<{ title?: string }> = ({ title = 'Inventario de Activos' }) => {
  return (
    <header className="siaf-topbar">
      <div className="siaf-topbar-left">
        <h3>{title}</h3>
      </div>
      <div className="siaf-topbar-right">
        <div className="siaf-notification">🔔<span className="badge">1</span></div>
        <div className="siaf-profile">
          <div className="siaf-avatar">👤</div>
          <div className="siaf-username">Electedo</div>
        </div>
      </div>
    </header>
  )
}

export default Topbar
