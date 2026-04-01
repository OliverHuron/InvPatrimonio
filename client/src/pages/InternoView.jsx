// =====================================================
// VISTA: Patrimonio Interno (PatrimonioCI)
// API: /api/patrimonioci - Soporta GET, POST, PUT
// =====================================================

import React, { useState, useEffect } from 'react'
import { FaPlus, FaEdit, FaSync, FaEye } from 'react-icons/fa'
import { toast } from 'react-toastify'
import './InternoView.css'

const InternoView = () => {
  // CAMBIO: Usar proxy local para evitar problemas CORS
  const API_BASE = 'http://localhost:5000/api/patrimonio-api'
  
  // Obtener sessionId de localStorage
  const getSessionId = () => localStorage.getItem('sessionId')
  
  // Estados
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState('view') // 'view', 'create', 'edit'
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
  const [searchId, setSearchId] = useState('')
  
  // IDs conocidos (guardados localmente)
  const [knownIds, setKnownIds] = useState(() => {
    const saved = localStorage.getItem('patrimonio_known_ids')
    return saved ? JSON.parse(saved) : [42]
  })
  
  // Guardar IDs conocidos en localStorage
  const saveKnownIds = (ids) => {
    const uniqueIds = [...new Set(ids.filter(id => id && id > 0))]
    setKnownIds(uniqueIds)
    localStorage.setItem('patrimonio_known_ids', JSON.stringify(uniqueIds))
  }
  
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
  
  // Cargar todos los IDs conocidos
  const loadData = async () => {
    try {
      setLoading(true)
      
      const loadedItems = []
      for (const id of knownIds) {
        const item = await loadById(id)
        if (item) loadedItems.push(item)
      }
      
      setItems(loadedItems)
      
      if (loadedItems.length === 0) {
        toast.info('No se encontraron registros. Usa la búsqueda por ID.')
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
      toast.error('Error al cargar datos')
      setItems([])
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    loadData()
  }, [])
  
  // Abrir modal para ver detalles
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
    setModalMode('view')
    setShowModal(true)
  }
  
  // Abrir modal para crear
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
    setModalMode('create')
    setShowModal(true)
  }
  
  // Abrir modal para editar
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
    setModalMode('edit')
    setShowModal(true)
  }
  
  // Cerrar modal
  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedItem(null)
    setModalMode('view')
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
      const url = modalMode === 'create' 
        ? `${API_BASE}/patrimonioci/insertar`
        : `${API_BASE}/patrimonioci/actualizar/${selectedItem.id_pat_ci}`
      
      const method = modalMode === 'create' ? 'POST' : 'PUT'
      
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
        // Si es creación y devuelve un ID, guardarlo en los conocidos
        if (modalMode === 'create' && data.data?.id) {
          saveKnownIds([...knownIds, data.data.id])
        }
        
        toast.success(modalMode === 'create' ? 'Creado exitosamente' : 'Actualizado exitosamente')
        handleCloseModal()
        loadData()
      } else {
        toast.error('Error al guardar: ' + (data.message || response.statusText))
      }
    } catch (error) {
      console.error('Error guardando:', error)
      toast.error('Error al guardar datos')
    }
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
    const item = await loadById(id)
    setLoading(false)
    
    if (item) {
      // Agregar a la lista si no existe
      if (!items.find(i => i.id_pat_ci === item.id_pat_ci)) {
        setItems(prev => [...prev, item])
      } else {
        // Actualizar el existente
        setItems(prev => prev.map(i => i.id_pat_ci === item.id_pat_ci ? item : i))
      }
      // Guardar en IDs conocidos
      if (!knownIds.includes(id)) {
        saveKnownIds([...knownIds, id])
      }
      toast.success(`Registro ${id} cargado`)
    } else {
      toast.error(`No se encontró el registro con ID ${id}`)
    }
    setSearchId('')
  }
  
  return (
    <div className="interno-view">
      {/* Header */}
      <div className="view-header">
        <div>
          <h1>Patrimonio Interno (CI)</h1>
          <p>Gestión de patrimonio interno con API PatrimonioCI</p>
        </div>
        <div className="header-actions">
          <button className="btn-refresh" onClick={loadData} disabled={loading}>
            <FaSync className={loading ? 'spinning' : ''} /> Actualizar
          </button>
          <button className="btn-primary" onClick={handleCreate}>
            <FaPlus /> Crear Nuevo
          </button>
        </div>
      </div>
      
      {/* Búsqueda por ID */}
      <div className="search-bar" style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '20px',
        padding: '15px',
        background: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <input
          type="number"
          placeholder="Buscar por ID..."
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          style={{
            flex: 1,
            padding: '10px 15px',
            border: '1px solid #ddd',
            borderRadius: '5px',
            fontSize: '14px'
          }}
        />
        <button 
          onClick={handleSearch}
          disabled={loading}
          style={{
            padding: '10px 20px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          🔍 Buscar
        </button>
        <span style={{ alignSelf: 'center', color: '#666', fontSize: '13px' }}>
          IDs cargados: {knownIds.join(', ')}
        </span>
      </div>
      
      {/* Tabla */}
      <div className="table-container">
        {loading ? (
          <div className="loading-state">Cargando...</div>
        ) : items.length === 0 ? (
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
              {items.map((item) => (
                <tr key={item.id_pat_ci}>
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
                        className="btn-icon btn-view" 
                        onClick={() => handleView(item)}
                        title="Ver detalles"
                      >
                        <FaEye />
                      </button>
                      <button 
                        className="btn-icon btn-edit" 
                        onClick={() => handleEdit(item)}
                        title="Editar"
                      >
                        <FaEdit />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {modalMode === 'view' && 'Detalles del Patrimonio'}
                {modalMode === 'create' && 'Crear Nuevo Patrimonio'}
                {modalMode === 'edit' && 'Editar Patrimonio'}
              </h2>
              <button className="btn-close" onClick={handleCloseModal}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Descripción</label>
                  <input
                    type="text"
                    name="descrip"
                    value={formData.descrip}
                    onChange={handleInputChange}
                    disabled={modalMode === 'view'}
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
                    disabled={modalMode === 'view'}
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
                    disabled={modalMode === 'view'}
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
                    disabled={modalMode === 'view'}
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
                    disabled={modalMode === 'view'}
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
                    disabled={modalMode === 'view'}
                    placeholder="URES"
                  />
                </div>
                
                <div className="form-group">
                  <label>Estado</label>
                  <select
                    name="activo"
                    value={formData.activo}
                    onChange={handleInputChange}
                    disabled={modalMode === 'view'}
                  >
                    <option value={1}>Activo</option>
                    <option value={0}>Inactivo</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              {modalMode === 'view' ? (
                <>
                  <button className="btn-secondary" onClick={handleCloseModal}>
                    Cerrar
                  </button>
                  <button className="btn-primary" onClick={() => setModalMode('edit')}>
                    Editar
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-secondary" onClick={handleCloseModal}>
                    Cancelar
                  </button>
                  <button className="btn-primary" onClick={handleSave}>
                    {modalMode === 'create' ? 'Crear' : 'Guardar Cambios'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InternoView
