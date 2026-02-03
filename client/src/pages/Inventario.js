import React, { useState, useEffect } from 'react'

const Inventario = () => {
  // Configuración de la API
  const API_BASE_URL = process.env.REACT_APP_API_URL 
    ? `${process.env.REACT_APP_API_URL}/api`
    : 'http://localhost:3001/api'

  // Estados del componente
  const [patrimonios, setPatrimonios] = useState([])
  const [filteredPatrimonios, setFilteredPatrimonios] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStage, setFilterStage] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [tipoInventario, setTipoInventario] = useState('INTERNO')
  const [formData, setFormData] = useState({
    // Campos comunes
    folio: '',
    descripcion: '',
    marca: '',
    modelo: '',
    numero_serie: '',
    estado_uso: 'bueno',
    costo: '',
    proveedor: '',
    factura: '',
    uuid: '',
    fecha_adquisicion: '',
    ubicacion: '',
    numero_empleado: '',
    observaciones: '',
    stage: 'INTERNO',
    
    // Campos INTERNO
    registro_patrimonial: '',
    registro_interno: '',
    elaboro_nombre: '',
    fecha_elaboracion: '',
    ures_asignacion: '',
    recurso: '',
    ur: '',
    
    // Campos EXTERNO
    id_patrimonio: '',
    numero_patrimonio: '',
    clave_patrimonial: '',
    numero_inventario: '',
    cog: '',
    fondo: '',
    valor_unitario: '',
    ures_gasto: '',
    ubicacion_fisica: '',
    coordinacion: '',
    ejercicio: '',
    solicitud_compra: '',
    cuenta_por_pagar: '',
    idcon: '',
    usu_asig: '',
    fecha_registro: '',
    fecha_asignacion: ''
  })

  // Cargar patrimonios al montar el componente
  useEffect(() => {
    fetchPatrimonios()
  }, [])

  // Filtrar patrimonios cuando cambien los filtros
  useEffect(() => {
    let filtered = patrimonios

    if (searchTerm) {
      filtered = filtered.filter(item => 
        (item.numero_patrimonio && item.numero_patrimonio.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.marca && item.marca.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.modelo && item.modelo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.numero_serie && item.numero_serie.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    if (filterStage) {
      filtered = filtered.filter(item => item.stage === filterStage)
    }

    if (filterEstado) {
      filtered = filtered.filter(item => item.estado === filterEstado)
    }

    setFilteredPatrimonios(filtered)
  }, [patrimonios, searchTerm, filterStage, filterEstado])

  // Función para obtener patrimonios del backend
  const fetchPatrimonios = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/inventarios`)
      if (!response.ok) {
        throw new Error('Error al cargar los datos')
      }
      const data = await response.json()
      setPatrimonios(data.data || [])
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // Función para crear/actualizar patrimonio
  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const method = editingItem ? 'PUT' : 'POST'
      const url = editingItem 
        ? `${API_BASE_URL}/inventarios/${editingItem.id}`
        : `${API_BASE_URL}/inventarios`

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error('Error al guardar')
      }

      await fetchPatrimonios()
      setModalOpen(false)
      resetForm()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  // Función para eliminar patrimonio
  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este elemento?')) return

    try {
      const response = await fetch(`${API_BASE_URL}/inventarios/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Error al eliminar')
      }

      await fetchPatrimonios()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  // Abrir modal para crear nuevo
  const openCreateModal = () => {
    setEditingItem(null)
    setFormData({
      folio: '',
      numero_patrimonio: '',
      descripcion: '',
      marca: '',
      modelo: '',
      numero_serie: '',
      tipo_bien: '',
      estado: 'buena',
      estado_uso: 'operativo',
      ubicacion: '',
      proveedor: '',
      costo: '',
      observaciones: '',
      stage: 'COMPLETO'
    })
    setModalOpen(true)
  }

  // Abrir modal para editar
  const openEditModal = (item) => {
    setEditingItem(item)
    setTipoInventario(item.stage || 'INTERNO')
    setFormData({
      folio: item.folio || '',
      descripcion: item.descripcion || '',
      marca: item.marca || '',
      modelo: item.modelo || '',
      numero_serie: item.numero_serie || '',
      estado_uso: item.estado_uso || item.estado || 'bueno',
      costo: item.costo || '',
      proveedor: item.proveedor || '',
      factura: item.factura || '',
      uuid: item.uuid || '',
      fecha_adquisicion: item.fecha_adquisicion || '',
      ubicacion: item.ubicacion || '',
      numero_empleado: item.numero_empleado || '',
      observaciones: item.observaciones || '',
      stage: item.stage || 'INTERNO',
      registro_patrimonial: item.registro_patrimonial || '',
      registro_interno: item.registro_interno || '',
      elaboro_nombre: item.elaboro_nombre || '',
      fecha_elaboracion: item.fecha_elaboracion || '',
      ures_asignacion: item.ures_asignacion || '',
      recurso: item.recurso || '',
      ur: item.ur || '',
      id_patrimonio: item.id_patrimonio || '',
      numero_patrimonio: item.numero_patrimonio || '',
      clave_patrimonial: item.clave_patrimonial || '',
      numero_inventario: item.numero_inventario || '',
      cog: item.cog || '',
      fondo: item.fondo || '',
      valor_unitario: item.valor_unitario || '',
      ures_gasto: item.ures_gasto || '',
      ubicacion_fisica: item.ubicacion_fisica || '',
      coordinacion: item.coordinacion || '',
      ejercicio: item.ejercicio || '',
      solicitud_compra: item.solicitud_compra || '',
      cuenta_por_pagar: item.cuenta_por_pagar || '',
      idcon: item.idcon || '',
      usu_asig: item.usu_asig || '',
      fecha_registro: item.fecha_registro || '',
      fecha_asignacion: item.fecha_asignacion || ''
    })
    setModalOpen(true)
  }

  // Resetear formulario
  const resetForm = () => {
    setFormData({
      folio: '',
      descripcion: '',
      marca: '',
      modelo: '',
      numero_serie: '',
      estado_uso: 'bueno',
      costo: '',
      proveedor: '',
      factura: '',
      uuid: '',
      fecha_adquisicion: '',
      ubicacion: '',
      numero_empleado: '',
      observaciones: '',
      stage: tipoInventario,
      registro_patrimonial: '',
      registro_interno: '',
      elaboro_nombre: '',
      fecha_elaboracion: '',
      ures_asignacion: '',
      recurso: '',
      ur: '',
      id_patrimonio: '',
      numero_patrimonio: '',
      clave_patrimonial: '',
      numero_inventario: '',
      cog: '',
      fondo: '',
      valor_unitario: '',
      ures_gasto: '',
      ubicacion_fisica: '',
      coordinacion: '',
      ejercicio: '',
      solicitud_compra: '',
      cuenta_por_pagar: '',
      idcon: '',
      usu_asig: '',
      fecha_registro: '',
      fecha_asignacion: ''
    })
  }

  // Manejar cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Inventario Patrimonial</h2>
      
      {error && (
        <div style={{ 
          color: 'red', 
          backgroundColor: '#ffe6e6', 
          padding: '10px', 
          borderRadius: '4px', 
          marginBottom: '10px' 
        }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={openCreateModal}
          style={{ 
            backgroundColor: '#007bff', 
            color: 'white', 
            padding: '10px 20px', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: 'pointer',
            marginRight: '15px'
          }}
        >
          Agregar Nuevo Bien
        </button>
        
        {/* Filtros y búsqueda */}
        <div style={{ 
          display: 'flex', 
          gap: '15px', 
          alignItems: 'center', 
          flexWrap: 'wrap',
          marginTop: '15px',
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px'
        }}>
          <input
            type="text"
            placeholder="🔍 Buscar por patrimonio, descripción, marca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              minWidth: '250px',
              fontSize: '14px'
            }}
          />
          
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="">Todos los Stages</option>
            <option value="FISCAL">FISCAL</option>
            <option value="EN_TRANSITO">EN TRÁNSITO</option>
            <option value="FISICO">FÍSICO</option>
            <option value="COMPLETO">COMPLETO</option>
            <option value="PENDIENTE_FISCAL">PENDIENTE FISCAL</option>
          </select>
          
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="">Todos los Estados</option>
            <option value="buena">Buena</option>
            <option value="regular">Regular</option>
            <option value="mala">Mala</option>
          </select>
          
          {(searchTerm || filterStage || filterEstado) && (
            <button
              onClick={() => {
                setSearchTerm('')
                setFilterStage('')
                setFilterEstado('')
              }}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                padding: '8px 12px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Limpiar Filtros
            </button>
          )}
          
          <div style={{ marginLeft: 'auto', fontSize: '14px', color: '#6c757d' }}>
            Mostrando {filteredPatrimonios.length} de {patrimonios.length} registros
          </div>
        </div>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd', fontSize: '14px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ padding: '8px', border: '1px solid #ddd', minWidth: '100px' }}>Folio</th>
              <th style={{ padding: '8px', border: '1px solid #ddd', minWidth: '80px' }}>Tipo</th>
              <th style={{ padding: '8px', border: '1px solid #ddd', minWidth: '200px' }}>Marca / Modelo</th>
              <th style={{ padding: '8px', border: '1px solid #ddd', minWidth: '150px' }}>Ubicación</th>
              <th style={{ padding: '8px', border: '1px solid #ddd', minWidth: '100px' }}>Estado</th>
              <th style={{ padding: '8px', border: '1px solid #ddd', minWidth: '120px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatrimonios.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '20px', textAlign: 'center' }}>
                  {patrimonios.length === 0 ? 'No hay datos disponibles' : 'No se encontraron resultados con los filtros aplicados'}
                </td>
              </tr>
            ) : (
              filteredPatrimonios.map((item) => (
                <tr key={item.id}>
                  <td style={{ padding: '6px', border: '1px solid #ddd' }}>
                    <span style={{ 
                      fontWeight: '600',
                      color: '#1976d2'
                    }}>
                      {item.folio || 'Pendiente'}
                    </span>
                  </td>
                  <td style={{ padding: '6px', border: '1px solid #ddd' }}>
                    <span style={{ 
                      fontSize: '11px', 
                      padding: '3px 8px', 
                      borderRadius: '4px', 
                      backgroundColor: item.stage === 'INTERNO' ? '#e3f2fd' : '#fff3e0',
                      color: item.stage === 'INTERNO' ? '#1976d2' : '#f57c00',
                      border: `1px solid ${item.stage === 'INTERNO' ? '#90caf9' : '#ffcc80'}`,
                      fontWeight: '600'
                    }}>
                      {item.stage || 'EXTERNO'}
                    </span>
                  </td>
                  <td style={{ padding: '6px', border: '1px solid #ddd' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong>{item.marca || '-'}</strong>
                      <small style={{ color: '#6c757d' }}>{item.modelo || '-'}</small>
                    </div>
                  </td>
                  <td style={{ padding: '6px', border: '1px solid #ddd' }}>
                    {item.ubicacion || 'Sin asignar'}
                  </td>
                  <td style={{ padding: '6px', border: '1px solid #ddd' }}>
                    <span style={{ 
                      backgroundColor: item.estado_uso === 'operativo' ? '#d4edda' : item.estado_uso === 'mantenimiento' ? '#fff3cd' : '#f8d7da',
                      color: item.estado_uso === 'operativo' ? '#155724' : item.estado_uso === 'mantenimiento' ? '#856404' : '#721c24',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '12px',
                      textTransform: 'capitalize'
                    }}>
                      {item.estado_uso || item.estado || '-'}
                    </span>
                  </td>
                  <td style={{ padding: '6px', border: '1px solid #ddd' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button 
                        onClick={() => openEditModal(item)}
                        title="Editar"
                        style={{ 
                          backgroundColor: '#28a745', 
                          color: 'white', 
                          padding: '4px 8px', 
                          border: 'none', 
                          borderRadius: '4px', 
                          cursor: 'pointer',
                          fontSize: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        title="Eliminar"
                        style={{ 
                          backgroundColor: '#dc3545', 
                          color: 'white', 
                          padding: '4px 8px', 
                          border: 'none', 
                          borderRadius: '4px', 
                          cursor: 'pointer',
                          fontSize: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {/* Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '700px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3>{editingItem ? 'Editar Bien' : 'Agregar Nuevo Bien'}</h3>
            
            {/* Tabs INTERNO/EXTERNO */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #ddd' }}>
              <button
                type="button"
                onClick={() => {
                  setTipoInventario('INTERNO')
                  setFormData({ ...formData, stage: 'INTERNO' })
                }}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  backgroundColor: tipoInventario === 'INTERNO' ? '#1976d2' : 'transparent',
                  color: tipoInventario === 'INTERNO' ? 'white' : '#666',
                  borderBottom: tipoInventario === 'INTERNO' ? '3px solid #1976d2' : 'none',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                🏢 INTERNO ({24} campos)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTipoInventario('EXTERNO')
                  setFormData({ ...formData, stage: 'EXTERNO' })
                }}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  backgroundColor: tipoInventario === 'EXTERNO' ? '#f57c00' : 'transparent',
                  color: tipoInventario === 'EXTERNO' ? 'white' : '#666',
                  borderBottom: tipoInventario === 'EXTERNO' ? '3px solid #f57c00' : 'none',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                🏛️ EXTERNO ({31} campos)
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              
              {/* FORMULARIO INTERNO - 24 campos */}
              {tipoInventario === 'INTERNO' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#333' }}>3. No. Registro Patrimonial</label>
                    <input type="text" name="registro_patrimonial" value={formData.registro_patrimonial} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#333' }}>4. No. Registro Interno</label>
                    <input type="text" name="registro_interno" value={formData.registro_interno} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#333' }}>5. Descripción</label>
                    <textarea name="descripcion" value={formData.descripcion} onChange={handleInputChange} rows={2}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>6. Elaboró</label>
                    <input type="text" name="elaboro_nombre" value={formData.elaboro_nombre} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>18. Fecha Elaboración</label>
                    <input type="date" name="fecha_elaboracion" value={formData.fecha_elaboracion} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>7. Marca *</label>
                    <input type="text" name="marca" value={formData.marca} onChange={handleInputChange} required
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>8. Modelo *</label>
                    <input type="text" name="modelo" value={formData.modelo} onChange={handleInputChange} required
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#333' }}>9. No. Serie</label>
                    <input type="text" name="numero_serie" value={formData.numero_serie} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>10. No. Factura</label>
                    <input type="text" name="factura" value={formData.factura} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>11. Fecha Factura</label>
                    <input type="date" name="fecha_adquisicion" value={formData.fecha_adquisicion} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#333' }}>12. UUID (Folio Fiscal)</label>
                    <input type="text" name="uuid" value={formData.uuid} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>13. Costo</label>
                    <input type="number" step="0.01" name="costo" value={formData.costo} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>14. URES Asignación</label>
                    <input type="text" name="ures_asignacion" value={formData.ures_asignacion} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#333' }}>15. Ubicación</label>
                    <input type="text" name="ubicacion" value={formData.ubicacion} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>16. Recurso</label>
                    <input type="text" name="recurso" value={formData.recurso} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>17. Proveedor</label>
                    <input type="text" name="proveedor" value={formData.proveedor} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#333' }}>19. Observaciones</label>
                    <textarea name="observaciones" value={formData.observaciones} onChange={handleInputChange} rows={2}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#333' }}>20. Estado de Uso</label>
                    <select name="estado_uso" value={formData.estado_uso} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }}>
                      <option value="bueno">Bueno</option>
                      <option value="regular">Regular</option>
                      <option value="malo">Malo</option>
                    </select>
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#333' }}>23. No. Empleado</label>
                    <input type="text" name="numero_empleado" value={formData.numero_empleado} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#333' }}>24. UR</label>
                    <input type="text" name="ur" value={formData.ur} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>
                </div>
              )}

              {/* FORMULARIO EXTERNO - 31 campos */}
              {tipoInventario === 'EXTERNO' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#333' }}>2. ID Patrimonio</label>
                    <input type="text" name="id_patrimonio" value={formData.id_patrimonio} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>3. Folio</label>
                    <input type="text" name="folio" value={formData.folio} disabled
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f5f5f5' }} 
                      placeholder="Automático" />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>4. Clave Patrimonial</label>
                    <input type="text" name="clave_patrimonial" value={formData.clave_patrimonial} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#333' }}>5. Descripción</label>
                    <textarea name="descripcion" value={formData.descripcion} onChange={handleInputChange} rows={2}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#333' }}>6. No. Inventario</label>
                    <input type="text" name="numero_inventario" value={formData.numero_inventario} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>7. Marca *</label>
                    <input type="text" name="marca" value={formData.marca} onChange={handleInputChange} required
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>8. Modelo *</label>
                    <input type="text" name="modelo" value={formData.modelo} onChange={handleInputChange} required
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#333' }}>9. No. Serie</label>
                    <input type="text" name="numero_serie" value={formData.numero_serie} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>10. COG</label>
                    <input type="text" name="cog" value={formData.cog} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>11. Fondo</label>
                    <input type="text" name="fondo" value={formData.fondo} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>12. No. Factura</label>
                    <input type="text" name="factura" value={formData.factura} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>13. Fecha Factura</label>
                    <input type="date" name="fecha_adquisicion" value={formData.fecha_adquisicion} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#333' }}>14. UUID (Folio Fiscal)</label>
                    <input type="text" name="uuid" value={formData.uuid} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>15. Costo</label>
                    <input type="number" step="0.01" name="costo" value={formData.costo} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>16. Valor Unitario</label>
                    <input type="number" step="0.01" name="valor_unitario" value={formData.valor_unitario} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#333' }}>17. URES Gasto</label>
                    <input type="text" name="ures_gasto" value={formData.ures_gasto} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>18. Ubicación Física</label>
                    <input type="text" name="ubicacion_fisica" value={formData.ubicacion_fisica} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>19. Coordinación</label>
                    <input type="text" name="coordinacion" value={formData.coordinacion} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>20. Ejercicio</label>
                    <input type="text" name="ejercicio" value={formData.ejercicio} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>21. Solicitud/Ord. Compra</label>
                    <input type="text" name="solicitud_compra" value={formData.solicitud_compra} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>22. Cuenta por Pagar</label>
                    <input type="text" name="cuenta_por_pagar" value={formData.cuenta_por_pagar} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>23. IDCON</label>
                    <input type="text" name="idcon" value={formData.idcon} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>24. Proveedor</label>
                    <input type="text" name="proveedor" value={formData.proveedor} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#333' }}>25. Usu Asig</label>
                    <input type="text" name="usu_asig" value={formData.usu_asig} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>26. Fecha Registro</label>
                    <input type="date" name="fecha_registro" value={formData.fecha_registro} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div>
                    <label style={{ fontWeight: '600', color: '#333' }}>27. Fecha Asig</label>
                    <input type="date" name="fecha_asignacion" value={formData.fecha_asignacion} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#333' }}>28. Ubicación</label>
                    <input type="text" name="ubicacion" value={formData.ubicacion} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#333' }}>29. Estado de Uso</label>
                    <select name="estado_uso" value={formData.estado_uso} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }}>
                      <option value="operativo">Bueno</option>
                      <option value="regular">Regular</option>
                      <option value="malo">Malo</option>
                    </select>
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontWeight: '600', color: '#333' }}>31. No. Empleado</label>
                    <input type="text" name="numero_empleado" value={formData.numero_empleado} onChange={handleInputChange}
                      style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ddd', borderRadius: '4px' }} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button 
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{ 
                    backgroundColor: '#6c757d', 
                    color: 'white', 
                    padding: '10px 20px', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer' 
                  }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  style={{ 
                    backgroundColor: '#007bff', 
                    color: 'white', 
                    padding: '10px 20px', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer' 
                  }}
                >
                  {editingItem ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Inventario