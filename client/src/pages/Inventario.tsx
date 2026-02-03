/*
  Inventario.tsx
  - Página de inventario patrimonial conectada a la API real
  - CRUD completo: Crear, Leer, Actualizar, Eliminar patrimonio
*/

import React, { useState, useEffect } from 'react'
import { AiOutlinePlus, AiOutlineSearch, AiOutlineEdit, AiOutlineDelete } from 'react-icons/ai'
import '../styles/inventario.css'

// Interfaz para el inventario SIAF
interface Patrimonio {
  id: number
  folio?: string
  numero_patrimonio?: string
  numero_serie?: string
  marca?: string
  modelo?: string
  descripcion?: string
  tipo_bien?: string
  estado: string
  estado_uso?: string
  ubicacion?: string
  coordinacion_id?: number
  dependencia_id?: number
  stage?: string
  estatus_validacion?: string
  costo?: number
  proveedor?: string
  fecha_adquisicion?: string
  created_at?: string
  updated_at?: string
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
    costo: ''
  })

  // Cargar patrimonios al montar el componente
  useEffect(() => {
    fetchPatrimonios()
  }, [])

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

  // Función para guardar patrimonio (crear/actualizar)
  const savePatrimonio = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingItem 
        ? `${API_BASE_URL}/inventarios/${editingItem.id}`
        : `${API_BASE_URL}/inventarios`
      
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
      const response = await fetch(`${API_BASE_URL}/inventarios/${id}`, {
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
      costo: ''
    })
    setModalOpen(true)
  }

  // Abrir modal para editar
  const openEditModal = (item: Patrimonio) => {
    setEditingItem(item)
    setFormData({
      numero_patrimonio: item.numero_patrimonio || '',
      descripcion: item.descripcion || '',
      marca: item.marca || '',
      modelo: item.modelo || '',
      numero_serie: item.numero_serie || '',
      tipo_bien: item.tipo_bien || '',
      estado: item.estado,
      estado_uso: item.estado_uso || 'operativo',
      ubicacion: item.ubicacion || '',
      proveedor: item.proveedor || '',
      costo: item.costo?.toString() || ''
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
    (item.numero_patrimonio || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.marca || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.folio || '').toLowerCase().includes(searchTerm.toLowerCase())
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
              <th>Folio</th>
              <th>N° Patrimonio</th>
              <th>Descripción</th>
              <th>Marca/Modelo</th>
              <th>Estado</th>
              <th>Stage SIAF</th>
              <th>Valor</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatrimonios.map((item) => (
              <tr key={item.id}>
                <td>{item.folio || '-'}</td>
                <td>{item.numero_patrimonio || '-'}</td>
                <td>{item.descripcion || '-'}</td>
                <td>
                  {item.marca || '-'}
                  {item.modelo && <><br /><small>{item.modelo}</small></>}
                </td>
                <td>
                  <span className={`status ${item.estado_uso?.toLowerCase() || 'operativo'}`}>
                    {item.estado_uso || 'Operativo'}
                  </span>
                </td>
                <td>
                  <span className={`stage ${item.stage?.toLowerCase() || 'completo'}`}>
                    {item.stage || 'COMPLETO'}
                  </span>
                </td>
                <td>
                  {item.costo 
                    ? `S/ ${item.costo.toLocaleString()}`
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
                  <label>Número Patrimonio *</label>
                  <input
                    type="text"
                    required
                    title="Número Patrimonio"
                    value={formData.numero_patrimonio}
                    onChange={(e) => setFormData({...formData, numero_patrimonio: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Descripción *</label>
                  <input
                    type="text"
                    required
                    title="Descripción del patrimonio"
                    value={formData.descripcion}
                    onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Marca</label>
                  <input
                    type="text"
                    title="Marca del patrimonio"
                    value={formData.marca}
                    onChange={(e) => setFormData({...formData, marca: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Modelo</label>
                  <input
                    type="text"
                    title="Modelo del patrimonio"
                    value={formData.modelo}
                    onChange={(e) => setFormData({...formData, modelo: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Número de Serie</label>
                  <input
                    type="text"
                    title="Número de serie del patrimonio"
                    value={formData.numero_serie}
                    onChange={(e) => setFormData({...formData, numero_serie: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Estado *</label>
                  <select
                    required
                    title="Estado del patrimonio"
                    value={formData.estado}
                    onChange={(e) => setFormData({...formData, estado: e.target.value})}
                  >
                    <option value="buena">Buena</option>
                    <option value="regular">Regular</option>
                    <option value="mala">Mala</option>
                    <option value="excelente">Excelente</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Estado de Uso</label>
                  <select
                    title="Estado de uso del patrimonio"
                    value={formData.estado_uso}
                    onChange={(e) => setFormData({...formData, estado_uso: e.target.value})}
                  >
                    <option value="operativo">Operativo</option>
                    <option value="en_reparacion">En Reparación</option>
                    <option value="de_baja">De Baja</option>
                    <option value="obsoleto">Obsoleto</option>
                    <option value="resguardo_temporal">Resguardo Temporal</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Ubicación</label>
                  <input
                    type="text"
                    title="Ubicación del patrimonio"
                    value={formData.ubicacion}
                    onChange={(e) => setFormData({...formData, ubicacion: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Costo</label>
                  <input
                    type="number"
                    step="0.01"
                    title="Costo en soles"
                    value={formData.costo}
                    onChange={(e) => setFormData({...formData, costo: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Tipo de Bien</label>
                  <input
                    type="text"
                    title="Tipo de bien"
                    value={formData.tipo_bien}
                    onChange={(e) => setFormData({...formData, tipo_bien: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Proveedor</label>
                  <input
                    type="text"
                    title="Proveedor"
                    value={formData.proveedor}
                    onChange={(e) => setFormData({...formData, proveedor: e.target.value})}
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

export default Inventario
