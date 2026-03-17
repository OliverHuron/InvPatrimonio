// =====================================================
// FORMULARIO UNIFICADO DE INVENTARIO
// =====================================================

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  FaSave, FaTimes, FaCamera, FaTrash, FaEye, FaInfoCircle,
  FaIdCard, FaClipboardList, FaMoneyBillWave, FaMapMarkerAlt,
  FaFileAlt, FaLandmark, FaImages, FaCalculator
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import './InventoryFormUnified.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://patrimonio.siafsystem.online/api';
const MAX_IMAGES = 3;
const ALLOWED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const currentYear = new Date().getFullYear();
const EJERCICIO_YEARS = Array.from({ length: 8 }, (_, i) => currentYear - 5 + i);

// =====================================================
// VALIDACIONES
// =====================================================
const validate = (data) => {
  const errs = {};
  if (!data.descripcion?.trim())  errs.descripcion = 'La descripción es requerida.';
  if (!data.marca?.trim())        errs.marca        = 'La marca es requerida.';
  if (!data.modelo?.trim())       errs.modelo       = 'El modelo es requerido.';

  if (data.costo && (isNaN(parseFloat(data.costo)) || parseFloat(data.costo) < 0))
    errs.costo = 'Ingresa un valor numérico positivo (ej: 15000.00).';
  if (data.valor_actual && (isNaN(parseFloat(data.valor_actual)) || parseFloat(data.valor_actual) < 0))
    errs.valor_actual = 'Ingresa un valor numérico positivo.';
  if (data.vida_util_anos && (isNaN(parseInt(data.vida_util_anos)) || parseInt(data.vida_util_anos) < 0))
    errs.vida_util_anos = 'Ingresa un número entero de años (ej: 5).';
  if (data.fecha_adquisicion && !DATE_REGEX.test(data.fecha_adquisicion))
    errs.fecha_adquisicion = 'Formato: AAAA-MM-DD  (ej: 2026-01-15).';
  if (data.fecha_elaboracion && !DATE_REGEX.test(data.fecha_elaboracion))
    errs.fecha_elaboracion = 'Formato: AAAA-MM-DD  (ej: 2026-01-15).';
  if (data.uuid && !UUID_REGEX.test(data.uuid))
    errs.uuid = 'Formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
  if (data.uuid_fiscal && !UUID_REGEX.test(data.uuid_fiscal))
    errs.uuid_fiscal = 'Formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';

  return errs;
};

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================
const InventoryFormUnified = React.memo(({ initialData = null, onClose, onSuccess }) => {

  const [ubicacionesOpts,    setUbicacionesOpts]    = useState([]);
  const [dependenciasOpts,   setDependenciasOpts]   = useState([]);
  const [coordinacionesOpts, setCoordinacionesOpts] = useState([]);
  const [empleadosOpts,      setEmpleadosOpts]      = useState([]);
  const [umaInfo,            setUmaInfo]            = useState(null);
  const [tipoCalculado,      setTipoCalculado]      = useState('INTERNO');
  const [isSubmitting,       setIsSubmitting]       = useState(false);
  const [images,             setImages]             = useState([]);
  const [imageFiles,         setImageFiles]         = useState([]);
  const [errors,             setErrors]             = useState({});
  const [touched,            setTouched]            = useState({});

  const initialFormState = useMemo(() => ({
    descripcion: initialData?.descripcion || '',
    descripcion_bien: initialData?.descripcion_bien || '',
    marca: initialData?.marca || '',
    modelo: initialData?.modelo || '',
    numero_serie: initialData?.numero_serie || '',
    estado_uso: initialData?.estado_uso || 'bueno',
    estado: initialData?.estado || 'buena',
    costo: initialData?.costo || '',
    valor_actual: initialData?.valor_actual || '',
    vida_util_anos: initialData?.vida_util_anos || '',
    proveedor: initialData?.proveedor || '',
    factura: initialData?.factura || '',
    fecha_adquisicion: initialData?.fecha_adquisicion || '',
    ubicacion: initialData?.ubicacion || '',
    ubicacion_id: initialData?.ubicacion_id || '',
    ubicacion_especifica: initialData?.ubicacion_especifica || '',
    numero_empleado: initialData?.numero_empleado || '',
    usu_asig: initialData?.usu_asig || '',
    observaciones: initialData?.observaciones || '',
    ures_asignacion: initialData?.ures_asignacion || '',
    registro_patrimonial: initialData?.registro_patrimonial || '',
    registro_interno: initialData?.registro_interno || '',
    elaboro_nombre: initialData?.elaboro_nombre || '',
    fecha_elaboracion: initialData?.fecha_elaboracion || '',
    recurso: initialData?.recurso || '',
    ur: initialData?.ur || '',
    uuid: initialData?.uuid || '',
    dependencia_id: initialData?.dependencia_id || '',
    coordinacion_id: initialData?.coordinacion_id || '',
    id_patrimonio: initialData?.id_patrimonio || '',
    numero_patrimonio: initialData?.numero_patrimonio || '',
    clave_patrimonial: initialData?.clave_patrimonial || '',
    ures_gasto: initialData?.ures_gasto || '',
    cog: initialData?.cog || '',
    fondo: initialData?.fondo || '',
    cuenta_por_pagar: initialData?.cuenta_por_pagar || '',
    ejercicio: initialData?.ejercicio || String(currentYear),
    solicitud_compra: initialData?.solicitud_compra || '',
    idcon: initialData?.idcon || '',
    numero_resguardo_interno: initialData?.numero_resguardo_interno || '',
    uuid_fiscal: initialData?.uuid_fiscal || '',
    empleado_resguardante_id: initialData?.empleado_resguardante_id || '',
    responsable_entrega_id: initialData?.responsable_entrega_id || '',
  }), [initialData]);

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    if (initialData) setFormData({
      descripcion: initialData.descripcion || '',
      descripcion_bien: initialData.descripcion_bien || '',
      marca: initialData.marca || '',
      modelo: initialData.modelo || '',
      numero_serie: initialData.numero_serie || '',
      estado_uso: initialData.estado_uso || 'bueno',
      estado: initialData.estado || 'buena',
      costo: initialData.costo || '',
      valor_actual: initialData.valor_actual || '',
      vida_util_anos: initialData.vida_util_anos || '',
      proveedor: initialData.proveedor || '',
      factura: initialData.factura || '',
      fecha_adquisicion: initialData.fecha_adquisicion || '',
      ubicacion: initialData.ubicacion || '',
      ubicacion_id: initialData.ubicacion_id || '',
      ubicacion_especifica: initialData.ubicacion_especifica || '',
      numero_empleado: initialData.numero_empleado || '',
      usu_asig: initialData.usu_asig || '',
      observaciones: initialData.observaciones || '',
      ures_asignacion: initialData.ures_asignacion || '',
      registro_patrimonial: initialData.registro_patrimonial || '',
      registro_interno: initialData.registro_interno || '',
      elaboro_nombre: initialData.elaboro_nombre || '',
      fecha_elaboracion: initialData.fecha_elaboracion || '',
      recurso: initialData.recurso || '',
      ur: initialData.ur || '',
      uuid: initialData.uuid || '',
      dependencia_id: initialData.dependencia_id || '',
      coordinacion_id: initialData.coordinacion_id || '',
      id_patrimonio: initialData.id_patrimonio || '',
      numero_patrimonio: initialData.numero_patrimonio || '',
      clave_patrimonial: initialData.clave_patrimonial || '',
      ures_gasto: initialData.ures_gasto || '',
      cog: initialData.cog || '',
      fondo: initialData.fondo || '',
      cuenta_por_pagar: initialData.cuenta_por_pagar || '',
      ejercicio: initialData.ejercicio || String(currentYear),
      solicitud_compra: initialData.solicitud_compra || '',
      idcon: initialData.idcon || '',
      numero_resguardo_interno: initialData.numero_resguardo_interno || '',
      uuid_fiscal: initialData.uuid_fiscal || '',
      empleado_resguardante_id: initialData.empleado_resguardante_id || '',
      responsable_entrega_id: initialData.responsable_entrega_id || '',
    });
  }, [initialData]);

  // Catálogos
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [ubRes, depRes, empRes] = await Promise.all([
          fetch(`${API_BASE_URL}/inventarios/ubicaciones`),
          fetch(`${API_BASE_URL}/inventarios/dependencias`),
          fetch(`${API_BASE_URL}/inventarios/empleados`),
        ]);
        if (ubRes.ok)  { const d = await ubRes.json();  setUbicacionesOpts(d.data  || []); }
        if (depRes.ok) { const d = await depRes.json(); setDependenciasOpts(d.data || []); }
        if (empRes.ok) { const d = await empRes.json(); setEmpleadosOpts(d.data    || []); }
      } catch (e) { console.warn('Catálogos no disponibles:', e.message); }
    };
    fetchAll();
  }, []);

  useEffect(() => {
    const fetchCoord = async () => {
      try {
        const url = formData.dependencia_id
          ? `${API_BASE_URL}/inventarios/coordinaciones?dependencia_id=${formData.dependencia_id}`
          : `${API_BASE_URL}/inventarios/coordinaciones`;
        const res = await fetch(url);
        if (res.ok) { const d = await res.json(); setCoordinacionesOpts(d.data || []); }
      } catch (e) { console.warn('Coordinaciones no disponibles:', e.message); }
    };
    fetchCoord();
  }, [formData.dependencia_id]);

  // UMA
  useEffect(() => {
    const fetchUma = async () => {
      if (!formData.ejercicio) return;
      try {
        const res = await fetch(`${API_BASE_URL}/inventarios/uma-valor?año=${formData.ejercicio}`);
        if (!res.ok) { setUmaInfo(null); return; }
        const d = await res.json();
        if (!d.success) { setUmaInfo(null); return; }
        setUmaInfo(d.data);
        const costo = parseFloat(formData.costo);
        setTipoCalculado(
          !isNaN(costo) && costo > 0 && costo > parseFloat(d.data.umbral_externo)
            ? 'EXTERNO' : 'INTERNO'
        );
      } catch { /* mantener INTERNO */ }
    };
    fetchUma();
  }, [formData.ejercicio, formData.costo]);

  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setErrors(prev => ({ ...prev, [name]: undefined }));
  }, []);

  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    setErrors(prev => ({ ...prev, ...validate(formData) }));
  }, [formData]);

  const handleImageSelect = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > MAX_IMAGES) {
      toast.error(`Máximo ${MAX_IMAGES} imágenes`); return;
    }
    files.forEach(file => {
      if (!ALLOWED_FORMATS.includes(file.type)) { toast.error(`${file.name}: solo JPG/PNG`); return; }
      if (file.size > MAX_FILE_SIZE)             { toast.error(`${file.name}: excede 5 MB`);   return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImages(prev => [...prev, { id: Date.now() + Math.random(), url: ev.target.result, name: file.name, size: file.size }]);
        setImageFiles(prev => [...prev, file]);
      };
      reader.readAsDataURL(file);
    });
  }, [images.length]);

  const handleImageRemove = useCallback((imgId, idx) => {
    setImages(prev => prev.filter(i => i.id !== imgId));
    setImageFiles(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const allTouched = Object.keys(formData).reduce((acc, k) => ({ ...acc, [k]: true }), {});
    setTouched(allTouched);
    const errs = validate(formData);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error('Corrige los errores marcados en el formulario.');
      return;
    }
    if (images.length === 0) {
      toast.error('Se requiere al menos 1 imagen del bien.');
      return;
    }
    setIsSubmitting(true);
    try {
      toast.info('Verificando duplicados...');
      const dupChecks = [];
      if (formData.numero_serie?.trim())
        dupChecks.push({ field: 'numero_serie', value: formData.numero_serie });
      if (formData.registro_patrimonial?.trim())
        dupChecks.push({ field: 'registro_patrimonial', value: formData.registro_patrimonial });
      if (formData.numero_patrimonio?.trim())
        dupChecks.push({ field: 'numero_patrimonio', value: formData.numero_patrimonio });

      const dupErrors = [];
      for (const { field, value } of dupChecks) {
        try {
          const r = await fetch(`${API_BASE_URL}/inventarios/check-duplicate/${field}/${encodeURIComponent(value)}`);
          if (r.ok) {
            const d = await r.json();
            if (d.exists && d.existing?.id !== initialData?.id)
              dupErrors.push(`${field} "${value}" ya existe (Folio: ${d.existing.folio || d.existing.id})`);
          }
        } catch { /* ignorar */ }
      }
      if (dupErrors.length > 0) {
        toast.error(
          <div><strong>Duplicados encontrados:</strong>{dupErrors.map((m, i) => <div key={i}>{m}</div>)}</div>,
          { autoClose: 8000 }
        );
        setIsSubmitting(false); return;
      }

      const submitData = new FormData();
      Object.entries(formData).forEach(([k, v]) => submitData.append(k, v ?? ''));
      imageFiles.forEach(f => submitData.append('images', f));

      const url    = initialData?.id ? `${API_BASE_URL}/inventarios/${initialData.id}` : `${API_BASE_URL}/inventarios`;
      const method = initialData?.id ? 'PUT' : 'POST';
      const response = await fetch(url, { method, body: submitData });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Error en el servidor');
      }
      const result = await response.json();
      toast.success(`Inventario ${initialData?.id ? 'actualizado' : 'creado'} exitosamente`);
      if (onSuccess) onSuccess(result);
      if (onClose)   onClose();
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, imageFiles, images.length, initialData, onSuccess, onClose]);

  // =====================================================
  // RENDER HELPERS
  // =====================================================
  const fe = (name) => touched[name] ? errors[name] : undefined;

  const TextInput = ({ name, label, required, hint, placeholder, maxLength, type = 'text', min, step }) => {
    const err = fe(name);
    return (
      <div className={`fg${err ? ' fg--error' : ''}`}>
        <label className="fg__label">
          {label}{required && <span className="fg__star">*</span>}
        </label>
        <input
          type={type}
          name={name}
          value={formData[name] ?? ''}
          onChange={handleInputChange}
          onBlur={handleBlur}
          className={`fg__input${err ? ' fg__input--error' : ''}`}
          placeholder={placeholder}
          maxLength={maxLength}
          {...(type === 'number' ? { min, step } : {})}
        />
        {hint && !err && <span className="fg__hint">{hint}</span>}
        {err  && <span className="fg__error"><FaInfoCircle size={10} />{err}</span>}
      </div>
    );
  };

  const TextArea = ({ name, label, required, hint, placeholder, rows = 2 }) => {
    const err = fe(name);
    return (
      <div className={`fg fg--full${err ? ' fg--error' : ''}`}>
        <label className="fg__label">
          {label}{required && <span className="fg__star">*</span>}
        </label>
        <textarea
          name={name}
          value={formData[name] ?? ''}
          onChange={handleInputChange}
          onBlur={handleBlur}
          className={`fg__textarea${err ? ' fg__input--error' : ''}`}
          placeholder={placeholder}
          rows={rows}
        />
        {hint && !err && <span className="fg__hint">{hint}</span>}
        {err  && <span className="fg__error"><FaInfoCircle size={10} />{err}</span>}
      </div>
    );
  };

  const SelectInput = ({ name, label, hint, children }) => {
    const err = fe(name);
    return (
      <div className={`fg${err ? ' fg--error' : ''}`}>
        <label className="fg__label">{label}</label>
        <select
          name={name}
          value={formData[name] ?? ''}
          onChange={handleInputChange}
          onBlur={handleBlur}
          className={`fg__select${err ? ' fg__input--error' : ''}`}
        >
          {children}
        </select>
        {hint && !err && <span className="fg__hint">{hint}</span>}
        {err  && <span className="fg__error"><FaInfoCircle size={10} />{err}</span>}
      </div>
    );
  };

  const CatalogSelect = ({ name, label, options, labelKey = 'nombre', hint }) => {
    const err = fe(name);
    return (
      <div className={`fg${err ? ' fg--error' : ''}`}>
        <label className="fg__label">{label}</label>
        <select
          name={name}
          value={formData[name] ?? ''}
          onChange={handleInputChange}
          className={`fg__select${err ? ' fg__input--error' : ''}`}
        >
          <option value="">— Seleccionar —</option>
          {options.map(o => (
            <option key={o.id} value={o.id}>
              {o[labelKey]}{o.numero_empleado ? ` · ${o.numero_empleado}` : ''}
            </option>
          ))}
        </select>
        {hint && <span className="fg__hint">{hint}</span>}
        {err  && <span className="fg__error"><FaInfoCircle size={10} />{err}</span>}
      </div>
    );
  };

  const Section = ({ icon: Icon, title, children, accent }) => (
    <div className="fs">
      <div className={`fs__header fs__header--${accent || 'brand'}`}>
        <Icon className="fs__icon" />
        <h3 className="fs__title">{title}</h3>
      </div>
      <div className="fs__body">
        <div className="fg-grid">
          {children}
        </div>
      </div>
    </div>
  );

  // =====================================================
  // RENDER
  // =====================================================
  return (
    <div className="mfm-overlay">
      <div className="mfm">

        {/* HEADER */}
        <div className="mfm__header">
          <div className="mfm__header-left">
            <span className="mfm__pretitle">
              {initialData?.id ? 'Editando registro' : 'Nuevo registro'}
            </span>
            <h2 className="mfm__title">Bien de Inventario</h2>
            {initialData?.id && (
              <span className="mfm__folio">Folio {initialData.folio || '—'}</span>
            )}
          </div>
          <div className="mfm__header-right">
            <div className={`mfm__tipo-pill mfm__tipo-pill--${tipoCalculado.toLowerCase()}`}>
              <FaCalculator size={11} />
              {tipoCalculado}
            </div>
            <button type="button" className="mfm__close" onClick={onClose} title="Cerrar">
              <FaTimes size={16} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="mfm__body">
          <form id="unified-form" onSubmit={handleSubmit}>

            {/* ── DATOS GENERALES ── */}
            <Section icon={FaIdCard} title="Datos Generales" accent="brand">
              <div className="fg">
                <label className="fg__label">Folio</label>
                <input
                  type="text"
                  className="fg__input fg__input--readonly"
                  value={initialData?.id ? (initialData.folio || '') : ''}
                  readOnly
                  placeholder="Se generará automáticamente al guardar"
                />
                <span className="fg__hint">Asignado por el sistema · no editable.</span>
              </div>
              <div className="fg">
                <label className="fg__label">Tipo de Inventario</label>
                <div className={`tipo-badge tipo-badge--${tipoCalculado.toLowerCase()}`}>
                  <FaCalculator size={12} />
                  <strong>{tipoCalculado}</strong>
                </div>
                <span className="fg__hint">
                  {umaInfo
                    ? `UMA ${formData.ejercicio}: $${parseFloat(umaInfo.valor).toFixed(2)}/día × 70 = $${parseFloat(umaInfo.umbral_externo).toFixed(2)} umbral`
                    : 'Calculado automáticamente: costo vs. UMA del ejercicio × 70.'}
                </span>
              </div>
            </Section>

            {/* ── INFORMACIÓN BÁSICA ── */}
            <Section icon={FaClipboardList} title="Información Básica" accent="brand">
              <TextArea  name="descripcion"   label="Descripción"         required
                placeholder="Ej: Laptop Dell Latitude 5530 Core i5, 16 GB RAM, 512 GB SSD" />
              <TextArea  name="descripcion_bien" label="Descripción del Bien"
                placeholder="Ej: Equipo de cómputo portátil para uso administrativo" />
              <TextInput name="marca"   label="Marca"   required maxLength={100}
                placeholder="Ej: Dell, HP, Samsung, Lenovo"
                hint="Nombre del fabricante tal como aparece en el bien." />
              <TextInput name="modelo"  label="Modelo"  required maxLength={100}
                placeholder="Ej: Latitude 5530 / LaserJet Pro M404n" />
              <TextInput name="numero_serie" label="Número de Serie" maxLength={100}
                placeholder="Ej: SN-5CG1234XYZ"
                hint="Etiqueta trasera del bien." />
              <SelectInput name="estado_uso" label="Estado de Uso">
                <option value="bueno">Bueno</option>
                <option value="regular">Regular</option>
                <option value="malo">Malo</option>
                <option value="baja">Baja</option>
              </SelectInput>
              <TextInput name="estado" label="Estado Físico" maxLength={50}
                placeholder="Ej: buena, regular, deteriorado" />
              <TextArea  name="observaciones" label="Observaciones"
                placeholder="Ej: Presenta rayón en tapa, funcionando correctamente." />
            </Section>

            {/* ── ADQUISICIÓN Y COSTO ── */}
            <Section icon={FaMoneyBillWave} title="Adquisición y Costo" accent="green">
              <SelectInput name="ejercicio" label="Ejercicio Fiscal"
                hint="Determina el valor UMA para clasificar el bien.">
                {EJERCICIO_YEARS.map(y => <option key={y} value={String(y)}>{y}</option>)}
              </SelectInput>
              <TextInput name="costo" label="Costo de Adquisición ($)" type="number" min="0" step="0.01"
                placeholder="Ej: 15000.00"
                hint={umaInfo
                  ? `EXTERNO si costo > $${parseFloat(umaInfo.umbral_externo).toFixed(2)}`
                  : 'Valor en pesos MXN al momento de la compra.'} />
              <TextInput name="proveedor"       label="Proveedor"              maxLength={200}
                placeholder="Ej: CompuSistemas SA de CV" />
              <TextInput name="factura"         label="Número de Factura"      maxLength={100}
                placeholder="Ej: A-0001234" />
              <TextInput name="fecha_adquisicion" label="Fecha de Adquisición" type="date"
                hint="Formato: AAAA-MM-DD" />
              <TextInput name="valor_actual"    label="Valor Actual ($)"       type="number" min="0" step="0.01"
                placeholder="Ej: 12000.00"
                hint="Valor contable actual (puede diferir del costo)." />
              <TextInput name="vida_util_anos"  label="Vida Útil (años)"       type="number" min="0"
                placeholder="Ej: 5" />
              <TextInput name="cuenta_por_pagar" label="Cuenta por Pagar"      maxLength={100}
                placeholder="Ej: CXP-2026-001" />
              <TextInput name="solicitud_compra" label="Solicitud de Compra"   maxLength={100}
                placeholder="Ej: SC-2026-0042" />
            </Section>

            {/* ── UBICACIÓN Y ASIGNACIÓN ── */}
            <Section icon={FaMapMarkerAlt} title="Ubicación y Asignación" accent="blue">
              <TextInput name="ubicacion" label="Ubicación (texto)" maxLength={200}
                placeholder="Ej: Edificio A, Piso 2, Oficina 214" />
              <CatalogSelect name="ubicacion_id" label="Ubicación (catálogo)" options={ubicacionesOpts} />
              <TextInput name="ubicacion_especifica" label="Ubicación Específica" maxLength={255}
                placeholder="Ej: Cubículo 3, junto a la ventana" />
              <TextInput name="numero_empleado" label="Número de Empleado" maxLength={50}
                placeholder="Ej: EMP-001234"
                hint="Número de nómina del responsable." />
              <TextInput name="usu_asig" label="Usuario Asignado" maxLength={255}
                placeholder="Ej: Juan Pérez García" />
              <TextInput name="ures_asignacion" label="URES Asignación" maxLength={100}
                placeholder="Ej: 001-A" />
              <CatalogSelect name="dependencia_id" label="Dependencia" options={dependenciasOpts} />
              <CatalogSelect name="coordinacion_id" label="Coordinación" options={coordinacionesOpts}
                hint={!formData.dependencia_id ? 'Selecciona primero una Dependencia.' : ''} />
              <CatalogSelect name="empleado_resguardante_id" label="Empleado Resguardante"
                options={empleadosOpts} labelKey="nombre_completo" />
              <CatalogSelect name="responsable_entrega_id" label="Responsable Entrega"
                options={empleadosOpts} labelKey="nombre_completo" />
            </Section>

            {/* ── DATOS INTERNOS ── */}
            <Section icon={FaFileAlt} title="Datos Internos" accent="purple">
              <TextInput name="registro_patrimonial" label="Registro Patrimonial" maxLength={100}
                placeholder="Ej: RP-2026-001" />
              <TextInput name="registro_interno"     label="Registro Interno"     maxLength={100}
                placeholder="Ej: RI-2026-001" />
              <TextInput name="elaboro_nombre"       label="Elaboró"              maxLength={100}
                placeholder="Ej: María González Torres" />
              <TextInput name="fecha_elaboracion"    label="Fecha Elaboración"    type="date"
                hint="Formato: AAAA-MM-DD" />
              <TextInput name="recurso"              label="Recurso"              maxLength={100}
                placeholder="Ej: Federal, Estatal, Propio" />
              <TextInput name="ur"                   label="UR (Unidad Responsable)" maxLength={100}
                placeholder="Ej: UR-001" />
              <TextInput name="uuid"                 label="UUID"                 maxLength={36}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                hint="Formato: 8-4-4-4-12 hex." />
              <TextInput name="numero_resguardo_interno" label="Núm. Resguardo Interno" maxLength={100}
                placeholder="Ej: NRI-2026-001" />
            </Section>

            {/* ── DATOS EXTERNOS / FISCALES ── */}
            <Section icon={FaLandmark} title="Datos Externos / Fiscales" accent="orange">
              <TextInput name="id_patrimonio"     label="ID Patrimonio"      maxLength={100}
                placeholder="Ej: PAT-2026-001" />
              <TextInput name="numero_patrimonio" label="Número Patrimonio"  maxLength={50}
                placeholder="Ej: 00123456" />
              <TextInput name="clave_patrimonial" label="Clave Patrimonial"  maxLength={100}
                placeholder="Ej: 5150.01.001" />
              <TextInput name="ures_gasto"        label="URES Gasto"         maxLength={100}
                placeholder="Ej: 002-B" />
              <TextInput name="cog"               label="COG"                maxLength={100}
                placeholder="Ej: 5150" />
              <TextInput name="fondo"             label="Fondo"              maxLength={100}
                placeholder="Ej: FONAGA, FISM" />
              <TextInput name="idcon"             label="IDCON"              maxLength={100}
                placeholder="Ej: CON-2026-00042" />
              <TextInput name="uuid_fiscal"       label="UUID Fiscal (CFDI)" maxLength={36}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                hint="UUID del CFDI de compra." />
            </Section>

            {/* ── IMÁGENES ── */}
            <Section icon={FaImages} title={`Imágenes del Bien · ${images.length}/${MAX_IMAGES}`} accent="teal">
              <div className="fg fg--full">
                <input type="file" id="img-upload" accept={ALLOWED_FORMATS.join(',')}
                  multiple onChange={handleImageSelect}
                  className="fg__file-hidden" disabled={images.length >= MAX_IMAGES} />
                <label htmlFor="img-upload"
                  className={`img-drop${images.length >= MAX_IMAGES ? ' img-drop--disabled' : ''}`}>
                  <FaCamera size={22} />
                  <span className="img-drop__text">
                    {images.length >= MAX_IMAGES ? 'Límite alcanzado' : 'Seleccionar imágenes'}
                  </span>
                  <span className="img-drop__hint">JPG, PNG · máx. 5 MB c/u · se requiere al menos 1</span>
                </label>
                {images.length > 0 && (
                  <div className="img-grid">
                    {images.map((image, index) => (
                      <div key={image.id} className="img-card">
                        <img src={image.url} alt={`img-${index + 1}`} className="img-card__thumb" />
                        <div className="img-card__footer">
                          <span className="img-card__name">{image.name}</span>
                          <span className="img-card__size">{(image.size / 1024).toFixed(0)} KB</span>
                        </div>
                        <div className="img-card__actions">
                          <button type="button" className="img-btn img-btn--view"
                            onClick={() => window.open(image.url, '_blank')} title="Ver">
                            <FaEye size={12} />
                          </button>
                          <button type="button" className="img-btn img-btn--remove"
                            onClick={() => handleImageRemove(image.id, index)} title="Eliminar">
                            <FaTrash size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>

          </form>
        </div>

        {/* FOOTER */}
        <div className="mfm__footer">
          <span className="mfm__footer-hint">
            Los campos con <span className="fg__star">*</span> son requeridos
          </span>
          <div className="mfm__footer-actions">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={isSubmitting}>
              <FaTimes size={13} /> Cancelar
            </button>
            <button type="submit" form="unified-form" className="btn btn--primary"
              disabled={isSubmitting} onClick={handleSubmit}>
              {isSubmitting
                ? <><span className="btn__spinner" /> Guardando...</>
                : <><FaSave size={13} /> {initialData?.id ? 'Actualizar' : 'Guardar'}</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
});

InventoryFormUnified.displayName = 'InventoryFormUnified';
export default InventoryFormUnified;
