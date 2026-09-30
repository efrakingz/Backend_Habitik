export const TRIVIA_CATEGORIES = [
  'energia',
  'agua',
  'reciclaje',
  'biodiversidad',
  'consumo_responsable',
] as const;

export type TriviaCategory = (typeof TRIVIA_CATEGORIES)[number];
export type TriviaDifficulty = 'facil' | 'media' | 'dificil';

export interface TriviaQuestionDraft {
  pregunta: string;
  alternativas: [string, string, string, string];
  correctIndex: number;
  explicacion: string;
  categoria: TriviaCategory;
  dificultad: TriviaDifficulty;
}

export interface TriviaQuestion extends TriviaQuestionDraft {
  id: string;
  fuente: 'curada' | 'gemini';
  fingerprint: string;
}

export interface TriviaSessionSummary {
  sesion_id: string;
  vidas: number;
  vida_extra_comprada: boolean;
  correctas: number;
  xp_acumulada: number;
  monedas_estimadas: number;
}

export interface TriviaAnswerResult {
  correcta: boolean;
  opcion_correcta: number;
  explicacion: string;
  tiempo_segundos: number;
  xp_ganada: number;
  vidas_restantes: number;
  correctas: number;
  xp_acumulada: number;
  puede_continuar: boolean;
}
