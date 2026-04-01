// =====================================================
// VISTA: Patrimonio Externo (Solo Lectura)
// API: /api/patrimonio/{id} - Solo GET con ID 16932
// =====================================================

import React, { useState, useEffect } from 'react'
import { FaSync, FaEye } from 'react-icons/fa'
import { toast } from 'react-toastify'
import './ExternoView.css'

const ExternoView = () => {
  const API_BASE_URL = process.env.REACT_APP_API_URL || '/api'
  const API_BASE = `${API_BASE_URL.replace(/\/$/, '')}/patrimonio-api`
  
  // Estados
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searchId, setSearchId] = useState('16932')
  const [currentId, setCurrentId] = useState('16932')
  const [showDetail, setShowDetail] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)

  const unwrapPayload = (payload) => {
    if (!payload) return null
    if (Array.isArray(payload)) return payload[0] || null
    if (payload.data !== undefined) return unwrapPayload(payload.data)
    return payload
  }

  const valueOf = (obj, keys) => {
    for (const key of keys) {
      const value = obj?.[key]
      if (value !== undefined && value !== null && value !== '') return value
    }
    return null
  }

  const normalizeItem = (raw) => {
    const source = unwrapPayload(raw)
    if (!source || typeof source !== 'object') return null
    return {
      id: valueOf(source, ['id', 'invpId']),
      folio: valueOf(source, ['folio']),
      descripcion: valueOf(source, ['descripcion', 'descrip']),
      descripcion_bien: valueOf(source, ['descripcion_bien', 'texto']),
      marca: valueOf(source, ['marca']),
      modelo: valueOf(source, ['modelo']),
      numero_serie: valueOf(source, ['numero_serie', 'serie']),
      tipo_bien: valueOf(source, ['tipo_bien', 'tipoBien']),
      ubicacion: valueOf(source, ['ubicacion', 'ubica']),
      usu_asig: valueOf(source, ['usu_asig', 'numero_empleado', 'persona']),
      costo: valueOf(source, ['costo']),
      fecha_adquisicion: valueOf(source, ['fecha_adquisicion', 'ffactura'])
    }
  }
  
  // Obtener sessionId
  const getSessionId = () => localStorage.getItem('sessionId')
  
  // Cargar datos por ID
  const loadData = async (id) => {
    if (!id) {
      toast.error('Ingrese un ID de patrimonio')
      return
    }

    const normalizedId = String(id).trim()
    if (!/^\d+$/.test(normalizedId)) {
      toast.error('El ID debe ser numerico')
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
      
      const response = await fetch(`${API_BASE}/patrimonio/${normalizedId}`, {
        headers,
        credentials: 'include'
      })
      
      const data = await response.json()
      
      if (data.success && data.data) {
        const normalized = normalizeItem(data.data)
        if (!normalized) {
          setItem(null)
          toast.error('No se pudo interpretar el registro')
          return
        }

        setItem(normalized)
        setCurrentId(normalizedId)
        setSearchId(normalizedId)
        toast.success(`Patrimonio ${normalizedId} cargado`)
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

  const handleView = () => {
    if (!item) return
    setSelectedItem(item)
    setShowDetail(true)
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
              Buscar
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
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Folio</th>
                <th>Descripción</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th>No. Serie</th>
                <th>Ubicación</th>
                <th>Costo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr onClick={handleView} className="clickable-row">
                <td>{item.id || 'N/A'}</td>
                <td>{item.folio || 'N/A'}</td>
                <td>{item.descripcion || 'N/A'}</td>
                <td>{item.marca || 'N/A'}</td>
                <td>{item.modelo || 'N/A'}</td>
                <td>{item.numero_serie || 'N/A'}</td>
                <td>{item.ubicacion || 'N/A'}</td>
                <td>{formatCurrency(item.costo)}</td>
                <td>
                  <button
                    type="button"
                    className="btn-icon btn-view"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleView()
                    }}
                    title="Ver detalle"
                  >
                    <FaEye />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {showDetail && selectedItem && (
        <>
          <div className="drawer-overlay open" onClick={() => setShowDetail(false)} />
          <div className="drawer-panel open">
            <div className="drawer-header">
              <h2>Detalle Patrimonio Externo</h2>
              <button className="btn-close" onClick={() => setShowDetail(false)}>x</button>
            </div>
            <div className="drawer-content">
              <div className="detail-grid">
                <div className="detail-item"><span className="detail-label">ID</span><span className="detail-value">{selectedItem.id || 'N/A'}</span></div>
                <div className="detail-item"><span className="detail-label">Folio</span><span className="detail-value">{selectedItem.folio || 'N/A'}</span></div>
                <div className="detail-item"><span className="detail-label">Descripción</span><span className="detail-value">{selectedItem.descripcion || 'N/A'}</span></div>
                <div className="detail-item"><span className="detail-label">Descripción Bien</span><span className="detail-value">{selectedItem.descripcion_bien || 'N/A'}</span></div>
                <div className="detail-item"><span className="detail-label">Marca</span><span className="detail-value">{selectedItem.marca || 'N/A'}</span></div>
                <div className="detail-item"><span className="detail-label">Modelo</span><span className="detail-value">{selectedItem.modelo || 'N/A'}</span></div>
                <div className="detail-item"><span className="detail-label">No. Serie</span><span className="detail-value">{selectedItem.numero_serie || 'N/A'}</span></div>
                <div className="detail-item"><span className="detail-label">Tipo Bien</span><span className="detail-value">{selectedItem.tipo_bien || 'N/A'}</span></div>
                <div className="detail-item"><span className="detail-label">Ubicación</span><span className="detail-value">{selectedItem.ubicacion || 'N/A'}</span></div>
                <div className="detail-item"><span className="detail-label">Usuario Asignado</span><span className="detail-value">{selectedItem.usu_asig || 'N/A'}</span></div>
                <div className="detail-item"><span className="detail-label">Costo</span><span className="detail-value">{formatCurrency(selectedItem.costo)}</span></div>
                <div className="detail-item"><span className="detail-label">Fecha Adquisición</span><span className="detail-value">{formatDate(selectedItem.fecha_adquisicion)}</span></div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ExternoView
