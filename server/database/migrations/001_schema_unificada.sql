-- =====================================================
-- MIGRACION UNIFICADA (SIN DATOS DE PRUEBA)
-- Incluye esquema final y fixes aplicados
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- INVENTARIO INTERNO
-- =====================================================
CREATE TABLE IF NOT EXISTS inventario_interno (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  numero_registro_patrimonial VARCHAR(100),
  no_registro VARCHAR(100),
  descripcion TEXT,
  marca VARCHAR(100),
  modelo VARCHAR(100),
  no_serie VARCHAR(100),
  no_factura VARCHAR(100),
  costo DECIMAL(15, 2),
  ures_asignacion VARCHAR(255),
  ubicacion_edificio VARCHAR(255),
  recurso VARCHAR(100),
  proveedor VARCHAR(255),
  fecha_elaboracion DATE,
  observaciones TEXT,
  estado_uso VARCHAR(20) CHECK (estado_uso IN ('1-Bueno', '2-Regular', '3-Malo')),
  entrega_responsable TEXT,
  responsable_usuario VARCHAR(255),
  numero_empleado_usuario VARCHAR(100),
  ur VARCHAR(100),
  activo BOOLEAN DEFAULT TRUE,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  usuario_creacion VARCHAR(100),
  usuario_actualizacion VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_interno_num_registro ON inventario_interno(numero_registro_patrimonial);
CREATE INDEX IF NOT EXISTS idx_interno_marca ON inventario_interno(marca);
CREATE INDEX IF NOT EXISTS idx_interno_modelo ON inventario_interno(modelo);
CREATE INDEX IF NOT EXISTS idx_interno_ubicacion ON inventario_interno(ubicacion_edificio);
CREATE INDEX IF NOT EXISTS idx_interno_responsable ON inventario_interno(responsable_usuario);
CREATE INDEX IF NOT EXISTS idx_interno_activo ON inventario_interno(activo);
CREATE INDEX IF NOT EXISTS idx_interno_fecha_creacion ON inventario_interno(fecha_creacion);

CREATE OR REPLACE FUNCTION update_inventario_interno_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inventario_interno_timestamp ON inventario_interno;
CREATE TRIGGER trigger_update_inventario_interno_timestamp
  BEFORE UPDATE ON inventario_interno
  FOR EACH ROW
  EXECUTE FUNCTION update_inventario_interno_timestamp();

-- =====================================================
-- INVENTARIO EXTERNO
-- =====================================================
CREATE TABLE IF NOT EXISTS inventario_externo (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  id_patrimonio VARCHAR(100),
  folio VARCHAR(100),
  no_inventario VARCHAR(100),
  descripcion TEXT,
  comentarios TEXT,
  entrega_responsable TEXT,
  areas_calculo VARCHAR(255),
  o_res_asignacion VARCHAR(100),
  folio_2 VARCHAR(100),
  codigo VARCHAR(100),
  tipo_bien VARCHAR(100),
  desc_text TEXT,
  porc_desc DECIMAL(5, 2),
  muo VARCHAR(100),
  equipo VARCHAR(255),
  marca VARCHAR(100),
  modelo VARCHAR(100),
  serie VARCHAR(100),
  ejercicio VARCHAR(10),
  adquisicion_compra VARCHAR(100),
  proveedor_prov VARCHAR(255),
  mycm VARCHAR(100),
  proveedor VARCHAR(255),
  anio_alta VARCHAR(10),
  fec_reg_registros DATE,
  nvo_costo DECIMAL(15, 2),
  ubicacion_edificio VARCHAR(50),
  ubicacion_salon VARCHAR(50),
  estado_uso VARCHAR(20) CHECK (estado_uso IN ('1-Bueno', '2-Regular', '3-Malo')),
  responsable_usuario VARCHAR(255),
  numero_empleado_usuario VARCHAR(100),
  usu_reg VARCHAR(255),
  activo BOOLEAN DEFAULT TRUE,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  usuario_creacion VARCHAR(100),
  usuario_actualizacion VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_externo_id_patrimonio ON inventario_externo(id_patrimonio);
CREATE INDEX IF NOT EXISTS idx_externo_folio ON inventario_externo(folio);
CREATE INDEX IF NOT EXISTS idx_externo_no_inventario ON inventario_externo(no_inventario);
CREATE INDEX IF NOT EXISTS idx_externo_marca ON inventario_externo(marca);
CREATE INDEX IF NOT EXISTS idx_externo_modelo ON inventario_externo(modelo);
CREATE INDEX IF NOT EXISTS idx_externo_serie ON inventario_externo(serie);
CREATE INDEX IF NOT EXISTS idx_externo_ubicacion ON inventario_externo(ubicacion_edificio, ubicacion_salon);
CREATE INDEX IF NOT EXISTS idx_externo_responsable ON inventario_externo(responsable_usuario);
CREATE INDEX IF NOT EXISTS idx_externo_activo ON inventario_externo(activo);
CREATE INDEX IF NOT EXISTS idx_externo_fecha_creacion ON inventario_externo(fecha_creacion);

CREATE OR REPLACE FUNCTION update_inventario_externo_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inventario_externo_timestamp ON inventario_externo;
CREATE TRIGGER trigger_update_inventario_externo_timestamp
  BEFORE UPDATE ON inventario_externo
  FOR EACH ROW
  EXECUTE FUNCTION update_inventario_externo_timestamp();

-- =====================================================
-- FOTOS DE PATRIMONIO (MAX 3 POR ITEM)
-- =====================================================
CREATE TABLE IF NOT EXISTS fotos_patrimonio (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  tipo_inventario VARCHAR(20) NOT NULL CHECK (tipo_inventario IN ('interno', 'externo')),
  inventario_id INTEGER NOT NULL,
  ruta_archivo VARCHAR(500) NOT NULL,
  nombre_archivo VARCHAR(255) NOT NULL,
  tamanio_bytes BIGINT,
  mime_type VARCHAR(100),
  orden SMALLINT NOT NULL CHECK (orden BETWEEN 1 AND 3),
  es_principal BOOLEAN DEFAULT FALSE,
  descripcion TEXT,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  usuario_creacion VARCHAR(100),
  CONSTRAINT uk_foto_orden_item UNIQUE(tipo_inventario, inventario_id, orden)
);

CREATE INDEX IF NOT EXISTS idx_foto_tipo_inventario ON fotos_patrimonio(tipo_inventario, inventario_id);
CREATE INDEX IF NOT EXISTS idx_foto_principal ON fotos_patrimonio(tipo_inventario, inventario_id, es_principal);
CREATE INDEX IF NOT EXISTS idx_foto_orden ON fotos_patrimonio(tipo_inventario, inventario_id, orden);

CREATE OR REPLACE FUNCTION check_max_fotos()
RETURNS TRIGGER AS $$
DECLARE
  foto_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO foto_count
  FROM fotos_patrimonio
  WHERE tipo_inventario = NEW.tipo_inventario
    AND inventario_id = NEW.inventario_id;

  IF foto_count >= 3 THEN
    RAISE EXCEPTION 'No se pueden agregar más de 3 fotos por item';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_max_fotos ON fotos_patrimonio;
CREATE TRIGGER trigger_check_max_fotos
  BEFORE INSERT ON fotos_patrimonio
  FOR EACH ROW
  EXECUTE FUNCTION check_max_fotos();

CREATE OR REPLACE FUNCTION check_foto_principal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.es_principal = TRUE THEN
    UPDATE fotos_patrimonio
    SET es_principal = FALSE
    WHERE tipo_inventario = NEW.tipo_inventario
      AND inventario_id = NEW.inventario_id
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_foto_principal ON fotos_patrimonio;
CREATE TRIGGER trigger_check_foto_principal
  AFTER INSERT OR UPDATE ON fotos_patrimonio
  FOR EACH ROW
  EXECUTE FUNCTION check_foto_principal();

-- =====================================================
-- CATEGORIAS (RESPONSABLE EN CASCADA)
-- =====================================================
CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  padre_id INTEGER REFERENCES categorias(id) ON DELETE CASCADE,
  nivel INTEGER NOT NULL DEFAULT 0,
  path_completo VARCHAR(500),
  tipo VARCHAR(50) DEFAULT 'dependencia',
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categoria_padre ON categorias(padre_id);
CREATE INDEX IF NOT EXISTS idx_categoria_codigo ON categorias(codigo);
CREATE INDEX IF NOT EXISTS idx_categoria_nivel ON categorias(nivel);
CREATE INDEX IF NOT EXISTS idx_categoria_path ON categorias(path_completo);
CREATE INDEX IF NOT EXISTS idx_categoria_activo ON categorias(activo);

CREATE OR REPLACE FUNCTION update_categoria_metadata()
RETURNS TRIGGER AS $$
DECLARE
  padre_path VARCHAR(500);
  padre_nivel INTEGER;
BEGIN
  IF NEW.padre_id IS NULL THEN
    NEW.nivel = 0;
    NEW.path_completo = NEW.codigo;
  ELSE
    SELECT nivel, path_completo INTO padre_nivel, padre_path
    FROM categorias
    WHERE id = NEW.padre_id;

    NEW.nivel = padre_nivel + 1;
    NEW.path_completo = padre_path || '/' || NEW.codigo;
  END IF;

  NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_categoria_metadata ON categorias;
CREATE TRIGGER trigger_update_categoria_metadata
  BEFORE INSERT OR UPDATE ON categorias
  FOR EACH ROW
  EXECUTE FUNCTION update_categoria_metadata();

-- Catalogo base de responsable (sin datos de prueba de inventario)
INSERT INTO categorias (codigo, nombre, padre_id, nivel, tipo, orden) VALUES
('1', 'DIRECTOR', NULL, 0, 'dependencia', 1)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO categorias (codigo, nombre, padre_id, nivel, tipo, orden) VALUES
('1.1', 'Jefe de la División de Posgrados', (SELECT id FROM categorias WHERE codigo = '1'), 1, 'dependencia', 1),
('1.2', 'SUBDIRECTOR', (SELECT id FROM categorias WHERE codigo = '1'), 1, 'dependencia', 2)
ON CONFLICT (codigo) DO NOTHING;

-- =====================================================
-- USUARIOS
-- =====================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  usuario VARCHAR(100) NOT NULL UNIQUE,
  contrasena VARCHAR(255) NOT NULL,
  rol VARCHAR(50) NOT NULL DEFAULT 'usuario',
  ures VARCHAR(100),
  activo BOOLEAN DEFAULT TRUE,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ultimo_acceso TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuario_activo ON usuarios(activo);
CREATE INDEX IF NOT EXISTS idx_usuario_rol ON usuarios(rol);

CREATE OR REPLACE FUNCTION update_usuarios_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_usuarios_timestamp ON usuarios;
CREATE TRIGGER trigger_update_usuarios_timestamp
  BEFORE UPDATE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION update_usuarios_timestamp();

-- Sin usuario/contraseña por defecto por seguridad.
-- Crea usuarios de forma explícita desde un script seguro o panel administrativo.

