import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { triviaQuestions } from '../src/data/triviaQuestions';
import { crearFingerprint } from '../src/services/triviaRules';

const sqlText = (value: string) => `'${value.replace(/'/g, "''")}'`;
const rows = triviaQuestions.map((question) => {
  const values = [
    sqlText(question.pregunta),
    `${sqlText(JSON.stringify(question.alternativas))}::jsonb`,
    String(question.correctIndex),
    sqlText(question.explicacion),
    sqlText(question.categoria),
    sqlText(question.dificultad),
    sqlText('curada'),
    sqlText(crearFingerprint(question.pregunta)),
  ];
  return `    (${values.join(', ')})`;
}).join(',\n');

const migration = `CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

CREATE TABLE IF NOT EXISTS public.trivia_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pregunta TEXT NOT NULL,
    alternativas JSONB NOT NULL,
    correct_index SMALLINT NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
    explicacion TEXT NOT NULL,
    categoria VARCHAR(40) NOT NULL,
    dificultad VARCHAR(20) NOT NULL CHECK (dificultad IN ('facil', 'media', 'dificil')),
    fuente VARCHAR(20) NOT NULL CHECK (fuente IN ('curada', 'gemini')),
    fingerprint CHAR(64) NOT NULL UNIQUE,
    veces_usada INTEGER NOT NULL DEFAULT 0,
    ultima_vez_usada TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT trivia_questions_four_options CHECK (jsonb_typeof(alternativas) = 'array' AND jsonb_array_length(alternativas) = 4)
);

CREATE TABLE IF NOT EXISTS public.trivia_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
    vidas_restantes SMALLINT NOT NULL DEFAULT 3 CHECK (vidas_restantes BETWEEN 0 AND 3),
    vida_extra_comprada BOOLEAN NOT NULL DEFAULT false,
    correctas INTEGER NOT NULL DEFAULT 0,
    incorrectas INTEGER NOT NULL DEFAULT 0,
    xp_acumulada INTEGER NOT NULL DEFAULT 0,
    monedas_ganadas INTEGER NOT NULL DEFAULT 0,
    current_question_id UUID REFERENCES public.trivia_questions(id) ON DELETE RESTRICT,
    current_question_started_at TIMESTAMPTZ,
    estado VARCHAR(20) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'finalizada')),
    recompensa_acreditada BOOLEAN NOT NULL DEFAULT false,
    xp_total_resultado INTEGER,
    saldo_monedas_resultado INTEGER,
    nivel_resultado INTEGER,
    level_up_resultado BOOLEAN,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.trivia_answers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.trivia_sessions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.trivia_questions(id) ON DELETE SET NULL,
    pregunta_snapshot TEXT NOT NULL,
    alternativas_snapshot JSONB NOT NULL,
    explicacion_snapshot TEXT NOT NULL,
    selected_index SMALLINT CHECK (selected_index BETWEEN 0 AND 3),
    correct_index SMALLINT NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
    correcta BOOLEAN NOT NULL,
    tiempo_segundos INTEGER NOT NULL CHECK (tiempo_segundos >= 0),
    xp_otorgada INTEGER NOT NULL DEFAULT 0,
    vidas_restantes_resultado SMALLINT NOT NULL,
    correctas_resultado INTEGER NOT NULL,
    xp_acumulada_resultado INTEGER NOT NULL,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, question_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trivia_one_active_session ON public.trivia_sessions(user_id) WHERE estado = 'activa';
CREATE INDEX IF NOT EXISTS idx_trivia_answers_session ON public.trivia_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_trivia_answers_user_history ON public.trivia_answers(question_id, answered_at DESC);
CREATE INDEX IF NOT EXISTS idx_trivia_questions_rotation ON public.trivia_questions(fuente, ultima_vez_usada NULLS FIRST, created_at);

INSERT INTO public.trivia_questions (
    pregunta, alternativas, correct_index, explicacion, categoria, dificultad, fuente, fingerprint
)
VALUES
${rows}
ON CONFLICT (fingerprint) DO UPDATE SET
    pregunta = EXCLUDED.pregunta,
    alternativas = EXCLUDED.alternativas,
    correct_index = EXCLUDED.correct_index,
    explicacion = EXCLUDED.explicacion,
    categoria = EXCLUDED.categoria,
    dificultad = EXCLUDED.dificultad,
    fuente = 'curada';
`;

const root = join(__dirname, '..');
mkdirSync(join(root, 'sql'), { recursive: true });
writeFileSync(join(root, 'sql', '2026-09-25_trivia.sql'), migration, 'utf8');

const consolidatedPath = join(root, 'database_actual_limpia_v2.sql');
const consolidated = readFileSync(consolidatedPath, 'utf8');
const marker = 'CREATE TABLE IF NOT EXISTS public.trivia_questions';
const triviaBlockStart = consolidated.lastIndexOf('\n\nCREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;');
const base = consolidated.includes(marker) && triviaBlockStart >= 0
  ? consolidated.slice(0, triviaBlockStart)
  : consolidated;
writeFileSync(consolidatedPath, `${base.trimEnd()}\n\n${migration}`, 'utf8');
