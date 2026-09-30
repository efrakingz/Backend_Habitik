import { describe, expect, it } from 'vitest';
import { triviaQuestions } from '../data/triviaQuestions';
import { TRIVIA_CATEGORIES } from '../models/trivia';
import { normalizarPregunta } from '../services/triviaRules';

describe('banco curado de trivia', () => {
  it('contiene exactamente 50 preguntas válidas', () => {
    expect(triviaQuestions).toHaveLength(50);

    for (const question of triviaQuestions) {
      expect(question.pregunta.trim()).not.toBe('');
      expect(question.explicacion.trim()).not.toBe('');
      expect(question.alternativas).toHaveLength(4);
      expect(new Set(question.alternativas.map((option) => normalizarPregunta(option))).size).toBe(4);
      expect(question.correctIndex).toBeGreaterThanOrEqual(0);
      expect(question.correctIndex).toBeLessThanOrEqual(3);
    }
  });

  it('distribuye diez preguntas en cada categoría', () => {
    for (const category of TRIVIA_CATEGORIES) {
      expect(triviaQuestions.filter((question) => question.categoria === category)).toHaveLength(10);
    }
  });

  it('no contiene preguntas duplicadas', () => {
    const normalized = triviaQuestions.map((question) => normalizarPregunta(question.pregunta));
    expect(new Set(normalized).size).toBe(normalized.length);
  });
});
