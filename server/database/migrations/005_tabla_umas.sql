-- =====================================================
-- TABLA DE UMAs (Unidad de Medida y Actualización)
-- Almacena el valor histórico de UMA por año
-- =====================================================

CREATE TABLE IF NOT EXISTS umas (
  id SERIAL PRIMARY KEY,
  anio INTEGER NOT NULL UNIQUE,
  valor NUMERIC(10, 2) NOT NULL,
  activo BOOLEAN DEFAULT true,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para búsquedas rápidas por año
CREATE INDEX IF NOT EXISTS idx_umas_anio ON umas(anio);

-- Índice para UMA activa
CREATE INDEX IF NOT EXISTS idx_umas_activo ON umas(activo) WHERE activo = true;

CREATE OR REPLACE FUNCTION update_umas_fecha_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_umas_fecha_actualizacion'
      AND tgrelid = 'umas'::regclass
  ) THEN
    CREATE TRIGGER trigger_umas_fecha_actualizacion
      BEFORE UPDATE ON umas
      FOR EACH ROW
      EXECUTE FUNCTION update_umas_fecha_actualizacion();
  END IF;
END;
$$;

-- Fuente: SAT / INEGI - valores referenciales
INSERT INTO umas (anio, valor, activo) VALUES
  (2014, 63.77, true),
  (2015, 70.10, true),
  (2016, 73.04, true),
  (2017, 75.49, true),
  (2018, 80.60, true),
  (2019, 84.49, true),
  (2020, 86.88, true),
  (2021, 89.62, true),
  (2022, 96.22, true),
  (2023, 103.74, true),
  (2024, 108.57, true),
  (2025, 113.14, true)
ON CONFLICT (anio) DO NOTHING;

COMMENT ON TABLE umas IS 'Valores históricos de UMA por año para cálculo de clasificación de bienes';
COMMENT ON COLUMN umas.anio IS 'Año fiscal de la UMA';
COMMENT ON COLUMN umas.valor IS 'Valor de UMA en pesos mexicanos';
COMMENT ON COLUMN umas.activo IS 'Indica si el valor está vigente (para auditoría)';
