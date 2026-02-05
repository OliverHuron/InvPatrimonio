// =====================================================
// FORMULARIO UNIFICADO DE INVENTARIO - MODAL
// 38 CAMPOS TOTALES EN UNA SOLA VISTA
// 13 COMUNES + 10 INTERNOS + 15 EXTERNOS
// SUBIDA DE IMAGENES OPTIMIZADA
// =====================================================

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { FaSave, FaTimes, FaCamera, FaTrash, FaEye } from 'react-icons/fa';
import { toast } from 'react-toastify';

// =====================================================
// CONFIGURACION Y CONSTANTES
// =====================================================
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://patrimonio.siafsystem.online/api';
const MAX_IMAGES = 3; // SIAF requiere máximo 3 imágenes
const ALLOWED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB por imagen

// =====================================================
// COMPONENTE PRINCIPAL - MODAL CON 38 CAMPOS
// =====================================================
const InventoryFormUnified = React.memo(({ 
  initialData = null, 
  onClose, 
  onSuccess 
}) => {
  console.log('InventoryFormUnified Modal renderizado');

  // =====================================================
  // ESTADO DEL FORMULARIO
  // =====================================================
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [images, setImages] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  
  // Estado inicial con LOS 38 CAMPOS CORREGIDOS
  const initialFormState = useMemo(() => ({
    // === 13 CAMPOS COMUNES (INTERNO + EXTERNO) ===
    descripcion: initialData?.descripcion || '',
    marca: initialData?.marca || '',
    modelo: initialData?.modelo || '',
    numero_serie: initialData?.numero_serie || '',
    estado_uso: initialData?.estado_uso || 'bueno',
    costo: initialData?.costo || '',
    proveedor: initialData?.proveedor || '',
    factura: initialData?.factura || '',
    fecha_adquisicion: initialData?.fecha_adquisicion || '',
    ubicacion: initialData?.ubicacion || '',
    numero_empleado: initialData?.numero_empleado || '',
    observaciones: initialData?.observaciones || '',
    ures_asignacion: initialData?.ures_asignacion || '',

    // === 10 CAMPOS ÚNICOS DE INTERNO ===
    registro_patrimonial: initialData?.registro_patrimonial || '',
    registro_interno: initialData?.registro_interno || '',
    elaboro_nombre: initialData?.elaboro_nombre || '',
    fecha_elaboracion: initialData?.fecha_elaboracion || '',
    recurso: initialData?.recurso || '',
    ur: initialData?.ur || '',
    folio: initialData?.folio || '',
    uuid: initialData?.uuid || '',
    dependencia_id: initialData?.dependencia_id || '',
    coordinacion_id: initialData?.coordinacion_id || '',

    // === 15 CAMPOS ÚNICOS DE EXTERNO ===
    id_patrimonio: initialData?.id_patrimonio || '',
    numero_patrimonio: initialData?.numero_patrimonio || '',
    clave_patrimonial: initialData?.clave_patrimonial || '',
    ures_gasto: initialData?.ures_gasto || '',
    cog: initialData?.cog || '',
    fondo: initialData?.fondo || '',
    cuenta_por_pagar: initialData?.cuenta_por_pagar || '',
    ejercicio: initialData?.ejercicio || new Date().getFullYear().toString(),
    solicitud_compra: initialData?.solicitud_compra || '',
    idcon: initialData?.idcon || '',
    usu_asig: initialData?.usu_asig || '',
    numero_resguardo_interno: initialData?.numero_resguardo_interno || '',
    uuid_fiscal: initialData?.uuid_fiscal || '',
    empleado_resguardante_id: initialData?.empleado_resguardante_id || '',
    responsable_entrega_id: initialData?.responsable_entrega_id || '',

    // === CAMPOS DE CONTROL ===
    tipo_inventario: initialData?.tipo_inventario || 'INTERNO',
    estatus_validacion: initialData?.estatus_validacion || 'borrador',
    stage: initialData?.stage || 'COMPLETO'
  }), [initialData]);

  const [formData, setFormData] = useState(initialFormState);

  // Actualizar formulario cuando cambien los datos iniciales (para modo edición)
  useEffect(() => {
    if (initialData) {
      console.log('Datos recibidos para edición:', initialData);
      console.log('Campos en initialData:', Object.keys(initialData));
      
      // Crear objeto con TODOS los campos del formulario
      const updatedFormData = {
        // Comunes (13)
        descripcion: initialData.descripcion || '',
        marca: initialData.marca || '',
        modelo: initialData.modelo || '',
        numero_serie: initialData.numero_serie || '',
        estado_uso: initialData.estado_uso || 'bueno',
        costo: initialData.costo || '',
        proveedor: initialData.proveedor || '',
        factura: initialData.factura || '',
        fecha_adquisicion: initialData.fecha_adquisicion || '',
        ubicacion: initialData.ubicacion || '',
        numero_empleado: initialData.numero_empleado || '',
        observaciones: initialData.observaciones || '',
        ures_asignacion: initialData.ures_asignacion || '',

        // INTERNO únicos (10)
        registro_patrimonial: initialData.registro_patrimonial || '',
        registro_interno: initialData.registro_interno || '',
        elaboro_nombre: initialData.elaboro_nombre || '',
        fecha_elaboracion: initialData.fecha_elaboracion || '',
        recurso: initialData.recurso || '',
        ur: initialData.ur || '',
        folio: initialData.folio || '',
        uuid: initialData.uuid || '',
        dependencia_id: initialData.dependencia_id || '',
        coordinacion_id: initialData.coordinacion_id || '',

        // EXTERNO únicos (15)
        id_patrimonio: initialData.id_patrimonio || '',
        numero_patrimonio: initialData.numero_patrimonio || '',
        clave_patrimonial: initialData.clave_patrimonial || '',
        ures_gasto: initialData.ures_gasto || '',
        cog: initialData.cog || '',
        fondo: initialData.fondo || '',
        cuenta_por_pagar: initialData.cuenta_por_pagar || '',
        ejercicio: initialData.ejercicio || new Date().getFullYear().toString(),
        solicitud_compra: initialData.solicitud_compra || '',
        idcon: initialData.idcon || '',
        usu_asig: initialData.usu_asig || '',
        numero_resguardo_interno: initialData.numero_resguardo_interno || '',
        uuid_fiscal: initialData.uuid_fiscal || '',
        empleado_resguardante_id: initialData.empleado_resguardante_id || '',
        responsable_entrega_id: initialData.responsable_entrega_id || '',

        // Control
        tipo_inventario: initialData.tipo_inventario || 'INTERNO',
        estatus_validacion: initialData.estatus_validacion || 'borrador',
        stage: initialData.stage || 'COMPLETO'
      };
      
      console.log('Actualizando formulario con:', updatedFormData);
      setFormData(updatedFormData);
    } else {
      // Si no hay initialData, resetear el formulario
      console.log('🆕 Modo creación: formulario vacío');
    }
  }, [initialData]); // Solo depender de initialData

  // =====================================================
  // MANEJADORES DE EVENTOS
  // =====================================================
  
  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    
    // Validación de longitud para campos críticos que pueden tener limitación VARCHAR(100)
    const fieldsWithLimits = {
      'descripcion': 500, // Campo largo
      'marca': 100,
      'modelo': 100,
      'numero_serie': 100,
      'proveedor': 100,
      'factura': 100,
      'ubicacion': 100,
      'registro_patrimonial': 100,
      'registro_interno': 100,
      'elaboro_nombre': 100,
      'numero_patrimonio': 100,
      'clave_patrimonial': 100,
      'ures_gasto': 100,
      'cog': 100,
      'fondo': 100,
      'cuenta_por_pagar': 100,
      'solicitud_compra': 100,
      'idcon': 100,
      'usu_asig': 100,
      'numero_resguardo_interno': 100,
      'uuid': 100,
      'uuid_fiscal': 100
    };
    
    // Verificar límite de longitud
    if (fieldsWithLimits[name] && value && value.length > fieldsWithLimits[name]) {
      toast.warning(`Campo "${name}" excede el límite de ${fieldsWithLimits[name]} caracteres`);
      return; // No actualizar si excede el límite
    }
    
    setFormData(prevData => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value
    }));
  }, []);

  // =====================================================
  // MANEJO DE IMAGENES
  // =====================================================
  
  const validateImageFile = useCallback((file) => {
    if (!ALLOWED_FORMATS.includes(file.type)) {
      throw new Error(`Formato no válido. Use: ${ALLOWED_FORMATS.join(', ')}`);
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`Archivo muy grande. Máximo: ${MAX_FILE_SIZE / (1024*1024)}MB`);
    }
    return true;
  }, []);

  const handleImageSelect = useCallback((e) => {
    const files = Array.from(e.target.files);
    
    if (images.length + files.length > MAX_IMAGES) {
      toast.error(`Máximo ${MAX_IMAGES} imágenes permitidas`);
      return;
    }

    const validFiles = [];
    const previews = [];

    files.forEach(file => {
      try {
        validateImageFile(file);
        validFiles.push(file);
        
        const reader = new FileReader();
        reader.onload = (e) => {
          previews.push({
            id: Date.now() + Math.random(),
            url: e.target.result,
            name: file.name,
            size: file.size
          });
          
          if (previews.length === validFiles.length) {
            setImages(prev => [...prev, ...previews]);
            setImageFiles(prev => [...prev, ...validFiles]);
          }
        };
        reader.readAsDataURL(file);
      } catch (error) {
        toast.error(`${file.name}: ${error.message}`);
      }
    });
  }, [images.length, validateImageFile]);

  const handleImageRemove = useCallback((imageId, index) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    toast.success('Imagen eliminada');
  }, []);

  // =====================================================
  // ENVIO DEL FORMULARIO
  // =====================================================
  
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    // Validación básica
    const requiredFields = ['descripcion', 'marca', 'modelo'];
    const missingFields = requiredFields.filter(field => !formData[field]);
    
    if (missingFields.length > 0) {
      toast.error(`Campos requeridos: ${missingFields.join(', ')}`);
      return;
    }

    if (images.length === 0) {
      toast.error('Se requiere al menos 1 imagen del bien');
      return;
    }

    setIsSubmitting(true);

    try {
      // VALIDACIÓN DE DUPLICADOS ANTES DE ENVIAR
      const duplicateFields = [];
      
      console.log('Iniciando validación de duplicados...');
      toast.info('Verificando duplicados...');
      
      try {
        // Verificar número de serie duplicado usando endpoint específico
        if (formData.numero_serie && formData.numero_serie.trim()) {
          console.log(`Verificando número de serie: ${formData.numero_serie}`);
          const serieCheck = await fetch(`${API_BASE_URL}/inventarios/check-duplicate/numero_serie/${encodeURIComponent(formData.numero_serie)}`);
          if (serieCheck.ok) {
            const serieResult = await serieCheck.json();
            console.log('Resultado verificación serie:', serieResult);
            if (serieResult.exists && serieResult.existing?.id !== initialData?.id) {
              duplicateFields.push(`Número de Serie "${formData.numero_serie}" ya existe en el registro con Folio: ${serieResult.existing.folio || 'ID: ' + serieResult.existing.id}`);
            }
          }
        }
        
        // Verificar registro patrimonial duplicado
        if (formData.registro_patrimonial && formData.registro_patrimonial.trim()) {
          console.log(`Verificando registro patrimonial: ${formData.registro_patrimonial}`);
          const regCheck = await fetch(`${API_BASE_URL}/inventarios/check-duplicate/registro_patrimonial/${encodeURIComponent(formData.registro_patrimonial)}`);
          if (regCheck.ok) {
            const regResult = await regCheck.json();
            console.log('Resultado verificación registro:', regResult);
            if (regResult.exists && regResult.existing?.id !== initialData?.id) {
              duplicateFields.push(`Registro Patrimonial "${formData.registro_patrimonial}" ya existe en el registro con Folio: ${regResult.existing.folio || 'ID: ' + regResult.existing.id}`);
            }
          }
        }
        
        // Verificar número de patrimonio duplicado
        if (formData.numero_patrimonio && formData.numero_patrimonio.trim()) {
          console.log(`Verificando número patrimonio: ${formData.numero_patrimonio}`);
          const patrimonioCheck = await fetch(`${API_BASE_URL}/inventarios/check-duplicate/numero_patrimonio/${encodeURIComponent(formData.numero_patrimonio)}`);
          if (patrimonioCheck.ok) {
            const patrimonioResult = await patrimonioCheck.json();
            console.log('Resultado verificación patrimonio:', patrimonioResult);
            if (patrimonioResult.exists && patrimonioResult.existing?.id !== initialData?.id) {
              duplicateFields.push(`Número de Patrimonio "${formData.numero_patrimonio}" ya existe en el registro con Folio: ${patrimonioResult.existing.folio || 'ID: ' + patrimonioResult.existing.id}`);
            }
          }
        }
      } catch (dupError) {
        console.warn('⚠️ Error verificando duplicados:', dupError);
        toast.warning('⚠️ No se pudo verificar duplicados, continuando...');
      }
      
      if (duplicateFields.length > 0) {
        console.error('Duplicados encontrados:', duplicateFields);
        toast.error(
          <div>
            <strong>🚫 DUPLICADOS ENCONTRADOS:</strong>
            <br />
            {duplicateFields.map((msg, idx) => (
              <div key={idx} style={{ marginTop: '5px' }}>{msg}</div>
            ))}
          </div>,
          { autoClose: 8000 }
        );
        setIsSubmitting(false);
        return;
      }
      
      console.log('No se encontraron duplicados, continuando con el guardado...');
      // Validación previa de longitudes para debugging
      const fieldsWithLimits = {
        'marca': 100, 'modelo': 100, 'numero_serie': 100, 'proveedor': 100,
        'factura': 100, 'ubicacion': 100, 'registro_patrimonial': 100,
        'registro_interno': 100, 'elaboro_nombre': 100, 'numero_patrimonio': 100,
        'clave_patrimonial': 100, 'ures_gasto': 100, 'cog': 100, 'fondo': 100,
        'cuenta_por_pagar': 100, 'solicitud_compra': 100, 'idcon': 100,
        'usu_asig': 100, 'numero_resguardo_interno': 100, 'uuid': 100, 'uuid_fiscal': 100
      };
      
      // Verificar longitudes y reportar problemas
      const longFields = [];
      Object.entries(formData).forEach(([key, value]) => {
        if (value && typeof value === 'string' && fieldsWithLimits[key]) {
          if (value.length > fieldsWithLimits[key]) {
            longFields.push(`${key}: ${value.length}/${fieldsWithLimits[key]} caracteres`);
          }
        }
      });
      
      if (longFields.length > 0) {
        console.error('🚨 Campos que exceden límites:', longFields);
        toast.error(`Campos con demasiados caracteres: ${longFields.join(', ')}`);
        return;
      }

      const submitData = new FormData();
      
      // Debuggear todos los campos que se están enviando
      console.log('Campos del formulario que se envían:', Object.keys(formData));
      console.log('Datos completos del formulario:', formData);
      
      // Debuggear todos los campos que se están enviando
      console.log('DIAGNÓSTICO COMPLETO DE CAMPOS:');
      console.log('  Total campos en formData:', Object.keys(formData).length);
      console.log('  Campos con valor:', Object.entries(formData).filter(([k,v]) => v && v !== '').length);
      console.log('  Campos vacíos:', Object.entries(formData).filter(([k,v]) => !v || v === '').map(([k]) => k));
      console.log('Datos completos del formulario:', formData);
      
      let camposEnviados = 0;
      let camposVacios = 0;
      
      // ENVIAR TODOS LOS CAMPOS, incluso los vacíos
      Object.entries(formData).forEach(([key, value]) => {
        // Recortar valores que excedan límites como medida de seguridad
        let finalValue = value || ''; // Si es null/undefined, usar string vacío
        
        if (typeof finalValue === 'string' && fieldsWithLimits[key] && finalValue.length > 0) {
          if (finalValue.length > fieldsWithLimits[key]) {
            finalValue = finalValue.substring(0, fieldsWithLimits[key]);
            console.warn(`⚠️ Campo ${key} recortado de ${value.length} a ${finalValue.length} caracteres`);
          }
        }
        
        submitData.append(key, finalValue);
        camposEnviados++;
        
        if (!finalValue || finalValue === '') {
          camposVacios++;
          console.log(`⚪ [${camposEnviados}] ${key} = (vacío)`);
        } else {
          console.log(`[${camposEnviados}] ${key} = "${finalValue}"`);
        }
      });
      
      console.log(`RESUMEN: ${camposEnviados} campos enviados (${camposEnviados - camposVacios} con datos, ${camposVacios} vacíos)`);

      imageFiles.forEach((file) => {
        submitData.append(`images`, file);
      });

      const url = initialData?.id 
        ? `${API_BASE_URL}/inventarios/${initialData.id}`
        : `${API_BASE_URL}/inventarios`;
      
      const method = initialData?.id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        body: submitData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Error específico para campo de longitud
        if (response.status === 500 && errorData.message?.includes('demasiado largo')) {
          console.error('🚨 Error de longitud de campo:', errorData);
          throw new Error('Uno o más campos exceden la longitud máxima permitida. Revisa los datos ingresados.');
        }
        
        throw new Error(errorData.message || 'Error en el servidor');
      }

      const result = await response.json();
      
      toast.success(` Inventario ${initialData?.id ? 'actualizado' : 'creado'} exitosamente`);
      
      if (onSuccess) onSuccess(result);
      if (onClose) onClose();
      
    } catch (error) {
      console.error(' Error:', error);
      toast.error(` Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, imageFiles, initialData, onSuccess, onClose]);

  // =====================================================
  // RENDER DEL MODAL CON 38 CAMPOS
  // =====================================================
  
  return (
    <div className="modal-overlay">
      <div className="modal-container">
        {/* HEADER DEL MODAL */}
        <div className="modal-header">
          <h2 className="modal-title">
            {initialData?.id ? ' Editar' : ' Agregar'} Bien de Inventario
            <span className="field-info">38 campos unificados</span>
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
          >
            <FaTimes />
          </button>
        </div>

        {/* CONTENIDO DEL MODAL */}
        <div className="modal-body">
          <form id="unified-form" onSubmit={handleSubmit} className="unified-form">
            
            {/* ========== SECCIÓN 1: CAMPOS COMUNES (13) ========== */}
            <div className="form-section">
              <h3 className="section-title"> Información Básica Común (13 campos)</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Descripción *</label>
                  <textarea
                    name="descripcion"
                    value={formData.descripcion}
                    onChange={handleInputChange}
                    className="form-textarea"
                    placeholder="Descripción detallada del bien..."
                    rows="2"
                    maxLength={500}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Marca *</label>
                  <input
                    type="text"
                    name="marca"
                    value={formData.marca}
                    onChange={handleInputChange}
                    className="form-input"
                    maxLength={100}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Modelo *</label>
                  <input
                    type="text"
                    name="modelo"
                    value={formData.modelo}
                    onChange={handleInputChange}
                    className="form-input"
                    maxLength={100}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Número de Serie</label>
                  <input
                    type="text"
                    name="numero_serie"
                    value={formData.numero_serie}
                    onChange={handleInputChange}
                    className="form-input"
                    maxLength={100}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Estado de Uso</label>
                  <select
                    name="estado_uso"
                    value={formData.estado_uso}
                    onChange={handleInputChange}
                    className="form-select"
                  >
                    <option value="bueno">Bueno</option>
                    <option value="regular">Regular</option>
                    <option value="malo">Malo</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Costo ($)</label>
                  <input
                    type="number"
                    name="costo"
                    value={formData.costo}
                    onChange={handleInputChange}
                    className="form-input"
                    min="0"
                    step="0.01"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Proveedor</label>
                  <input
                    type="text"
                    name="proveedor"
                    value={formData.proveedor}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Número de Factura</label>
                  <input
                    type="text"
                    name="factura"
                    value={formData.factura}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Fecha de Adquisición</label>
                  <input
                    type="date"
                    name="fecha_adquisicion"
                    value={formData.fecha_adquisicion}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Ubicación</label>
                  <input
                    type="text"
                    name="ubicacion"
                    value={formData.ubicacion}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Número de Empleado</label>
                  <input
                    type="text"
                    name="numero_empleado"
                    value={formData.numero_empleado}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">URES Asignación</label>
                  <input
                    type="text"
                    name="ures_asignacion"
                    value={formData.ures_asignacion}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group full-width">
                  <label className="form-label">Observaciones</label>
                  <textarea
                    name="observaciones"
                    value={formData.observaciones}
                    onChange={handleInputChange}
                    className="form-textarea"
                    rows="2"
                  />
                </div>
              </div>
            </div>

            {/* ========== SECCIÓN 2: CAMPOS ÚNICOS INTERNOS (10) ========== */}
            <div className="form-section">
              <h3 className="section-title"> Campos Únicos INTERNO (10 campos)</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Registro Patrimonial</label>
                  <input
                    type="text"
                    name="registro_patrimonial"
                    value={formData.registro_patrimonial}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="RP-2026-001"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Registro Interno</label>
                  <input
                    type="text"
                    name="registro_interno"
                    value={formData.registro_interno}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="RI-2026-001"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Elaboró (Nombre)</label>
                  <input
                    type="text"
                    name="elaboro_nombre"
                    value={formData.elaboro_nombre}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Fecha Elaboración</label>
                  <input
                    type="date"
                    name="fecha_elaboracion"
                    value={formData.fecha_elaboracion}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Recurso</label>
                  <input
                    type="text"
                    name="recurso"
                    value={formData.recurso}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">UR (Unidad Responsable)</label>
                  <input
                    type="text"
                    name="ur"
                    value={formData.ur}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Folio</label>
                  <input
                    type="text"
                    name="folio"
                    value={formData.folio}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="Auto-generado"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">UUID</label>
                  <input
                    type="text"
                    name="uuid"
                    value={formData.uuid}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">ID Dependencia</label>
                  <input
                    type="number"
                    name="dependencia_id"
                    value={formData.dependencia_id}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">ID Coordinación</label>
                  <input
                    type="number"
                    name="coordinacion_id"
                    value={formData.coordinacion_id}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            {/* ========== SECCIÓN 3: CAMPOS ÚNICOS EXTERNOS (15) ========== */}
            <div className="form-section">
              <h3 className="section-title"> Campos Únicos EXTERNO (15 campos)</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">ID Patrimonio</label>
                  <input
                    type="text"
                    name="id_patrimonio"
                    value={formData.id_patrimonio}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="PAT-2026-001"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Número Patrimonio</label>
                  <input
                    type="text"
                    name="numero_patrimonio"
                    value={formData.numero_patrimonio}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Clave Patrimonial</label>
                  <input
                    type="text"
                    name="clave_patrimonial"
                    value={formData.clave_patrimonial}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">URES Gasto</label>
                  <input
                    type="text"
                    name="ures_gasto"
                    value={formData.ures_gasto}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">COG</label>
                  <input
                    type="text"
                    name="cog"
                    value={formData.cog}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Fondo</label>
                  <input
                    type="text"
                    name="fondo"
                    value={formData.fondo}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Cuenta por Pagar</label>
                  <input
                    type="text"
                    name="cuenta_por_pagar"
                    value={formData.cuenta_por_pagar}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Ejercicio</label>
                  <input
                    type="text"
                    name="ejercicio"
                    value={formData.ejercicio}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Solicitud Compra</label>
                  <input
                    type="text"
                    name="solicitud_compra"
                    value={formData.solicitud_compra}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">IDCON</label>
                  <input
                    type="text"
                    name="idcon"
                    value={formData.idcon}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Usuario Asignado</label>
                  <input
                    type="text"
                    name="usu_asig"
                    value={formData.usu_asig}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Número Resguardo Interno</label>
                  <input
                    type="text"
                    name="numero_resguardo_interno"
                    value={formData.numero_resguardo_interno}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">UUID Fiscal</label>
                  <input
                    type="text"
                    name="uuid_fiscal"
                    value={formData.uuid_fiscal}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">ID Empleado Resguardante</label>
                  <input
                    type="number"
                    name="empleado_resguardante_id"
                    value={formData.empleado_resguardante_id}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">ID Responsable Entrega</label>
                  <input
                    type="number"
                    name="responsable_entrega_id"
                    value={formData.responsable_entrega_id}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            {/* ========== SECCIÓN 4: IMÁGENES ========== */}
            <div className="form-section">
              <h3 className="section-title">
                 Imágenes del Bien ({images.length}/{MAX_IMAGES})
              </h3>
              
              <div className="image-upload-area">
                <input
                  type="file"
                  id="image-upload"
                  accept={ALLOWED_FORMATS.join(',')}
                  multiple
                  onChange={handleImageSelect}
                  className="hidden-input"
                  disabled={images.length >= MAX_IMAGES}
                />
                
                <label 
                  htmlFor="image-upload" 
                  className={`upload-button ${images.length >= MAX_IMAGES ? 'disabled' : ''}`}
                >
                  <FaCamera />
                  Seleccionar Imágenes
                  <span className="upload-hint">
                    JPG, PNG (máx. 5MB c/u)
                  </span>
                </label>
              </div>

              {images.length > 0 && (
                <div className="image-preview-grid">
                  {images.map((image, index) => (
                    <div key={image.id} className="image-preview-card">
                      <img 
                        src={image.url} 
                        alt={`Vista previa ${index + 1}`}
                        className="preview-image"
                      />
                      <div className="image-info">
                        <span className="image-name">{image.name}</span>
                        <span className="image-size">
                          {(image.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <div className="image-actions">
                        <button
                          type="button"
                          className="action-button view"
                          onClick={() => window.open(image.url, '_blank')}
                        >
                          <FaEye />
                        </button>
                        <button
                          type="button"
                          className="action-button remove"
                          onClick={() => handleImageRemove(image.id, index)}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* FOOTER DEL MODAL */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <FaTimes />
            Cancelar
          </button>
          
          <button
            type="submit"
            form="unified-form"
            className="btn-primary"
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            <FaSave />
            {isSubmitting 
              ? ' Guardando...' 
              : initialData?.id 
                ? ' Actualizar' 
                : ' Guardar'
            }
          </button>
        </div>
      </div>
    </div>
  );
});

InventoryFormUnified.displayName = 'InventoryFormUnified';

// =====================================================
// VALIDACION DE ESQUEMAS
// =====================================================
const VALIDATION_SCHEMAS = {
  INTERNO: {
    totalFields: 23,
    required: ['descripcion', 'marca', 'modelo', 'registro_patrimonial', 'registro_interno', 'elaboro_nombre', 'fecha_elaboracion', 'recurso', 'ur']
  },
  EXTERNO: {
    totalFields: 28,
    required: ['descripcion', 'marca', 'modelo', 'id_patrimonio', 'clave_patrimonial', 'ures_gasto', 'cog', 'fondo', 'cuenta_por_pagar', 'ejercicio', 'solicitud_compra']
  }
};

// Configurar display name para debugging
InventoryFormUnified.displayName = 'InventoryFormUnified';

export default InventoryFormUnified;