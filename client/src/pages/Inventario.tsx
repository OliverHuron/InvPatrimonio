/*
  Inventario.tsx
  - Página de inventario patrimonial conectada a la API real
  - CRUD completo: Crear, Leer, Actualizar, Eliminar patrimonio
*/

import React, { useState, useEffect } from 'react'
import { AiOutlinePlus, AiOutlineSearch, AiOutlineEdit, AiOutlineDelete, AiOutlineEye } from 'react-icons/ai'
import '../styles/inventario.css'

// Interfaz para el patrimonio basada en el backend
interface Patrimonio {
  id: number
  codigo_patrimonial: string
  descripcion: string
  marca?: string
  modelo?: string
  numero_serie?: string
  estado: string
  categoria_id?: number
  coordinacion_id?: number
  ubicacion?: string
  fecha_ingreso: string
  valor_adquisicion?: number
}

// Configuración de la API
const API_BASE_URL = import.meta.env.PROD 
  ? 'https://patrimonio.siafsystem.online/api'
  : 'http://localhost:3001/api'

const Inventario: React.FC = () => {
  const [patrimonios, setPatrimonios] = useState<Patrimonio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Patrimonio | null>(null)
  const [formData, setFormData] = useState({
    codigo_patrimonial: '',
    descripcion: '',
    marca: '',
    modelo: '',
    numero_serie: '',
    estado: 'ACTIVO',
    ubicacion: '',
    valor_adquisicion: ''
  })

  // Cargar patrimonios al montar el componente
  useEffect(() => {
    fetchPatrimonios()
  }, [])

  // Función para obtener patrimonios del backend
  const fetchPatrimonios = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/inventory/patrimonio`)
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

  // Función para guardar patrimonio (crear/actualizar)
  const savePatrimonio = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingItem 
        ? `${API_BASE_URL}/inventory/patrimonio/${editingItem.id}`
        : `${API_BASE_URL}/inventory/patrimonio`
      
      const method = editingItem ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error('Error al guardar')
      }

      // Recargar lista y cerrar modal
      await fetchPatrimonios()
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  // Función para eliminar patrimonio
  const deletePatrimonio = async (id: number) => {
    if (!window.confirm('¿Está seguro de eliminar este patrimonio?')) return

    try {
      const response = await fetch(`${API_BASE_URL}/inventory/patrimonio/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Error al eliminar')
      }

      await fetchPatrimonios()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  // Abrir modal para crear nuevo
  const openCreateModal = () => {
    setEditingItem(null)
    setFormData({
      codigo_patrimonial: '',
      descripcion: '',
      marca: '',
      modelo: '',
      numero_serie: '',
      estado: 'ACTIVO',
      ubicacion: '',
      valor_adquisicion: ''
    })
    setModalOpen(true)
  }

  // Abrir modal para editar
  const openEditModal = (item: Patrimonio) => {
    setEditingItem(item)
    setFormData({
      codigo_patrimonial: item.codigo_patrimonial,
      descripcion: item.descripcion,
      marca: item.marca || '',
      modelo: item.modelo || '',
      numero_serie: item.numero_serie || '',
      estado: item.estado,
      ubicacion: item.ubicacion || '',
      valor_adquisicion: item.valor_adquisicion?.toString() || ''
    })
    setModalOpen(true)
  }

  // Cerrar modal
  const closeModal = () => {
    setModalOpen(false)
    setEditingItem(null)
    setError('')
  }

  // Filtrar patrimonios por búsqueda
  const filteredPatrimonios = patrimonios.filter(item =>
    item.codigo_patrimonial.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.marca || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <section>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando inventario...</p>
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="inventory-header">
        <h2>Inventario Patrimonial</h2>
        <p>Gestión completa del patrimonio institucional</p>
      </div>

      {/* Barra de herramientas */}
      <div className="toolbar">
        <button className="btn-primary" onClick={openCreateModal}>
          <AiOutlinePlus /> Nuevo Patrimonio
        </button>
        
        <div className="search-container">
          <AiOutlineSearch className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por código, descripción o marca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Mensaje de error */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Tabla de patrimonios */}
      <div className="table-container">
        <table className="patrimonio-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th>Marca/Modelo</th>
              <th>Serie</th>
              <th>Estado</th>
              <th>Ubicación</th>
              <th>Valor</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatrimonios.map((item) => (
              <tr key={item.id}>
                <td>{item.codigo_patrimonial}</td>
                <td>{item.descripcion}</td>
                <td>
                  {item.marca}
                  {item.modelo && <><br /><small>{item.modelo}</small></>}
                </td>
                <td>{item.numero_serie || '-'}</td>
                <td>
                  <span className={`status ${item.estado.toLowerCase()}`}>
                    {item.estado}
                  </span>
                </td>
                <td>{item.ubicacion || '-'}</td>
                <td>
                  {item.valor_adquisicion 
                    ? `S/ ${item.valor_adquisicion.toLocaleString()}`
                    : '-'
                  }
                </td>
                <td className="actions">
                  <button
                    className="btn-icon btn-edit"
                    onClick={() => openEditModal(item)}
                    title="Editar"
                  >
                    <AiOutlineEdit />
                  </button>
                  <button
                    className="btn-icon btn-delete"
                    onClick={() => deletePatrimonio(item.id)}
                    title="Eliminar"
                  >
                    <AiOutlineDelete />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredPatrimonios.length === 0 && !loading && (
          <div className="empty-state">
            <p>No se encontraron patrimonios</p>
          </div>
        )}
      </div>

      {/* Modal para crear/editar */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingItem ? 'Editar Patrimonio' : 'Nuevo Patrimonio'}</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            
            <form onSubmit={savePatrimonio}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Código Patrimonial *</label>
                  <input
                    type="text"
                    required
                    value={formData.codigo_patrimonial}
                    onChange={(e) => setFormData({...formData, codigo_patrimonial: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Descripción *</label>
                  <input
                    type="text"
                    required
                    value={formData.descripcion}
                    onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Marca</label>
                  <input
                    type="text"
                    value={formData.marca}
                    onChange={(e) => setFormData({...formData, marca: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Modelo</label>
                  <input
                    type="text"
                    value={formData.modelo}
                    onChange={(e) => setFormData({...formData, modelo: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Número de Serie</label>
                  <input
                    type="text"
                    value={formData.numero_serie}
                    onChange={(e) => setFormData({...formData, numero_serie: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Estado *</label>
                  <select
                    required
                    value={formData.estado}
                    onChange={(e) => setFormData({...formData, estado: e.target.value})}
                  >
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="INACTIVO">INACTIVO</option>
                    <option value="EN_REPARACION">EN REPARACIÓN</option>
                    <option value="BAJA">BAJA</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Ubicación</label>
                  <input
                    type="text"
                    value={formData.ubicacion}
                    onChange={(e) => setFormData({...formData, ubicacion: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Valor de Adquisición</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.valor_adquisicion}
                    onChange={(e) => setFormData({...formData, valor_adquisicion: e.target.value})}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingItem ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

      <div className="siaf-table">
        <table>
          <thead>
            <tr>
              <th>Clave Patrimonial</th>
              <th>Descripción</th>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Serie</th>
            </tr>
          </thead>
          <tbody>
            {bienes.map(b => (
              <tr key={b.id}>
                <td>{b.clave}</td>
                <td>{b.descripcion}</td>
                <td>{b.marca}</td>
                <td>{b.modelo}</td>
                <td>{b.serie}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12 }}>
        <button className="siaf-btn primary" onClick={() => setModalOpen(true)}>Generar y Confirmar Baja</button>
        <button className="siaf-btn secondary" style={{ marginLeft: 8 }} onClick={() => alert('Cancelar')}>Cancelar</button>
      </div>

      {modalOpen && (
        <div className="siaf-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="siaf-modal" onClick={e => e.stopPropagation()}>
            <header>Solicitud de Baja de Activo</header>
            <div>
              <p><strong>Dependencia:</strong> Facultad de Ciencias &nbsp; <strong>Fecha:</strong> 2026-02-01</p>
              <div style={{ background: '#fff', padding: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Clave Patrimonial</th>
                      <th>Descripción</th>
                      <th>Marca</th>
                      <th>Modelo</th>
                      <th>Serie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bienes.map(b => (
                      <tr key={b.id}>
                        <td>{b.clave}</td>
                        <td>{b.descripcion}</td>
                        <td>{b.marca}</td>
                        <td>{b.modelo}</td>
                        <td>{b.serie}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="actions">
              <div className="siaf-modal-actions">
                <button className="siaf-btn primary" onClick={() => { setModalOpen(false); alert('Baja generada') }}>Generar y Confirmar Baja</button>
                <button className="siaf-btn secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default Inventario
