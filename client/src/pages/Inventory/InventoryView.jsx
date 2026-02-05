// =====================================================
// INTEGRACIÓN COMPLETA: Vista de Inventario Master-Detail
// Archivo: client/src/pages/Inventory/InventoryView.jsx
// Propósito: Tabla optimizada + Drawer + Form + RLS
// =====================================================

import React, { useState, useEffect, useCallback } from 'react'
import { FaPlus, FaEye, FaEdit, FaTrash, FaSync } from 'react-icons/fa'
import { toast } from 'react-toastify'
import InventoryFormUnified from './InventoryFormUnified'
import InventoryDrawer from './InventoryDrawer'
import BajaRequestModalMass from './BajaRequestModalMass'
import './InventoryView.css'
import './InventoryFormUnified.css'

const InventoryView = () => {
  // Configuración de la API
  const API_BASE_URL = 'http://localhost:5000/api'

  // Estados del componente
  const [items, setItems] = useState([])
  const [filteredPatrimonios, setFilteredPatrimonios] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [totalResults, setTotalResults] = useState(0)
  const [isFiltered, setIsFiltered] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [drawerItem, setDrawerItem] = useState(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterMarca, setFilterMarca] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [filterUbicacion, setFilterUbicacion] = useState('')
  // Estados para el modal de baja
  const [showBajaModal, setShowBajaModal] = useState(false)
  const [itemToBaja, setItemToBaja] = useState(null)
  // Estados para selección múltiple
  const [selectedItems, setSelectedItems] = useState([])
  const [selectAll, setSelectAll] = useState(false)
  // Estados para filtros dinámicos
  const [availableMarcas, setAvailableMarcas] = useState([])
  const [availableUbicaciones, setAvailableUbicaciones] = useState([])

  // Cargar datos con paginación por cursor (estilo SIAF)
  const loadData = useCallback(async (reset = true) => {
    try {
      console.log('Loading inventory data with cursor pagination...')
      if (reset) {
        setLoading(true)
        setNextCursor(null)
        setHasMore(true)
      } else {
        setLoadingMore(true)
      }

      const params = new URLSearchParams()
      params.append('limit', '100') // Lotes de 100 como en SIAF

      if (!reset && nextCursor) {
        params.append('cursor', nextCursor)
      }

      // Filtros
      if (debouncedSearch && debouncedSearch.trim()) {
        params.append('search', debouncedSearch.trim())
      }
      if (filterMarca) params.append('filter_marca', filterMarca)
      if (filterEstado) params.append('filter_estado', filterEstado)
      if (filterUbicacion) params.append('filter_ubicacion', filterUbicacion)

      const response = await fetch(`${API_BASE_URL}/inventarios?${params}`)
      if (!response.ok) {
        throw new Error('Error al cargar los datos')
      }
      
      const data = await response.json()
      const newItems = Array.isArray(data.data?.items) ? data.data.items : []
      const pagination = data.data?.pagination || {}
      
      // DEBUG: Ver si las imágenes vienen en la respuesta
      console.log('🖼️ DEBUG loadData - Primer item de respuesta:', newItems[0])
      if (newItems[0]) {
        console.log('🖼️ DEBUG loadData - imagenes del primer item:', newItems[0].imagenes)
      }

      if (reset) {
        setItems(newItems)
        setTotalResults(pagination.totalFiltered || 0)
        setIsFiltered(pagination.isFiltered || false)
      } else {
        setItems(prev => [...prev, ...newItems])
      }

      setNextCursor(pagination.nextCursor)
      setHasMore(pagination.hasMore || false)

      console.log(`Inventory loaded: ${newItems.length} items | hasMore: ${pagination.hasMore}`)
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error al cargar datos')
      setItems([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [API_BASE_URL, debouncedSearch, filterMarca, filterEstado, filterUbicacion, nextCursor])

  // Debounce para búsqueda en tiempo real
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 2000) // 2000ms de delay (2 segundos)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Cargar opciones dinámicas para filtros
  const loadFilterOptions = useCallback(async () => {
    try {
      // Cargar marcas únicas
      const marcasResponse = await fetch(`${API_BASE_URL}/inventarios/marcas`)
      if (marcasResponse.ok) {
        const marcasData = await marcasResponse.json()
        setAvailableMarcas(marcasData.data || [])
      }

      // Cargar ubicaciones únicas
      const ubicacionesResponse = await fetch(`${API_BASE_URL}/inventarios/ubicaciones`)
      if (ubicacionesResponse.ok) {
        const ubicacionesData = await ubicacionesResponse.json()
        setAvailableUbicaciones(ubicacionesData.data || [])
      }
    } catch (error) {
      console.error('Error loading filter options:', error)
    }
  }, [API_BASE_URL])

  useEffect(() => {
    loadData(true) // Reset = true para primera carga
    loadFilterOptions() // Cargar opciones de filtros
  }, []) // Sin dependencias para evitar loops infinitos

  // Recargar cuando cambien los filtros (incluyendo búsqueda debounced)
  useEffect(() => {
    if (debouncedSearch !== searchTerm) return // Esperar a que termine el debounce
    loadData(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filterMarca, filterEstado, filterUbicacion])

  // Filtrar patrimonios localmente (ahora que tenemos datos paginados)
  useEffect(() => {
    setFilteredPatrimonios(items)
  }, [items])

  // Función para abrir modal de baja
  const handleDelete = (item) => {
    setItemToBaja(item)
    setShowBajaModal(true)
  }

  // Función para procesar la baja
  const handleBajaConfirm = async (item, bajaData) => {
    try {
      // Si es un array (baja masiva) o un item individual
      const itemsToProcess = Array.isArray(item) ? item : [item]
      
      // Procesar cada item
      for (const currentItem of itemsToProcess) {
        const response = await fetch(`${API_BASE_URL}/inventarios/${currentItem.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...currentItem,
            estado_uso: 'de_baja',
            motivo_baja: bajaData.motivo_baja,
            fecha_baja: bajaData.fecha_solicitud,
            tipo_disposicion: bajaData.tipo_disposicion,
            observaciones_baja: bajaData.observaciones,
            solicitante_baja: bajaData.solicitante_nombre,
            dependencia_solicitante: bajaData.dependencia
          })
        })

        if (!response.ok) {
          throw new Error(`Error al procesar la baja del item ${currentItem.numero_patrimonio || currentItem.id}`)
        }
      }

      const mensaje = itemsToProcess.length > 1 
        ? `${itemsToProcess.length} solicitudes de baja generadas exitosamente`
        : 'Solicitud de baja generada exitosamente'
      
      toast.success(mensaje)
      setShowBajaModal(false)
      setItemToBaja(null)
      setSelectedItems([]) // Limpiar selección
      setSelectAll(false)
      loadData()
      setIsDrawerOpen(false)
    } catch (error) {
      console.error('Error processing baja:', error)
      toast.error('Error al procesar la solicitud de baja')
    }
  }

  // ==========================================
  // FUNCIONES DE SELECCIÓN MÚLTIPLE
  // ==========================================
  
  // Manejar selección individual
  const handleItemSelect = (itemId) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId)
      } else {
        return [...prev, itemId]
      }
    })
  }

  // Manejar seleccionar todos
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([])
      setSelectAll(false)
    } else {
      const allIds = filteredPatrimonios.map(item => item.id)
      setSelectedItems(allIds)
      setSelectAll(true)
    }
  }

  // Limpiar selección
  const handleClearSelection = () => {
    setSelectedItems([])
    setSelectAll(false)
  }

  // Manejar baja masiva
  const handleMassBaja = () => {
    const selectedItemsData = filteredPatrimonios.filter(item => 
      selectedItems.includes(item.id)
    )
    
    if (selectedItemsData.length === 0) {
      toast.error('Selecciona al menos un elemento')
      return
    }

    setItemToBaja(selectedItemsData) // Enviar array de items
    setShowBajaModal(true)
  }

  const handleCreate = () => {
    setEditingItem(null)
    setShowForm(true)
    setIsDrawerOpen(false)
  }

  const handleEdit = (item) => {
    setEditingItem(item)
    setShowForm(true)
    setIsDrawerOpen(false)
  }

  const handleView = async (item) => {
    try {
      console.log('🖼️ DEBUG handleView - Item desde tabla:', item)
      console.log('🖼️ DEBUG handleView - item.imagenes:', item.imagenes)
      setDrawerItem(item)
      setIsDrawerOpen(true)
    } catch (err) {
      console.error('Error fetching item for drawer:', err)
      setDrawerItem(item)
      setIsDrawerOpen(true)
    }
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingItem(null)
    loadData(true) // Reset = true para recargar desde el inicio
  }

  // Función para cargar más registros
  const handleLoadMore = () => {
    if (hasMore && !loadingMore) {
      loadData(false) // Reset = false para agregar más datos
    }
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>
  }

  return (
    <div className="inventory-container">
      <div className="inventory-header">
        <div className="header-left">
          <h1 className="page-title">Inventario Patrimonial</h1>
          <p className="page-subtitle">Gestión completa de bienes patrimoniales</p>
        </div>
        <div className="header-actions">
          <button 
            onClick={handleCreate}
            className="btn btn-primary"
          >
            <FaPlus /> Agregar Nuevo Bien
          </button>
          
          <button 
            onClick={() => loadData(true)}
            disabled={loading}
            className="btn btn-secondary"
          >
            <FaSync /> Actualizar
          </button>
        </div>
      </div>
        {/* Filtros y búsqueda mejorados */}
        <div className="filters-section">
          <div className="search-container">
            <input
              type="text"
              placeholder="Buscar por folio, descripción, marca, modelo o serie..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filters-container">
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="filter-select"
            >
              <option value="">Todos los Estados</option>
              <option value="bueno">Bueno</option>
              <option value="regular">Regular</option>
              <option value="malo">Malo</option>
              <option value="baja">Baja</option>
            </select>
            
            <select
              value={filterMarca}
              onChange={(e) => setFilterMarca(e.target.value)}
              className="filter-select"
            >
              <option value="">Todas las Marcas</option>
              {availableMarcas.map((marca, index) => (
                <option key={index} value={marca}>
                  {marca}
                </option>
              ))}
            </select>

            <select
              value={filterUbicacion}
              onChange={(e) => setFilterUbicacion(e.target.value)}
              className="filter-select"
            >
              <option value="">Todas las Ubicaciones</option>
              {availableUbicaciones.map((ubicacion, index) => (
                <option key={index} value={ubicacion}>
                  {ubicacion}
                </option>
              ))}
            </select>
            
            {(searchTerm || filterEstado || filterMarca || filterUbicacion) && (
              <button
                onClick={() => {
                  setSearchTerm('')
                  setFilterEstado('')
                  setFilterMarca('')
                  setFilterUbicacion('')
                }}
                className="btn-clear-filters"
              >
                ✨ Limpiar Filtros
              </button>
            )}
          </div>
          
          <div className="results-info">
            <span className="results-count">
              {items.length} de {totalResults.toLocaleString()}
              {hasMore && ' • Registros disponibles'}
            </span>
          </div>
        </div>

      {/* CONTROLES DE SELECCIÓN MÚLTIPLE */}
      {selectedItems.length > 0 && (
        <div className="mass-selection-controls">
          <div className="selection-info">
            <span className="selection-count">
              {selectedItems.length}
            </span>
            {selectedItems.length === 1 ? 'elemento seleccionado' : 'elementos seleccionados'}
          </div>
          <div className="mass-action-buttons">
            <button 
              className="btn-mass-baja"
              onClick={handleMassBaja}
              disabled={selectedItems.length === 0}
            >
              <FaTrash />
              Baja Masiva ({selectedItems.length})
            </button>
            <button 
              className="btn-clear-selection"
              onClick={handleClearSelection}
            >
              Limpiar Selección
            </button>
          </div>
        </div>
      )}

      {/* Tabla con scrolling y headers fijos */}
      <div className="table-container-scrollable">
        <table className="inventory-table">
          <thead className="table-header-fixed">
            <tr>
              <th className="checkbox-column">
                <input
                  type="checkbox"
                  className="select-all-checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                  title="Seleccionar todos"
                />
              </th>
              <th className="folio-column">Folio</th>
              <th className="estado-column">Estado</th>
              <th className="marca-column">Marca / Modelo</th>
              <th className="ubicacion-column">Ubicación</th>
              <th className="tipo-column">Tipo</th>
              <th className="acciones-column">Acciones</th>
            </tr>
          </thead>
          <tbody className="table-body-scrollable">
            {filteredPatrimonios.length === 0 && !loading ? (
              <tr>
                <td colSpan="7" className="empty-state">
                  {items.length === 0 ? 'No hay datos disponibles' : 'No se encontraron resultados con los filtros aplicados'}
                </td>
              </tr>
            ) : (
              Array.isArray(filteredPatrimonios) && filteredPatrimonios.map((item) => (
                <tr 
                  key={item.id}
                  className={selectedItems.includes(item.id) ? 'row-selected' : 'row-normal'}
                >
                  <td className="checkbox-cell">
                    <input
                      type="checkbox"
                      className="select-checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => handleItemSelect(item.id)}
                    />
                  </td>
                  <td className="folio-cell">
                    <span className="folio-badge">
                      {item.folio || 'Pendiente'}
                    </span>
                  </td>
                  <td className="estado-cell">
                    <span className={`estado-badge estado-${item.estado_uso || item.estado || 'unknown'}`}>
                      {item.estado_uso || item.estado || '-'}
                    </span>
                  </td>
                  <td className="marca-cell">
                    <div className="marca-info">
                      <strong>{item.marca || '-'}</strong>
                      <small>{item.modelo || '-'}</small>
                    </div>
                  </td>
                  <td className="ubicacion-cell">
                    {item.ubicacion || 'Sin asignar'}
                  </td>
                  <td className="tipo-cell">
                    <span className={`stage-badge ${item.stage === 'INTERNO' ? 'stage-interno' : 'stage-externo'}`}>
                      {item.stage || 'EXTERNO'}
                    </span>
                  </td>
                  <td className="acciones-cell">
                    <div className="action-buttons">
                      <button 
                        onClick={() => handleView(item)}
                        title="Ver detalles"
                        className="btn-action btn-view"
                      >
                        <FaEye />
                      </button>
                      <button 
                        onClick={() => handleEdit(item)}
                        title="Editar"
                        className="btn-action btn-edit"
                      >
                        <FaEdit />
                      </button>
                      <button 
                        onClick={() => handleDelete(item)}
                        title="Solicitar Baja"
                        className="btn-action btn-delete"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Botón Ver Más (estilo SIAF) */}
      {hasMore && (
        <div className="load-more-container">
          <button 
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="btn-load-more"
          >
            {loadingMore ? (
              <>
                <div className="spinner-small"></div>
                Cargando más registros...
              </>
            ) : (
              <>
                Ver más registros (100 más)
              </>
            )}
          </button>
        </div>
      )}

      {/* FORMULARIO UNIFICADO MODAL */}
      {showForm && (
        <InventoryFormUnified
          initialData={editingItem}
          onClose={handleFormClose}
          onSuccess={loadData}
        />
      )}

      {/* DRAWER DE DETALLES */}
      <InventoryDrawer
        item={drawerItem}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* MODAL DE SOLICITUD DE BAJA MASIVA */}
      <BajaRequestModalMass
        item={itemToBaja}
        isOpen={showBajaModal}
        onClose={() => {
          setShowBajaModal(false)
          setItemToBaja(null)
        }}
        onConfirm={handleBajaConfirm}
      />

      {/* FOOTER */}
      <footer className="siaf-footer">
        SIAF 2026 - INFRAESTRUCTURA INFORMÁTICA
      </footer>

    </div>
  )
}

export default InventoryView