// =====================================================
// VISTA: Patrimonio Interno (PatrimonioCI)
// API: /api/patrimonioci - Soporta GET, POST, PUT
// =====================================================

import React, { useState, useEffect } from 'react'
import { FaPlus, FaEdit, FaSync } from 'react-icons/fa'
import { toast } from 'react-toastify'
import './InternoView.css'

const InternoView = () => {
  const API_BASE_URL = process.env.REACT_APP_API_URL || '/api'
  const API_BASE = `${API_BASE_URL.replace(/\/$/, '')}/patrimonio-api`
  
  // Obtener sessionId de localStorage
  const getSessionId = () => localStorage.getItem('sessionId')
  
  // Estados
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [drawerMode, setDrawerMode] = useState('view') // 'view', 'create', 'edit'
  const [selectedItem, setSelectedItem] = useState(null)
  
  // Form data
  const [formData, setFormData] = useState({
    descrip: '',
    marca: '',
    modelo: '',
    num_serie: '',
    depenadsc: '',
    ures: '',
    activo: 1
  })
  
  // Estado para búsqueda por ID
  const [searchId, setSearchId] = useState('42')
  const [currentId, setCurrentId] = useState(42)
  
  // Cargar un registro por ID
  const loadById = async (id) => {
    const sessionId = getSessionId()
    try {
      const response = await fetch(`${API_BASE}/patrimonioci/${id}`, {
        credentials: 'include',
        headers: { 'X-UMICH-Session': sessionId || '' }
      })
      
      // Si el servidor devuelve error, retornar null
      if (!response.ok) {
        console.log(`ID ${id} no encontrado (status ${response.status})`)
        return null
      }
      
      const data = await response.json()
      
      // Verificar que realmente hay datos válidos
      if (data.success && data.data) {
        return {
          id_pat_ci: data.data.id || id,
          descrip: data.data.descripcion || '',
          marca: data.data.marca || '',
          modelo: data.data.modelo || '',
          num_serie: data.data.numero_serie || '',
          depenadsc: data.data.dependencia || '',
          ures: data.data.ubicacion || '',
          activo: data.data.activo ? 1 : 0
        }
      }
      return null
    } catch (error) {
      console.error(`Error cargando ID ${id}:`, error)
      return null
    }
  }
  
  // Cargar item actual
  const loadCurrentItem = async (id) => {
    try {
      setLoading(true)
      const loadedItem = await loadById(id)
      setItem(loadedItem)
    } catch (error) {
      console.error('Error cargando datos:', error)
      toast.error('Error al cargar datos')
      setItem(null)
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    loadCurrentItem(42)
  }, [])
  
  // Abrir drawer para ver detalles
  const handleView = (item) => {
    setSelectedItem(item)
    setFormData({
      descrip: item.descrip,
      marca: item.marca,
      modelo: item.modelo,
      num_serie: item.num_serie,
      depenadsc: item.depenadsc,
      ures: item.ures,
      activo: item.activo
    })
    setDrawerMode('view')
    setShowDrawer(true)
  }
  
  // Abrir drawer para crear
  const handleCreate = () => {
    setSelectedItem(null)
    setFormData({
      descrip: '',
      marca: '',
      modelo: '',
      num_serie: '',
      depenadsc: '',
      ures: '',
      activo: 1
    })
    setDrawerMode('create')
    setShowDrawer(true)
  }
  
  // Abrir drawer para editar
  const handleEdit = (item) => {
    setSelectedItem(item)
    setFormData({
      descrip: item.descrip,
      marca: item.marca,
      modelo: item.modelo,
      num_serie: item.num_serie,
      depenadsc: item.depenadsc,
      ures: item.ures,
      activo: item.activo
    })
    setDrawerMode('edit')
    setShowDrawer(true)
  }
  
  // Cerrar drawer
  const handleCloseDrawer = () => {
    setShowDrawer(false)
    setSelectedItem(null)
    setDrawerMode('view')
  }
  
  // Manejar cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }
  
  // Guardar (crear o actualizar)
  const handleSave = async () => {
    try {
      const sessionId = getSessionId()
      
      // Usar proxy local para evitar CORS
      const url = drawerMode === 'create' 
        ? `${API_BASE}/patrimonioci/insertar`
        : `${API_BASE}/patrimonioci/actualizar/${selectedItem.id_pat_ci}`
      
      const method = drawerMode === 'create' ? 'POST' : 'PUT'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-UMICH-Session': sessionId || ''
        },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          id_pat_ci: selectedItem?.id_pat_ci || 0
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast.success(drawerMode === 'create' ? 'Creado exitosamente' : 'Actualizado exitosamente')
        handleCloseDrawer()
        if (drawerMode === 'create' && data.data?.id) {
          const createdId = parseInt(data.data.id)
          setCurrentId(createdId)
          setSearchId(String(createdId))
          loadCurrentItem(createdId)
        } else {
          loadCurrentItem(currentId)
        }
      } else {
        toast.error('Error al guardar: ' + (data.message || response.statusText))
      }
    } catch (error) {
      console.error('Error guardando:', error)
      toast.error('Error al guardar datos')
    }
  }

  const showValue = (value) => {
    if (value === undefined || value === null || value === '') return 'Sin dato'
    return value
  }
  
  // Buscar por ID específico
  const handleSearch = async () => {
    if (!searchId.trim()) {
      toast.warning('Ingresa un ID para buscar')
      return
    }
    
    const id = parseInt(searchId.trim())
    if (isNaN(id)) {
      toast.error('El ID debe ser un número')
      return
    }
    
    setLoading(true)
    const foundItem = await loadById(id)
    setLoading(false)
    
    if (foundItem) {
      setItem(foundItem)
      setCurrentId(id)
      toast.success(`Registro ${id} cargado`)
    } else {
      setItem(null)
      setCurrentId(id)
      toast.error(`No se encontró el registro con ID ${id}`)
    }
  }
  
  return (
    <div className="interno-view">
      {/* Header */}
      <div className="view-header">
        <div>
          <h1>Patrimonio Interno</h1>
        </div>
        <div className="header-actions">
          <button className="btn-refresh" onClick={() => loadCurrentItem(currentId)} disabled={loading}>
            <FaSync className={loading ? 'spinning' : ''} /> Actualizar
          </button>
          <button className="btn-primary" onClick={handleCreate}>
            <FaPlus /> Crear Nuevo
          </button>
        </div>
      </div>
      
      {/* Búsqueda por ID */}
      <div className="search-bar">
        <input
          type="number"
          placeholder="Buscar por ID..."
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          className="search-input"
        />
        <button 
          className="btn-search"
          onClick={handleSearch}
          disabled={loading}
        >
          Buscar
        </button>
      </div>
      
      {/* Tabla */}
      <div className="table-container">
        {loading ? (
          <div className="loading-state">Cargando...</div>
        ) : !item ? (
          <div className="empty-state">No hay datos disponibles</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Descripción</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th>No. Serie</th>
                <th>Dependencia</th>
                <th>URES</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr key={item.id_pat_ci} className="clickable-row" onClick={() => handleView(item)}>
                <td>{item.id_pat_ci}</td>
                <td>{item.descrip}</td>
                <td>{item.marca}</td>
                <td>{item.modelo}</td>
                <td>{item.num_serie}</td>
                <td>{item.depenadsc}</td>
                <td>{item.ures}</td>
                <td>
                  <span className={`badge ${item.activo === 1 ? 'badge-success' : 'badge-danger'}`}>
                    {item.activo === 1 ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn-icon btn-edit"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit(item)
                      }}
                      title="Editar"
                    >
                      <FaEdit />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
      
      {/* Drawer */}
      {showDrawer && (
        <>
          <div className="drawer-overlay open" onClick={handleCloseDrawer} />
          <div className="drawer-panel open" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h2>
                  {drawerMode === 'view' && 'Detalle Patrimonio Interno'}
                  {drawerMode === 'create' && 'Crear Nuevo Patrimonio'}
                  {drawerMode === 'edit' && 'Editar Patrimonio'}
                </h2>
                {(drawerMode === 'view' || drawerMode === 'edit') && (
                  <p className="drawer-subtitle">
                    ID {showValue(selectedItem?.id_pat_ci)} · Estado {selectedItem?.activo === 1 ? 'Activo' : 'Inactivo'}
                  </p>
                )}
              </div>
              <button className="btn-close" onClick={handleCloseDrawer}>×</button>
            </div>
            
            <div className="drawer-content">
              {drawerMode === 'view' && (
                <>
                  <div className="drawer-summary">
                    <div className="summary-card">
                      <span className="summary-label">Descripción</span>
                      <span className="summary-value">{showValue(formData.descrip)}</span>
                    </div>
                    <div className="summary-card">
                      <span className="summary-label">Estado</span>
                      <span className="summary-value">{formData.activo === 1 ? 'Activo' : 'Inactivo'}</span>
                    </div>
                  </div>

                  <div className="drawer-section">
                    <h3>Información del bien</h3>
                    <div className="detail-grid two-cols">
                      <div className="detail-item"><span className="detail-label">ID</span><span className="detail-value">{showValue(selectedItem?.id_pat_ci)}</span></div>
                      <div className="detail-item"><span className="detail-label">Descripción</span><span className="detail-value">{showValue(formData.descrip)}</span></div>
                      <div className="detail-item"><span className="detail-label">Marca</span><span className="detail-value">{showValue(formData.marca)}</span></div>
                      <div className="detail-item"><span className="detail-label">Modelo</span><span className="detail-value">{showValue(formData.modelo)}</span></div>
                      <div className="detail-item"><span className="detail-label">Número de Serie</span><span className="detail-value">{showValue(formData.num_serie)}</span></div>
                    </div>
                  </div>

                  <div className="drawer-section">
                    <h3>Asignación</h3>
                    <div className="detail-grid two-cols">
                      <div className="detail-item"><span className="detail-label">Dependencia</span><span className="detail-value">{showValue(formData.depenadsc)}</span></div>
                      <div className="detail-item"><span className="detail-label">URES</span><span className="detail-value">{showValue(formData.ures)}</span></div>
                      <div className="detail-item"><span className="detail-label">Estado</span><span className="detail-value">{formData.activo === 1 ? 'Activo' : 'Inactivo'}</span></div>
                    </div>
                  </div>
                </>
              )}

              {drawerMode !== 'view' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Descripción</label>
                    <input
                      type="text"
                      name="descrip"
                      value={formData.descrip}
                      onChange={handleInputChange}
                      disabled={drawerMode === 'view'}
                      placeholder="Descripción del bien"
                    />
                  </div>

                  <div className="form-group">
                    <label>Marca</label>
                    <input
                      type="text"
                      name="marca"
                      value={formData.marca}
                      onChange={handleInputChange}
                      disabled={drawerMode === 'view'}
                      placeholder="Marca"
                    />
                  </div>

                  <div className="form-group">
                    <label>Modelo</label>
                    <input
                      type="text"
                      name="modelo"
                      value={formData.modelo}
                      onChange={handleInputChange}
                      disabled={drawerMode === 'view'}
                      placeholder="Modelo"
                    />
                  </div>

                  <div className="form-group">
                    <label>Número de Serie</label>
                    <input
                      type="text"
                      name="num_serie"
                      value={formData.num_serie}
                      onChange={handleInputChange}
                      disabled={drawerMode === 'view'}
                      placeholder="Número de serie"
                    />
                  </div>

                  <div className="form-group">
                    <label>Dependencia</label>
                    <input
                      type="text"
                      name="depenadsc"
                      value={formData.depenadsc}
                      onChange={handleInputChange}
                      disabled={drawerMode === 'view'}
                      placeholder="Dependencia"
                    />
                  </div>

                  <div className="form-group">
                    <label>URES</label>
                    <input
                      type="text"
                      name="ures"
                      value={formData.ures}
                      onChange={handleInputChange}
                      disabled={drawerMode === 'view'}
                      placeholder="URES"
                    />
                  </div>

                  <div className="form-group">
                    <label>Estado</label>
                    <select
                      name="activo"
                      value={formData.activo}
                      onChange={handleInputChange}
                      disabled={drawerMode === 'view'}
                    >
                      <option value={1}>Activo</option>
                      <option value={0}>Inactivo</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            
            <div className="drawer-footer">
              {drawerMode === 'view' ? (
                <>
                  <button className="btn-secondary" onClick={handleCloseDrawer}>
                    Cerrar
                  </button>
                  <button className="btn-primary" onClick={() => setDrawerMode('edit')}>
                    Editar
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-secondary" onClick={handleCloseDrawer}>
                    Cancelar
                  </button>
                  <button className="btn-primary" onClick={handleSave}>
                    {drawerMode === 'create' ? 'Crear' : 'Guardar Cambios'}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default InternoView
