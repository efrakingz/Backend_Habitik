-- ============================================================
-- MIGRACIÓN: HU 4.1 - Muro Social Familiar (Feed y Reacciones)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

-- 1. Asegurar columnas de timestamp en shower_logs si faltaran
ALTER TABLE public.shower_logs ADD COLUMN IF NOT EXISTS iniciado_en TIMESTAMPTZ;
ALTER TABLE public.shower_logs ADD COLUMN IF NOT EXISTS finalizado_en TIMESTAMPTZ;

-- 2. Tabla de Reacciones para Actividades del Feed Familiar
CREATE TABLE IF NOT EXISTS public.feed_reacciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_id VARCHAR(100) NOT NULL,
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tipo_reaccion VARCHAR(30) NOT NULL DEFAULT 'like',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_feed_reaccion UNIQUE (feed_id, user_id)
);

-- 3. Índices para consultas de alta velocidad y agregación en el Muro
CREATE INDEX IF NOT EXISTS idx_feed_reacciones_feed_id ON public.feed_reacciones(feed_id);
CREATE INDEX IF NOT EXISTS idx_feed_reacciones_family_id ON public.feed_reacciones(family_id);
CREATE INDEX IF NOT EXISTS idx_feed_reacciones_user_id ON public.feed_reacciones(user_id);

-- 4. Comentarios descriptivos para documentación académica
COMMENT ON TABLE public.feed_reacciones IS 'Almacena las reacciones e interacciones (likes, fuego, aplauso, etc.) que los miembros de la familia dan a las actividades del muro.';
COMMENT ON CONSTRAINT unique_user_feed_reaccion ON public.feed_reacciones IS 'Garantiza idempotencia: un usuario solo puede tener una reaccion activa por actividad.';
