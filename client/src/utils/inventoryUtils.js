// Shared inventory utilities used by InternoView and SmartExportModal

export const normalizeDate = (value) => (value ? String(value).split('T')[0] : '')

export const normalizeInterno = (data) => {
  const r = (data && data._raw) ? data._raw : data
  return {
    id: data.id ?? r.invpId ?? '',
    clave_patrimonial: data.clave_patrimonial || r.clavePat || data.numero_registro_patrimonial || '',
    folio: data.folio || r.folio || data.no_registro || data.no_obsequio || '',
    descripcion: data.descripcion || r.descrip || '',
    marca: data.marca || r.marca || '',
    modelo: data.modelo || r.modelo || '',
    no_serie: data.no_serie || r.serie || data.no_docente || data.numero_serie || '',
    no_factura: data.no_factura || r.numFact || '',
    fec_fact: normalizeDate(data.fec_fact || r.ffactura || data.fecha_factura),
    uuid: data.uuid || r.uuid || '',
    costo: data.costo ?? r.costo ?? '',
    ures_asignacion: data.ures_asignacion || data.llaves_adquisicion || '',
    ures_gasto: data.ures_gasto || data.ur || (r.ures != null ? String(r.ures) : ''),
    ubicacion: r.ubica || data.ubicacion || data.ubicacion_edificio || '',
    cog: data.cog || r.cog || data.recurso || '',
    proveedor: data.proveedor || '',
    cuenta: data.cuenta || r.cnta || '',
    descripcion_cuenta: data.descripcion_cuenta || r.cntaDescr || '',
    tipo_bien: data.tipo_bien || r.tipoBien || '',
    ejercicio: data.ejercicio ?? r.ejercicio ?? '',
    solicitud_orden_compra: data.solicitud_orden_compra || r.docu || data.solicitud_ord_compra || '',
    fondo: data.fondo || r.fondo || '',
    cuenta_por_pagar: data.cuenta_por_pagar || '',
    idcon: data.idcon || r.idCon || '',
    usuario_registro: data.usuario_registro || r.lusu || data.usu_reg || '',
    fecha_registro: normalizeDate(data.fecha_registro),
    fecha_asignacion: normalizeDate(data.fecha_asignacion),
    fecha_aprobacion: normalizeDate(data.fecha_aprobacion),
    comentarios: data.comentarios || r.texto || data.observaciones || '',
    estado: data.estado || 'Sin asignar',
    responsable: data.responsable || r.persona || data.entrega_responsable || data.dependencia || '',
    usu_asig: data.usu_asig || data.responsable_usuario || '',
    numero_empleado_usuario: data.numero_empleado_usuario || '',
    archi: data.archi || r.archi || '',
    fxml: data.fxml || r.fxml || ''
  }
}

export const toCsvCell = (value) => {
  if (value === null || value === undefined) return '""'
  const safe = String(value).replace(/"/g, '""')
  return `"${safe}"`
}

// RM-01: campos del documento oficial (Inventario de Mobiliario y Equipo de Oficina)
export const RM_COLUMNS = [
  { key: 'descripcion',            label: 'Descripción' },
  { key: 'marca',                  label: 'Marca' },
  { key: 'modelo',                 label: 'Modelo' },
  { key: 'no_serie',               label: 'No. de Serie' },
  { key: 'clave_patrimonial',      label: 'No. de Patrimonio' },
  { key: 'folio',                  label: 'No. de Resguardo Interno' },
  { key: 'estado',                 label: 'Estado de Uso', getValue: (row, getEstado) => getEstado ? getEstado(row) : (row.estado || '') },
  { key: 'ures_gasto',             label: 'UR' },
  { key: 'numero_empleado_usuario',label: 'No. de Empleado' },
  { key: 'responsable',            label: 'Responsable' },
  { key: 'puesto',                 label: 'Puesto del Usuario Resguardante', getValue: () => '' },
]

// Todos los campos disponibles
export const ALL_COLUMNS = [
  { key: 'id',                     label: 'ID' },
  { key: 'folio',                  label: 'Folio' },
  { key: 'clave_patrimonial',      label: 'Clave Patrimonial' },
  { key: 'descripcion',            label: 'Descripción' },
  { key: 'comentarios',            label: 'Comentarios' },
  { key: 'responsable',            label: 'Responsable' },
  { key: 'ures_gasto',             label: 'URES de Gasto' },
  { key: 'ures_asignacion',        label: 'URES Asignación' },
  { key: 'ubicacion',              label: 'Ubicación' },
  { key: 'costo',                  label: 'Costo' },
  { key: 'cog',                    label: 'COG' },
  { key: 'tipo_bien',              label: 'Tipo de Bien' },
  { key: 'estado',                 label: 'Estado', getValue: (row, getEstado) => getEstado ? getEstado(row) : (row.estado || '') },
  { key: 'no_factura',             label: 'Núm. Factura' },
  { key: 'fec_fact',               label: 'Fec. Factura',     getValue: (row) => row.fec_fact ? String(row.fec_fact).slice(0,10) : '' },
  { key: 'uuid',                   label: 'UUID' },
  { key: 'fondo',                  label: 'Fondo' },
  { key: 'marca',                  label: 'Marca' },
  { key: 'modelo',                 label: 'Modelo' },
  { key: 'no_serie',               label: 'Serie' },
  { key: 'ejercicio',              label: 'Ejercicio' },
  { key: 'solicitud_orden_compra', label: 'Solicitud/Ord. Compra' },
  { key: 'cuenta_por_pagar',       label: 'Cuenta por Pagar' },
  { key: 'cuenta',                 label: 'Cuenta' },
  { key: 'descripcion_cuenta',     label: 'Descripción Cuenta' },
  { key: 'idcon',                  label: 'IDCON' },
  { key: 'proveedor',              label: 'Proveedor' },
  { key: 'usu_asig',               label: 'Usu. Asig.' },
  { key: 'numero_empleado_usuario',label: 'Núm. Empleado' },
  { key: 'usuario_registro',       label: 'Usu. Reg.' },
  { key: 'fecha_registro',         label: 'Fec. Registro',   getValue: (row) => row.fecha_registro ? String(row.fecha_registro).slice(0,10) : '' },
  { key: 'fecha_asignacion',       label: 'Fec. Asignación', getValue: (row) => row.fecha_asignacion ? String(row.fecha_asignacion).slice(0,10) : '' },
  { key: 'fecha_aprobacion',       label: 'Fec. Aprobación', getValue: (row) => row.fecha_aprobacion ? String(row.fecha_aprobacion).slice(0,10) : '' },
]
