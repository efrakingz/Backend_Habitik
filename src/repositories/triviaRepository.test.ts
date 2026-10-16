import { describe, expect, it, vi } from 'vitest';
import { TriviaRepository } from './triviaRepository';

describe('TriviaRepository', () => {
  it('elimina únicamente preguntas Gemini que no estén en una sesión activa', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 4, rows: [] });
    const repository = new TriviaRepository({ query } as never);
    const deleted = await repository.deleteOldestGenerated({ query } as never, 4);

    expect(deleted).toBe(4);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("q.fuente = 'gemini'");
    expect(sql).toContain("s.estado = 'activa'");
    expect(sql).toContain('s.current_question_id = q.id');
    expect(query.mock.calls[0][1]).toEqual([4]);
  });

  it('respeta el máximo de 70 generadas y 120 totales', () => {
    const repository = new TriviaRepository({} as never);
    expect(repository.getGeneratedCapacity(70, 120)).toBe(0);
    expect(repository.getGeneratedCapacity(60, 110)).toBe(10);
    expect(repository.getGeneratedCapacity(65, 119)).toBe(1);
  });

  it('obtiene una curiosidad de la base de datos o retorna fallback si está vacía', async () => {
    // 1. Caso con dato_curioso en DB
    const queryWithDb = vi.fn().mockResolvedValue({
      rows: [{ dato_curioso: '💡 Los paneles solares ahorran hasta 60%', categoria: 'energia' }],
    });
    const repoWithDb = new TriviaRepository({ query: queryWithDb } as never);
    const resultDb = await repoWithDb.getRandomCuriosidad('energia');
    expect(resultDb?.curiosidad).toBe('💡 Los paneles solares ahorran hasta 60%');

    // 2. Caso fallback (sin registros en DB)
    const queryEmpty = vi.fn().mockResolvedValue({ rows: [] });
    const repoEmpty = new TriviaRepository({ query: queryEmpty } as never);
    const resultFallback = await repoEmpty.getRandomCuriosidad('agua');
    expect(resultFallback).not.toBeNull();
    expect(resultFallback?.curiosidad).toContain('💡 ¿Sabías que?');
  });
});
