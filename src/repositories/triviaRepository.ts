import { Pool, PoolClient, QueryResult } from 'pg';
import { pool } from '../config/db';
import { TriviaQuestion, TriviaQuestionDraft } from '../models/trivia';
import { crearFingerprint, TRIVIA_GENERATED_LIMIT, TRIVIA_TOTAL_LIMIT } from '../services/triviaRules';

type Queryable = Pick<Pool | PoolClient, 'query'>;

export class TriviaRepository {
  constructor(private readonly database: Pool = pool) {}

  connect(): Promise<PoolClient> {
    return this.database.connect();
  }

  async getAvailability(userId: string): Promise<{ generated: number; unseen: number }> {
    const result = await this.database.query(`
      SELECT
        COUNT(*) FILTER (WHERE q.fuente = 'gemini')::integer AS generated,
        COUNT(*) FILTER (WHERE NOT EXISTS (
          SELECT 1
          FROM public.trivia_answers a
          JOIN public.trivia_sessions s ON s.id = a.session_id
          WHERE s.user_id = $1 AND a.question_id = q.id
        ))::integer AS unseen
      FROM public.trivia_questions q;
    `, [userId]);
    return { generated: result.rows[0]?.generated ?? 0, unseen: result.rows[0]?.unseen ?? 0 };
  }

  lockGeneration(client: Queryable): Promise<QueryResult> {
    return client.query('SELECT pg_advisory_xact_lock($1);', [72834119]);
  }

  async getCatalogCounts(client: Queryable): Promise<{ generated: number; total: number }> {
    const result = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE fuente = 'gemini')::integer AS generated,
        COUNT(*)::integer AS total
      FROM public.trivia_questions;
    `);
    return { generated: result.rows[0]?.generated ?? 0, total: result.rows[0]?.total ?? 0 };
  }

  async getExistingFingerprints(client: Queryable, fingerprints: string[]): Promise<Set<string>> {
    if (fingerprints.length === 0) return new Set();
    const result = await client.query('SELECT fingerprint FROM public.trivia_questions WHERE fingerprint = ANY($1::char(64)[]);', [fingerprints]);
    return new Set(result.rows.map((row) => String(row.fingerprint).trim()));
  }

  async deleteOldestGenerated(client: Queryable, count: number): Promise<number> {
    if (count <= 0) return 0;
    const result = await client.query(`
      DELETE FROM public.trivia_questions
      WHERE id IN (
        SELECT q.id
        FROM public.trivia_questions q
        WHERE q.fuente = 'gemini'
          AND NOT EXISTS (
            SELECT 1 FROM public.trivia_sessions s
            WHERE s.current_question_id = q.id AND s.estado = 'activa'
          )
        ORDER BY q.ultima_vez_usada NULLS FIRST, q.created_at
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      );
    `, [count]);
    return result.rowCount ?? 0;
  }

  async insertGenerated(client: Queryable, questions: TriviaQuestionDraft[], capacity: number): Promise<number> {
    let inserted = 0;
    for (const question of questions.slice(0, Math.max(0, capacity))) {
      const result = await client.query(`
        INSERT INTO public.trivia_questions (
          pregunta, alternativas, correct_index, explicacion, categoria, dificultad, fuente, fingerprint
        ) VALUES ($1, $2::jsonb, $3, $4, $5, $6, 'gemini', $7)
        ON CONFLICT (fingerprint) DO NOTHING
        RETURNING id;
      `, [
        question.pregunta,
        JSON.stringify(question.alternativas),
        question.correctIndex,
        question.explicacion,
        question.categoria,
        question.dificultad,
        crearFingerprint(question.pregunta),
      ]);
      inserted += result.rowCount ?? 0;
    }
    return inserted;
  }

  async selectQuestion(client: Queryable, userId: string, previousQuestionId?: string | null): Promise<TriviaQuestion | null> {
    const result = await client.query(`
      SELECT q.id, q.pregunta, q.alternativas, q.correct_index, q.explicacion,
             q.categoria, q.dificultad, q.fuente, q.fingerprint
      FROM public.trivia_questions q
      WHERE ($2::uuid IS NULL OR q.id <> $2::uuid)
      ORDER BY
        EXISTS (
          SELECT 1
          FROM public.trivia_answers a
          JOIN public.trivia_sessions s ON s.id = a.session_id
          WHERE s.user_id = $1 AND a.question_id = q.id
        ) ASC,
        q.veces_usada ASC,
        q.ultima_vez_usada NULLS FIRST,
        random()
      LIMIT 1
      FOR UPDATE SKIP LOCKED;
    `, [userId, previousQuestionId ?? null]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      pregunta: row.pregunta,
      alternativas: row.alternativas,
      correctIndex: row.correct_index,
      explicacion: row.explicacion,
      categoria: row.categoria,
      dificultad: row.dificultad,
      fuente: row.fuente,
      fingerprint: String(row.fingerprint).trim(),
    };
  }

  getGeneratedCapacity(generated: number, total: number): number {
    return Math.max(0, Math.min(TRIVIA_GENERATED_LIMIT - generated, TRIVIA_TOTAL_LIMIT - total));
  }
}

export const triviaRepository = new TriviaRepository();
