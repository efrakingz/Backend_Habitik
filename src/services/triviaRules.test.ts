import { describe, expect, it } from 'vitest';
import {
  calcularMonedasTrivia,
  calcularXpRespuesta,
  crearFingerprint,
  normalizarPregunta,
  TRIVIA_CURATED_LIMIT,
  TRIVIA_GENERATED_LIMIT,
  TRIVIA_TOTAL_LIMIT,
} from './triviaRules';

describe('reglas de trivia', () => {
  it.each([
    [0, true, 60],
    [9, true, 60],
    [10, true, 40],
    [20, true, 40],
    [21, true, 20],
    [30, true, 20],
    [31, true, 0],
    [5, false, 0],
  ])('calcula %s segundos y acierto %s como %s XP', (segundos, correcta, esperado) => {
    expect(calcularXpRespuesta(segundos, correcta)).toBe(esperado);
  });

  it.each([[0, 0], [4, 0], [5, 1], [12, 2]])('calcula %s aciertos como %s monedas', (correctas, esperado) => {
    expect(calcularMonedasTrivia(correctas)).toBe(esperado);
  });

  it('normaliza espacios, mayúsculas y tildes', () => {
    expect(normalizarPregunta('  ¿QUÉ   acción ahorra ENERGÍA? ')).toBe('¿que accion ahorra energia?');
    expect(crearFingerprint('¿Qué acción ahorra energía?')).toBe(crearFingerprint('  ¿QUE ACCION   AHORRA ENERGIA?'));
  });

  it('mantiene los límites del banco', () => {
    expect(TRIVIA_CURATED_LIMIT).toBe(50);
    expect(TRIVIA_GENERATED_LIMIT).toBe(70);
    expect(TRIVIA_TOTAL_LIMIT).toBe(120);
  });
});
