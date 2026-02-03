import React from 'react'

const Home = () => {
  return (
    <div>
      <h2>Dashboard - InvPatrimonio</h2>
      <p>Bienvenido al sistema de inventario patrimonial.</p>
      <div className="dashboard-stats">
        <div className="stat-card">
          <h3>Total de Bienes</h3>
          <p className="stat-number">1</p>
        </div>
        <div className="stat-card">
          <h3>En Buen Estado</h3>
          <p className="stat-number">1</p>
        </div>
        <div className="stat-card">
          <h3>Pendientes</h3>
          <p className="stat-number">0</p>
        </div>
        <div className="stat-card">
          <h3>Valor Total</h3>
          <p className="stat-number">$25,000</p>
        </div>
      </div>
    </div>
  )
}

export default Home