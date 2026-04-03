// =====================================================
// VISTA: Patrimonio Interno (PatrimonioCI)
// API: /api/patrimonioci - Soporta GET, POST, PUT
// =====================================================

import React, { useState, useEffect } from 'react'
import { FaPlus, FaEdit, FaEye, FaSync, FaTrash } from 'react-icons/fa'
import { toast } from 'react-toastify'
import './InternoView.css'

const InternoView = () => {
  const API_BASE_URL = process.env.REACT_APP_API_URL || '/api'
  const API_BASE = `${API_BASE_URL.replace(/\/$/, '')}`
  const BACKEND_BASE_URL = process.env.REACT_APP_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : '')
  const [photoRefreshTs, setPhotoRefreshTs] = useState(0)
  const normalizeDate = (value) => (value ? String(value).split('T')[0] : '')
  const toFileUrl = (ruta) => {
    if (!ruta) return ''
    const cleanPath = String(ruta).replace(/^\/+/, '')
    return `${BACKEND_BASE_URL}/${cleanPath}?v=${photoRefreshTs}`
  }
  
  // Obtener sessionId de localStorage
  const getSessionId = () => localStorage.getItem('sessionId')
  
  // Estados
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [drawerMode, setDrawerMode] = useState('view') // 'view', 'create', 'edit'
  const [selectedItem, setSelectedItem] = useState(null)
  const [fotos, setFotos] = useState([])
  const [brokenFotos, setBrokenFotos] = useState({})
  const [uploadingOrden, setUploadingOrden] = useState(null)
  const [categoriasEntrega, setCategoriasEntrega] = useState([])
  const [entregaPath, setEntregaPath] = useState([])
  const [entregaManualMode, setEntregaManualMode] = useState(false)
  const [filters, setFilters] = useState({
    q: '',
    responsable: '',
    ubicacion_edificio: '',
    fecha_elaboracion: '',
    estado: ''
  })
  const [filterOptions, setFilterOptions] = useState({
    responsables: [],
    ubicaciones: []
  })
  
  // Form data
  const [formData, setFormData] = useState({
    numero_registro_patrimonial: '',
    no_registro: '',
    descripcion: '',
    usuario_creacion: '',
    marca: '',
    modelo: '',
    no_serie: '',
    no_factura: '',
    uuid: '',
    costo: '',
    ures_asignacion: '',
    ubicacion_edificio: '',
    recurso: '',
    proveedor: '',
    fecha_elaboracion: '',
    observaciones: '',
    estado_uso: '1-Bueno',
    entrega_responsable: '',
    responsable_usuario: '',
    numero_empleado_usuario: '',
    ur: '',
    activo: 1
  })
  
  const normalizeInterno = (data) => ({
    id: data.id,
    numero_registro_patrimonial: data.numero_registro_patrimonial || '',
    no_registro: data.no_registro || data.no_obsequio || '',
    descripcion: data.descripcion || '',
    usuario_creacion: data.usuario_creacion || '',
    marca: data.marca || '',
    modelo: data.modelo || '',
    no_serie: data.no_serie || data.no_docente || data.numero_serie || '',
    no_factura: data.no_factura || '',
    uuid: data.uuid || '',
    costo: data.costo || '',
    ures_asignacion: data.ures_asignacion || data.llaves_adquisicion || '',
    ubicacion_edificio: data.ubicacion_edificio || data.ubicacion || '',
    recurso: data.recurso || data.insauro || '',
    proveedor: data.proveedor || '',
    fecha_elaboracion: normalizeDate(data.fecha_elaboracion),
    observaciones: data.observaciones || '',
    estado_uso: data.estado_uso || '1-Bueno',
    entrega_responsable: data.entrega_responsable || data.dependencia || '',
    responsable_usuario: data.responsable_usuario || '',
    numero_empleado_usuario: data.numero_empleado_usuario || '',
    ur: data.ur || data.ures || '',
    activo: data.activo ? 1 : 0
  })

  const parseEntregaPath = (value = '') => {
    const raw = String(value || '').trim()
    if (!raw) return []
    return raw.split('>').map((p) => p.trim()).filter(Boolean)
  }

  const updateEntregaFromPath = (pathParts) => {
    const value = (pathParts || []).filter(Boolean).join(' > ')
    setFormData((prev) => ({ ...prev, entrega_responsable: value }))
  }
  
  const loadAllItems = async (appliedFilters = filters) => {
    const sessionId = getSessionId()
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: '1', limit: '500' })
      if (appliedFilters.q) params.set('q', appliedFilters.q)
      if (appliedFilters.responsable) params.set('responsable', appliedFilters.responsable)
      if (appliedFilters.ubicacion_edificio) params.set('ubicacion_edificio', appliedFilters.ubicacion_edificio)
      if (appliedFilters.fecha_elaboracion) params.set('fecha_elaboracion', appliedFilters.fecha_elaboracion)
      if (appliedFilters.estado) params.set('estado', appliedFilters.estado)

      const response = await fetch(`${API_BASE}/patrimonioci?${params.toString()}`, {
        credentials: 'include',
        headers: { 'X-UMICH-Session': sessionId || '' }
      })

      if (!response.ok) {
        throw new Error(`Error ${response.status}`)
      }

      const data = await response.json()
      const records = data?.data?.items || []
      const normalized = records.map(normalizeInterno)
      setItems(normalized)
      setFilterOptions({
        responsables: [...new Set(normalized.map((x) => x.entrega_responsable).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
        ubicaciones: [...new Set(normalized.map((x) => x.ubicacion_edificio).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      })
    } catch (error) {
      console.error('Error cargando internos:', error)
      toast.error('Error al cargar datos')
      setItems([])
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    loadAllItems()
    loadEntregaOptions()
  }, [])

  const loadEntregaOptions = async () => {
    const sessionId = getSessionId()
    try {
      const response = await fetch(`${API_BASE}/categorias/entrega`, {
        credentials: 'include',
        headers: { 'X-UMICH-Session': sessionId || '' }
      })
      const data = await response.json()
      if (!data.success) return
      const opciones = (data.data || [])
        .filter((cat) => cat && cat.codigo && cat.nombre)
        .map((cat) => ({
          id: cat.id,
          padre_id: cat.padre_id,
          nivel: cat.nivel,
          orden: cat.orden ?? 0,
          codigo: String(cat.codigo),
          nombre: String(cat.nombre),
          label: `${cat.codigo}. ${cat.nombre}`.replace(/\.\s\./g, '.')
        }))
      setCategoriasEntrega(opciones)
    } catch (error) {
      console.error('Error cargando catálogo de entrega:', error)
      setCategoriasEntrega([])
    }
  }
  
  // Abrir drawer para ver detalles
  const handleView = (item) => {
    setSelectedItem(item)
    setFormData({ ...item })
    setEntregaPath(parseEntregaPath(item.entrega_responsable))
    setDrawerMode('view')
    setShowDrawer(true)
    setBrokenFotos({})
    loadFotos(item.id)
  }
  
  // Abrir drawer para crear
  const handleCreate = () => {
    setSelectedItem(null)
      setFormData({
      numero_registro_patrimonial: '',
      no_registro: '',
      descripcion: '',
      usuario_creacion: '',
      marca: '',
      modelo: '',
      no_serie: '',
      no_factura: '',
      uuid: '',
        costo: '',
        ures_asignacion: '',
        ubicacion_edificio: '',
        recurso: '',
      proveedor: '',
      fecha_elaboracion: '',
      observaciones: '',
      estado_uso: '1-Bueno',
      entrega_responsable: '',
      responsable_usuario: '',
      numero_empleado_usuario: '',
      ur: '',
      activo: 1
    })
    setEntregaPath([])
    setEntregaManualMode(false)
    setDrawerMode('create')
    setShowDrawer(true)
    setFotos([])
  }
  
  // Abrir drawer para editar
  const handleEdit = (item) => {
    setSelectedItem(item)
    setFormData({ ...item })
    setEntregaPath(parseEntregaPath(item.entrega_responsable))
    setEntregaManualMode(false)
    setDrawerMode('edit')
    setShowDrawer(true)
    setBrokenFotos({})
    loadFotos(item.id)
  }
  
  // Cerrar drawer
  const handleCloseDrawer = () => {
    setShowDrawer(false)
    setSelectedItem(null)
    setDrawerMode('view')
    setFotos([])
    setBrokenFotos({})
    setEntregaPath([])
    setEntregaManualMode(false)
  }

  const categoriasOrdenadas = categoriasEntrega
    .sort((a, b) => (a.orden - b.orden) || a.codigo.localeCompare(b.codigo, undefined, { numeric: true }))
  const findByLabel = (label) => categoriasOrdenadas.find((c) => c.label === label)
  const nodoActual = entregaPath.length ? findByLabel(entregaPath[entregaPath.length - 1]) : null
  const parentIdActual = nodoActual ? Number(nodoActual.id) : null
  const opcionesEntregaActual = categoriasOrdenadas.filter((c) => {
    if (parentIdActual === null) return c.padre_id === null
    return Number(c.padre_id) === parentIdActual
  })

  const handleEntregaStep = (value) => {
    if (!value) return
    if (value === '__MANUAL__') {
      setEntregaManualMode(true)
      setEntregaPath([])
      return
    }
    if (value === '__UP__') {
      const next = entregaPath.slice(0, -1)
      setEntregaPath(next)
      updateEntregaFromPath(next)
      setEntregaManualMode(false)
      return
    }
    const next = [...entregaPath, value]
    setEntregaPath(next)
    updateEntregaFromPath(next)
    setEntregaManualMode(false)
  }

  const loadFotos = async (id) => {
    const sessionId = getSessionId()
    try {
      const response = await fetch(`${API_BASE}/patrimonioci/${id}/fotos`, {
        credentials: 'include',
        headers: { 'X-UMICH-Session': sessionId || '' }
      })
      const data = await response.json()
      if (!data.success) return setFotos([])
      setFotos(data.data || [])
    } catch (error) {
      console.error('Error cargando fotos:', error)
      setFotos([])
    }
  }

  const getFotoByOrden = (orden) => fotos.find((f) => Number(f.orden) === orden)

  const convertImageToWebpFile = (file, id, orden) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('No se pudo procesar imagen'))
        ctx.drawImage(img, 0, 0)
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('No se pudo convertir a WebP'))
          resolve(new File([blob], `${id}_${orden}.webp`, { type: 'image/webp' }))
        }, 'image/webp', 0.82)
      }
      img.onerror = () => reject(new Error('Imagen inválida'))
      img.src = reader.result
    }
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.readAsDataURL(file)
  })

  const handleUploadFoto = async (orden, file) => {
    if (!selectedItem?.id || !file) return
    const sessionId = getSessionId()
    try {
      setUploadingOrden(orden)
      const webpFile = await convertImageToWebpFile(file, selectedItem.id, orden)
      const form = new FormData()
      form.append('foto', webpFile)
      const response = await fetch(`${API_BASE}/patrimonioci/${selectedItem.id}/fotos/${orden}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-UMICH-Session': sessionId || '' },
        body: form
      })
      const data = await response.json()
      if (!data.success) throw new Error(data.message || 'No se pudo subir la foto')
      setBrokenFotos((prev) => ({
        ...prev,
        [`view-${orden}`]: false,
        [`edit-${orden}`]: false
      }))
      setPhotoRefreshTs(Date.now())
      toast.success(`Foto ${orden} actualizada`)
      loadFotos(selectedItem.id)
    } catch (error) {
      console.error('Error subiendo foto:', error)
      toast.error(error.message || 'Error subiendo foto')
    } finally {
      setUploadingOrden(null)
    }
  }

  const handleDeleteFoto = async (orden) => {
    if (!selectedItem?.id) return
    const sessionId = getSessionId()
    try {
      const response = await fetch(`${API_BASE}/patrimonioci/${selectedItem.id}/fotos/${orden}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-UMICH-Session': sessionId || '' }
      })
      const data = await response.json()
      if (!data.success) throw new Error(data.message || 'No se pudo eliminar la foto')
      setPhotoRefreshTs(Date.now())
      toast.success(`Foto ${orden} eliminada`)
      loadFotos(selectedItem.id)
    } catch (error) {
      console.error('Error eliminando foto:', error)
      toast.error(error.message || 'Error eliminando foto')
    }
  }
  
  // Manejar cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    const nextFilters = { ...filters, [name]: value }
    setFilters(nextFilters)
    loadAllItems(nextFilters)
  }

  const handleClearFilters = () => {
    const emptyFilters = {
      q: '',
      responsable: '',
      ubicacion_edificio: '',
      fecha_elaboracion: '',
      estado: ''
    }
    setFilters(emptyFilters)
    loadAllItems(emptyFilters)
  }
  
  // Guardar (crear o actualizar)
  const handleSave = async () => {
    try {
      const sessionId = getSessionId()
      
      // Usar proxy local para evitar CORS
      const url = drawerMode === 'create' 
        ? `${API_BASE}/patrimonioci/insertar`
        : `${API_BASE}/patrimonioci/actualizar/${selectedItem.id}`
      
      const method = drawerMode === 'create' ? 'POST' : 'PUT'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-UMICH-Session': sessionId || ''
        },
        credentials: 'include',
        body: JSON.stringify({ ...formData })
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast.success(drawerMode === 'create' ? 'Creado exitosamente' : 'Actualizado exitosamente')
        handleCloseDrawer()
        if (drawerMode === 'create' && data.data?.id) {
          await loadAllItems()
        } else {
          await loadAllItems()
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
  
  return (
    <div className="interno-view">
      {/* Header */}
      <div className="view-header">
        <div>
          <h1>Patrimonio Interno</h1>
        </div>
        <div className="header-actions">
          <button className="btn-refresh" onClick={loadAllItems} disabled={loading}>
            <FaSync className={loading ? 'spinning' : ''} /> Actualizar
          </button>
          <button className="btn-primary" onClick={handleCreate}>
            <FaPlus /> Crear Nuevo
          </button>
        </div>
      </div>

      <div className="search-bar">
          <input
          className="search-input"
          type="text"
          name="q"
          value={filters.q}
          onChange={handleFilterChange}
          placeholder="Búsqueda inteligente"
        />
        <select className="search-input" name="responsable" value={filters.responsable} onChange={handleFilterChange}>
          <option value="">Responsable (todos)</option>
          {filterOptions.responsables.map((responsable) => (
            <option key={responsable} value={responsable}>{responsable}</option>
          ))}
        </select>
        <select className="search-input" name="ubicacion_edificio" value={filters.ubicacion_edificio} onChange={handleFilterChange}>
          <option value="">Ubicación (todas)</option>
          {filterOptions.ubicaciones.map((ubicacion) => (
            <option key={ubicacion} value={ubicacion}>{ubicacion}</option>
          ))}
        </select>
        <input
          className="search-input"
          type="date"
          name="fecha_elaboracion"
          value={filters.fecha_elaboracion}
          onChange={handleFilterChange}
          title="Fecha de elaboración"
        />
        <select className="search-input" name="estado" value={filters.estado} onChange={handleFilterChange}>
          <option value="">Estado (todos)</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </select>
        <button className="btn-secondary" onClick={handleClearFilters} disabled={loading}>Limpiar</button>
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
                <th>No. Registro</th>
                <th>Descripción</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th>No. Serie</th>
                <th>Responsable</th>
                <th>UR</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.numero_registro_patrimonial}</td>
                  <td>{item.descripcion}</td>
                  <td>{item.marca}</td>
                  <td>{item.modelo}</td>
                  <td>{item.no_serie}</td>
                  <td>{item.entrega_responsable}</td>
                  <td>{item.ur}</td>
                  <td>
                    <span className={`badge ${item.activo === 1 ? 'badge-success' : 'badge-danger'}`}>
                      {item.activo === 1 ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon btn-view"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleView(item)
                        }}
                        title="Ver detalle"
                      >
                        <FaEye />
                      </button>
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
              ))}
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
                    Estado {selectedItem?.activo === 1 ? 'Activo' : 'Inactivo'}
                  </p>
                )}
              </div>
              <button className="btn-close" onClick={handleCloseDrawer}>×</button>
            </div>
            
            <div className="drawer-content">
              {drawerMode === 'view' && (
                <>
                  <div className="drawer-section">
                    <h3>Detalle Patrimonio</h3>
                    <div className="detail-grid two-cols">
                      <div className="detail-item"><span className="detail-label">Número de registro patrimonial</span><span className="detail-value">{showValue(formData.numero_registro_patrimonial)}</span></div>
                      <div className="detail-item"><span className="detail-label">No. de Registro</span><span className="detail-value">{showValue(formData.no_registro)}</span></div>
                      <div className="detail-item"><span className="detail-label">Descripción</span><span className="detail-value">{showValue(formData.descripcion)}</span></div>
                      <div className="detail-item"><span className="detail-label">Elaboró</span><span className="detail-value">{showValue(formData.usuario_creacion)}</span></div>
                      <div className="detail-item"><span className="detail-label">Marca</span><span className="detail-value">{showValue(formData.marca)}</span></div>
                      <div className="detail-item"><span className="detail-label">Modelo</span><span className="detail-value">{showValue(formData.modelo)}</span></div>
                      <div className="detail-item"><span className="detail-label">No. de Serie</span><span className="detail-value">{showValue(formData.no_serie)}</span></div>
                      <div className="detail-item"><span className="detail-label">No. Factura</span><span className="detail-value">{showValue(formData.no_factura)}</span></div>
                      <div className="detail-item"><span className="detail-label">UUID (folio fiscal)</span><span className="detail-value">{showValue(formData.uuid)}</span></div>
                      <div className="detail-item"><span className="detail-label">Costo</span><span className="detail-value">{showValue(formData.costo)}</span></div>
                      <div className="detail-item"><span className="detail-label">URES de asignación</span><span className="detail-value">{showValue(formData.ures_asignacion)}</span></div>
                      <div className="detail-item"><span className="detail-label">Ubicación</span><span className="detail-value">{showValue(formData.ubicacion_edificio)}</span></div>
                      <div className="detail-item"><span className="detail-label">Recurso</span><span className="detail-value">{showValue(formData.recurso)}</span></div>
                      <div className="detail-item"><span className="detail-label">Proveedor</span><span className="detail-value">{showValue(formData.proveedor)}</span></div>
                      <div className="detail-item"><span className="detail-label">Fecha de elaboración</span><span className="detail-value">{showValue(formData.fecha_elaboracion)}</span></div>
                      <div className="detail-item"><span className="detail-label">Observaciones</span><span className="detail-value">{showValue(formData.observaciones)}</span></div>
                      <div className="detail-item"><span className="detail-label">Estado de uso</span><span className="detail-value">{showValue(formData.estado_uso)}</span></div>
                      <div className="detail-item"><span className="detail-label">Responsable</span><span className="detail-value">{showValue(formData.entrega_responsable)}</span></div>
                      <div className="detail-item"><span className="detail-label">Resguardante (usuario)</span><span className="detail-value">{showValue(formData.responsable_usuario)}</span></div>
                      <div className="detail-item"><span className="detail-label">Número de empleado (usuario)</span><span className="detail-value">{showValue(formData.numero_empleado_usuario)}</span></div>
                      <div className="detail-item"><span className="detail-label">UR</span><span className="detail-value">{showValue(formData.ur)}</span></div>
                      <div className="detail-item"><span className="detail-label">Estado</span><span className="detail-value">{formData.activo === 1 ? 'Activo' : 'Inactivo'}</span></div>
                    </div>
                  </div>

                  <div className="drawer-section">
                    <h3>Fotografía del bien</h3>
                    <div className="photo-slots">
                      {[1, 2, 3].map((orden) => {
                        const foto = getFotoByOrden(orden)
                        return (
                          <div className="photo-slot" key={`view-photo-${orden}`}>
                            <div className="photo-slot-header">
                              <span>Foto {orden}</span>
                              <span className="photo-name">{selectedItem?.id ? `${selectedItem.id}_${orden}` : `slot_${orden}`}</span>
                            </div>
                            {foto && !brokenFotos[`view-${orden}`] ? (
                              <img
                                className="photo-preview"
                                src={toFileUrl(foto.ruta_archivo)}
                                alt={`Foto ${orden}`}
                                onError={() => setBrokenFotos((prev) => ({ ...prev, [`view-${orden}`]: true }))}
                              />
                            ) : (
                              <div className="photo-empty">Sin imagen</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}

              {drawerMode !== 'view' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Número de registro patrimonial</label>
                    <input type="text" name="numero_registro_patrimonial" value={formData.numero_registro_patrimonial || ''} onChange={handleInputChange} />
                  </div>

                  <div className="form-group">
                    <label>No. de Registro</label>
                    <input type="text" name="no_registro" value={formData.no_registro || ''} onChange={handleInputChange} />
                  </div>

                  <div className="form-group">
                    <label>Descripción</label>
                    <input type="text" name="descripcion" value={formData.descripcion || ''} onChange={handleInputChange} />
                  </div>

                  <div className="form-group">
                    <label>Elaboró</label>
                    <input type="text" name="usuario_creacion" value={formData.usuario_creacion || ''} onChange={handleInputChange} />
                  </div>

                  <div className="form-group">
                    <label>Marca</label>
                    <input type="text" name="marca" value={formData.marca || ''} onChange={handleInputChange} />
                  </div>

                  <div className="form-group">
                    <label>Modelo</label>
                    <input type="text" name="modelo" value={formData.modelo || ''} onChange={handleInputChange} />
                  </div>

                  <div className="form-group">
                    <label>No. de serie</label>
                    <input type="text" name="no_serie" value={formData.no_serie || ''} onChange={handleInputChange} />
                  </div>

                  <div className="form-group">
                    <label>No. Factura</label>
                    <input type="text" name="no_factura" value={formData.no_factura || ''} onChange={handleInputChange} />
                  </div>

                  <div className="form-group">
                    <label>UUID (folio fiscal)</label>
                    <input type="text" name="uuid" value={formData.uuid || ''} disabled />
                  </div>

                  <div className="form-group">
                    <label>Costo</label>
                    <input type="number" step="0.01" name="costo" value={formData.costo || ''} onChange={handleInputChange} />
                  </div>

                  <div className="form-group">
                    <label>URES de asignación</label>
                    <input type="text" name="ures_asignacion" value={formData.ures_asignacion || ''} onChange={handleInputChange} />
                  </div>

                  <div className="form-group">
                    <label>Ubicación</label>
                    <input type="text" name="ubicacion_edificio" value={formData.ubicacion_edificio || ''} onChange={handleInputChange} />
                  </div>

                  <div className="form-group">
                    <label>Recurso</label>
                    <input type="text" name="recurso" value={formData.recurso || ''} onChange={handleInputChange} />
                  </div>

                  <div className="form-group">
                    <label>Proveedor</label>
                    <input type="text" name="proveedor" value={formData.proveedor || ''} onChange={handleInputChange} />
                  </div>

                  <div className="form-group">
                    <label>Fecha de elaboración</label>
                    <input type="date" name="fecha_elaboracion" value={formData.fecha_elaboracion || ''} onChange={handleInputChange} />
                  </div>

                  <div className="form-group">
                    <label>Observaciones</label>
                    <input type="text" name="observaciones" value={formData.observaciones || ''} onChange={handleInputChange} />
                  </div>

                  <div className="form-group">
                    <label>Estado de uso</label>
                    <select name="estado_uso" value={formData.estado_uso || '1-Bueno'} onChange={handleInputChange}>
                      <option value="1-Bueno">1-Bueno</option>
                      <option value="2-Regular">2-Regular</option>
                      <option value="3-Malo">3-Malo</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Responsable</label>
                    <select
                      value=""
                      className="select-cascade-control"
                      title={formData.entrega_responsable || 'Seleccionar responsable'}
                      onChange={(e) => handleEntregaStep(e.target.value)}
                    >
                      <option value="">
                        {entregaPath.length === 0 ? 'Seleccionar responsable' : 'Selecciona categoría dependiente'}
                      </option>
                      <option value="__MANUAL__">Manual (escribir nombre)</option>
                      {entregaPath.length > 0 && <option value="__UP__">← Subir un nivel</option>}
                      {opcionesEntregaActual.map((opt) => (
                        <option key={opt.id} value={opt.label} title={opt.label}>{opt.label}</option>
                      ))}
                    </select>
                    {entregaManualMode && (
                      <input
                        type="text"
                        name="entrega_responsable"
                        value={formData.entrega_responsable || ''}
                        onChange={handleInputChange}
                        placeholder="Escribe el nombre manualmente"
                        style={{ marginTop: '0.4rem' }}
                      />
                    )}
                  </div>

                  <div className="form-group">
                    <label>Resguardante (usuario)</label>
                    <input type="text" name="responsable_usuario" value={formData.responsable_usuario || ''} onChange={handleInputChange} />
                  </div>

                  <div className="form-group">
                    <label>Número de empleado (usuario)</label>
                    <input type="text" name="numero_empleado_usuario" value={formData.numero_empleado_usuario || ''} onChange={handleInputChange} />
                  </div>

                  <div className="form-group">
                    <label>UR</label>
                    <input type="text" name="ur" value={formData.ur || ''} onChange={handleInputChange} />
                  </div>

                  <div className="form-group">
                    <label>Estado</label>
                    <select name="activo" value={formData.activo} onChange={handleInputChange}>
                      <option value={1}>Activo</option>
                      <option value={0}>Inactivo</option>
                    </select>
                  </div>

                  <div className="form-group form-group-full">
                    <label>Fotografía del bien (máximo 3)</label>
                    {!selectedItem?.id && drawerMode === 'create' && (
                      <div className="photo-helper">Primero guarda el registro para habilitar fotos.</div>
                    )}
                    <div className="photo-slots">
                      {[1, 2, 3].map((orden) => {
                        const foto = getFotoByOrden(orden)
                        return (
                          <div className="photo-slot" key={`edit-photo-${orden}`}>
                            <div className="photo-slot-header">
                              <span>Foto {orden}</span>
                              <span className="photo-name">{selectedItem?.id ? `${selectedItem.id}_${orden}` : `slot_${orden}`}</span>
                            </div>
                            {foto && !brokenFotos[`edit-${orden}`] ? (
                              <img
                                className="photo-preview"
                                src={toFileUrl(foto.ruta_archivo)}
                                alt={`Foto ${orden}`}
                                onError={() => setBrokenFotos((prev) => ({ ...prev, [`edit-${orden}`]: true }))}
                              />
                            ) : (
                              <div className="photo-empty">Sin imagen</div>
                            )}
                            <div className="photo-actions">
                              <label className={`btn-secondary btn-upload ${(!selectedItem?.id || uploadingOrden === orden) ? 'disabled' : ''}`}>
                                Subir
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={!selectedItem?.id || uploadingOrden === orden}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) handleUploadFoto(orden, file)
                                    e.target.value = ''
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                className="btn-icon btn-delete-photo"
                                onClick={() => handleDeleteFoto(orden)}
                                disabled={!selectedItem?.id || !foto || uploadingOrden === orden}
                                title="Eliminar foto"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
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
