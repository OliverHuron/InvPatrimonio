// =====================================================
// COMPONENTE: Formulario de Solicitud de Baja MASIVA/INDIVIDUAL
// Archivo: client/src/pages/Inventory/BajaRequestModalMass.jsx
// Propósito: Modal para generar solicitud de baja múltiple con page breaks automáticos
// =====================================================

import React, { useState, useMemo } from 'react'
import { FaTimes, FaPrint, FaFileAlt, FaList } from 'react-icons/fa'
import BajaRequestDocumentMultiPage from './BajaRequestDocumentMultiPage'
import './BajaRequestModal.css'

const BajaRequestModalMass = ({ item, isOpen, onClose, onConfirm }) => {
  const [formData, setFormData] = useState({
    motivo_baja: '',
    observaciones: '',
    solicitante_nombre: '',
    solicitante_cargo: '',
    numero_empleado: '',
    dependencia: '',
    fecha_solicitud: new Date().toISOString().split('T')[0],
    tipo_disposicion: 'donacion' // donacion, destruccion, venta
  })
  const [showDocument, setShowDocument] = useState(false)

  // Determinar si es baja masiva o individual
  const isMultiple = Array.isArray(item)
  const items = isMultiple ? item : [item].filter(Boolean)
  const totalItems = items.length

  // Dividir items en páginas de máximo 15 elementos
  const itemsPerPage = 15
  const pages = useMemo(() => {
    const result = []
    for (let i = 0; i < items.length; i += itemsPerPage) {
      result.push(items.slice(i, i + itemsPerPage))
    }
    return result
  }, [items, itemsPerPage])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onConfirm(isMultiple ? item : item, formData)
  }

  const generateDocument = () => {
    if (!formData.solicitante_nombre || !formData.motivo_baja || !formData.dependencia) {
      alert('Por favor complete todos los campos obligatorios antes de generar el documento.')
      return
    }
    setShowDocument(true)
  }

  if (!isOpen || !item) return null

  return (
    <div className="baja-modal-backdrop">
      <div className="baja-modal">
        <div className="baja-modal-header">
          <h2>
            {isMultiple 
              ? `Solicitud de Baja Masiva - ${totalItems} Bienes`
              : 'Solicitud de Baja - Bien Mueble'
            }
          </h2>
          <button onClick={onClose} className="close-button">
            <FaTimes />
          </button>
        </div>

        <div className="baja-modal-content">
          {/* Información de los bienes */}
          <div className="bien-info">
            <h3>
              <FaList /> 
              {isMultiple 
                ? `Información de los Bienes (${totalItems} elementos)`
                : 'Información del Bien'
              }
            </h3>
            
            {isMultiple ? (
              <div className="multiple-items-summary">
                <div className="summary-stats">
                  <div className="stat-item">
                    <label>Total de bienes:</label>
                    <span className="stat-value">{totalItems}</span>
                  </div>
                  <div className="stat-item">
                    <label>Páginas necesarias:</label>
                    <span className="stat-value">{pages.length}</span>
                  </div>
                  <div className="stat-item">
                    <label>Elementos por página:</label>
                    <span className="stat-value">Máx. {itemsPerPage}</span>
                  </div>
                </div>
                
                <div className="items-preview">
                  <h4>Vista previa de elementos seleccionados:</h4>
                  <div className="items-list">
                    {items.slice(0, 5).map((currentItem, index) => (
                      <div key={currentItem.id} className="item-preview">
                        <span className="item-number">{index + 1}.</span>
                        <span className="item-patrimonio">
                          {currentItem.numero_patrimonio || currentItem.folio || 'N/A'}
                        </span>
                        <span className="item-description">
                          {currentItem.descripcion?.substring(0, 50)}
                          {currentItem.descripcion?.length > 50 ? '...' : ''}
                        </span>
                      </div>
                    ))}
                    {items.length > 5 && (
                      <div className="item-preview more-items">
                        <span>... y {items.length - 5} elementos más</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="info-grid">
                <div className="info-item">
                  <label>No. Patrimonio:</label>
                  <span>{items[0]?.numero_patrimonio || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <label>Descripción:</label>
                  <span>{items[0]?.descripcion}</span>
                </div>
                <div className="info-item">
                  <label>Marca/Modelo:</label>
                  <span>{items[0]?.marca} {items[0]?.modelo}</span>
                </div>
                <div className="info-item">
                  <label>No. Serie:</label>
                  <span>{items[0]?.numero_serie}</span>
                </div>
                <div className="info-item">
                  <label>Ubicación:</label>
                  <span>{items[0]?.ubicacion}</span>
                </div>
                <div className="info-item">
                  <label>Estado Actual:</label>
                  <span>{items[0]?.estado_uso}</span>
                </div>
              </div>
            )}
          </div>

          {/* Formulario de baja */}
          <form onSubmit={handleSubmit} className="baja-form">
            <div className="form-section">
              <h3>Datos de la Solicitud</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Solicitante *</label>
                  <input
                    type="text"
                    name="solicitante_nombre"
                    value={formData.solicitante_nombre}
                    onChange={handleInputChange}
                    required
                    placeholder="Nombre completo del solicitante"
                  />
                </div>
                <div className="form-group">
                  <label>Cargo</label>
                  <input
                    type="text"
                    name="solicitante_cargo"
                    value={formData.solicitante_cargo}
                    onChange={handleInputChange}
                    placeholder="Cargo del solicitante"
                  />
                </div>                <div className="form-group">
                  <label>Número de Empleado</label>
                  <input
                    type="text"
                    name="numero_empleado"
                    value={formData.numero_empleado}
                    onChange={handleInputChange}
                    placeholder="Número de empleado"
                  />
                </div>              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Dependencia *</label>
                  <input
                    type="text"
                    name="dependencia"
                    value={formData.dependencia}
                    onChange={handleInputChange}
                    required
                    placeholder="Dependencia solicitante"
                  />
                </div>
                <div className="form-group">
                  <label>Fecha de Solicitud</label>
                  <input
                    type="date"
                    name="fecha_solicitud"
                    value={formData.fecha_solicitud}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Motivo de la Baja *</label>
                <select
                  name="motivo_baja"
                  value={formData.motivo_baja}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Seleccione un motivo...</option>
                  <option value="obsolescencia">Obsolescencia tecnológica</option>
                  <option value="deterioro">Deterioro por uso normal</option>
                  <option value="dano_irreparable">Daño irreparable</option>
                  <option value="falta_repuestos">Falta de repuestos</option>
                  <option value="costo_reparacion">Costo de reparación excesivo</option>
                  <option value="reorganizacion">Reorganización administrativa</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div className="form-group">
                <label>Tipo de Disposición</label>
                <select
                  name="tipo_disposicion"
                  value={formData.tipo_disposicion}
                  onChange={handleInputChange}
                  required
                >
                  <option value="donacion">Donación</option>
                  <option value="destruccion">Destrucción</option>
                  <option value="venta">Venta</option>
                  <option value="reciclaje">Reciclaje</option>
                </select>
              </div>

              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  name="observaciones"
                  value={formData.observaciones}
                  onChange={handleInputChange}
                  rows="4"
                  placeholder={isMultiple 
                    ? `Observaciones adicionales para los ${totalItems} bienes seleccionados...`
                    : "Observaciones adicionales..."
                  }
                />
              </div>
            </div>

            <div className="baja-modal-actions">
              <button 
                type="button" 
                onClick={generateDocument} 
                className="btn-generate-doc"
                disabled={!formData.solicitante_nombre || !formData.motivo_baja || !formData.dependencia}
              >
                <FaFileAlt />
                {isMultiple 
                  ? `Generar Documento (${pages.length} ${pages.length === 1 ? 'página' : 'páginas'})`
                  : 'Generar Documento'
                }
              </button>
              <button type="button" onClick={onClose} className="btn-cancel">
                Cancelar
              </button>
              <button type="submit" className="btn-confirm">
                {isMultiple 
                  ? `Confirmar Baja de ${totalItems} Bienes`
                  : 'Confirmar Baja'
                }
              </button>
            </div>
          </form>
        </div>

        {/* Modal del documento */}
        {showDocument && (
          <BajaRequestDocumentMultiPage 
            items={items}
            bajaData={formData}
            isMultiple={isMultiple}
            pages={pages}
            onClose={() => setShowDocument(false)}
          />
        )}
      </div>
    </div>
  )
}

export default BajaRequestModalMass