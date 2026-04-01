// =====================================================
// VISTA: Patrimonio Externo (Solo Lectura)
// API: /api/patrimonio/{id} - Solo GET con ID 16932
// =====================================================

import React, { useState, useEffect } from 'react'
import { FaSync, FaSearch } from 'react-icons/fa'
import { toast } from 'react-toastify'
import './ExternoView.css'

const ExternoView = () => {
  const API_BASE = 'http://localhost:5000/api/patrimonio-api'
  
  // Estados
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searchId, setSearchId] = useState('16932')
  
  // Obtener sessionId
  const getSessionId = () => localStorage.getItem('sessionId')
  
  // Cargar datos por ID
  const loadData = async (id) => {
    if (!id) {
      toast.error('Ingrese un ID de patrimonio')
      return
    }
    
    try {
      setLoading(true)
      const sessionId = getSessionId()
      
      const headers = {
        'Content-Type': 'application/json'
      }
      
      if (sessionId) {
        headers['X-UMICH-Session'] = sessionId
      }
      
      const response = await fetch(`${API_BASE}/patrimonio/${id}`, {
        headers,
        credentials: 'include'
      })
      
      const data = await response.json()
      
      if (data.success && data.data) {
        setItem(data.data)
        toast.success(`Patrimonio ${id} cargado`)
      } else {
        setItem(null)
        toast.error('Error: ' + (data.message || 'No encontrado'))
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
      setItem(null)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }
  
  // Buscar al presionar Enter
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      loadData(searchId)
    }
  }
  
  useEffect(() => {
    loadData(searchId)
  }, [])
  
  // Formatear fecha
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString('es-MX')
    } catch {
      return 'N/A'
    }
  }
  
  // Formatear moneda
  const formatCurrency = (amount) => {
    if (!amount) return 'N/A'
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount)
  }
  
  return (
    <div className="externo-view">
      {/* Header */}
      <div className="view-header">
        <div>
          <h1>Patrimonio Externo</h1>
          <p>Consulta de patrimonio externo (Solo lectura)</p>
        </div>
        <div className="header-actions">
          <div className="search-container">
            <input
              type="text"
              placeholder="ID del patrimonio"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyPress={handleKeyPress}
              className="search-input"
            />
            <button 
              className="btn-search" 
              onClick={() => loadData(searchId)} 
              disabled={loading}
            >
              <FaSearch /> Buscar
            </button>
          </div>
          <button className="btn-refresh" onClick={() => loadData(searchId)} disabled={loading}>
            <FaSync className={loading ? 'spinning' : ''} /> Actualizar
          </button>
        </div>
      </div>
      
      {/* Contenido */}
      {loading ? (
        <div className="loading-state">Cargando...</div>
      ) : !item ? (
        <div className="empty-state">No hay datos disponibles</div>
      ) : (
        <div className="info-container">
          {/* Card Principal */}
          <div className="info-card main-card">
            <h2>Información General</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">ID</span>
                <span className="value">{item.id || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="label">Folio</span>
                <span className="value">{item.folio || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="label">Clave Patrimonio</span>
                <span className="value">{item.numero_patrimonio || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="label">UUID</span>
                <span className="value">{item.uuid || 'N/A'}</span>
              </div>
            </div>
          </div>
          
          {/* Card Descripción */}
          <div className="info-card">
            <h2>Descripción del Bien</h2>
            <div className="info-grid">
              <div className="info-item full-width">
                <span className="label">Descripción</span>
                <span className="value">{item.descripcion || 'N/A'}</span>
              </div>
              <div className="info-item full-width">
                <span className="label">Descripción Detallada</span>
                <span className="value">{item.descripcion_bien || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="label">Tipo de Bien</span>
                <span className="value">{item.tipo_bien || 'N/A'}</span>
              </div>
            </div>
          </div>
          
          {/* Card Identificación */}
          <div className="info-card">
            <h2>Identificación</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Marca</span>
                <span className="value">{item.marca || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="label">Modelo</span>
                <span className="value">{item.modelo || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="label">Número de Serie</span>
                <span className="value">{item.numero_serie || 'N/A'}</span>
              </div>
            </div>
          </div>
          
          {/* Card Ubicación */}
          <div className="info-card">
            <h2>Ubicación y Asignación</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Ubicación</span>
                <span className="value">{item.ubicacion || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="label">Ubicación ID</span>
                <span className="value">{item.ubicacion_id || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="label">Usuario Asignado</span>
                <span className="value">{item.usu_asig || item.numero_empleado || 'N/A'}</span>
              </div>
            </div>
          </div>
          
          {/* Card Financiera */}
          <div className="info-card">
            <h2>Información Financiera</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Costo</span>
                <span className="value highlight">{formatCurrency(item.costo)}</span>
              </div>
              <div className="info-item">
                <span className="label">Factura</span>
                <span className="value">{item.factura || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="label">Fecha Adquisición</span>
                <span className="value">{formatDate(item.fecha_adquisicion)}</span>
              </div>
            </div>
          </div>
          
          {/* Card Contable */}
          <div className="info-card">
            <h2>Información Contable</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">COG</span>
                <span className="value">{item.cog || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="label">Cuenta Contable</span>
                <span className="value">{item.cuenta_contable || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="label">Descripción Cuenta</span>
                <span className="value">{item.cuenta_descripcion || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="label">Ejercicio</span>
                <span className="value">{item.ejercicio || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="label">Documento</span>
                <span className="value">{item.documento || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="label">Fondo</span>
                <span className="value">{item.fondo || 'N/A'}</span>
              </div>
            </div>
          </div>
          
          {/* Card Metadatos */}
          <div className="info-card metadata-card">
            <h2>Metadatos</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">ID Concepto</span>
                <span className="value">{item.id_concepto || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="label">Último Usuario</span>
                <span className="value">{item.ultimo_usuario || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="label">Fuente de Datos</span>
                <span className="value badge badge-info">{item._source || 'api_externa'}</span>
              </div>
              <div className="info-item">
                <span className="label">Sincronización</span>
                <span className="value">{formatDate(item._fecha_sincronizacion)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExternoView
