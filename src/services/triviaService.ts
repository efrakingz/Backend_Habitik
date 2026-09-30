import { Pool, PoolClient } from 'pg';
import { pool } from '../config/db';
import { TriviaAnswerResult, TriviaSessionSummary } from '../models/trivia';
import { triviaRepository, TriviaRepository } from '../repositories/triviaRepository';
import { StreakService } from './streakService';
import { triviaGenerationService, TriviaGenerationService } from './triviaGenerationService';
import {
  calcularMonedasTrivia,
  calcularXpRespuesta,
  TRIVIA_EXTRA_LIFE_COST,
  TRIVIA_INITIAL_LIVES,
  TRIVIA_TIME_LIMIT_SECONDS,
} from './triviaRules';

export class TriviaNotFoundError extends Error {}
export class TriviaConflictError extends Error {}

interface SessionRow {
  id: string;
  vidas_restantes: number;
  vida_extra_comprada: boolean;
  correctas: number;
  incorrectas: number;
  xp_acumulada: number;
  monedas_ganadas: number;
  current_question_id: string | null;
  current_question_started_at: Date | string | null;
  estado: 'activa' | 'finalizada';
  recompensa_acreditada: boolean;
  xp_total_resultado: number | null;
  saldo_monedas_resultado: number | null;
  nivel_resultado: number | null;
  level_up_resultado: boolean | null;
}

export interface TriviaQuestionResponse {
  pregunta_id: string;
  pregunta: string;
  alternativas: string[];
  categoria: string;
  dificultad: string;
  limite_segundos: number;
  iniciada_en: string;
}

export interface TriviaFinalResult {
  sesion_id: string;
  correctas: number;
  incorrectas: number;
  xp_ganada: number;
  monedas_ganadas: number;
  xp_total: number;
  saldo_monedas: number;
  nivel_actual: number;
  level_up: boolean;
}

export class TriviaService {
  constructor(
    private readonly database: Pool = pool,
    private readonly repository: TriviaRepository = triviaRepository,
    private readonly generationService: TriviaGenerationService = triviaGenerationService,
  ) {}

  private summary(row: SessionRow): TriviaSessionSummary {
    return {
      sesion_id: row.id,
      vidas: row.vidas_restantes,
      vida_extra_comprada: row.vida_extra_comprada,
      correctas: row.correctas,
      xp_acumulada: row.xp_acumulada,
      monedas_estimadas: calcularMonedasTrivia(row.correctas),
    };
  }

  async iniciar(userId: string, familyId: string | null): Promise<{ created: boolean; session: TriviaSessionSummary }> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const active = await client.query<SessionRow>(`
        SELECT * FROM public.trivia_sessions
        WHERE user_id = $1 AND estado = 'activa'
        FOR UPDATE;
      `, [userId]);
      if (active.rows[0]) {
        await client.query('COMMIT');
        return { created: false, session: this.summary(active.rows[0]) };
      }

      const inserted = await client.query<SessionRow>(`
        INSERT INTO public.trivia_sessions (user_id, family_id, vidas_restantes)
        VALUES ($1, $2, $3)
        RETURNING *;
      `, [userId, familyId, TRIVIA_INITIAL_LIVES]);
      await client.query('COMMIT');
      return { created: true, session: this.summary(inserted.rows[0]) };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async obtenerPregunta(userId: string, sessionId: string): Promise<TriviaQuestionResponse> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const sessionResult = await client.query<SessionRow>(`
        SELECT * FROM public.trivia_sessions
        WHERE id = $1 AND user_id = $2
        FOR UPDATE;
      `, [sessionId, userId]);
      const session = sessionResult.rows[0];
      if (!session) throw new TriviaNotFoundError('Partida no encontrada.');
      if (session.estado !== 'activa') throw new TriviaConflictError('La partida ya finalizó.');
      if (session.vidas_restantes <= 0) throw new TriviaConflictError('No quedan vidas disponibles.');

      let question;
      let startedAt: Date | string;
      if (session.current_question_id && session.current_question_started_at) {
        const pending = await client.query(`
          SELECT id, pregunta, alternativas, categoria, dificultad
          FROM public.trivia_questions WHERE id = $1;
        `, [session.current_question_id]);
        question = pending.rows[0];
        startedAt = session.current_question_started_at;
      } else {
        const previous = await client.query(`
          SELECT question_id FROM public.trivia_answers
          WHERE session_id = $1 ORDER BY answered_at DESC LIMIT 1;
        `, [sessionId]);
        const selected = await this.repository.selectQuestion(client, userId, previous.rows[0]?.question_id ?? null);
        if (!selected) throw new TriviaConflictError('No hay preguntas disponibles.');
        const update = await client.query(`
          UPDATE public.trivia_sessions
          SET current_question_id = $1, current_question_started_at = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING current_question_started_at;
        `, [selected.id, sessionId]);
        await client.query(`
          UPDATE public.trivia_questions
          SET veces_usada = veces_usada + 1, ultima_vez_usada = CURRENT_TIMESTAMP
          WHERE id = $1;
        `, [selected.id]);
        question = selected;
        startedAt = update.rows[0].current_question_started_at;
      }

      await client.query('COMMIT');
      void this.generationService.refillIfNeeded(userId).catch(() => undefined);
      return {
        pregunta_id: question.id,
        pregunta: question.pregunta,
        alternativas: question.alternativas,
        categoria: question.categoria,
        dificultad: question.dificultad,
        limite_segundos: TRIVIA_TIME_LIMIT_SECONDS,
        iniciada_en: new Date(startedAt).toISOString(),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async responder(userId: string, sessionId: string, questionId: string, selectedIndex: number | null): Promise<TriviaAnswerResult> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const previous = await client.query(`
        SELECT a.correcta, a.correct_index, a.explicacion_snapshot, a.tiempo_segundos,
               a.xp_otorgada, a.vidas_restantes_resultado, a.correctas_resultado,
               a.xp_acumulada_resultado
        FROM public.trivia_answers a
        JOIN public.trivia_sessions s ON s.id = a.session_id
        WHERE a.session_id = $1 AND a.question_id = $2 AND s.user_id = $3;
      `, [sessionId, questionId, userId]);
      if (previous.rows[0]) {
        await client.query('COMMIT');
        const row = previous.rows[0];
        return {
          correcta: row.correcta,
          opcion_correcta: row.correct_index,
          explicacion: row.explicacion_snapshot,
          tiempo_segundos: row.tiempo_segundos,
          xp_ganada: row.xp_otorgada,
          vidas_restantes: row.vidas_restantes_resultado,
          correctas: row.correctas_resultado,
          xp_acumulada: row.xp_acumulada_resultado,
          puede_continuar: row.vidas_restantes_resultado > 0,
        };
      }

      const result = await client.query(`
        SELECT s.*,
          GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.current_question_started_at))))::integer AS elapsed_seconds,
          q.pregunta, q.alternativas, q.correct_index, q.explicacion
        FROM public.trivia_sessions s
        JOIN public.trivia_questions q ON q.id = s.current_question_id
        WHERE s.id = $1 AND s.user_id = $2
        FOR UPDATE OF s;
      `, [sessionId, userId]);
      const row = result.rows[0];
      if (!row) throw new TriviaNotFoundError('Partida o pregunta no encontrada.');
      if (row.estado !== 'activa') throw new TriviaConflictError('La partida ya finalizó.');
      if (row.vidas_restantes <= 0) throw new TriviaConflictError('No quedan vidas disponibles.');
      if (row.current_question_id !== questionId) throw new TriviaConflictError('La pregunta no está pendiente en esta partida.');

      const elapsedSeconds = Number(row.elapsed_seconds);
      const correct = selectedIndex !== null && selectedIndex === row.correct_index && elapsedSeconds <= TRIVIA_TIME_LIMIT_SECONDS;
      const xp = calcularXpRespuesta(elapsedSeconds, correct);
      const remainingLives = correct ? row.vidas_restantes : Math.max(0, row.vidas_restantes - 1);
      const correctCount = row.correctas + (correct ? 1 : 0);
      const accumulatedXp = row.xp_acumulada + xp;

      await client.query(`
        INSERT INTO public.trivia_answers (
          session_id, question_id, pregunta_snapshot, alternativas_snapshot,
          explicacion_snapshot, selected_index, correct_index, correcta,
          tiempo_segundos, xp_otorgada, vidas_restantes_resultado,
          correctas_resultado, xp_acumulada_resultado
        ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13);
      `, [
        sessionId, questionId, row.pregunta, JSON.stringify(row.alternativas), row.explicacion,
        selectedIndex, row.correct_index, correct, elapsedSeconds, xp, remainingLives,
        correctCount, accumulatedXp,
      ]);
      await client.query(`
        UPDATE public.trivia_sessions
        SET vidas_restantes = $1,
            correctas = $2,
            incorrectas = incorrectas + $3,
            xp_acumulada = $4,
            current_question_id = NULL,
            current_question_started_at = NULL
        WHERE id = $5;
      `, [remainingLives, correctCount, correct ? 0 : 1, accumulatedXp, sessionId]);
      await client.query('COMMIT');

      return {
        correcta: correct,
        opcion_correcta: row.correct_index,
        explicacion: row.explicacion,
        tiempo_segundos: elapsedSeconds,
        xp_ganada: xp,
        vidas_restantes: remainingLives,
        correctas: correctCount,
        xp_acumulada: accumulatedXp,
        puede_continuar: remainingLives > 0,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async comprarVidaExtra(userId: string, sessionId: string): Promise<{ vidas: number; saldo_monedas: number; vida_extra_comprada: true }> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const sessionResult = await client.query<SessionRow>(`
        SELECT * FROM public.trivia_sessions
        WHERE id = $1 AND user_id = $2
        FOR UPDATE;
      `, [sessionId, userId]);
      const session = sessionResult.rows[0];
      if (!session) throw new TriviaNotFoundError('Partida no encontrada.');
      if (session.estado !== 'activa') throw new TriviaConflictError('La partida ya finalizó.');
      if (session.vidas_restantes !== 0) throw new TriviaConflictError('La vida extra solo puede comprarse al quedar sin vidas.');
      if (session.vida_extra_comprada) throw new TriviaConflictError('La vida extra ya fue comprada en esta partida.');

      const profile = await client.query('SELECT monedas FROM public.profiles WHERE id = $1 FOR UPDATE;', [userId]);
      if (!profile.rows[0]) throw new TriviaNotFoundError('Perfil no encontrado.');
      if (profile.rows[0].monedas < TRIVIA_EXTRA_LIFE_COST) throw new TriviaConflictError('No tienes monedas suficientes.');
      const balance = profile.rows[0].monedas - TRIVIA_EXTRA_LIFE_COST;

      await client.query('UPDATE public.profiles SET monedas = $1 WHERE id = $2;', [balance, userId]);
      await client.query(`
        UPDATE public.trivia_sessions
        SET vidas_restantes = 1, vida_extra_comprada = true
        WHERE id = $1;
      `, [sessionId]);
      await client.query('COMMIT');
      return { vidas: 1, saldo_monedas: balance, vida_extra_comprada: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async finalizar(userId: string, sessionId: string): Promise<TriviaFinalResult> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const sessionResult = await client.query<SessionRow>(`
        SELECT * FROM public.trivia_sessions
        WHERE id = $1 AND user_id = $2
        FOR UPDATE;
      `, [sessionId, userId]);
      const session = sessionResult.rows[0];
      if (!session) throw new TriviaNotFoundError('Partida no encontrada.');
      if (session.recompensa_acreditada) {
        await client.query('COMMIT');
        return this.finalResult(session);
      }

      const profileResult = await client.query(`
        SELECT xp, monedas, nivel FROM public.profiles WHERE id = $1 FOR UPDATE;
      `, [userId]);
      const profile = profileResult.rows[0];
      if (!profile) throw new TriviaNotFoundError('Perfil no encontrado.');
      const coins = calcularMonedasTrivia(session.correctas);
      const totalXp = (profile.xp ?? 0) + session.xp_acumulada;
      const balance = (profile.monedas ?? 0) + coins;
      const previousLevel = profile.nivel ?? 1;

      await client.query(`
        UPDATE public.profiles
        SET xp = $1,
            monedas = $2,
            trivia_correct_count = COALESCE(trivia_correct_count, 0) + $3,
            trivia_last_updated = CURRENT_TIMESTAMP::text
        WHERE id = $4;
      `, [totalXp, balance, session.correctas, userId]);
      const levelResult = await client.query('SELECT public.obtener_nivel_usuario($1) AS nivel;', [userId]);
      const level = levelResult.rows[0]?.nivel ?? Math.min(99, Math.floor(totalXp / 500) + 1);
      await client.query('UPDATE public.profiles SET nivel = $1 WHERE id = $2;', [level, userId]);
      await StreakService.actualizarRachaDiaria(client, userId);
      await client.query(`
        INSERT INTO public.historial_gamificacion (user_id, origen_actividad, monedas_otorgadas, xp_otorgada)
        VALUES ($1, 'trivia', $2, $3);
      `, [userId, coins, session.xp_acumulada]);
      const finished = await client.query<SessionRow>(`
        UPDATE public.trivia_sessions
        SET estado = 'finalizada',
            recompensa_acreditada = true,
            monedas_ganadas = $1,
            xp_total_resultado = $2,
            saldo_monedas_resultado = $3,
            nivel_resultado = $4,
            level_up_resultado = $5,
            current_question_id = NULL,
            current_question_started_at = NULL,
            finished_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING *;
      `, [coins, totalXp, balance, level, level > previousLevel, sessionId]);
      await client.query('COMMIT');
      return this.finalResult(finished.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private finalResult(row: SessionRow): TriviaFinalResult {
    return {
      sesion_id: row.id,
      correctas: row.correctas,
      incorrectas: row.incorrectas,
      xp_ganada: row.xp_acumulada,
      monedas_ganadas: row.monedas_ganadas,
      xp_total: row.xp_total_resultado ?? 0,
      saldo_monedas: row.saldo_monedas_resultado ?? 0,
      nivel_actual: row.nivel_resultado ?? 1,
      level_up: row.level_up_resultado ?? false,
    };
  }
}

export const triviaService = new TriviaService();
