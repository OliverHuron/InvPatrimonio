-- Migración 011: Agrega columna ures_responsable a inventario_interno
-- Propósito: Permite asignar una URES responsable a cada bien para el filtrado
--            por URES del usuario autenticado (modo BD / demo multi-URES).
-- Autor: GitHub Copilot
-- Fecha: 2025

BEGIN;

ALTER TABLE public.inventario_interno
  ADD COLUMN IF NOT EXISTS ures_responsable character varying(100);

COMMENT ON COLUMN public.inventario_interno.ures_responsable
  IS 'URES responsable del bien (para filtrado por usuario en modo BD). Ej: 231';

CREATE INDEX IF NOT EXISTS idx_interno_ures_responsable
  ON public.inventario_interno USING btree (ures_responsable);

COMMIT;
