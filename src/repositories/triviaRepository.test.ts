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
});
