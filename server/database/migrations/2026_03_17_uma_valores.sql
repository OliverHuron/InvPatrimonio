-- =====================================================
-- MIGRACIÓN: Tabla de valores UMA por año
-- UMA = Unidad de Medida y Actualización (INEGI México)
-- Umbral EXTERNO: costo > UMA_del_año * 70
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.uma_valores (
  año                  INTEGER         PRIMARY KEY,
  valor                NUMERIC(10, 4)  NOT NULL,  -- valor diario de la UMA en pesos
  fuente               VARCHAR(100)    DEFAULT 'INEGI',
  fecha_actualizacion  TIMESTAMPTZ     DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  public.uma_valores IS 'Valor diario de la UMA por año fiscal (fuente: INEGI BIE indicador 628229)';
COMMENT ON COLUMN public.uma_valores.valor IS 'Valor diario de la UMA en pesos MXN';

-- Valores históricos conocidos (actualizar via cron con la API de INEGI)
INSERT INTO public.uma_valores (año, valor, fuente) VALUES
  (2016, 73.04,  'INEGI'),
  (2017, 75.49,  'INEGI'),
  (2018, 80.60,  'INEGI'),
  (2019, 84.49,  'INEGI'),
  (2020, 86.88,  'INEGI'),
  (2021, 89.62,  'INEGI'),
  (2022, 96.22,  'INEGI'),
  (2023, 103.74, 'INEGI'),
  (2024, 108.57, 'INEGI'),
  (2025, 117.20, 'INEGI'),
  (2026, 126.16, 'INEGI')
ON CONFLICT (año) DO UPDATE
  SET valor = EXCLUDED.valor,
      fuente = EXCLUDED.fuente,
      fecha_actualizacion = CURRENT_TIMESTAMP;

-- Índice innecesario para PK, pero documentar
-- El tipo_inventario se calcula dinámicamente:
--   costo > (uma_valores.valor * 70) => 'EXTERNO', sino 'INTERNO'
-- No se almacena en la tabla inventario (computed on SELECT)

COMMIT;
