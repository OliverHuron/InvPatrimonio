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
      clave_patrimonial: valueOf(source, ['clave_patrimonial', 'clavePat']),
      descripcion: valueOf(source, ['descripcion', 'descrip']),
      descripcion_bien: valueOf(source, ['descripcion_bien', 'texto']),
      persona: valueOf(source, ['persona', 'usu_asig', 'numero_empleado']),
      ures: valueOf(source, ['ures']),
      ubicacion_id: valueOf(source, ['ubicacion_id', 'ures']),
      marca: valueOf(source, ['marca']),
      modelo: valueOf(source, ['modelo']),
      numero_serie: valueOf(source, ['numero_serie', 'serie']),
      tipo_bien: valueOf(source, ['tipo_bien', 'tipoBien']),
      ubicacion: valueOf(source, ['ubicacion', 'ubica']),
      usu_asig: valueOf(source, ['usu_asig', 'numero_empleado', 'persona']),
      costo: valueOf(source, ['costo']),
      cog: valueOf(source, ['cog']),
      cuenta_contable: valueOf(source, ['cuenta_contable', 'cnta']),
      cuenta_descripcion: valueOf(source, ['cuenta_descripcion', 'cntaDescr']),
      factura: valueOf(source, ['factura', 'numFact']),
      fecha_adquisicion: valueOf(source, ['fecha_adquisicion', 'ffactura'])
      ,
      uuid: valueOf(source, ['uuid']),
      ejercicio: valueOf(source, ['ejercicio', 'ejerci']),
      documento: valueOf(source, ['documento', 'docu']),
      fondo: valueOf(source, ['fondo']),
      id_concepto: valueOf(source, ['id_concepto', 'idCon']),
      ultimo_usuario: valueOf(source, ['ultimo_usuario', 'lusu'])
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

  const showValue = (value, formatter) => {
    if (value === undefined || value === null || value === '') return 'Sin dato'
    return formatter ? formatter(value) : value
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
              <div>
                <h2>Detalle Patrimonio Externo</h2>
                <p className="drawer-subtitle">
                  ID {showValue(selectedItem.id)} · Folio {showValue(selectedItem.folio)}
                </p>
              </div>
              <button className="btn-close" onClick={() => setShowDetail(false)}>×</button>
            </div>
            <div className="drawer-content">
              <div className="drawer-summary">
                <div className="summary-card">
                  <span className="summary-label">Descripción</span>
                  <span className="summary-value">{showValue(selectedItem.descripcion)}</span>
                </div>
                <div className="summary-card">
                  <span className="summary-label">Costo</span>
                  <span className="summary-value">{showValue(selectedItem.costo, formatCurrency)}</span>
                </div>
              </div>

              <div className="drawer-section">
                <h3>Información principal</h3>
                <div className="detail-grid two-cols">
                  <div className="detail-item"><span className="detail-label">ID</span><span className="detail-value">{showValue(selectedItem.id)}</span></div>
                  <div className="detail-item"><span className="detail-label">Folio</span><span className="detail-value">{showValue(selectedItem.folio)}</span></div>
                  <div className="detail-item"><span className="detail-label">Clave Patrimonial</span><span className="detail-value">{showValue(selectedItem.clave_patrimonial)}</span></div>
                  <div className="detail-item"><span className="detail-label">UUID</span><span className="detail-value">{showValue(selectedItem.uuid)}</span></div>
                  <div className="detail-item"><span className="detail-label">Tipo Bien</span><span className="detail-value">{showValue(selectedItem.tipo_bien)}</span></div>
                  <div className="detail-item"><span className="detail-label">Descripción Bien</span><span className="detail-value">{showValue(selectedItem.descripcion_bien)}</span></div>
                </div>
              </div>

              <div className="drawer-section">
                <h3>Asignación y ubicación</h3>
                <div className="detail-grid two-cols">
                  <div className="detail-item"><span className="detail-label">Persona</span><span className="detail-value">{showValue(selectedItem.persona)}</span></div>
                  <div className="detail-item"><span className="detail-label">Usuario Asignado</span><span className="detail-value">{showValue(selectedItem.usu_asig)}</span></div>
                  <div className="detail-item"><span className="detail-label">URES</span><span className="detail-value">{showValue(selectedItem.ures)}</span></div>
                  <div className="detail-item"><span className="detail-label">Ubicación ID</span><span className="detail-value">{showValue(selectedItem.ubicacion_id)}</span></div>
                  <div className="detail-item"><span className="detail-label">Ubicación</span><span className="detail-value">{showValue(selectedItem.ubicacion)}</span></div>
                </div>
              </div>

              <div className="drawer-section">
                <h3>Datos contables y factura</h3>
                <div className="detail-grid two-cols">
                  <div className="detail-item"><span className="detail-label">COG</span><span className="detail-value">{showValue(selectedItem.cog)}</span></div>
                  <div className="detail-item"><span className="detail-label">Cuenta Contable</span><span className="detail-value">{showValue(selectedItem.cuenta_contable)}</span></div>
                  <div className="detail-item"><span className="detail-label">Cuenta Descripción</span><span className="detail-value">{showValue(selectedItem.cuenta_descripcion)}</span></div>
                  <div className="detail-item"><span className="detail-label">Factura</span><span className="detail-value">{showValue(selectedItem.factura)}</span></div>
                  <div className="detail-item"><span className="detail-label">Fecha Adquisición</span><span className="detail-value">{showValue(selectedItem.fecha_adquisicion, formatDate)}</span></div>
                  <div className="detail-item"><span className="detail-label">Ejercicio</span><span className="detail-value">{showValue(selectedItem.ejercicio)}</span></div>
                  <div className="detail-item"><span className="detail-label">Documento</span><span className="detail-value">{showValue(selectedItem.documento)}</span></div>
                  <div className="detail-item"><span className="detail-label">Fondo</span><span className="detail-value">{showValue(selectedItem.fondo)}</span></div>
                  <div className="detail-item"><span className="detail-label">ID Concepto</span><span className="detail-value">{showValue(selectedItem.id_concepto)}</span></div>
                  <div className="detail-item"><span className="detail-label">Último Usuario</span><span className="detail-value">{showValue(selectedItem.ultimo_usuario)}</span></div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ExternoView
