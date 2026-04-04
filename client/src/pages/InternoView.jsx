// =====================================================
// VISTA: Patrimonio Interno (PatrimonioCI)
// API: /api/patrimonioci - Soporta GET, POST, PUT
// =====================================================

import React, { useState, useEffect, useRef } from 'react'
import { FaPlus, FaEdit, FaEye, FaSync, FaUpload, FaCamera, FaFileExcel, FaTrash } from 'react-icons/fa'
import { toast } from 'react-toastify'
import './InternoView.css'

const InternoView = () => {
  const PAGE_SIZE = 500
  const API_BASE_URL = process.env.REACT_APP_API_URL || '/api'
  const API_BASE = `${API_BASE_URL.replace(/\/$/, '')}`
  const BACKEND_BASE_URL = process.env.REACT_APP_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : '')
  const [photoRefreshTs, setPhotoRefreshTs] = useState(0)
  const tableScrollRef = useRef(null)
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
    resguardante: '',
    ubicacion: '',
    anio_elaboracion: '',
    estado: ''
  })
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    pages: 1
  })
  const [filterOptions, setFilterOptions] = useState({
    responsables: [],
    resguardantes: [],
    ubicaciones: [],
    aniosElaboracion: []
  })
  const [filterOptionsLoaded, setFilterOptionsLoaded] = useState(false)
  
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
    ubicacion: '',
    recurso: '',
    proveedor: '',
    fecha_elaboracion: '',
    observaciones: '',
    estado_uso: '1-Bueno',
    estado_localizacion: 'Localizado Activo',
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
    ubicacion: data.ubicacion || data.ubicacion_edificio || '',
    recurso: data.recurso || data.insauro || '',
    proveedor: data.proveedor || '',
    fecha_elaboracion: normalizeDate(data.fecha_elaboracion),
    observaciones: data.observaciones || '',
    estado_uso: data.estado_uso || '1-Bueno',
    estado_localizacion: data.estado_localizacion || (data.activo ? 'Localizado Activo' : 'Localizado No Activo'),
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

  // Cargar opciones de filtros una sola vez (todos los datos sin filtros)
  const loadFilterOptions = async () => {
    if (filterOptionsLoaded) return
    const sessionId = getSessionId()
    try {
      const params = new URLSearchParams({ page: '1', limit: '10000' })
      const response = await fetch(`${API_BASE}/patrimonioci?${params.toString()}`, {
        credentials: 'include',
        headers: { 'X-UMICH-Session': sessionId || '' }
      })

      if (!response.ok) return

      const data = await response.json()
      const payload = data?.data || {}
      const records = payload.items || []
      const normalized = records.map(normalizeInterno)

      setFilterOptions({
        responsables: [...new Set(normalized.map((x) => x.entrega_responsable).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
        resguardantes: [...new Set(normalized.map((x) => x.responsable_usuario).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
        ubicaciones: [...new Set(normalized.map((x) => x.ubicacion).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
        aniosElaboracion: [...new Set(normalized
          .map((x) => (x.fecha_elaboracion ? String(x.fecha_elaboracion).slice(0, 4) : ''))
          .filter((year) => /^\d{4}$/.test(year))
        )].sort((a, b) => Number(b) - Number(a))
      })
      setFilterOptionsLoaded(true)
    } catch (error) {
      console.error('Error cargando filter options:', error)
    }
  }
  
  const loadAllItems = async (appliedFilters = filters, targetPage = 1) => {
    const sessionId = getSessionId()
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(targetPage), limit: String(PAGE_SIZE) })
      if (appliedFilters.q) params.set('q', appliedFilters.q)
      if (appliedFilters.responsable) params.set('responsable', appliedFilters.responsable)
      if (appliedFilters.resguardante) params.set('resguardante', appliedFilters.resguardante)
      if (appliedFilters.ubicacion) params.set('ubicacion', appliedFilters.ubicacion)
      if (appliedFilters.anio_elaboracion) params.set('anio_elaboracion', appliedFilters.anio_elaboracion)
      if (appliedFilters.estado) params.set('estado', appliedFilters.estado)

      const response = await fetch(`${API_BASE}/patrimonioci?${params.toString()}`, {
        credentials: 'include',
        headers: { 'X-UMICH-Session': sessionId || '' }
      })

      if (!response.ok) {
        throw new Error(`Error ${response.status}`)
      }

      const data = await response.json()
      const payload = data?.data || {}
      const records = payload.items || []
      const normalized = records.map(normalizeInterno)
      setItems(normalized)
      if (tableScrollRef.current) {
        tableScrollRef.current.scrollTop = 0
      }
      setPagination((prev) => ({
        ...prev,
        page: payload.page || targetPage,
        total: payload.total || 0,
        pages: Math.max(1, Math.ceil((payload.total || 0) / PAGE_SIZE))
      }))
    } catch (error) {
      console.error('Error cargando internos:', error)
      toast.error('Error al cargar datos')
      setItems([])
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    loadFilterOptions()
    loadAllItems(filters, 1)
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
        ubicacion: '',
        recurso: '',
      proveedor: '',
      fecha_elaboracion: '',
      observaciones: '',
      estado_uso: '1-Bueno',
      estado_localizacion: 'Localizado Activo',
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
    loadAllItems(nextFilters, 1)
  }

  const handleClearFilters = () => {
    const emptyFilters = {
      q: '',
      responsable: '',
      resguardante: '',
      ubicacion: '',
      anio_elaboracion: '',
      estado: ''
    }
    setFilters(emptyFilters)
    loadAllItems(emptyFilters, 1)
  }

  const handlePageChange = (nextPage) => {
    if (nextPage < 1 || nextPage > pagination.pages || nextPage === pagination.page) return
    loadAllItems(filters, nextPage)
  }

  const toCsvCell = (value) => {
    if (value === null || value === undefined) return '""'
    const safe = String(value).replace(/"/g, '""')
    return `"${safe}"`
  }

  const handleExportExcel = async () => {
    const sessionId = getSessionId()
    try {
      setLoading(true)
      const allRows = []
      let currentPage = 1
      let totalPages = 1

      while (currentPage <= totalPages) {
        const params = new URLSearchParams({ page: String(currentPage), limit: String(PAGE_SIZE) })
        if (filters.q) params.set('q', filters.q)
        if (filters.responsable) params.set('responsable', filters.responsable)
        if (filters.resguardante) params.set('resguardante', filters.resguardante)
        if (filters.ubicacion) params.set('ubicacion', filters.ubicacion)
        if (filters.anio_elaboracion) params.set('anio_elaboracion', filters.anio_elaboracion)
        if (filters.estado) params.set('estado', filters.estado)

        const response = await fetch(`${API_BASE}/patrimonioci?${params.toString()}`, {
          credentials: 'include',
          headers: { 'X-UMICH-Session': sessionId || '' }
        })

        if (!response.ok) throw new Error(`Error ${response.status}`)

        const data = await response.json()
        const payload = data?.data || {}
        const normalized = (payload.items || []).map(normalizeInterno)
        allRows.push(...normalized)
        totalPages = payload.pages || 1
        currentPage += 1
      }

      const headers = [
        'UUID',
        'No. Patrimonio',
        'No. Registro',
        'Descripcion',
        'Marca',
        'Modelo',
        'No. Serie',
        'No. Factura',
        'Costo',
        'URES Asignacion',
        'Ubicacion',
        'Recurso',
        'Proveedor',
        'Fecha Elaboracion',
        'Observaciones',
        'Estado Uso',
        'Estado Localizacion',
        'Entrega Responsable',
        'Responsable Usuario',
        'Numero Empleado Usuario',
        'UR',
        'Activo',
        'Fecha Creacion',
        'Fecha Actualizacion',
        'Usuario Creacion',
        'Usuario Actualizacion'
      ]

      const lines = [
        headers.join(','),
        ...allRows.map((row) => ([
          toCsvCell(row.uuid || ''),
          toCsvCell(row.numero_registro_patrimonial || ''),
          toCsvCell(row.no_registro || ''),
          toCsvCell(row.descripcion || ''),
          toCsvCell(row.marca || ''),
          toCsvCell(row.modelo || ''),
          toCsvCell(row.no_serie || ''),
          toCsvCell(row.no_factura || ''),
          toCsvCell(row.costo || ''),
          toCsvCell(row.ures_asignacion || ''),
          toCsvCell(row.ubicacion || ''),
          toCsvCell(row.recurso || ''),
          toCsvCell(row.proveedor || ''),
          toCsvCell(row.fecha_elaboracion ? String(row.fecha_elaboracion).slice(0, 10) : ''),
          toCsvCell(row.observaciones || ''),
          toCsvCell(row.estado_uso || ''),
          toCsvCell(getEstadoLocalizacion(row)),
          toCsvCell(row.entrega_responsable || ''),
          toCsvCell(row.responsable_usuario || ''),
          toCsvCell(row.numero_empleado_usuario || ''),
          toCsvCell(row.ur || ''),
          toCsvCell(row.activo ? 'Sí' : 'No'),
          toCsvCell(row.fecha_creacion ? String(row.fecha_creacion).slice(0, 10) : ''),
          toCsvCell(row.fecha_actualizacion ? String(row.fecha_actualizacion).slice(0, 10) : ''),
          toCsvCell(row.usuario_creacion || ''),
          toCsvCell(row.usuario_actualizacion || '')
        ].join(',')))
      ]

      const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `inventario_interno_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success(`Exportado: ${allRows.length} registros`)
    } catch (error) {
      console.error('Error exportando:', error)
      toast.error('Error al exportar a Excel')
    } finally {
      setLoading(false)
    }
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
        body: JSON.stringify({
          ...formData,
          activo: formData.estado_localizacion === 'Localizado Activo'
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast.success(drawerMode === 'create' ? 'Creado exitosamente' : 'Actualizado exitosamente')
        handleCloseDrawer()
        if (drawerMode === 'create' && data.data?.id) {
          await loadAllItems(filters, 1)
        } else {
          await loadAllItems(filters, pagination.page)
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

  const getEstadoBadgeClass = (estado) => {
    if (estado === 'Localizado Activo') return 'badge-success'
    if (estado === 'Localizado No Activo') return 'badge-danger'
    return 'badge-neutral'
  }

  const getEstadoLocalizacion = (item) => {
    return item?.estado_localizacion || (item?.activo === 1 ? 'Localizado Activo' : 'Localizado No Activo')
  }
  
  return (
    <div className="interno-view">
      {/* Header */}
      <div className="view-header">
        <div>
          <h1>Patrimonio Interno</h1>
        </div>
        <div className="header-actions">
          <button className="btn-refresh" onClick={() => loadAllItems(filters, pagination.page)} disabled={loading}>
            <FaSync className={loading ? 'spinning' : ''} /> Actualizar
          </button>
          <button className="btn-secondary" onClick={handleExportExcel} disabled={loading}>
            <FaFileExcel /> Exportar Excel
          </button>
          <button className="btn-primary" onClick={handleCreate}>
            <FaPlus /> Crear Nuevo
          </button>
        </div>
      </div>

      <div className="search-bar">
        <div className="search-row search-row-main">
          <input
            className="search-input"
            type="text"
            name="q"
            value={filters.q}
            onChange={handleFilterChange}
            placeholder="Búsqueda inteligente"
          />
        </div>
        <div className="search-row search-row-filters">
          <select className="search-input" name="resguardante" value={filters.resguardante} onChange={handleFilterChange}>
            <option value="">Resguardante (todos)</option>
            {filterOptions.resguardantes.map((resguardante) => (
              <option key={resguardante} value={resguardante}>{resguardante}</option>
            ))}
          </select>
          <select className="search-input" name="responsable" value={filters.responsable} onChange={handleFilterChange}>
            <option value="">Responsable (todos)</option>
            {filterOptions.responsables.map((responsable) => (
              <option key={responsable} value={responsable}>{responsable}</option>
            ))}
          </select>
          <select className="search-input" name="ubicacion" value={filters.ubicacion} onChange={handleFilterChange}>
            <option value="">Ubicación (todas)</option>
            {filterOptions.ubicaciones.map((ubicacion) => (
              <option key={ubicacion} value={ubicacion}>{ubicacion}</option>
            ))}
          </select>
          <select className="search-input" name="anio_elaboracion" value={filters.anio_elaboracion} onChange={handleFilterChange}>
            <option value="">Año elaboración (todos)</option>
            {filterOptions.aniosElaboracion.map((anio) => (
              <option key={anio} value={anio}>{anio}</option>
            ))}
          </select>
          <select className="search-input" name="estado" value={filters.estado} onChange={handleFilterChange}>
            <option value="">Estado (todos)</option>
            <option value="Localizado Activo">Localizado Activo</option>
            <option value="Localizado No Activo">Localizado No Activo</option>
            <option value="No Localizado">No Localizado</option>
          </select>
          <button className="btn-secondary search-clear-btn" onClick={handleClearFilters} disabled={loading}>Limpiar</button>
        </div>
      </div>
      
      {/* Tabla */}
      <div className="table-container">
        {loading ? (
          <div className="loading-state">Cargando...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">No hay datos disponibles</div>
        ) : (
          <>
            <div className="table-header">
              <div className="table-header-row">
                <div className="th">ID</div>
                <div className="th">No. Patrimonio</div>
                <div className="th">Descripción</div>
                <div className="th">No. Serie</div>
                <div className="th">Responsable</div>
                <div className="th">Resguardante</div>
                <div className="th">Estado</div>
                <div className="th">Acciones</div>
              </div>
            </div>
            <div className="table-body" ref={tableScrollRef}>
              {items.map((item) => (
                <div key={item.id} className="table-row">
                  <div className="td" title={item.id}>
                    {item.id}
                  </div>
                  <div className="td" title={item.numero_registro_patrimonial || ''}>
                    {item.numero_registro_patrimonial}
                  </div>
                  <div className="td" title={item.descripcion || ''}>
                    {item.descripcion}
                  </div>
                  <div className="td" title={item.no_serie || ''}>
                    {item.no_serie}
                  </div>
                  <div className="td" title={item.entrega_responsable || ''}>
                    {item.entrega_responsable}
                  </div>
                  <div className="td" title={item.responsable_usuario || 'Sin dato'}>
                    {item.responsable_usuario || 'Sin dato'}
                  </div>
                  <div className="td td-estado">
                    <span className={`badge ${getEstadoBadgeClass(getEstadoLocalizacion(item))}`}>
                      {getEstadoLocalizacion(item)}
                    </span>
                  </div>
                  <div className="td">
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
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {!loading && pagination.pages > 1 && (
        <div className="pagination-bar">
          <button className="btn-secondary" onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page === 1}>
            Anterior
          </button>
          <div className="pagination-pages">
            {Array.from({ length: pagination.pages }, (_, idx) => {
              const pageNumber = idx + 1
              return (
                <button
                  key={pageNumber}
                  type="button"
                  className={`pagination-page ${pagination.page === pageNumber ? 'active' : ''}`}
                  onClick={() => handlePageChange(pageNumber)}
                >
                  {pageNumber}
                </button>
              )
            })}
          </div>
          <button className="btn-secondary" onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page === pagination.pages}>
            Siguiente
          </button>
        </div>
      )}
      
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
                    Estado {getEstadoLocalizacion(selectedItem)}
                  </p>
                )}
              </div>
              <button className="btn-close" onClick={handleCloseDrawer}>×</button>
            </div>
            
            <div className="drawer-content">
              {drawerMode === 'view' && (
                <>
                  <div className="drawer-section">
                    <h3>Identificación del bien</h3>
                    <div className="detail-grid two-cols">
                      <div className="detail-item"><span className="detail-label">No. Patrimonio</span><span className="detail-value">{showValue(formData.numero_registro_patrimonial)}</span></div>
                      <div className="detail-item"><span className="detail-label">Descripción</span><span className="detail-value">{showValue(formData.descripcion)}</span></div>
                      <div className="detail-item"><span className="detail-label">Marca</span><span className="detail-value">{showValue(formData.marca)}</span></div>
                      <div className="detail-item"><span className="detail-label">Modelo</span><span className="detail-value">{showValue(formData.modelo)}</span></div>
                      <div className="detail-item"><span className="detail-label">No. de Serie</span><span className="detail-value">{showValue(formData.no_serie)}</span></div>
                      <div className="detail-item"><span className="detail-label">No. Factura</span><span className="detail-value">{showValue(formData.no_factura)}</span></div>
                      <div className="detail-item"><span className="detail-label">UUID (folio fiscal)</span><span className="detail-value">{showValue(formData.uuid)}</span></div>
                    </div>
                  </div>

                  <div className="drawer-section">
                    <h3>Control Interno</h3>
                    <div className="detail-grid two-cols">
                      <div className="detail-item"><span className="detail-label">Ubicación</span><span className="detail-value">{showValue(formData.ubicacion)}</span></div>
                      <div className="detail-item"><span className="detail-label">Responsable</span><span className="detail-value">{showValue(formData.entrega_responsable)}</span></div>
                      <div className="detail-item"><span className="detail-label">Resguardante (usuario)</span><span className="detail-value">{showValue(formData.responsable_usuario)}</span></div>
                      <div className="detail-item"><span className="detail-label">Número de empleado (usuario)</span><span className="detail-value">{showValue(formData.numero_empleado_usuario)}</span></div>
                      <div className="detail-item"><span className="detail-label">UR</span><span className="detail-value">{showValue(formData.ur)}</span></div>
                      <div className="detail-item"><span className="detail-label">URES de asignación</span><span className="detail-value">{showValue(formData.ures_asignacion)}</span></div>
                    </div>
                  </div>

                  <div className="drawer-section">
                    <h3>Información Contable</h3>
                    <div className="detail-grid two-cols">
                      <div className="detail-item"><span className="detail-label">Elaboró</span><span className="detail-value">{showValue(formData.usuario_creacion)}</span></div>
                      <div className="detail-item"><span className="detail-label">Recurso</span><span className="detail-value">{showValue(formData.recurso)}</span></div>
                      <div className="detail-item"><span className="detail-label">Proveedor</span><span className="detail-value">{showValue(formData.proveedor)}</span></div>
                      <div className="detail-item"><span className="detail-label">Fecha de elaboración</span><span className="detail-value">{showValue(formData.fecha_elaboracion)}</span></div>
                      <div className="detail-item"><span className="detail-label">Costo</span><span className="detail-value">{showValue(formData.costo)}</span></div>
                      <div className="detail-item"><span className="detail-label">Estado de uso</span><span className="detail-value">{showValue(formData.estado_uso)}</span></div>
                      <div className="detail-item"><span className="detail-label">Estado</span><span className="detail-value">{showValue(formData.estado_localizacion)}</span></div>
                      <div className="detail-item"><span className="detail-label">Observaciones</span><span className="detail-value">{showValue(formData.observaciones)}</span></div>
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
                    <label>No. Patrimonio</label>
                    <input type="text" name="numero_registro_patrimonial" value={formData.numero_registro_patrimonial || ''} onChange={handleInputChange} />
                  </div>

                  <div className="form-group">
                    <label>No. Patrimonio (alterno)</label>
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
                    <input type="text" name="ubicacion" value={formData.ubicacion || ''} onChange={handleInputChange} />
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
                    <select name="estado_localizacion" value={formData.estado_localizacion || 'Localizado Activo'} onChange={handleInputChange}>
                      <option value="Localizado Activo">Localizado Activo</option>
                      <option value="Localizado No Activo">Localizado No Activo</option>
                      <option value="No Localizado">No Localizado</option>
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
                                <FaUpload />
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
                              <label className={`btn-secondary btn-upload ${(!selectedItem?.id || uploadingOrden === orden) ? 'disabled' : ''}`} title="Tomar foto">
                                <FaCamera />
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
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
