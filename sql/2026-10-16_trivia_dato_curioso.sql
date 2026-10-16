-- Migración para soportar Eco-Curiosidades generadas por Gemini
ALTER TABLE public.trivia_questions 
ADD COLUMN IF NOT EXISTS dato_curioso VARCHAR(260);
