// =====================================================
// VISTA: Patrimonio Interno (PatrimonioCI)
// API: /api/patrimonioci - Soporta GET, POST, PUT
// =====================================================

import React, { useState, useEffect, useRef } from 'react'
import { FaPlus, FaEdit, FaEye, FaSync, FaUpload, FaCamera, FaFileExcel, FaTrash, FaChevronDown, FaFileCode } from 'react-icons/fa'
import { toast } from 'react-toastify'
import './InternoView.css'

const InternoView = () => {
  const PAGE_SIZE = 500
  const API_BASE_URL = process.env.REACT_APP_API_URL || '/api'
  const API_BASE = `${API_BASE_URL.replace(/\/$/, '')}`
  const BACKEND_BASE_URL = process.env.REACT_APP_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : '')
  const [photoRefreshTs, setPhotoRefreshTs] = useState(0)
  const tableScrollRef = useRef(null)
  const headerRowRef = useRef(null)
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
    ejercicio: '',
    estado: ''
  })
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    pages: 1
  })
  // Form state and UI helpers
  const [formData, setFormData] = useState({})
  const [collapsedSections, setCollapsedSections] = useState({})
  const [filterOptions, setFilterOptions] = useState({ responsables: [], resguardantes: [], ubicaciones: [], aniosElaboracion: [] })
  const [filterOptionsLoaded, setFilterOptionsLoaded] = useState(false)

  const toggleSection = (sectionKey) => {
    setCollapsedSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }))
  }
  // XML state + ref for file input
  const [xmlInfo, setXmlInfo] = useState({ exists: false, filename: '', content: '', url: '' })
  const xmlInputRef = useRef(null)
  const [xmlModal, setXmlModal] = useState({ open: false, filename: '', content: '', id: null, url: '' })

  const closeXmlModal = () => setXmlModal({ open: false, filename: '', content: '', id: null })

  const openXmlModal = async (item) => {
    if (!item || !item.id) {
      // If there's no id (new record), open drawer instead
      handleView(item)
      setCollapsedSections((prev) => ({ ...prev, xml: false }))
      return
    }

    try {
      setLoading(true)
      const sessionId = getSessionId()
      const resp = await fetch(`${API_BASE}/patrimonioci/${item.id}/xml`, {
        credentials: 'include',
        headers: { 'X-UMICH-Session': sessionId || '' }
      })

      if (resp.ok) {
        const data = await resp.json()
        if (data && data.success && data.data && data.data.exists) {
          // keep selectedItem in sync so delete/edit work from modal
          setSelectedItem(item)
          setXmlModal({
            open: true,
            filename: data.data.filename || `${item.id}.xml`,
            content: data.data.content || '',
            id: item.id,
            url: data.data.url || '',
            origin: data.data.origin || (data.data.url ? 'api' : 'local')
          })
          // If API only returned a URL (no inline content), ask server to proxy-fetch the content
          if ((!data.data.content || data.data.content === '') && data.data.url) {
            try {
              const proxyResp = await fetch(`${API_BASE}/patrimonioci/${item.id}/xml/proxy`, {
                credentials: 'include',
                headers: { 'X-UMICH-Session': sessionId || '' }
              })
              if (proxyResp.ok) {
                const proxyData = await proxyResp.json()
                if (proxyData && proxyData.success && proxyData.data && proxyData.data.content) {
                  setXmlModal((prev) => ({ ...prev, content: proxyData.data.content || '', url: proxyData.data.url || prev.url, origin: proxyData.data.origin || prev.origin }))
                }
              }
            } catch (err) {
              console.error('Error proxy-fetching XML:', err)
            }
          }
          return
        }
      }
    } catch (err) {
      console.error('Error cargando XML para modal:', err)
    } finally {
      setLoading(false)
    }

    // Fallback: open drawer and show XML section
    handleView(item)
    setCollapsedSections((prev) => ({ ...prev, xml: false }))
  }

  // Metadata de campos y asignación por secciones.
  const FIELD_META = {
    id: { label: 'Id', type: 'text', readOnly: true },
    clave_patrimonial: { label: 'Clave patrimonial', type: 'text' },
    folio: { label: 'Folio', type: 'text' },
    descripcion: { label: 'Descripción', type: 'text' },
    marca: { label: 'Marca', type: 'text' },
    modelo: { label: 'Modelo', type: 'text' },
    no_serie: { label: 'Serie', type: 'text' },
    no_factura: { label: 'No. Factura', type: 'text' },
    fec_fact: { label: 'Fecha Factura', type: 'date' },
    uuid: { label: 'UUID (folio fiscal)', type: 'text', readOnly: true },
    cog: { label: 'COG', type: 'text' },
    cuenta: { label: 'Cuenta', type: 'text' },
    descripcion_cuenta: { label: 'Descripción Cuenta', type: 'text' },
    tipo_bien: { label: 'Tipo de bien', type: 'text' },
    ejercicio: { label: 'Ejercicio', type: 'text' },
    idcon: { label: 'IDCON', type: 'text' },
    proveedor: { label: 'Proveedor', type: 'text' },
    // fecha_elaboracion removed per request (DB control)
    costo: { label: 'Costo', type: 'number' },
    fecha_registro: { label: 'Fecha Registro', type: 'date' },
    fecha_asignacion: { label: 'Fecha Asignación', type: 'date' },
    fecha_aprobacion: { label: 'Fecha Aprobación', type: 'date' },
    estado: { label: 'Estado', type: 'select', options: ['Sin asignar', 'Localizado', 'Baja', 'No Localizado'] },
    comentarios: { label: 'Comentarios', type: 'text' },
    ubicacion: { label: 'Ubicación', type: 'text' },
    responsable: { label: 'Responsable', type: 'cascade' },
    solicitud_orden_compra: { label: 'Solicitud / Ord. Compra', type: 'text' },
    fondo: { label: 'Fondo', type: 'text' },
    cuenta_por_pagar: { label: 'Cuenta por pagar', type: 'text' },
    usu_asig: { label: 'Resguardante(Usuario Asignado)', type: 'text' },
    numero_empleado_usuario: { label: 'Número de empleado (usuario)', type: 'text' },
    ures_gasto: { label: 'Ures de gasto', type: 'text' },
    ures_asignacion: { label: 'URES de asignación', type: 'text' },
    // usuario_creacion: control DB-only field, not shown in form
    usuario_registro: { label: 'Usuario registro', type: 'text' }
  }

  // Definición de campos por sección. Si un campo aparece en más de una sección,
  // se repetirá automáticamente (duplicado/triplicado según pertenencias).
  const SECTION_LABELS = {
    rm: 'RM',
    identificacion: 'Identificación del bien',
    informacionContable: 'Información Contable',
    controlInterno: 'Control Interno'
  }

  const SECTION_FIELDS = {
    // RM: campos que deben aparecer también en la sección RM
    rm: [
      'id', 'descripcion', 'marca', 'modelo', 'no_serie', 'clave_patrimonial', 'usu_asig', 'responsable', 'ures_gasto', 'numero_empleado_usuario'
    ],
    // Identificación del bien (sin UUID ni No. Factura — esos van a Información Contable)
    identificacion: ['id','clave_patrimonial','descripcion','marca','modelo','no_serie'],
    // Información Contable (Folio, cuentas, proveedor, fechas, etc.) — incluye entrega_responsable, solicitud_orden_compra, fondo, cuenta_por_pagar, usuario_registro
    informacionContable: ['folio','usuario_registro','responsable','solicitud_orden_compra','fondo','cuenta_por_pagar','cog','cuenta','descripcion_cuenta','tipo_bien','ejercicio','idcon','proveedor','no_factura','fec_fact','uuid','costo','fecha_registro','fecha_asignacion','fecha_aprobacion','comentarios'],
    // Control Interno (incluye estado_uso y estado_localizacion). quitar campos contables que no pertenecen aquí
    controlInterno: ['ubicacion','usu_asig','numero_empleado_usuario','ures_gasto','ures_asignacion','estado']
  }

  const renderDetailField = (key) => {
    const meta = FIELD_META[key] || { label: key, type: 'text' }
    const value = key === 'id' ? (selectedItem?.id ?? formData.id) : (formData[key] ?? selectedItem?.[key])
    return (
      <div key={`detail-${key}`} className="detail-item">
        <span className="detail-label">{meta.label}</span>
        <span className="detail-value">{showValue(value)}</span>
      </div>
    )
  }

  const renderFormField = (key) => {
    const meta = FIELD_META[key] || { label: key, type: 'text' }
    // Special-case: responsable uses the cascade selector UI from above
    if (key === 'responsable') {
      return (
        <div key={`form-${key}`} className="form-group detail-item">
          <label>{meta.label}</label>
          <select
            value=""
            className="select-cascade-control"
            title={formData.responsable || 'Seleccionar responsable'}
            onChange={(e) => handleEntregaStep(e.target.value)}
          >
            <option value="">{entregaPath.length === 0 ? 'Seleccionar responsable' : 'Selecciona categoría dependiente'}</option>
            <option value="__MANUAL__">Manual (escribir nombre)</option>
            {entregaPath.length > 0 && <option value="__UP__">← Subir un nivel</option>}
            {opcionesEntregaActual.map((opt) => (
              <option key={opt.id} value={opt.label} title={opt.label}>{opt.label}</option>
            ))}
          </select>
          {entregaManualMode && (
            <input type="text" name="responsable" value={formData.responsable || ''} onChange={handleInputChange} placeholder="Escribe el nombre manualmente" style={{ marginTop: '0.4rem' }} />
          )}
        </div>
      )
    }

    if (meta.type === 'date') {
      return (
        <div key={`form-${key}`} className="form-group detail-item"><label>{meta.label}</label><input type="date" name={key} value={formData[key] || ''} onChange={handleInputChange} /></div>
      )
    }

    if (meta.type === 'number') {
      return (
        <div key={`form-${key}`} className="form-group detail-item"><label>{meta.label}</label><input type="number" step="0.01" name={key} value={formData[key] || ''} onChange={handleInputChange} /></div>
      )
    }

    if (meta.type === 'select') {
      return (
        <div key={`form-${key}`} className="form-group detail-item">
          <label>{meta.label}</label>
          <select name={key} value={formData[key] || meta.options?.[0] || ''} onChange={handleInputChange}>
            {(meta.options || []).map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
          </select>
        </div>
      )
    }

    // default: text
    if (meta.readOnly) {
      return (
        <div key={`form-${key}`} className="form-group detail-item"><label>{meta.label}</label><input type="text" name={key} value={formData[key] || ''} disabled /></div>
      )
    }

    return (
      <div key={`form-${key}`} className="form-group detail-item"><label>{meta.label}</label><input type="text" name={key} value={formData[key] || ''} onChange={handleInputChange} /></div>
    )
  }

  const renderSection = (sectionKey, mode = 'view') => {
    const fields = SECTION_FIELDS[sectionKey] || []
    return (
      <div className="drawer-section" key={`section-${sectionKey}`}>
                <div className="section-header" onClick={() => toggleSection(sectionKey)}>
                  <div className="section-left">
                    <h3>{SECTION_LABELS[sectionKey] || sectionKey}</h3>
                    {sectionKey === 'rm' && (
                      <button className="btn-secondary btn-export-rm" onClick={(e) => { e.stopPropagation(); handleExportRM(mode) }} title="Exportar RM">Exportar RM</button>
                    )}
                  </div>
                  <button className="section-toggle" aria-expanded={!collapsedSections[sectionKey]}><FaChevronDown className={collapsedSections[sectionKey] ? 'rotated' : ''} /></button>
                </div>
        {!collapsedSections[sectionKey] && (
          <div className="detail-grid two-cols">
            {fields.map((key) => (mode === 'view' ? renderDetailField(key) : renderFormField(key)))}
          </div>
        )}
      </div>
    )
  }

  const loadXmlInfo = async (id) => {
    if (!id) return setXmlInfo({ exists: false, filename: '', content: '' })
    try {
      const response = await fetch(`${API_BASE}/patrimonioci/${id}/xml`, { credentials: 'include' })
      if (!response.ok) return setXmlInfo({ exists: false, filename: '', content: '', url: '' })
      const data = await response.json()
      if (!data.success) return setXmlInfo({ exists: false, filename: '', content: '', url: '' })
      setXmlInfo(data.data || { exists: false, filename: '', content: '', url: '', origin: 'local' })
    } catch (error) {
      console.error('Error cargando XML:', error)
      setXmlInfo({ exists: false, filename: '', content: '', origin: 'local' })
    }
  }

  const handleXmlFileSelected = async (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    if (!selectedItem || !selectedItem.id) {
      toast.info('Guarda el registro antes de subir el XML')
      return
    }
    // If XML origin is from API, disallow uploading local XML
    if ((xmlInfo && xmlInfo.origin === 'api') || (xmlModal && xmlModal.origin === 'api')) {
      toast.info('No se puede subir XML: el fxml proviene de la API externa')
      if (xmlInputRef.current) xmlInputRef.current.value = null
      return
    }
    try {
      setLoading(true)
      const form = new FormData()
      form.append('xmlfile', file)
      const sessionId = getSessionId()
      const resp = await fetch(`${API_BASE}/patrimonioci/${selectedItem.id}/xml`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-UMICH-Session': sessionId || '' },
        body: form
      })
      const result = await resp.json()
      if (result.success) {
        toast.success('XML subido')
        await loadXmlInfo(selectedItem.id)
      } else {
        toast.error('Error subiendo XML')
      }
    } catch (error) {
      console.error('Error subiendo XML:', error)
      toast.error('Error subiendo XML')
    } finally {
      setLoading(false)
      // reset input
      if (xmlInputRef.current) xmlInputRef.current.value = null
    }
  }

  const handleDeleteXml = async (id) => {
    const targetId = id || selectedItem?.id
    if (!targetId) return
    // Prevent deletion if XML origin is external API
    const origin = (xmlModal && xmlModal.open && xmlModal.id === targetId) ? xmlModal.origin : (xmlInfo && xmlInfo.origin)
    if (origin === 'api') {
      toast.info('No se puede eliminar el XML: proviene de la API externa')
      return
    }
    try {
      setLoading(true)
      const sessionId = getSessionId()
      const resp = await fetch(`${API_BASE}/patrimonioci/${targetId}/xml`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-UMICH-Session': sessionId || '' }
      })
      const result = await resp.json()
      if (result.success) {
        toast.success('XML eliminado')
        setXmlInfo({ exists: false, filename: '', content: '' })
        if (xmlModal.open && xmlModal.id === targetId) closeXmlModal()
      } else {
        toast.error('Error eliminando XML')
      }
    } catch (error) {
      console.error('Error eliminando XML:', error)
      toast.error('Error eliminando XML')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenXml = (item) => {
    openXmlModal(item)
  }
  
  const normalizeInterno = (data) => ({
    id: data.id,
    clave_patrimonial: data.clave_patrimonial || data.numero_registro_patrimonial || '',
    folio: data.folio || data.no_registro || data.no_obsequio || '',
    descripcion: data.descripcion || '',
    marca: data.marca || '',
    modelo: data.modelo || '',
    no_serie: data.no_serie || data.no_docente || data.numero_serie || '',
    no_factura: data.no_factura || '',
    fec_fact: normalizeDate(data.fec_fact || data.fecha_factura),
    uuid: data.uuid || '',
    costo: data.costo || '',
    ures_asignacion: data.ures_asignacion || data.llaves_adquisicion || '',
    ures_gasto: data.ures_gasto || data.ur || data.ures || '',
    ubicacion: data.ubicacion || data.ubicacion_edificio || '',
    cog: data.cog || data.recurso || '',
    proveedor: data.proveedor || '',
    cuenta: data.cuenta || '',
    descripcion_cuenta: data.descripcion_cuenta || '',
    tipo_bien: data.tipo_bien || '',
    ejercicio: data.ejercicio || '',
    solicitud_orden_compra: data.solicitud_orden_compra || data.solicitud_ord_compra || '',
    fondo: data.fondo || '',
    cuenta_por_pagar: data.cuenta_por_pagar || '',
    idcon: data.idcon || '',
    usuario_registro: data.usuario_registro || data.usu_reg || '',
    fecha_registro: normalizeDate(data.fecha_registro),
    fecha_asignacion: normalizeDate(data.fecha_asignacion),
    fecha_aprobacion: normalizeDate(data.fecha_aprobacion),
    comentarios: data.comentarios || data.observaciones || '',
    estado: data.estado || 'Sin asignar',
    responsable: data.responsable || data.entrega_responsable || data.dependencia || '',
    usu_asig: data.usu_asig || data.responsable_usuario || '',
    numero_empleado_usuario: data.numero_empleado_usuario || ''
  })

  const parseEntregaPath = (value = '') => {
    const raw = String(value || '').trim()
    if (!raw) return []
    return raw.split('>').map((p) => p.trim()).filter(Boolean)
  }

  const updateEntregaFromPath = (pathParts) => {
    const value = (pathParts || []).filter(Boolean).join(' > ')
    setFormData((prev) => ({ ...prev, responsable: value }))
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
        responsables: [...new Set(normalized.map((x) => x.responsable).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
        resguardantes: [...new Set(normalized.map((x) => x.usu_asig).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
        ubicaciones: [...new Set(normalized.map((x) => x.ubicacion).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
        aniosElaboracion: [...new Set(normalized
            .map((x) => (x.ejercicio ? String(x.ejercicio) : ''))
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
      if (appliedFilters.ejercicio) params.set('ejercicio', appliedFilters.ejercicio)
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
    // prevent page-level vertical scrolling while this view is active
    document.body.classList.add('interno-active')
    loadFilterOptions()
    loadAllItems(filters, 1)
    loadEntregaOptions()

    return () => {
      document.body.classList.remove('interno-active')
    }
  }, [])

  // Measure internal scrollbar width and set CSS variable so header can reserve space
  useEffect(() => {
    const updateScrollbarWidth = () => {
      const el = tableScrollRef.current
      if (!el) return
      const scrollbarWidth = Math.max(0, el.offsetWidth - el.clientWidth)
      document.documentElement.style.setProperty('--table-scrollbar-width', `${scrollbarWidth}px`)
    }

    // initial
    updateScrollbarWidth()

    // update on resize and when table content changes
    window.addEventListener('resize', updateScrollbarWidth)
    let ro
    if (window.ResizeObserver && tableScrollRef.current) {
      ro = new ResizeObserver(updateScrollbarWidth)
      ro.observe(tableScrollRef.current)
    }

    return () => {
      window.removeEventListener('resize', updateScrollbarWidth)
      if (ro && tableScrollRef.current) ro.unobserve(tableScrollRef.current)
    }
  }, [items])

  // Sync header horizontal position with the scroll container to avoid clipping
  useEffect(() => {
    const scroller = tableScrollRef.current
    const headerRow = headerRowRef.current
    if (!scroller || !headerRow) return
    // If headerRow is inside the scroller, the browser will move it naturally
    // when the container scrolls; applying an extra transform causes a mismatch.
    if (scroller.contains(headerRow)) {
      headerRow.style.transform = ''
      return
    }

    const onScroll = () => {
      // translate the header row opposite to the scrollLeft so it stays aligned
      headerRow.style.transform = `translateX(${ -scroller.scrollLeft }px)`
    }

    scroller.addEventListener('scroll', onScroll, { passive: true })
    // initial sync
    onScroll()

    return () => scroller.removeEventListener('scroll', onScroll)
  }, [tableScrollRef.current, headerRowRef.current])

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
    setEntregaPath(parseEntregaPath(item.responsable))
    setDrawerMode('view')
    setShowDrawer(true)
    setBrokenFotos({})
    loadFotos(item.id)
    loadXmlInfo(item.id)
  }
  
  // Abrir drawer para crear
  const handleCreate = () => {
    setSelectedItem(null)
      setFormData({
      clave_patrimonial: '',
      folio: '',
      descripcion: '',
      marca: '',
      modelo: '',
      no_serie: '',
      no_factura: '',
      uuid: '',
      costo: '',
      ures_asignacion: '',
      ures_gasto: '',
      ubicacion: '',
      cog: '',
      proveedor: '',
      comentarios: '',
      estado: 'Sin asignar',
      responsable: '',
      usu_asig: '',
      numero_empleado_usuario: '',
      cuenta: '',
      descripcion_cuenta: '',
      tipo_bien: '',
      ejercicio: '',
      solicitud_orden_compra: '',
      fondo: '',
      cuenta_por_pagar: '',
      idcon: '',
      usuario_registro: ''
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
    setEntregaPath(parseEntregaPath(item.responsable))
    setEntregaManualMode(false)
    setDrawerMode('edit')
    setShowDrawer(true)
    setBrokenFotos({})
    loadFotos(item.id)
    loadXmlInfo(item.id)
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
      ejercicio: '',
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
        if (filters.ejercicio) params.set('ejercicio', filters.ejercicio)
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
        'Clave patrimonial',
        'Folio',
        'Descripcion',
        'Marca',
        'Modelo',
        'No. Serie',
        'No. Factura',
        'Costo',
        'URES Asignacion',
        'URES Gasto',
        'Ubicacion',
        'COG',
        'Proveedor',
        'Comentarios',
        'Estado',
        'Responsable',
        'Resguardante (Usuario Asignado)',
        'Numero Empleado Usuario',
        'Cuenta',
        'Descripcion Cuenta',
        'Tipo de bien',
        'Ejercicio',
        'Solicitud/Ord. Compra',
        'Fondo',
        'Cuenta por pagar',
        'IDCON',
        'Usuario registro',
        'Fec Registro',
        'Fec Asig',
        'Fec Aprob'
      ]

      const lines = [
        headers.join(','),
        ...allRows.map((row) => ([
          toCsvCell(row.uuid || ''),
          toCsvCell(row.clave_patrimonial || ''),
          toCsvCell(row.folio || ''),
          toCsvCell(row.descripcion || ''),
          toCsvCell(row.marca || ''),
          toCsvCell(row.modelo || ''),
          toCsvCell(row.no_serie || ''),
          toCsvCell(row.no_factura || ''),
          toCsvCell(row.costo || ''),
          toCsvCell(row.ures_asignacion || ''),
          toCsvCell(row.ures_gasto || ''),
          toCsvCell(row.ubicacion || ''),
          toCsvCell(row.cog || ''),
          toCsvCell(row.proveedor || ''),
          toCsvCell(row.comentarios || ''),
          toCsvCell(getEstadoLocalizacion(row)),
          toCsvCell(row.responsable || ''),
          toCsvCell(row.usu_asig || ''),
          toCsvCell(row.numero_empleado_usuario || ''),
          toCsvCell(row.cuenta || ''),
          toCsvCell(row.descripcion_cuenta || ''),
          toCsvCell(row.tipo_bien || ''),
          toCsvCell(row.ejercicio || ''),
          toCsvCell(row.solicitud_orden_compra || ''),
          toCsvCell(row.fondo || ''),
          toCsvCell(row.cuenta_por_pagar || ''),
          toCsvCell(row.idcon || ''),
          toCsvCell(row.usuario_registro || ''),
          toCsvCell(row.fecha_registro ? String(row.fecha_registro).slice(0, 10) : ''),
          toCsvCell(row.fecha_asignacion ? String(row.fecha_asignacion).slice(0, 10) : ''),
          toCsvCell(row.fecha_aprobacion ? String(row.fecha_aprobacion).slice(0, 10) : '')
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

  // Exportar CSV específico para la sección RM: descarga todos los registros
  // cuyo `entrega_responsable` coincida con el del elemento seleccionado.
  const handleExportRM = async (mode = 'view') => {
    const row = selectedItem || formData || {}
    const responsable = (row.responsable || row.usu_asig || '').trim()
    if (!responsable) {
      toast.info('El registro no tiene Responsable asignado')
      return
    }

    try {
      setLoading(true)
      const sessionId = getSessionId()
      const allRows = []
      let currentPage = 1
      let totalPages = 1

      while (currentPage <= totalPages) {
        const params = new URLSearchParams({ page: String(currentPage), limit: String(PAGE_SIZE) })
        params.set('responsable', responsable)
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

      if (allRows.length === 0) {
        toast.info('No se encontraron registros para ese Responsable')
        return
      }

      const headers = [
        'Descripción', 'Marca', 'Modelo', 'No. de Serie', 'No. de Patrimonio', 'No. de Resguardo Interno',
        'Estado', 'UR', 'No. de Empleado', 'Responsable', 'Puesto del Usuario Resguardante'
      ]

      const lines = [
        headers.join(','),
        ...allRows.map((r) => ([
          toCsvCell(r.descripcion || ''),
          toCsvCell(r.marca || ''),
          toCsvCell(r.modelo || ''),
          toCsvCell(r.no_serie || ''),
          toCsvCell(r.clave_patrimonial || ''),
          toCsvCell(r.folio || ''),
          toCsvCell(r.estado || r.estado_uso || ''),
          toCsvCell(r.ures_gasto || r.ur || ''),
          toCsvCell(r.numero_empleado_usuario || ''),
          toCsvCell(r.responsable || r.usu_asig || ''),
          toCsvCell('') // Puesto del Usuario Resguardante (no disponible)
        ].join(',')))
      ]

      const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const safeName = String(responsable).replace(/[^a-z0-9_\-]/gi, '_').slice(0, 80) || new Date().toISOString().slice(0, 10)
      link.setAttribute('download', `inventario_interno_rm_${safeName}_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success(`Exportado RM: ${allRows.length} registros`)
    } catch (error) {
      console.error('Error exportando RM:', error)
      toast.error('Error exportando RM')
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
        body: JSON.stringify({ ...formData })
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
    const s = String(estado || '').trim().toLowerCase()
    if (s === 'localizado') return 'badge-yellow'
    if (s === 'baja') return 'badge-green'
    if (s === 'no localizado') return 'badge-blue'
    return 'badge-neutral'
  }

  const getEstadoLocalizacion = (item) => {
    return item?.estado || 'Sin asignar'
  }

  // Resumen de resultados para mostrar en la UI
  const totalResults = pagination.total || 0
  const pageSize = PAGE_SIZE
  const resultsStart = totalResults === 0 ? 0 : ((pagination.page - 1) * pageSize) + 1
  const resultsEnd = Math.min(pagination.page * pageSize, totalResults)
  
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
        {/* Paginación superior eliminada para evitar duplicados */}
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
          <select className="search-input" name="ejercicio" value={filters.ejercicio} onChange={handleFilterChange}>
            <option value="">Ejercicio (todos)</option>
            {filterOptions.aniosElaboracion.map((anio) => (
              <option key={anio} value={anio}>{anio}</option>
            ))}
          </select>
          <select className="search-input" name="estado" value={filters.estado} onChange={handleFilterChange}>
            <option value="">Estado (todos)</option>
            <option value="Sin asignar">Sin asignar</option>
            <option value="Localizado">Localizado</option>
            <option value="Baja">Baja</option>
            <option value="No Localizado">No Localizado</option>
          </select>
          <button className="btn-secondary search-clear-btn" onClick={handleClearFilters} disabled={loading}>Limpiar</button>
        </div>
        <div className="search-row">
          <div className="results-summary">
            Mostrando {resultsStart} - {resultsEnd} de {totalResults} resultados
          </div>
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
          <div className="table-scroll" ref={tableScrollRef}>
            <div className="table-inner">
              <div className="table-header">
                <div className="table-header-row" ref={headerRowRef}>
                <div className="th col-id">ID</div>
                <div className="th col-num">No. Patrimonio</div>
                <div className="th col-desc">Descripción</div>
                <div className="th col-serie">No. Serie</div>
                <div className="th col-responsable">Responsable</div>
                <div className="th col-resguardante">Resguardante</div>
                <div className="th col-estado">Estado</div>
                <div className="th col-acciones">Acciones</div>
              </div>
            </div>

            <div className="table-body">
              {items.map((item) => (
                <div key={item.id} className="table-row">
                  <div className="td col-id" title={String(item.id)}>{item.id}</div>
                  <div className="td col-num" title={item.clave_patrimonial || ''}>{item.clave_patrimonial}</div>
                  <div className="td col-desc" title={item.descripcion || ''}>{item.descripcion}</div>
                  <div className="td col-serie" title={item.no_serie || ''}>{item.no_serie}</div>
                  <div className="td col-responsable" title={item.responsable || ''}>{item.responsable}</div>
                  <div className="td col-resguardante" title={item.usu_asig || 'Sin dato'}>{item.usu_asig || 'Sin dato'}</div>
                  <div className="td td-estado col-estado">
                    <span className={`badge ${getEstadoBadgeClass(getEstadoLocalizacion(item))}`}>
                      {getEstadoLocalizacion(item)}
                    </span>
                  </div>
                  <div className="td col-acciones">
                    <div className="action-buttons">
                      <button className="btn-icon btn-view" onClick={(e) => { e.stopPropagation(); handleView(item) }} title="Ver detalle"><FaEye /></button>
                      <button className="btn-icon btn-edit" onClick={(e) => { e.stopPropagation(); handleEdit(item) }} title="Editar"><FaEdit /></button>
                      <button className="btn-icon btn-xml" onClick={(e) => { e.stopPropagation(); handleOpenXml(item) }} title="Ver XML"><FaFileCode /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            </div>
            {/* Tablet hint and mobile cards moved outside the scrolling container */}
          </div>

          {/* Tablet hint: shown on intermediate widths */}
          <div className="table-hint" aria-hidden>
            Desliza para ver más columnas
          </div>

          {/* Mobile: card list (hidden on desktop/tablet via CSS) */}
          <div className="card-list">
            {items.map((item) => (
              <div key={`card-${item.id}`} className="asset-card">
                <div className="card-row">
                  <div className="card-title">{item.descripcion || 'Sin descripción'}</div>
                  <div className="card-badge">
                    <span className={`badge ${getEstadoBadgeClass(getEstadoLocalizacion(item))}`}>{getEstadoLocalizacion(item)}</span>
                  </div>
                </div>
                <div className="card-body">
                  <div><strong>ID:</strong> {item.id} {item.clave_patrimonial ? `- No. ${item.clave_patrimonial}` : ''}</div>
                  <div><strong>No. Serie:</strong> {item.no_serie || '—'}</div>
                  <div><strong>Responsable:</strong> {item.responsable || '—'}</div>
                  <div><strong>Resguardante:</strong> {item.usu_asig || '—'}</div>
                </div>
                <div className="card-actions">
                  <div className="action-buttons">
                    <button className="btn-icon btn-view" onClick={(e) => { e.stopPropagation(); handleView(item) }} title="Ver detalle"><FaEye /></button>
                    <button className="btn-icon btn-edit" onClick={(e) => { e.stopPropagation(); handleEdit(item) }} title="Editar"><FaEdit /></button>
                    <button className="btn-icon btn-xml" onClick={(e) => { e.stopPropagation(); handleOpenXml(item) }} title="Ver XML"><FaFileCode /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
        )}

        {/* Paginación */}
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
                    Estado {getEstadoLocalizacion(selectedItem)}
                  </p>
                )}
              </div>
              <button className="btn-close" onClick={handleCloseDrawer}>×</button>
            </div>
            
            <div className="drawer-content">
              {drawerMode === 'view' && (
                <>
                  {renderSection('rm', 'view')}
                  {renderSection('identificacion', 'view')}
                  {renderSection('informacionContable', 'view')}
                  {renderSection('controlInterno', 'view')}

                  <div className="drawer-section">
                    <div className="section-header" onClick={() => toggleSection('xml')}>
                      <div className="section-left">
                        <h3>XML del bien</h3>
                      </div>
                      <button className="section-toggle" aria-expanded={!collapsedSections.xml}><FaChevronDown className={collapsedSections.xml ? 'rotated' : ''} /></button>
                    </div>
                    {!collapsedSections.xml && (
                      <div className="xml-block">
                        {xmlInfo.exists ? (
                          <>
                            <div className="xml-meta">{xmlInfo.filename || `${selectedItem?.id}.xml`}</div>
                            <pre className="xml-preview">{xmlInfo.content || '—'}</pre>
                            <div className="xml-actions">
                              <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); window.open(xmlInfo.url || `${BACKEND_BASE_URL.replace(/\/$/, '')}/uploads/xml/${selectedItem?.id}.xml`, '_blank') }}>Abrir</button>
                              <button className="btn-edit" onClick={(e) => { e.stopPropagation(); setDrawerMode('edit') }}>Editar</button>
                              <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); handleDeleteXml() }}>Eliminar</button>
                            </div>
                          </>
                        ) : (
                          <div className="xml-empty">Vacio</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="drawer-section">
                    <div className="section-header" onClick={() => toggleSection('fotografia')}>
                      <h3>Fotografía del bien</h3>
                      <button className="section-toggle" aria-expanded={!collapsedSections.fotografia}><FaChevronDown className={collapsedSections.fotografia ? 'rotated' : ''} /></button>
                    </div>
                    {!collapsedSections.fotografia && (
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
                    )}
                  </div>
                </>
              )}

              {drawerMode !== 'view' && (
                <>
                  {renderSection('rm', 'edit')}
                  {renderSection('identificacion', 'edit')}
                  {renderSection('informacionContable', 'edit')}
                  {renderSection('controlInterno', 'edit')}

                  <div className="drawer-section">
                    <div className="section-header" onClick={() => toggleSection('xml')}>
                      <div className="section-left">
                        <h3>XML del bien</h3>
                      </div>
                      <button className="section-toggle" aria-expanded={!collapsedSections.xml}><FaChevronDown className={collapsedSections.xml ? 'rotated' : ''} /></button>
                    </div>
                    {!collapsedSections.xml && (
                      <>
                        <input ref={xmlInputRef} type="file" accept=".xml" style={{ display: 'none' }} onChange={handleXmlFileSelected} />
                        <div className="xml-block xml-edit" onClick={() => {
                          if (!selectedItem?.id) return toast.info('Guarda el registro antes de subir el XML')
                          if (xmlInputRef.current) xmlInputRef.current.click()
                        }}>
                          {xmlInfo.exists ? (
                            <div className="xml-meta">{xmlInfo.filename || `${selectedItem?.id}.xml`}</div>
                          ) : (
                            <div className="xml-empty">Vacio — Presiona para subir XML</div>
                          )}
                        </div>
                        {xmlInfo.exists && (
                          <div className="xml-actions">
                            <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); window.open(xmlModal.url || `${BACKEND_BASE_URL.replace(/\/$/, '')}/uploads/xml/${selectedItem?.id}.xml`, '_blank') }}>Abrir</button>
                            <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); handleDeleteXml() }}>Eliminar</button>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="drawer-section">
                    <div className="section-header" onClick={() => toggleSection('fotografia')}>
                      <h3>Fotografía del bien (máximo 3)</h3>
                      <button className="section-toggle" aria-expanded={!collapsedSections.fotografia}><FaChevronDown className={collapsedSections.fotografia ? 'rotated' : ''} /></button>
                    </div>
                    {!collapsedSections.fotografia && (
                      <>
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
                                    <input type="file" accept="image/*" disabled={!selectedItem?.id || uploadingOrden === orden} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadFoto(orden, file); e.target.value = '' }} />
                                  </label>
                                  <label className={`btn-secondary btn-upload ${(!selectedItem?.id || uploadingOrden === orden) ? 'disabled' : ''}`} title="Tomar foto">
                                    <FaCamera />
                                    <input type="file" accept="image/*" capture="environment" disabled={!selectedItem?.id || uploadingOrden === orden} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadFoto(orden, file); e.target.value = '' }} />
                                  </label>
                                  <button type="button" className="btn-icon btn-delete-photo" onClick={() => handleDeleteFoto(orden)} disabled={!selectedItem?.id || !foto || uploadingOrden === orden} title="Eliminar foto"><FaTrash /></button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </>
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
      {xmlModal.open && (
        <>
          <div className="xml-modal-overlay" onClick={closeXmlModal} />
          <div className="xml-modal" role="dialog" aria-modal="true">
            <div className="xml-modal-header">
              <h3>{xmlModal.filename || `${xmlModal.id}.xml`}</h3>
              <button className="btn-close" onClick={closeXmlModal}>×</button>
            </div>
            <div className="xml-modal-body">
              <pre className="xml-preview">{xmlModal.content || '—'}</pre>
            </div>
            <div className="xml-modal-footer">
              <a className="btn-secondary" href={xmlModal.url || `${BACKEND_BASE_URL.replace(/\/$/, '')}/uploads/xml/${xmlModal.id}.xml`} target="_blank" rel="noopener noreferrer">Abrir en nueva pestaña</a>
              <button className="btn-secondary" onClick={() => { closeXmlModal(); handleEdit(selectedItem) }}>Editar</button>
              <button className="btn-secondary" onClick={() => handleDeleteXml(xmlModal.id)}>Eliminar</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default InternoView
