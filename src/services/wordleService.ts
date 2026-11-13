import { Pool } from 'pg';
import { pool } from '../config/db';

export interface EcologicalWordRow {
  id: number;
  palabra: string;
  pista: string;
}

interface WordleAttemptRow {
  id: string;
  intentos: string[];
  estado: string;
  pista_revelada: boolean;
  word_id: number | null;
}

const SANTIAGO_TODAY_SQL = `(NOW() AT TIME ZONE 'America/Santiago')::date`;

const WORDLE_SCHEMA_STATEMENTS = [
  `ALTER TABLE public.wordle_attempts DROP CONSTRAINT IF EXISTS wordle_attempts_user_id_fecha_key;`,
  `ALTER TABLE public.wordle_attempts ADD COLUMN IF NOT EXISTS word_id INTEGER;`,
  `ALTER TABLE public.wordle_attempts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_wordle_attempts_active_user_fecha ON public.wordle_attempts (user_id, fecha) WHERE estado = 'en_proceso';`,
  `CREATE INDEX IF NOT EXISTS idx_wordle_attempts_user_fecha_created ON public.wordle_attempts (user_id, fecha, created_at DESC);`,
];

export class WordleService {
  private schemaPromise: Promise<void> | null = null;

  constructor(private readonly database: Pool = pool) {}

  /**
   * Asegura de forma idempotente que wordle_attempts soporte múltiples partidas por día
   * con seguimiento de word_id (tanto en local como en producción).
   */
  async ensureSchema(): Promise<void> {
    if (!this.schemaPromise) {
      this.schemaPromise = (async () => {
        for (const sql of WORDLE_SCHEMA_STATEMENTS) {
          try {
            await this.database.query(sql);
          } catch (error) {
            console.warn('⚠️ [WordleService] No se pudo aplicar statement DDL opcional:', (error as Error).message);
          }
        }
      })();
    }
    await this.schemaPromise;
  }

  /**
   * Respaldo histórico para sesiones creadas antes de guardar word_id explícito.
   */
  private async getLegacyDailyWord(client: any): Promise<EcologicalWordRow> {
    const wordRes = await client.query(`
      SELECT id, UPPER(TRIM(palabra)) AS palabra, pista
      FROM public.ecological_words
      ORDER BY id
      LIMIT 1 OFFSET (EXTRACT(EPOCH FROM (CURRENT_DATE AT TIME ZONE 'America/Santiago')) / 86400)::integer % (SELECT COUNT(*) FROM public.ecological_words);
    `);

    if (wordRes.rows.length === 0) {
      throw new Error('No hay palabras ecológicas configuradas en la base de datos.');
    }

    return wordRes.rows[0];
  }

  /**
   * Carga una palabra específica por ID o resuelve respaldo si el registro fue actualizado.
   */
  private async resolveWordForSession(client: any, session: WordleAttemptRow): Promise<EcologicalWordRow> {
    if (session.word_id != null) {
      const res = await client.query(
        `SELECT id, UPPER(TRIM(palabra)) AS palabra, pista FROM public.ecological_words WHERE id = $1 LIMIT 1;`,
        [session.word_id]
      );
      if (res.rows.length > 0) {
        return res.rows[0];
      }
    }

    const legacyWord = await this.getLegacyDailyWord(client);
    await client.query(
      `UPDATE public.wordle_attempts SET word_id = $1 WHERE id = $2;`,
      [legacyWord.id, session.id]
    );
    session.word_id = legacyWord.id;
    return legacyWord;
  }

  /**
   * Selecciona una palabra distinta a las ya jugadas hoy por el usuario.
   * Si completó todo el catálogo en el mismo día, reinicia evitando repetir la inmediatamente anterior.
   */
  private async selectNextWord(client: any, userId: string): Promise<EcologicalWordRow> {
    const wordsRes = await client.query(`
      SELECT id, UPPER(TRIM(palabra)) AS palabra, pista
      FROM public.ecological_words
      ORDER BY id ASC;
    `);

    if (wordsRes.rows.length === 0) {
      throw new Error('No hay palabras ecológicas configuradas en la base de datos.');
    }

    const uniqueWords: EcologicalWordRow[] = [];
    const seenNormalized = new Set<string>();
    const wordById = new Map<number, EcologicalWordRow>();

    for (const row of wordsRes.rows as EcologicalWordRow[]) {
      const normalized = row.palabra.trim().toUpperCase();
      const item: EcologicalWordRow = { id: Number(row.id), palabra: normalized, pista: row.pista };
      wordById.set(item.id, item);
      if (!seenNormalized.has(normalized)) {
        seenNormalized.add(normalized);
        uniqueWords.push(item);
      }
    }

    const usedRes = await client.query(`
      SELECT word_id
      FROM public.wordle_attempts
      WHERE user_id = $1
        AND fecha = ${SANTIAGO_TODAY_SQL}
      ORDER BY created_at DESC;
    `, [userId]);

    const usedWordsToday = new Set<string>();
    let hasLegacyNullToday = false;
    let lastPlayedWord: string | null = null;

    for (const row of usedRes.rows as Array<{ word_id: number | null }>) {
      if (row.word_id != null) {
        const found = wordById.get(Number(row.word_id));
        if (found) {
          usedWordsToday.add(found.palabra);
          if (lastPlayedWord === null) {
            lastPlayedWord = found.palabra;
          }
        }
      } else {
        hasLegacyNullToday = true;
      }
    }

    if (hasLegacyNullToday) {
      const legacyWord = await this.getLegacyDailyWord(client);
      usedWordsToday.add(legacyWord.palabra.trim().toUpperCase());
      if (lastPlayedWord === null) {
        lastPlayedWord = legacyWord.palabra.trim().toUpperCase();
      }
    }

    let candidates = uniqueWords.filter((w) => !usedWordsToday.has(w.palabra));
    if (candidates.length === 0) {
      candidates = lastPlayedWord
        ? uniqueWords.filter((w) => w.palabra !== lastPlayedWord)
        : uniqueWords;
      if (candidates.length === 0) {
        candidates = uniqueWords;
      }
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private async findActiveSession(client: any, userId: string, lockForUpdate = false): Promise<WordleAttemptRow | null> {
    const lockClause = lockForUpdate ? 'FOR UPDATE' : '';
    const res = await client.query(`
      SELECT id, intentos, estado, pista_revelada, word_id
      FROM public.wordle_attempts
      WHERE user_id = $1
        AND fecha = ${SANTIAGO_TODAY_SQL}
        AND estado = 'en_proceso'
      ORDER BY created_at DESC
      LIMIT 1
      ${lockClause};
    `, [userId]);

    return res.rows.length > 0 ? res.rows[0] : null;
  }

  /**
   * Obtiene la sesión activa ('en_proceso') de hoy o crea una nueva con una palabra distinta.
   */
  private async getOrCreateActiveSession(
    client: any,
    userId: string,
    lockForUpdate = false
  ): Promise<{ session: WordleAttemptRow; palabraObj: EcologicalWordRow }> {
    const existing = await this.findActiveSession(client, userId, lockForUpdate);
    if (existing) {
      const palabraObj = await this.resolveWordForSession(client, existing);
      return { session: existing, palabraObj };
    }

    const nextWord = await this.selectNextWord(client, userId);

    const inserted = await client.query(`
      INSERT INTO public.wordle_attempts (user_id, fecha, intentos, estado, word_id)
      VALUES ($1, ${SANTIAGO_TODAY_SQL}, '[]'::jsonb, 'en_proceso', $2)
      ON CONFLICT (user_id, fecha) WHERE estado = 'en_proceso'
      DO NOTHING
      RETURNING id, intentos, estado, pista_revelada, word_id;
    `, [userId, nextWord.id]);

    if (inserted.rows.length > 0) {
      return { session: inserted.rows[0], palabraObj: nextWord };
    }

    const concurrent = await this.findActiveSession(client, userId, lockForUpdate);
    if (!concurrent) {
      throw new Error('No se pudo inicializar la sesión de Eco-Wordle.');
    }
    const palabraObj = await this.resolveWordForSession(client, concurrent);
    return { session: concurrent, palabraObj };
  }

  private async getCompletedCountToday(client: any, userId: string): Promise<number> {
    const statsRes = await client.query(`
      SELECT COALESCE(SUM(CASE WHEN estado = 'ganado' THEN 1 ELSE 0 END), 0)::int AS completadas_hoy
      FROM public.wordle_attempts
      WHERE user_id = $1
        AND fecha = ${SANTIAGO_TODAY_SQL};
    `, [userId]);

    return Number(statsRes.rows[0]?.completadas_hoy || 0);
  }

  private buildSessionResponse(
    session: WordleAttemptRow,
    palabraObj: EcologicalWordRow,
    completadasHoy: number
  ) {
    const palabraSecreta = palabraObj.palabra.toUpperCase();
    return {
      sesion_id: session.id,
      largo_palabra: palabraSecreta.length,
      intentos_realizados: session.intentos || [],
      estado: session.estado,
      pista_revelada: Boolean(session.pista_revelada),
      pista_educativa: (session.estado !== 'en_proceso' || session.pista_revelada) ? palabraObj.pista : null,
      completado_hoy: completadasHoy > 0,
      partidas_completadas_hoy: completadasHoy,
    };
  }

  async getTodayGame(userId: string) {
    await this.ensureSchema();
    const [{ session, palabraObj }, completadasHoy] = await Promise.all([
      this.getOrCreateActiveSession(this.database, userId, false),
      this.getCompletedCountToday(this.database, userId),
    ]);
    return this.buildSessionResponse(session, palabraObj, completadasHoy);
  }

  async startNewGame(userId: string) {
    await this.ensureSchema();
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const { session, palabraObj } = await this.getOrCreateActiveSession(client, userId, true);
      const completadasHoy = await this.getCompletedCountToday(client, userId);
      await client.query('COMMIT');
      return this.buildSessionResponse(session, palabraObj, completadasHoy);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async submitGuess(userId: string, intento: string, sesionId?: string) {
    await this.ensureSchema();
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');

      let session: WordleAttemptRow;
      let palabraObj: EcologicalWordRow;

      if (sesionId) {
        const res = await client.query(`
          SELECT id, intentos, estado, pista_revelada, word_id
          FROM public.wordle_attempts
          WHERE id = $1 AND user_id = $2
          FOR UPDATE;
        `, [sesionId, userId]);

        if (res.rows.length === 0) {
          throw new Error('Partida de Eco-Wordle no encontrada.');
        }
        session = res.rows[0];
        palabraObj = await this.resolveWordForSession(client, session);
      } else {
        const active = await this.getOrCreateActiveSession(client, userId, true);
        session = active.session;
        palabraObj = active.palabraObj;
      }

      if (session.estado !== 'en_proceso') {
        throw new Error('Esta partida ya ha finalizado.');
      }

      const palabraSecreta = palabraObj.palabra.toUpperCase();
      const pistaEducativa = palabraObj.pista;
      const guess = intento.toUpperCase().trim();

      if (guess.length !== palabraSecreta.length) {
        throw new Error(`La palabra debe tener exactamente ${palabraSecreta.length} letras.`);
      }

      const intentosPrevios: string[] = Array.isArray(session.intentos) ? [...session.intentos] : [];
      if (intentosPrevios.length >= 6) {
        throw new Error('Ya has agotado tus 6 intentos.');
      }

      const resultadoEvaluacion = this.evaluarIntento(guess, palabraSecreta);
      intentosPrevios.push(guess);

      let nuevoEstado = 'en_proceso';
      let recompensasOtorgadas = null;

      if (guess === palabraSecreta) {
        nuevoEstado = 'ganado';
      } else if (intentosPrevios.length >= 6) {
        nuevoEstado = 'perdido';
      }

      if (nuevoEstado === 'ganado') {
        const progreso = await this.acreditarRecompensaWordle(client, userId, 100, 4);

        recompensasOtorgadas = {
          xp: 100,
          monedas: 4,
          nivel_actual: progreso.nivel_actual,
          racha_dias: progreso.racha_dias,
        };
      }

      await client.query(`
        UPDATE public.wordle_attempts
        SET intentos = $1, estado = $2
        WHERE id = $3;
      `, [JSON.stringify(intentosPrevios), nuevoEstado, session.id]);

      await client.query('COMMIT');

      return {
        sesion_id: session.id,
        evaluacion: resultadoEvaluacion,
        estado: nuevoEstado,
        intentos_restantes: 6 - intentosPrevios.length,
        recompensas: recompensasOtorgadas,
        pista_educativa: (nuevoEstado !== 'en_proceso' || session.pista_revelada) ? pistaEducativa : null,
        palabra_correcta: nuevoEstado !== 'en_proceso' ? palabraSecreta : null,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async acreditarRecompensaWordle(
    client: any,
    userId: string,
    xpGanada: number,
    monedasGanadas: number
  ): Promise<{ nivel_actual: number; racha_dias: number }> {
    const updateRes = await client.query(
      `
      WITH prev AS (
        SELECT
          id,
          COALESCE(xp, 0) AS old_xp,
          COALESCE(monedas, 0) AS old_monedas,
          COALESCE(racha_dias, 0) AS old_racha,
          ultima_actividad
        FROM public.profiles
        WHERE id = $1
        FOR UPDATE
      ),
      updated AS (
        UPDATE public.profiles p
        SET
          xp = prev.old_xp + $2,
          monedas = prev.old_monedas + $3,
          nivel = LEAST(99, FLOOR((prev.old_xp + $2) / 500.0)::int + 1),
          racha_dias = CASE
            WHEN $4::boolean IS FALSE THEN prev.old_racha
            WHEN prev.ultima_actividad = CURRENT_DATE THEN GREATEST(prev.old_racha, 1)
            WHEN prev.ultima_actividad = CURRENT_DATE - 1 THEN prev.old_racha + 1
            ELSE 1
          END,
          ultima_actividad = CASE
            WHEN $4::boolean IS TRUE THEN CURRENT_DATE
            ELSE p.ultima_actividad
          END
        FROM prev
        WHERE p.id = prev.id
        RETURNING
          p.nivel AS nivel_actual,
          p.racha_dias
      )
      SELECT * FROM updated;
      `,
      [userId, xpGanada, monedasGanadas, true]
    );

    if (updateRes.rows.length === 0) {
      throw new Error('Perfil no encontrado.');
    }

    await client.query(
      `INSERT INTO public.historial_gamificacion (user_id, origen_actividad, monedas_otorgadas, xp_otorgada)
       VALUES ($1, 'wordle', $2, $3);`,
      [userId, monedasGanadas, xpGanada]
    );

    return {
      nivel_actual: Number(updateRes.rows[0].nivel_actual) || 1,
      racha_dias: Number(updateRes.rows[0].racha_dias) || 0,
    };
  }

  async unlockHint(userId: string, sesionId?: string) {
    await this.ensureSchema();
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');

      let session: WordleAttemptRow;
      let palabraObj: EcologicalWordRow;

      if (sesionId) {
        const res = await client.query(`
          SELECT id, intentos, estado, pista_revelada, word_id
          FROM public.wordle_attempts
          WHERE id = $1 AND user_id = $2
          FOR UPDATE;
        `, [sesionId, userId]);

        if (res.rows.length === 0) {
          throw new Error('Partida de Eco-Wordle no encontrada.');
        }
        session = res.rows[0];
        palabraObj = await this.resolveWordForSession(client, session);
      } else {
        const active = await this.getOrCreateActiveSession(client, userId, true);
        session = active.session;
        palabraObj = active.palabraObj;
      }

      if (session.pista_revelada) {
        await client.query('COMMIT');
        return { pista: palabraObj.pista };
      }

      const profileRes = await client.query(`
        SELECT monedas FROM public.profiles WHERE id = $1 FOR UPDATE;
      `, [userId]);
      const profile = profileRes.rows[0];

      if ((profile?.monedas || 0) < 3) {
        throw new Error('No tienes suficientes monedas (necesitas 3).');
      }

      await client.query(`
        UPDATE public.profiles SET monedas = monedas - 3 WHERE id = $1;
      `, [userId]);

      await client.query(`
        UPDATE public.wordle_attempts SET pista_revelada = TRUE WHERE id = $1;
      `, [session.id]);

      await client.query('COMMIT');
      return { pista: palabraObj.pista };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private evaluarIntento(intento: string, secreta: string) {
    const secretaArr = secreta.split('');
    const intentoArr = intento.split('');

    const evaluado = intentoArr.map((letra, i) => {
      if (letra === secretaArr[i]) {
        secretaArr[i] = '_';
        return { letra, estado: 'verde' as const };
      }
      return { letra, estado: null };
    });

    return evaluado.map((item, i) => {
      if (item.estado === 'verde') return item;
      const letra = intentoArr[i];
      const indexSecreta = secretaArr.indexOf(letra);
      if (indexSecreta !== -1) {
        secretaArr[indexSecreta] = '_';
        return { letra, estado: 'amarillo' as const };
      }
      return { letra, estado: 'gris' as const };
    });
  }
}
