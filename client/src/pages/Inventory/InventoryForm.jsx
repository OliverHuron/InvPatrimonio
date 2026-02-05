// =====================================================
// COMPONENTE: Formulario de Inventario con Tabs y Validación
// Archivo: client/src/pages/Inventory/InventoryForm.jsx
// Stack: React + Tabs INTERNO/EXTERNO
// =====================================================

import React, { useState, useEffect } from 'react'
import { FaSave, FaTimes } from 'react-icons/fa'
import { toast } from 'react-toastify'
import './InventoryForm.css'

const InventoryForm = ({
  initialData = null,
  onClose
}) => {
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://patrimonio.siafsystem.online/api'

  const [activeTab, setActiveTab] = useState(initialData?.stage || 'INTERNO')
  const [isSubmitting, setIsSubmitting] = useState(false)
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

  // Cargar datos iniciales si es edición
  useEffect(() => {
    if (initialData) {
      setActiveTab(initialData.stage || 'INTERNO')
      setFormData({
        folio: initialData.folio || '',
        descripcion: initialData.descripcion || '',
        marca: initialData.marca || '',
        modelo: initialData.modelo || '',
        numero_serie: initialData.numero_serie || '',
        estado_uso: initialData.estado_uso || initialData.estado || 'bueno',
        costo: initialData.costo || '',
        proveedor: initialData.proveedor || '',
        factura: initialData.factura || '',
        uuid: initialData.uuid || '',
        fecha_adquisicion: initialData.fecha_adquisicion || '',
        ubicacion: initialData.ubicacion || '',
        numero_empleado: initialData.numero_empleado || '',
        observaciones: initialData.observaciones || '',
        stage: initialData.stage || 'INTERNO',
        registro_patrimonial: initialData.registro_patrimonial || '',
        registro_interno: initialData.registro_interno || '',
        elaboro_nombre: initialData.elaboro_nombre || '',
        fecha_elaboracion: initialData.fecha_elaboracion || '',
        ures_asignacion: initialData.ures_asignacion || '',
        recurso: initialData.recurso || '',
        ur: initialData.ur || '',
        id_patrimonio: initialData.id_patrimonio || '',
        numero_patrimonio: initialData.numero_patrimonio || '',
        clave_patrimonial: initialData.clave_patrimonial || '',
        numero_inventario: initialData.numero_inventario || '',
        cog: initialData.cog || '',
        fondo: initialData.fondo || '',
        valor_unitario: initialData.valor_unitario || '',
        ures_gasto: initialData.ures_gasto || '',
        ubicacion_fisica: initialData.ubicacion_fisica || '',
        coordinacion: initialData.coordinacion || '',
        ejercicio: initialData.ejercicio || '',
        solicitud_compra: initialData.solicitud_compra || '',
        cuenta_por_pagar: initialData.cuenta_por_pagar || '',
        idcon: initialData.idcon || '',
        usu_asig: initialData.usu_asig || '',
        fecha_registro: initialData.fecha_registro || '',
        fecha_asignacion: initialData.fecha_asignacion || ''
      })
    }
  }, [initialData])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ 
      ...prev, 
      [name]: value,
      stage: activeTab // Asegurar que el stage siempre esté sincronizado
    }))
  }

  const handleTabChange = (newTab) => {
    setActiveTab(newTab)
    setFormData(prev => ({ ...prev, stage: newTab }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const method = initialData ? 'PUT' : 'POST'
      const url = initialData 
        ? `${API_BASE_URL}/inventarios/${initialData.id}`
        : `${API_BASE_URL}/inventarios`

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, stage: activeTab })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Error al guardar')
      }

      toast.success(initialData ? 'Item actualizado exitosamente' : 'Item creado exitosamente')
      onClose()
    } catch (error) {
      console.error('Error saving:', error)
      toast.error(error.message || 'Error al guardar item')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content-form">
        <div className="modal-header-form">
          <h3>{initialData ? 'Editar Bien' : 'Agregar Nuevo Bien'}</h3>
          <button type="button" className="modal-close-form" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        
        {/* Tabs INTERNO/EXTERNO */}
        <div className="tabs-container">
          <button
            type="button"
            onClick={() => handleTabChange('INTERNO')}
            className={`tab-button ${activeTab === 'INTERNO' ? 'active' : ''}`}
          >
            🏢 INTERNO
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('EXTERNO')}
            className={`tab-button ${activeTab === 'EXTERNO' ? 'active' : ''}`}
          >
            🏛️ EXTERNO
          </button>
        </div>

        <form onSubmit={handleSubmit} className="inventory-form">
          
          {/* FORMULARIO INTERNO */}
          {activeTab === 'INTERNO' && (
            <div className="form-grid">
              <div className="form-row-full">
                <label>3. No. Registro Patrimonial</label>
                <input 
                  type="text" 
                  name="registro_patrimonial" 
                  value={formData.registro_patrimonial} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-row-full">
                <label>4. No. Registro Interno</label>
                <input 
                  type="text" 
                  name="registro_interno" 
                  value={formData.registro_interno} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-row-full">
                <label>5. Descripción</label>
                <textarea 
                  name="descripcion" 
                  value={formData.descripcion} 
                  onChange={handleInputChange} 
                  rows={2}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>6. Elaboró</label>
                <input 
                  type="text" 
                  name="elaboro_nombre" 
                  value={formData.elaboro_nombre} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>18. Fecha Elaboración</label>
                <input 
                  type="date" 
                  name="fecha_elaboracion" 
                  value={formData.fecha_elaboracion} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>7. Marca *</label>
                <input 
                  type="text" 
                  name="marca" 
                  value={formData.marca} 
                  onChange={handleInputChange} 
                  required
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>8. Modelo *</label>
                <input 
                  type="text" 
                  name="modelo" 
                  value={formData.modelo} 
                  onChange={handleInputChange} 
                  required
                  className="form-control" 
                />
              </div>

              <div className="form-row-full">
                <label>9. No. Serie</label>
                <input 
                  type="text" 
                  name="numero_serie" 
                  value={formData.numero_serie} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>10. No. Factura</label>
                <input 
                  type="text" 
                  name="factura" 
                  value={formData.factura} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>11. Fecha Factura</label>
                <input 
                  type="date" 
                  name="fecha_adquisicion" 
                  value={formData.fecha_adquisicion} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-row-full">
                <label>12. UUID (Folio Fiscal)</label>
                <input 
                  type="text" 
                  name="uuid" 
                  value={formData.uuid} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>13. Costo</label>
                <input 
                  type="number" 
                  step="0.01" 
                  name="costo" 
                  value={formData.costo} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>14. URES Asignación</label>
                <input 
                  type="text" 
                  name="ures_asignacion" 
                  value={formData.ures_asignacion} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-row-full">
                <label>15. Ubicación</label>
                <input 
                  type="text" 
                  name="ubicacion" 
                  value={formData.ubicacion} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>16. Recurso</label>
                <input 
                  type="text" 
                  name="recurso" 
                  value={formData.recurso} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>17. Proveedor</label>
                <input 
                  type="text" 
                  name="proveedor" 
                  value={formData.proveedor} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-row-full">
                <label>19. Observaciones</label>
                <textarea 
                  name="observaciones" 
                  value={formData.observaciones} 
                  onChange={handleInputChange} 
                  rows={2}
                  className="form-control" 
                />
              </div>

              <div className="form-row-full">
                <label>20. Estado de Uso</label>
                <select 
                  name="estado_uso" 
                  value={formData.estado_uso} 
                  onChange={handleInputChange}
                  className="form-control"
                >
                  <option value="bueno">Bueno</option>
                  <option value="regular">Regular</option>
                  <option value="malo">Malo</option>
                </select>
              </div>

              <div className="form-row-full">
                <label>23. No. Empleado</label>
                <input 
                  type="text" 
                  name="numero_empleado" 
                  value={formData.numero_empleado} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-row-full">
                <label>24. UR</label>
                <input 
                  type="text" 
                  name="ur" 
                  value={formData.ur} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>
            </div>
          )}

          {/* FORMULARIO EXTERNO */}
          {activeTab === 'EXTERNO' && (
            <div className="form-grid">
              <div className="form-row-full">
                <label>2. ID Patrimonio</label>
                <input 
                  type="text" 
                  name="id_patrimonio" 
                  value={formData.id_patrimonio} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>3. Folio</label>
                <input 
                  type="text" 
                  name="folio" 
                  value={formData.folio} 
                  disabled
                  className="form-control" 
                  placeholder="Automático" 
                />
              </div>

              <div className="form-group">
                <label>4. Clave Patrimonial</label>
                <input 
                  type="text" 
                  name="clave_patrimonial" 
                  value={formData.clave_patrimonial} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-row-full">
                <label>5. Descripción</label>
                <textarea 
                  name="descripcion" 
                  value={formData.descripcion} 
                  onChange={handleInputChange} 
                  rows={2}
                  className="form-control" 
                />
              </div>

              <div className="form-row-full">
                <label>6. No. Inventario</label>
                <input 
                  type="text" 
                  name="numero_inventario" 
                  value={formData.numero_inventario} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>7. Marca *</label>
                <input 
                  type="text" 
                  name="marca" 
                  value={formData.marca} 
                  onChange={handleInputChange} 
                  required
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>8. Modelo *</label>
                <input 
                  type="text" 
                  name="modelo" 
                  value={formData.modelo} 
                  onChange={handleInputChange} 
                  required
                  className="form-control" 
                />
              </div>

              <div className="form-row-full">
                <label>9. No. Serie</label>
                <input 
                  type="text" 
                  name="numero_serie" 
                  value={formData.numero_serie} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>10. COG</label>
                <input 
                  type="text" 
                  name="cog" 
                  value={formData.cog} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>11. Fondo</label>
                <input 
                  type="text" 
                  name="fondo" 
                  value={formData.fondo} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>12. No. Factura</label>
                <input 
                  type="text" 
                  name="factura" 
                  value={formData.factura} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>13. Fecha Factura</label>
                <input 
                  type="date" 
                  name="fecha_adquisicion" 
                  value={formData.fecha_adquisicion} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-row-full">
                <label>14. UUID (Folio Fiscal)</label>
                <input 
                  type="text" 
                  name="uuid" 
                  value={formData.uuid} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>15. Costo</label>
                <input 
                  type="number" 
                  step="0.01" 
                  name="costo" 
                  value={formData.costo} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>16. Valor Unitario</label>
                <input 
                  type="number" 
                  step="0.01" 
                  name="valor_unitario" 
                  value={formData.valor_unitario} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-row-full">
                <label>17. URES Gasto</label>
                <input 
                  type="text" 
                  name="ures_gasto" 
                  value={formData.ures_gasto} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>18. Ubicación Física</label>
                <input 
                  type="text" 
                  name="ubicacion_fisica" 
                  value={formData.ubicacion_fisica} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>19. Coordinación</label>
                <input 
                  type="text" 
                  name="coordinacion" 
                  value={formData.coordinacion} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>20. Ejercicio</label>
                <input 
                  type="text" 
                  name="ejercicio" 
                  value={formData.ejercicio} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>21. Solicitud/Ord. Compra</label>
                <input 
                  type="text" 
                  name="solicitud_compra" 
                  value={formData.solicitud_compra} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>22. Cuenta por Pagar</label>
                <input 
                  type="text" 
                  name="cuenta_por_pagar" 
                  value={formData.cuenta_por_pagar} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>23. IDCON</label>
                <input 
                  type="text" 
                  name="idcon" 
                  value={formData.idcon} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>24. Proveedor</label>
                <input 
                  type="text" 
                  name="proveedor" 
                  value={formData.proveedor} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-row-full">
                <label>25. Usu Asig</label>
                <input 
                  type="text" 
                  name="usu_asig" 
                  value={formData.usu_asig} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>26. Fecha Registro</label>
                <input 
                  type="date" 
                  name="fecha_registro" 
                  value={formData.fecha_registro} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-group">
                <label>27. Fecha Asig</label>
                <input 
                  type="date" 
                  name="fecha_asignacion" 
                  value={formData.fecha_asignacion} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-row-full">
                <label>28. Ubicación</label>
                <input 
                  type="text" 
                  name="ubicacion" 
                  value={formData.ubicacion} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>

              <div className="form-row-full">
                <label>29. Estado de Uso</label>
                <select 
                  name="estado_uso" 
                  value={formData.estado_uso} 
                  onChange={handleInputChange}
                  className="form-control"
                >
                  <option value="bueno">Bueno</option>
                  <option value="regular">Regular</option>
                  <option value="malo">Malo</option>
                </select>
              </div>

              <div className="form-row-full">
                <label>31. No. Empleado</label>
                <input 
                  type="text" 
                  name="numero_empleado" 
                  value={formData.numero_empleado} 
                  onChange={handleInputChange}
                  className="form-control" 
                />
              </div>
            </div>
          )}

          <div className="form-footer">
            <button 
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <FaSave /> {initialData ? 'Actualizar' : 'Guardar'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default InventoryForm