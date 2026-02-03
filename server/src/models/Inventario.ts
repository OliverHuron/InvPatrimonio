// ====================================================
// MODELO INVENTARIO - ESQUEMA SIAF COMPLETO
// ====================================================

export interface Inventario {
  // Identificadores principales
  id: number;
  folio?: string; // Autogenerado formato YYYY-NNNN
  numero_patrimonio?: string;
  numero_serie?: string;
  numero_inventario?: string;
  uuid?: string;
  uuid_fiscal?: string;
  
  // Información básica del bien
  marca?: string;
  modelo?: string;
  descripcion?: text;
  descripcion_bien?: text;
  tipo_bien?: string;
  
  // Estado y ubicación
  estado: string; // Default: 'buena'
  estado_uso: string; // Default: 'operativo' ['operativo', 'en_reparacion', 'de_baja', 'obsoleto', 'resguardo_temporal']
  ubicacion?: string;
  ubicacion_id?: number;
  ubicacion_especifica?: string;
  
  // Organización SIAF
  dependencia_id?: number;
  coordinacion_id?: number;
  stage: string; // Default: 'COMPLETO' ['FISCAL', 'EN_TRANSITO', 'FISICO', 'COMPLETO', 'PENDIENTE_FISCAL']
  estatus_validacion: string; // Default: 'borrador' ['borrador', 'revision', 'validado', 'rechazado']
  tipo_inventario?: string; // ['INTERNO', 'EXTERNO']
  
  // Flags SIAF
  es_oficial_siia: boolean; // Default: false
  es_local: boolean; // Default: true
  es_investigacion: boolean; // Default: false
  
  // Información financiera
  costo?: number; // numeric(12,2)
  cog?: string;
  factura?: string;
  numero_factura?: string;
  fondo?: string;
  cuenta_por_pagar?: string;
  proveedor?: string;
  
  // Fechas importantes
  fecha_adquisicion?: Date;
  fecha_compra?: Date;
  fecha_factura?: Date;
  fecha_recepcion?: Date;
  fecha_envio?: Date;
  fecha_registro?: Date;
  fecha_asignacion?: Date;
  fecha_elaboracion?: Date;
  fecha_baja?: Date;
  
  // Depreciación y vida útil
  vida_util_anios: number; // Default: 5
  depreciacion_anual?: number;
  valor_actual?: number;
  
  // Mantenimiento y garantía
  ultimo_mantenimiento?: Date;
  proximo_mantenimiento?: Date;
  garantia_meses?: number;
  
  // Responsables y asignaciones
  empleado_resguardante_id?: number;
  usuario_asignado_id?: number;
  numero_resguardo_interno?: string;
  enviado_por?: number;
  recibido_por?: number;
  responsable_entrega_id?: number;
  numero_empleado?: string;
  elaboro_nombre?: string;
  usu_asig?: string;
  
  // Registros patrimoniales gubernamentales
  registro_patrimonial?: string;
  registro_interno?: string;
  id_patrimonio?: string;
  clave_patrimonial?: string;
  
  // Controles presupuestales SIAF
  ures_asignacion?: string;
  ures_gasto?: string;
  recurso?: string;
  ur?: string;
  ejercicio?: string;
  solicitud_compra?: string;
  idcon?: string;
  
  // Documentación y multimedia
  foto_url?: string;
  documento_adjunto_url?: string;
  imagenes: any[]; // jsonb Default: []
  
  // Observaciones
  comentarios?: text;
  observaciones_tecnicas?: text;
  motivo_baja?: text;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

// Tipos para validación
export type EstadoUso = 'operativo' | 'en_reparacion' | 'de_baja' | 'obsoleto' | 'resguardo_temporal';
export type Stage = 'FISCAL' | 'EN_TRANSITO' | 'FISICO' | 'COMPLETO' | 'PENDIENTE_FISCAL';
export type EstatusValidacion = 'borrador' | 'revision' | 'validado' | 'rechazado';
export type TipoInventario = 'INTERNO' | 'EXTERNO';

// DTO para crear inventario (sin campos autogenerados)
export interface CreateInventarioDTO {
  marca?: string;
  modelo?: string;
  descripcion?: string;
  estado?: string;
  ubicacion?: string;
  numero_patrimonio?: string;
  numero_serie?: string;
  costo?: number;
  proveedor?: string;
  tipo_bien?: string;
  estado_uso?: EstadoUso;
  coordinacion_id?: number;
  dependencia_id?: number;
  tipo_inventario?: TipoInventario;
  fecha_adquisicion?: Date;
  vida_util_anios?: number;
  garantia_meses?: number;
  comentarios?: string;
  observaciones_tecnicas?: string;
  imagenes?: any[];
}

// DTO para actualizar inventario
export interface UpdateInventarioDTO extends Partial<CreateInventarioDTO> {
  id: number;
  estatus_validacion?: EstatusValidacion;
  stage?: Stage;
  fecha_baja?: Date;
  motivo_baja?: string;
  ultimo_mantenimiento?: Date;
  proximo_mantenimiento?: Date;
}

// Filtros para búsqueda avanzada SIAF
export interface InventarioFilters {
  marca?: string;
  modelo?: string;
  estado?: string;
  estado_uso?: EstadoUso;
  ubicacion?: string;
  stage?: Stage;
  estatus_validacion?: EstatusValidacion;
  tipo_inventario?: TipoInventario;
  coordinacion_id?: number;
  dependencia_id?: number;
  proveedor?: string;
  fecha_desde?: Date;
  fecha_hasta?: Date;
  costo_min?: number;
  costo_max?: number;
  search?: string; // Búsqueda general
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
}