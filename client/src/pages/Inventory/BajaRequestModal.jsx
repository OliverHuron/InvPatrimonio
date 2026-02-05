// =====================================================
// COMPONENTE: Formulario de Solicitud de Baja
// Archivo: client/src/pages/Inventory/BajaRequestModal.jsx
// Propósito: Modal para generar solicitud de baja de bienes
// =====================================================

import React, { useState } from 'react'
import { FaTimes, FaPrint, FaDownload, FaFileAlt } from 'react-icons/fa'
import BajaRequestDocument from './BajaRequestDocument'
import './BajaRequestModal.css'

const BajaRequestModal = ({ item, isOpen, onClose, onConfirm }) => {
  const [formData, setFormData] = useState({
    motivo_baja: '',
    observaciones: '',
    solicitante_nombre: '',
    solicitante_cargo: '',
    dependencia: '',
    fecha_solicitud: new Date().toISOString().split('T')[0],
    tipo_disposicion: 'donacion' // donacion, destruccion, venta
  })
  const [showDocument, setShowDocument] = useState(false)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onConfirm(item, formData)
  }

  const generateDocument = () => {
    if (!formData.solicitante_nombre || !formData.motivo_baja || !formData.dependencia) {
      alert('Por favor complete todos los campos obligatorios antes de generar el documento.')
      return
    }
    setShowDocument(true)
  }

  if (!isOpen) return null

  return (
    <div className="baja-modal-backdrop">
      <div className="baja-modal">
        <div className="baja-modal-header">
          <h2>Solicitud de Baja - Bien Mueble</h2>
          <button onClick={onClose} className="close-button">
            <FaTimes />
          </button>
        </div>

        <div className="baja-modal-content">
          {/* Información del bien */}
          <div className="bien-info">
            <h3>Información del Bien</h3>
            <div className="info-grid">
              <div className="info-item">
                <label>No. Patrimonio:</label>
                <span>{item?.numero_patrimonio || 'N/A'}</span>
              </div>
              <div className="info-item">
                <label>Descripción:</label>
                <span>{item?.descripcion}</span>
              </div>
              <div className="info-item">
                <label>Marca/Modelo:</label>
                <span>{item?.marca} {item?.modelo}</span>
              </div>
              <div className="info-item">
                <label>No. Serie:</label>
                <span>{item?.numero_serie}</span>
              </div>
              <div className="info-item">
                <label>Ubicación:</label>
                <span>{item?.ubicacion}</span>
              </div>
              <div className="info-item">
                <label>Estado Actual:</label>
                <span>{item?.estado_uso}</span>
              </div>
            </div>
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
                  <label>Cargo *</label>
                  <input
                    type="text"
                    name="solicitante_cargo"
                    value={formData.solicitante_cargo}
                    onChange={handleInputChange}
                    required
                    placeholder="Cargo o puesto"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Dependencia *</label>
                  <input
                    type="text"
                    name="dependencia"
                    value={formData.dependencia}
                    onChange={handleInputChange}
                    required
                    placeholder="Dependencia o coordinación"
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
                <label>Tipo de Disposición Final *</label>
                <select
                  name="tipo_disposicion"
                  value={formData.tipo_disposicion}
                  onChange={handleInputChange}
                  required
                >
                  <option value="donacion">Donación</option>
                  <option value="destruccion">Destrucción</option>
                  <option value="venta">Venta</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>

              <div className="form-group">
                <label>Motivo de la Baja *</label>
                <textarea
                  name="motivo_baja"
                  value={formData.motivo_baja}
                  onChange={handleInputChange}
                  required
                  rows="4"
                  placeholder="Describa detalladamente el motivo por el cual solicita la baja del bien..."
                />
              </div>

              <div className="form-group">
                <label>Observaciones Adicionales</label>
                <textarea
                  name="observaciones"
                  value={formData.observaciones}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Observaciones adicionales (opcional)"
                />
              </div>
            </div>

            <div className="baja-modal-actions">
              <button type="button" onClick={generateDocument} className="btn-secondary">
                <FaFileAlt /> Previsualizar Documento
              </button>
              <button type="button" onClick={onClose} className="btn-cancel">
                Cancelar
              </button>
              <button type="submit" className="btn-danger">
                <FaDownload /> Generar Solicitud de Baja
              </button>
            </div>
          </form>
        </div>

        {/* DOCUMENTO HTML */}
        {showDocument && (
          <BajaRequestDocument
            items={[item]}
            solicitante={{
              nombre: formData.solicitante_nombre,
              cargo: formData.solicitante_cargo,
              dependencia: formData.dependencia,
              numeroEmpleado: item?.numero_empleado || '',
              motivo_baja: formData.motivo_baja,
              tipo_disposicion: formData.tipo_disposicion
            }}
            onClose={() => setShowDocument(false)}
          />
        )}
      </div>
    </div>
  )
}

export default BajaRequestModal