// =====================================================
// COMPONENTE: Drawer Master-Detail para Inventario
// Archivo: client/src/pages/Inventory/InventoryDrawer.jsx
// Propósito: Vista detallada de un activo con animación slide-in
// =====================================================

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { 
  FaTimes, FaBox, FaFileInvoiceDollar, FaCalendar, 
  FaEdit, FaTrash, FaClock, FaBarcode, FaImages, FaExpand 
} from 'react-icons/fa'
import './InventoryDrawer.css'

const InventoryDrawer = ({ 
  item, 
  isOpen, 
  onClose, 
  onEdit, 
  onDelete,
  userRole = 'coordinador' // 'admin', 'coordinador', 'usuario'
}) => {
  if (!item) return null
  
  const isAdmin = userRole === 'admin'
  const canEdit = isAdmin || userRole === 'coordinador'
  
  // DEBUG: Ver qué datos llegan
  console.log('🖼️ DEBUG Drawer - Item completo:', item)
  console.log('🖼️ DEBUG Drawer - item.imagenes:', item.imagenes)
  console.log('🖼️ DEBUG Drawer - tipo de imagenes:', typeof item.imagenes)
  
  // Parsear imágenes desde campo imagenes (JSONB o string)
  let imageUrls = []
  if (item.imagenes) {
    try {
      imageUrls = typeof item.imagenes === 'string' 
        ? JSON.parse(item.imagenes) 
        : item.imagenes
      if (!Array.isArray(imageUrls)) imageUrls = []
      console.log('🖼️ DEBUG Drawer - imageUrls parseadas:', imageUrls)
    } catch (e) {
      console.error('Error parseando imagenes:', e)
      imageUrls = []
    }
  } else {
    console.log('🖼️ DEBUG Drawer - NO HAY item.imagenes')
  }
  
  // Formatear fechas
  const formatDate = (dateString) => {
    if (!dateString) return 'No especificada'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return 'Fecha inválida'
    }
  }

  // Formatear moneda
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return 'No especificado'
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount)
  }

  // Estado de uso badge
  const getEstadoUsoBadge = (estado) => {
    const badges = {
      'bueno': { bg: '#d4edda', color: '#155724', label: 'Bueno', icon: '✓' },
      'regular': { bg: '#fff3cd', color: '#856404', label: 'Regular', icon: '⚠' },
      'malo': { bg: '#f8d7da', color: '#721c24', label: 'Malo', icon: '✕' },
      'operativo': { bg: '#d4edda', color: '#155724', label: 'Operativo', icon: '✓' },
      'en_reparacion': { bg: '#fff3cd', color: '#856404', label: 'En Reparación', icon: '🔧' },
      'de_baja': { bg: '#f8d7da', color: '#721c24', label: 'De Baja', icon: '✕' }
    }
    return badges[estado] || { bg: '#e9ecef', color: '#6c757d', label: estado || 'Sin estado', icon: '?' }
  }

  const estadoUsoBadge = getEstadoUsoBadge(item.estado_uso || item.estado)

  return (
    <>
      {/* Overlay */}
      <div 
        className={`drawer-overlay ${isOpen ? 'open' : ''}`} 
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className={`drawer-panel ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-title">
            <FaBox />
            <div>
              <h2>{item.descripcion || 'Activo de Inventario'}</h2>
              <p className="drawer-subtitle">{item.marca} {item.modelo}</p>
            </div>
          </div>
          <button className="drawer-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        
        {/* Content */}
        <div className="drawer-content">
          
          {/* Folio */}
          <div className="drawer-section">
            <div className="folio-display">
              <div>
                <span className="folio-label">Folio</span>
                <span className="folio-value">{item.folio || 'Pendiente'}</span>
              </div>
            </div>
            
            <div className="badges-row">
              <span 
                className="status-badge" 
                style={{ backgroundColor: estadoUsoBadge.bg, color: estadoUsoBadge.color }}
              >
                {estadoUsoBadge.icon} {estadoUsoBadge.label}
              </span>
              <span 
                className="type-badge"
                style={{ 
                  backgroundColor: item.stage === 'INTERNO' ? '#e3f2fd' : '#fff3e0',
                  color: item.stage === 'INTERNO' ? '#1976d2' : '#f57c00'
                }}
              >
                {item.stage || 'EXTERNO'}
              </span>
            </div>
          </div>
          
          {/* Datos Generales */}
          <div className="drawer-section">
            <h3 className="section-title">
              <FaBox /> Datos Generales
            </h3>
            <div className="detail-grid">
              <DetailItem label="Tipo de Inventario" value={item.tipo_inventario || item.stage} highlight />
              <DetailItem label="Descripción" value={item.descripcion} />
              <DetailItem label="Marca" value={item.marca} />
              <DetailItem label="Modelo" value={item.modelo} />
              <DetailItem label="Número de Serie" value={item.numero_serie} />
              <DetailItem label="Estado de Uso" value={item.estado_uso} />
              <DetailItem label="Ubicación" value={item.ubicacion} />
              <DetailItem label="Número de Empleado" value={item.numero_empleado} />
              <DetailItem label="URES Asignación" value={item.ures_asignacion} />
              <DetailItem label="Observaciones" value={item.observaciones} />
              
              {/* Campos específicos INTERNO */}
              {(item.tipo_inventario === 'INTERNO' || item.stage === 'INTERNO') && (
                <>
                  <DetailItem label="Registro Patrimonial" value={item.registro_patrimonial} highlight />
                  <DetailItem label="Registro Interno" value={item.registro_interno} />
                  <DetailItem label="Elaboró Nombre" value={item.elaboro_nombre} />
                  <DetailItem label="Fecha Elaboración" value={formatDate(item.fecha_elaboracion)} />
                  <DetailItem label="Recurso" value={item.recurso} />
                  <DetailItem label="UR" value={item.ur} />
                  <DetailItem label="Folio" value={item.folio} />
                  <DetailItem label="UUID" value={item.uuid} />
                  <DetailItem label="Dependencia ID" value={item.dependencia_id} />
                  <DetailItem label="Coordinación ID" value={item.coordinacion_id} />
                </>
              )}
              
              {/* Campos específicos EXTERNO */}
              {(item.tipo_inventario === 'EXTERNO' || item.stage === 'EXTERNO') && (
                <>
                  <DetailItem label="ID Patrimonio" value={item.id_patrimonio} highlight />
                  <DetailItem label="Número de Patrimonio" value={item.numero_patrimonio} />
                  <DetailItem label="Clave Patrimonial" value={item.clave_patrimonial} />
                  <DetailItem label="URES de Gasto" value={item.ures_gasto} />
                  <DetailItem label="COG" value={item.cog} />
                  <DetailItem label="Fondo" value={item.fondo} />
                  <DetailItem label="Cuenta por Pagar" value={item.cuenta_por_pagar} />
                  <DetailItem label="Ejercicio" value={item.ejercicio} />
                  <DetailItem label="Solicitud Compra" value={item.solicitud_compra} />
                  <DetailItem label="IDCON" value={item.idcon} />
                  <DetailItem label="Usuario Asignado" value={item.usu_asig} />
                  <DetailItem label="Número Resguardo Interno" value={item.numero_resguardo_interno} />
                  <DetailItem label="UUID Fiscal" value={item.uuid_fiscal} />
                  <DetailItem label="Empleado Resguardante ID" value={item.empleado_resguardante_id} />
                  <DetailItem label="Responsable Entrega ID" value={item.responsable_entrega_id} />
                </>
              )}
            </div>
          </div>

          {/* Ubicación y Responsables */}
          <div className="drawer-section">
            <h3 className="section-title">
              <FaBarcode /> Ubicación y Responsables
            </h3>
            <div className="detail-grid">
              <DetailItem label="Ubicación" value={item.ubicacion} />
              <DetailItem label="Elaboró" value={item.elaboro_nombre} />
            </div>
          </div>

          {/* Información Administrativa */}
          {isAdmin && (
            <div className="drawer-section">
              <h3 className="section-title">
                <FaFileInvoiceDollar /> Información Administrativa
              </h3>
              <div className="admin-warning-small">
                🔒 Información confidencial - Solo administradores
              </div>
              
              <div className="detail-grid">
                <DetailItem 
                  label="Costo de Adquisición" 
                  value={formatCurrency(item.costo)} 
                  highlight 
                />
                <DetailItem label="Factura" value={item.factura} />
                <DetailItem label="Proveedor" value={item.proveedor} />
                <DetailItem 
                  label="Fecha de Adquisición" 
                  value={formatDate(item.fecha_adquisicion)} 
                  icon={<FaCalendar />} 
                />
                <DetailItem label="UUID" value={item.uuid} />
                <DetailItem label="UUID Fiscal" value={item.uuid_fiscal} />
                <DetailItem label="Estatus Validación" value={item.estatus_validacion} />
                <DetailItem label="Stage" value={item.stage} />
                {item.valor_unitario && (
                  <DetailItem 
                    label="Valor Unitario" 
                    value={formatCurrency(item.valor_unitario)} 
                  />
                )}
              </div>
            </div>
          )}
          
          {/* Observaciones */}
          {item.observaciones && (
            <div className="drawer-section">
              <h3 className="section-title">Observaciones</h3>
              <div className="detail-full">
                <div className="detail-text">
                  {item.observaciones}
                </div>
              </div>
            </div>
          )}
          
          {/* Auditoría */}
          <div className="drawer-section">
            <h3 className="section-title">
              <FaClock /> Información de Auditoría
            </h3>
            <div className="detail-grid">
              <DetailItem 
                label="Creado" 
                value={formatDate(item.created_at)} 
              />
              <DetailItem 
                label="Última Actualización" 
                value={formatDate(item.updated_at)} 
              />
              {item.fecha_elaboracion && (
                <DetailItem 
                  label="Fecha Elaboración" 
                  value={formatDate(item.fecha_elaboracion)} 
                  icon={<FaCalendar />} 
                />
              )}
              {item.fecha_registro && (
                <DetailItem 
                  label="Fecha Registro" 
                  value={formatDate(item.fecha_registro)} 
                  icon={<FaCalendar />} 
                />
              )}
              {item.fecha_asignacion && (
                <DetailItem 
                  label="Fecha Asignación" 
                  value={formatDate(item.fecha_asignacion)} 
                  icon={<FaCalendar />} 
                />
              )}
            </div>
          </div>

          {/* Sección de Imágenes con Galería */}
          {imageUrls.length > 0 && <ImageGallerySection images={imageUrls} />}
          
        </div>
        
        {/* Footer Actions */}
        {canEdit && (
          <div className="drawer-footer">
            <button 
              className="btn-drawer btn-edit" 
              onClick={() => onEdit(item)}
            >
              <FaEdit /> Editar
            </button>
            {isAdmin && (
              <button 
                className="btn-drawer btn-delete" 
                onClick={() => onDelete(item)}
              >
                <FaTrash /> Solicitar Baja
              </button>
            )}
          </div>
        )}        </div>

      {/* Modal de Imagen - Eliminado, ahora usa ImageGallerySection con lightbox */}
    </>
  )
}

// Componente auxiliar para items de detalle
const DetailItem = ({ label, value, icon, highlight }) => (
  <div className={`detail-item ${highlight ? 'highlight' : ''}`}>
    <span className="detail-label">
      {icon && <span className="detail-icon">{icon}</span>}
      {label}
    </span>
    <span className="detail-value">{value || 'N/A'}</span>
  </div>
)

// =====================================================
// Image gallery + lightbox modal component (de SIAF)
// =====================================================
const ImageGallerySection = ({ images = [] }) => {
  const [openIndex, setOpenIndex] = useState(null)
  const open = (i) => setOpenIndex(i)
  const close = () => setOpenIndex(null)
  const prev = () => setOpenIndex((i) => (i === 0 ? images.length - 1 : i - 1))
  const next = () => setOpenIndex((i) => (i === images.length - 1 ? 0 : i + 1))

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (openIndex === null) return
    const handler = (e) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openIndex, images.length])

  // Lightbox portal content
  const Lightbox = () => {
    const lightboxUrl = `https://patrimonio.siafsystem.online${images[openIndex]}`
    console.log('🖼️ DEBUG Lightbox - URL:', lightboxUrl)
    return (
      <div className="lightbox-overlay" onClick={close}>
        <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
          <button className="lightbox-close" onClick={close}>✕</button>
          {images.length > 1 && (
            <>
              <button className="lightbox-prev" onClick={prev}>‹</button>
              <button className="lightbox-next" onClick={next}>›</button>
            </>
          )}
          <img 
            className="lightbox-img" 
            src={lightboxUrl} 
            alt={`Imagen ${openIndex + 1}`}
            onError={(e) => {
              console.error('❌ Error en Lightbox:', lightboxUrl)
            }}
            onLoad={() => {
              console.log('✅ Lightbox imagen cargada:', lightboxUrl)
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="drawer-section">
      <h3 className="section-title">
        <FaImages /> Imágenes del Bien ({images.length})
      </h3>

      <div className="image-gallery">
        {images.map((img, idx) => {
          const fullUrl = `https://patrimonio.siafsystem.online${img}`
          console.log(`🖼️ DEBUG Gallery - Imagen ${idx + 1}:`, fullUrl)
          return (
            <div 
              key={idx} 
              className="gallery-item" 
              onClick={() => open(idx)}
            >
              <img 
                src={fullUrl} 
                alt={`Evidencia ${idx + 1}`}
                onError={(e) => { 
                  console.error(`❌ Error cargando imagen ${idx + 1}:`, fullUrl)
                  console.error('Event:', e)
                  e.currentTarget.style.border = '2px solid red'
                  e.currentTarget.alt = 'Error al cargar'
                }}
                onLoad={() => {
                  console.log(`✅ Imagen ${idx + 1} cargada exitosamente:`, fullUrl)
                }}
              />
            </div>
          )
        })}
      </div>

      {openIndex !== null && createPortal(<Lightbox />, document.body)}
    </div>
  )
}

export default InventoryDrawer