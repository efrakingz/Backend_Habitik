-- Permite múltiples partidas de Eco-Wordle por día por usuario,
-- manteniendo un máximo de 1 partida activa ('en_proceso') por usuario y fecha,
-- y registrando la palabra asignada a cada sesión para evitar repetirlas.

ALTER TABLE public.wordle_attempts
  DROP CONSTRAINT IF EXISTS wordle_attempts_user_id_fecha_key;

ALTER TABLE public.wordle_attempts
  ADD COLUMN IF NOT EXISTS word_id INTEGER;

ALTER TABLE public.wordle_attempts
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_wordle_attempts_active_user_fecha
  ON public.wordle_attempts (user_id, fecha)
  WHERE estado = 'en_proceso';

CREATE INDEX IF NOT EXISTS idx_wordle_attempts_user_fecha_created
  ON public.wordle_attempts (user_id, fecha, created_at DESC);
