import { createHash } from 'node:crypto';

export const TRIVIA_INITIAL_LIVES = 3;
export const TRIVIA_EXTRA_LIFE_COST = 5;
export const TRIVIA_TIME_LIMIT_SECONDS = 30;
export const TRIVIA_CURATED_LIMIT = 50;
export const TRIVIA_GENERATED_LIMIT = 70;
export const TRIVIA_TOTAL_LIMIT = 120;

export function calcularXpRespuesta(segundos: number, correcta: boolean): number {
  if (!correcta || segundos > TRIVIA_TIME_LIMIT_SECONDS) return 0;
  if (segundos <= 3) return 10;
  if (segundos <= 11) return 9;
  if (segundos <= 18) return 8;
  if (segundos <= 26) return 7;
  return 6;
}

export function calcularMonedasTrivia(correctas: number): number {
  return Math.floor(Math.max(0, correctas) / 5);
}

export function normalizarPregunta(pregunta: string): string {
  return pregunta
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function crearFingerprint(pregunta: string): string {
  return createHash('sha256').update(normalizarPregunta(pregunta)).digest('hex');
}
