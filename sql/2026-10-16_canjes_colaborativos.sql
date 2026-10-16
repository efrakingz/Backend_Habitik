-- ============================================================
-- MIGRACIÓN: CANJES COLABORATIVOS, PROPUESTAS Y LIMPIEZA
-- Fecha: 2026-10-16
-- Base de datos: Habitik (PostgreSQL Railway)
-- ============================================================

-- 1. Limpieza de notificaciones antiguas (solicitada por el usuario)
DELETE FROM public.notifications;

-- 2. Limpieza de canjes pendientes antiguos (reembolsando monedas a los usuarios)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT user_id, costo_pagado FROM public.canjes WHERE estado = 'pendiente' LOOP
        UPDATE public.profiles 
        SET monedas = monedas + r.costo_pagado 
        WHERE id = r.user_id;
    END LOOP;
END $$;

DELETE FROM public.canjes WHERE estado = 'pendiente';

-- 3. Soporte para propuestas y visibilidad en family_rewards
ALTER TABLE public.family_rewards 
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'activo',
  ADD COLUMN IF NOT EXISTS propuesto_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_propuesta DATE;

-- Índice para asegurar máximo 1 propuesta por usuario al día
CREATE UNIQUE INDEX IF NOT EXISTS ux_propuesta_diaria_usuario 
  ON public.family_rewards (propuesto_por, fecha_propuesta) 
  WHERE propuesto_por IS NOT NULL;

-- 4. Soporte para colectas familiares colaborativas en canjes
ALTER TABLE public.canjes 
  ADD COLUMN IF NOT EXISTS es_colecta BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS total_requerido INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_recaudado INTEGER DEFAULT 0;

-- 5. Tabla de aportes individuales a la colecta familiar
CREATE TABLE IF NOT EXISTS public.canje_aportes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canje_id UUID NOT NULL REFERENCES public.canjes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  monto_asignado INTEGER NOT NULL,
  monto_pagado INTEGER NOT NULL DEFAULT 0,
  pagado BOOLEAN NOT NULL DEFAULT FALSE,
  pagado_en TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unq_canje_usuario UNIQUE (canje_id, user_id)
);
