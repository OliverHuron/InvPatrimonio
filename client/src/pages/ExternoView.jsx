// =====================================================
// VISTA: Patrimonio Externo
// API: /api/patrimonio/{id} + /api/patrimonio/actualizar/{id}
// =====================================================

import React, { useState, useEffect } from 'react'
import { FaSync, FaEye, FaEdit } from 'react-icons/fa'
import { toast } from 'react-toastify'
import './ExternoView.css'

const ExternoView = () => {
  const API_BASE_URL = process.env.REACT_APP_API_URL || '/api'
  const API_BASE = `${API_BASE_URL.replace(/\/$/, '')}`

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [drawerMode, setDrawerMode] = useState('view')
  const [selectedItem, setSelectedItem] = useState(null)
  const [categoriasEntrega, setCategoriasEntrega] = useState([])
  const [entregaPath, setEntregaPath] = useState([])
  const [entregaManualMode, setEntregaManualMode] = useState(false)
  const [formData, setFormData] = useState({
    id_patrimonio: '',
    folio: '',
    no_inventario: '',
    descripcion: '',
    comentarios: '',
    entrega_responsable: '',
    areas_calculo: '',
    o_res_asignacion: '',
    folio_2: '',
    codigo: '',
    tipo_bien: '',
    desc_text: '',
    porc_desc: '',
    muo: '',
    equipo: '',
    marca: '',
    modelo: '',
    serie: '',
    ejercicio: '',
    adquisicion_compra: '',
    proveedor_prov: '',
    mycm: '',
    proveedor: '',
    anio_alta: '',
    fec_reg_registros: '',
    nvo_costo: '',
    ubicacion_edificio: '',
    ubicacion_salon: '',
    estado_uso: '1-Bueno',
    responsable_usuario: '',
    numero_empleado_usuario: '',
    usu_reg: '',
    activo: 1,
    uuid: ''
  })

  const getSessionId = () => localStorage.getItem('sessionId')

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
      id_patrimonio: valueOf(source, ['id_patrimonio', 'idPatrimonio']),
      folio: valueOf(source, ['folio']),
      no_inventario: valueOf(source, ['no_inventario']),
      descripcion: valueOf(source, ['descripcion']),
      comentarios: valueOf(source, ['comentarios']),
      entrega_responsable: valueOf(source, ['entrega_responsable']),
      areas_calculo: valueOf(source, ['areas_calculo']),
      o_res_asignacion: valueOf(source, ['o_res_asignacion']),
      folio_2: valueOf(source, ['folio_2']),
      codigo: valueOf(source, ['codigo']),
      tipo_bien: valueOf(source, ['tipo_bien']),
      desc_text: valueOf(source, ['desc_text']),
      porc_desc: valueOf(source, ['porc_desc']),
      muo: valueOf(source, ['muo']),
      equipo: valueOf(source, ['equipo']),
      marca: valueOf(source, ['marca']),
      modelo: valueOf(source, ['modelo']),
      serie: valueOf(source, ['serie']),
      ejercicio: valueOf(source, ['ejercicio']),
      adquisicion_compra: valueOf(source, ['adquisicion_compra']),
      proveedor_prov: valueOf(source, ['proveedor_prov']),
      mycm: valueOf(source, ['mycm']),
      proveedor: valueOf(source, ['proveedor']),
      anio_alta: valueOf(source, ['anio_alta']),
      fec_reg_registros: valueOf(source, ['fec_reg_registros', 'fecha_adquisicion']),
      nvo_costo: valueOf(source, ['nvo_costo', 'costo']),
      ubicacion_edificio: valueOf(source, ['ubicacion_edificio', 'ubicacion']),
      ubicacion_salon: valueOf(source, ['ubicacion_salon']),
      estado_uso: valueOf(source, ['estado_uso']),
      responsable_usuario: valueOf(source, ['responsable_usuario']),
      numero_empleado_usuario: valueOf(source, ['numero_empleado_usuario']),
      usu_reg: valueOf(source, ['usu_reg']),
      activo: valueOf(source, ['activo']),
      uuid: valueOf(source, ['uuid'])
    }
  }

  const parseEntregaPath = (value = '') => {
    const raw = String(value || '').trim()
    if (!raw) return []
    return raw.split('>').map((p) => p.trim()).filter(Boolean)
  }

  const updateEntregaFromPath = (pathParts) => {
    const value = (pathParts || []).filter(Boolean).join(' > ')
    setFormData((prev) => ({ ...prev, entrega_responsable: value }))
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const sessionId = getSessionId()
      const headers = { 'Content-Type': 'application/json' }
      if (sessionId) headers['X-UMICH-Session'] = sessionId

      const response = await fetch(`${API_BASE}/patrimonio?page=1&limit=500`, { headers, credentials: 'include' })
      const data = await response.json()

      if (data.success) {
        const list = data?.data?.items || []
        setItems(list.map(normalizeItem).filter(Boolean))
      } else {
        setItems([])
        toast.error(data.message || 'No encontrado')
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
      setItems([])
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const loadEntregaOptions = async () => {
    try {
      const sessionId = getSessionId()
      const headers = {}
      if (sessionId) headers['X-UMICH-Session'] = sessionId
      const response = await fetch(`${API_BASE}/categorias/entrega`, { headers, credentials: 'include' })
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

  const handleView = (item) => {
    if (!item) return
    setSelectedItem(item)
    setFormData({ ...item })
    setEntregaPath(parseEntregaPath(item.entrega_responsable))
    setEntregaManualMode(false)
    setDrawerMode('view')
    setShowDetail(true)
  }

  const handleEdit = (item) => {
    if (!item) return
    setSelectedItem(item)
    setFormData({ ...item })
    setEntregaPath(parseEntregaPath(item.entrega_responsable))
    setEntregaManualMode(false)
    setDrawerMode('edit')
    setShowDetail(true)
  }

  const handleCloseDrawer = () => {
    setShowDetail(false)
    setDrawerMode('view')
    setSelectedItem(null)
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

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    if (!selectedItem?.id) return
    try {
      const sessionId = getSessionId()
      const headers = { 'Content-Type': 'application/json' }
      if (sessionId) headers['X-UMICH-Session'] = sessionId

      const payload = { ...formData }

      const response = await fetch(`${API_BASE}/patrimonio/actualizar/${selectedItem.id}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload)
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Actualizado exitosamente')
        handleCloseDrawer()
        loadData()
      } else {
        toast.error(data.message || 'Error al actualizar')
      }
    } catch (error) {
      console.error('Error guardando:', error)
      toast.error('Error al guardar datos')
    }
  }

  useEffect(() => {
    loadData()
    loadEntregaOptions()
  }, [])

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString('es-MX')
    } catch {
      return 'N/A'
    }
  }

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A'
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)
  }

  const showValue = (value, formatter) => {
    if (value === undefined || value === null || value === '') return 'Sin dato'
    return formatter ? formatter(value) : value
  }

  return (
    <div className="externo-view">
      <div className="view-header">
        <div><h1>Patrimonio Externo</h1></div>
        <div className="header-actions">
          <button className="btn-refresh" onClick={() => loadData()} disabled={loading}>
            <FaSync className={loading ? 'spinning' : ''} /> Actualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Cargando...</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No hay datos disponibles</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Clave Patrimonial</th>
                <th>Descripción</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th>No. Serie</th>
                <th>Edificio</th>
                <th>Costo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.folio || 'N/A'}</td>
                  <td>{item.no_inventario || 'N/A'}</td>
                  <td>{item.descripcion || 'N/A'}</td>
                  <td>{item.marca || 'N/A'}</td>
                  <td>{item.modelo || 'N/A'}</td>
                  <td>{item.serie || 'N/A'}</td>
                  <td>{item.ubicacion_edificio || 'N/A'}</td>
                  <td>{formatCurrency(item.nvo_costo)}</td>
                  <td>
                    <div className="action-buttons">
                      <button type="button" className="btn-icon btn-view" onClick={(e) => { e.stopPropagation(); handleView(item) }} title="Ver detalle">
                        <FaEye />
                      </button>
                      <button type="button" className="btn-icon btn-edit" onClick={(e) => { e.stopPropagation(); handleEdit(item) }} title="Editar">
                        <FaEdit />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showDetail && selectedItem && (
        <>
          <div className="drawer-overlay open" onClick={handleCloseDrawer} />
          <div className="drawer-panel open">
            <div className="drawer-header">
              <div>
                <h2>{drawerMode === 'view' ? 'Detalle Patrimonio Externo' : 'Editar Patrimonio Externo'}</h2>
                <p className="drawer-subtitle">Folio {showValue(selectedItem.folio)}</p>
              </div>
              <button className="btn-close" onClick={handleCloseDrawer}>×</button>
            </div>

            <div className="drawer-content">
              {drawerMode === 'view' ? (
                <>
                  <div className="drawer-section">
                    <h3>Información principal</h3>
                    <div className="detail-grid two-cols">
                      <div className="detail-item"><span className="detail-label">Folio</span><span className="detail-value">{showValue(selectedItem.folio)}</span></div>
                      <div className="detail-item"><span className="detail-label">Clave Patrimonial</span><span className="detail-value">{showValue(selectedItem.no_inventario)}</span></div>
                      <div className="detail-item"><span className="detail-label">Descripción</span><span className="detail-value">{showValue(selectedItem.descripcion)}</span></div>
                      <div className="detail-item"><span className="detail-label">Comentarios</span><span className="detail-value">{showValue(selectedItem.comentarios)}</span></div>
                      <div className="detail-item"><span className="detail-label">Responsable</span><span className="detail-value">{showValue(selectedItem.entrega_responsable)}</span></div>
                      <div className="detail-item"><span className="detail-label">U. Res. de gasto</span><span className="detail-value">{showValue(selectedItem.areas_calculo)}</span></div>
                      <div className="detail-item"><span className="detail-label">U. Res. de asignación</span><span className="detail-value">{showValue(selectedItem.o_res_asignacion)}</span></div>
                      <div className="detail-item"><span className="detail-label">Costo</span><span className="detail-value">{showValue(selectedItem.nvo_costo, formatCurrency)}</span></div>
                      <div className="detail-item"><span className="detail-label">COG</span><span className="detail-value">{showValue(selectedItem.codigo)}</span></div>
                      <div className="detail-item"><span className="detail-label">Tipo de bien</span><span className="detail-value">{showValue(selectedItem.tipo_bien)}</span></div>
                      <div className="detail-item"><span className="detail-label">Num Fact</span><span className="detail-value">{showValue(selectedItem.folio_2)}</span></div>
                      <div className="detail-item"><span className="detail-label">Fec Factura</span><span className="detail-value">{showValue(selectedItem.fec_reg_registros, formatDate)}</span></div>
                      <div className="detail-item"><span className="detail-label">UUID</span><span className="detail-value">{showValue(selectedItem.uuid)}</span></div>
                      <div className="detail-item"><span className="detail-label">Fondo</span><span className="detail-value">{showValue(selectedItem.mycm)}</span></div>
                      <div className="detail-item"><span className="detail-label">Marca</span><span className="detail-value">{showValue(selectedItem.marca)}</span></div>
                      <div className="detail-item"><span className="detail-label">Modelo</span><span className="detail-value">{showValue(selectedItem.modelo)}</span></div>
                      <div className="detail-item"><span className="detail-label">Serie</span><span className="detail-value">{showValue(selectedItem.serie)}</span></div>
                      <div className="detail-item"><span className="detail-label">Ejercicio</span><span className="detail-value">{showValue(selectedItem.ejercicio)}</span></div>
                      <div className="detail-item"><span className="detail-label">Solicitud/ord. Compra</span><span className="detail-value">{showValue(selectedItem.adquisicion_compra)}</span></div>
                      <div className="detail-item"><span className="detail-label">Cuenta por pagar</span><span className="detail-value">{showValue(selectedItem.proveedor_prov)}</span></div>
                      <div className="detail-item"><span className="detail-label">IDCON</span><span className="detail-value">{showValue(selectedItem.desc_text)}</span></div>
                      <div className="detail-item"><span className="detail-label">Proveedor</span><span className="detail-value">{showValue(selectedItem.proveedor)}</span></div>
                      <div className="detail-item"><span className="detail-label">Usu Asig</span><span className="detail-value">{showValue(selectedItem.numero_empleado_usuario)}</span></div>
                      <div className="detail-item"><span className="detail-label">Usu Reg</span><span className="detail-value">{showValue(selectedItem.usu_reg)}</span></div>
                      <div className="detail-item"><span className="detail-label">Ubicación - Edificio</span><span className="detail-value">{showValue(selectedItem.ubicacion_edificio)}</span></div>
                      <div className="detail-item"><span className="detail-label">Ubicación - Salón</span><span className="detail-value">{showValue(selectedItem.ubicacion_salon)}</span></div>
                      <div className="detail-item"><span className="detail-label">Estado de Uso</span><span className="detail-value">{showValue(selectedItem.estado_uso)}</span></div>
                      <div className="detail-item"><span className="detail-label">Resguardante (usuario)</span><span className="detail-value">{showValue(selectedItem.responsable_usuario)}</span></div>
                      <div className="detail-item"><span className="detail-label">Número de empleado (usuario)</span><span className="detail-value">{showValue(selectedItem.numero_empleado_usuario)}</span></div>
                      <div className="detail-item"><span className="detail-label">Fecha Registro</span><span className="detail-value">{showValue(selectedItem.fec_reg_registros, formatDate)}</span></div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="form-grid">
                  <div className="form-group"><label>Folio</label><input name="folio" value={formData.folio || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Clave Patrimonial</label><input name="no_inventario" value={formData.no_inventario || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Descripción</label><input name="descripcion" value={formData.descripcion || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Comentarios</label><input name="comentarios" value={formData.comentarios || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Responsable</label><select value="" className="select-cascade-control" title={formData.entrega_responsable || 'Seleccionar responsable'} onChange={(e) => handleEntregaStep(e.target.value)}><option value="">{entregaPath.length === 0 ? 'Seleccionar responsable' : 'Selecciona categoría dependiente'}</option><option value="__MANUAL__">Manual (escribir nombre)</option>{entregaPath.length > 0 && <option value="__UP__">← Subir un nivel</option>}{opcionesEntregaActual.map((opt) => (<option key={opt.id} value={opt.label} title={opt.label}>{opt.label}</option>))}</select>{entregaManualMode && <input name="entrega_responsable" value={formData.entrega_responsable || ''} onChange={handleInputChange} placeholder="Escribe el nombre manualmente" style={{ marginTop: '0.4rem' }} />}</div>
                  <div className="form-group"><label>U. Res. de gasto</label><input name="areas_calculo" value={formData.areas_calculo || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>U. Res. de asignación</label><input name="o_res_asignacion" value={formData.o_res_asignacion || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Costo</label><input name="nvo_costo" value={formData.nvo_costo || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>COG</label><input name="codigo" value={formData.codigo || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Tipo de bien</label><input name="tipo_bien" value={formData.tipo_bien || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Num Fact</label><input name="folio_2" value={formData.folio_2 || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Fec Factura</label><input type="date" name="fec_reg_registros" value={(formData.fec_reg_registros || '').split('T')[0]} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>UUID</label><input name="uuid" value={formData.uuid || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Fondo</label><input name="mycm" value={formData.mycm || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Marca</label><input name="marca" value={formData.marca || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Modelo</label><input name="modelo" value={formData.modelo || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Serie</label><input name="serie" value={formData.serie || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Ejercicio</label><input name="ejercicio" value={formData.ejercicio || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Solicitud/ord. Compra</label><input name="adquisicion_compra" value={formData.adquisicion_compra || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Cuenta por pagar</label><input name="proveedor_prov" value={formData.proveedor_prov || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>IDCON</label><input name="desc_text" value={formData.desc_text || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Proveedor</label><input name="proveedor" value={formData.proveedor || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Usu Asig</label><input name="numero_empleado_usuario" value={formData.numero_empleado_usuario || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Usu Reg</label><input name="usu_reg" value={formData.usu_reg || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Ubicación - Edificio</label><input name="ubicacion_edificio" value={formData.ubicacion_edificio || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Ubicación - Salón</label><input name="ubicacion_salon" value={formData.ubicacion_salon || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Estado de Uso</label><select name="estado_uso" value={formData.estado_uso || '1-Bueno'} onChange={handleInputChange}><option value="1-Bueno">1-Bueno</option><option value="2-Regular">2-Regular</option><option value="3-Malo">3-Malo</option></select></div>
                  <div className="form-group"><label>Resguardante (usuario)</label><input name="responsable_usuario" value={formData.responsable_usuario || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Número de empleado (usuario)</label><input name="numero_empleado_usuario" value={formData.numero_empleado_usuario || ''} onChange={handleInputChange} /></div>
                  <div className="form-group"><label>Fecha Registro</label><input type="date" name="fec_reg_registros" value={(formData.fec_reg_registros || '').split('T')[0]} onChange={handleInputChange} /></div>
                </div>
              )}
            </div>

            <div className="drawer-footer">
              {drawerMode === 'view' ? (
                <>
                  <button className="btn-secondary" onClick={handleCloseDrawer}>Cerrar</button>
                  <button className="btn-primary" onClick={() => setDrawerMode('edit')}>Editar</button>
                </>
              ) : (
                <>
                  <button className="btn-secondary" onClick={handleCloseDrawer}>Cancelar</button>
                  <button className="btn-primary" onClick={handleSave}>Guardar Cambios</button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ExternoView
