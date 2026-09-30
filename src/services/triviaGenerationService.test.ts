import { describe, expect, it, vi } from 'vitest';
import { TriviaGenerationService } from './triviaGenerationService';

const drafts = Array.from({ length: 10 }, (_, index) => ({
  pregunta: `Pregunta ambiental ${index}`,
  alternativas: ['A', 'B', 'C', 'D'] as [string, string, string, string],
  correctIndex: 0,
  explicacion: 'Explicación educativa.',
  categoria: 'energia' as const,
  dificultad: 'facil' as const,
}));

function createRepository(generated = 70, total = 120) {
  const client = {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  };
  return {
    client,
    repository: {
      getAvailability: vi.fn().mockResolvedValue({ generated: 5, unseen: 4 }),
      connect: vi.fn().mockResolvedValue(client),
      lockGeneration: vi.fn().mockResolvedValue(undefined),
      getExistingFingerprints: vi.fn().mockResolvedValue(new Set()),
      getCatalogCounts: vi.fn().mockResolvedValue({ generated, total }),
      deleteOldestGenerated: vi.fn().mockResolvedValue(10),
      getGeneratedCapacity: vi.fn().mockReturnValue(10),
      insertGenerated: vi.fn().mockResolvedValue(10),
    },
  };
}

describe('TriviaGenerationService', () => {
  it('rota diez preguntas al alcanzar 70 dinámicas y 120 totales', async () => {
    const { repository, client } = createRepository();
    const generator = { generateQuestions: vi.fn().mockResolvedValue(drafts) };
    const service = new TriviaGenerationService(repository as never, generator as never);

    await expect(service.refillIfNeeded('user-1')).resolves.toBe(10);
    expect(repository.lockGeneration).toHaveBeenCalledWith(client);
    expect(repository.deleteOldestGenerated).toHaveBeenCalledWith(client, 10);
    expect(repository.insertGenerated).toHaveBeenCalledWith(client, drafts, 10);
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('deduplica fingerprints antes de insertar', async () => {
    const { repository } = createRepository(20, 70);
    const { crearFingerprint } = await import('./triviaRules');
    repository.getExistingFingerprints.mockResolvedValue(new Set([crearFingerprint(drafts[0].pregunta)]));
    const service = new TriviaGenerationService(repository as never, { generateQuestions: vi.fn().mockResolvedValue(drafts) } as never);

    await service.refillIfNeeded('user-1');
    expect(repository.insertGenerated.mock.calls[0][1]).toHaveLength(9);
  });

  it('no modifica el banco cuando Gemini falla', async () => {
    const { repository } = createRepository();
    const service = new TriviaGenerationService(repository as never, { generateQuestions: vi.fn().mockRejectedValue(new Error('sin IA')) } as never);

    await expect(service.refillIfNeeded('user-1')).rejects.toThrow('sin IA');
    expect(repository.connect).not.toHaveBeenCalled();
  });

  it('no genera cuando existen suficientes preguntas no vistas', async () => {
    const { repository } = createRepository();
    repository.getAvailability.mockResolvedValue({ generated: 10, unseen: 15 });
    const generator = { generateQuestions: vi.fn() };
    const service = new TriviaGenerationService(repository as never, generator as never);

    await expect(service.refillIfNeeded('user-1')).resolves.toBe(0);
    expect(generator.generateQuestions).not.toHaveBeenCalled();
  });
});
