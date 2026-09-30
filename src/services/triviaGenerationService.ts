import { geminiTriviaClient, GeminiTriviaClient } from '../integrations/geminiTriviaClient';
import { triviaRepository, TriviaRepository } from '../repositories/triviaRepository';
import { crearFingerprint, TRIVIA_GENERATED_LIMIT, TRIVIA_TOTAL_LIMIT } from './triviaRules';

export class TriviaGenerationService {
  constructor(
    private readonly repository: TriviaRepository = triviaRepository,
    private readonly generator: GeminiTriviaClient = geminiTriviaClient,
  ) {}

  async refillIfNeeded(userId: string): Promise<number> {
    const availability = await this.repository.getAvailability(userId);
    if (availability.generated >= 10 && availability.unseen >= 15) return 0;

    const generated = await this.generator.generateQuestions();
    const client = await this.repository.connect();
    try {
      await client.query('BEGIN');
      await this.repository.lockGeneration(client);
      const fingerprints = generated.map((question) => crearFingerprint(question.pregunta));
      const existing = await this.repository.getExistingFingerprints(client, fingerprints);
      const unique = generated.filter((question) => !existing.has(crearFingerprint(question.pregunta)));
      const counts = await this.repository.getCatalogCounts(client);
      const required = Math.min(
        unique.length,
        Math.max(0, counts.generated + unique.length - TRIVIA_GENERATED_LIMIT, counts.total + unique.length - TRIVIA_TOTAL_LIMIT),
      );
      const deleted = await this.repository.deleteOldestGenerated(client, required);
      const capacity = this.repository.getGeneratedCapacity(counts.generated - deleted, counts.total - deleted);
      const inserted = await this.repository.insertGenerated(client, unique, capacity);
      await client.query('COMMIT');
      return inserted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const triviaGenerationService = new TriviaGenerationService();
