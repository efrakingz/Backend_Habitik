import { pool } from '../config/db';

export class WordleService {
  /**
   * Obtiene la palabra del día directamente desde PostgreSQL de forma cíclica (UTC-4).
   */
  private async getPalabraDelDia(client: any) {
    const wordRes = await client.query(`
      SELECT id, palabra, pista FROM public.ecological_words 
      ORDER BY id 
      LIMIT 1 OFFSET (EXTRACT(EPOCH FROM (CURRENT_DATE AT TIME ZONE 'America/Santiago')) / 86400)::integer % (SELECT COUNT(*) FROM public.ecological_words);
    `);

    if (wordRes.rows.length === 0) {
      throw new Error('No hay palabras ecológicas configuradas en la base de datos.');
    }

    return wordRes.rows[0];
  }

  /**
   * Helper centralizado: Garantiza que siempre exista la sesión de hoy para el usuario (UPSERT).
   */
  private async getOrCreateSession(client: any, userId: string) {
    const result = await client.query(`
      INSERT INTO public.wordle_attempts (user_id, fecha, intentos, estado)
      VALUES ($1, (CURRENT_DATE AT TIME ZONE 'America/Santiago'), '[]'::jsonb, 'en_proceso')
      ON CONFLICT (user_id, fecha) 
      DO UPDATE SET user_id = EXCLUDED.user_id 
      RETURNING id, intentos, estado, pista_revelada;
    `, [userId]);
    return result.rows[0];
  }

  async getTodayGame(userId: string) {
    const client = await pool.connect();
    try {
      const palabraObj = await this.getPalabraDelDia(client);
      const palabraSecreta = palabraObj.palabra.toUpperCase();
      const gameSession = await this.getOrCreateSession(client, userId);

      return {
        largo_palabra: palabraSecreta.length,
        intentos_realizados: gameSession.intentos,
        estado: gameSession.estado,
        pista_revelada: gameSession.pista_revelada,
        pista_educativa: (gameSession.estado !== 'en_proceso' || gameSession.pista_revelada) ? palabraObj.pista : null
      };
    } finally {
      client.release();
    }
  }

  async submitGuess(userId: string, intento: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const palabraObj = await this.getPalabraDelDia(client);
      const palabraSecreta = palabraObj.palabra.toUpperCase();
      const pistaEducativa = palabraObj.pista;

      const guess = intento.toUpperCase().trim();

      if (guess.length !== palabraSecreta.length) {
        throw new Error(`La palabra debe tener exactamente ${palabraSecreta.length} letras.`);
      }

      // Asegurar que la sesión exista antes de evaluar
      const session = await this.getOrCreateSession(client, userId);

      if (session.estado !== 'en_proceso') {
        throw new Error('El reto de hoy ya ha finalizado.');
      }

      const intentosPrevios: string[] = session.intentos || [];
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
        const profileRes = await client.query(`
          SELECT xp, nivel, monedas FROM public.profiles WHERE id = $1 FOR UPDATE;
        `, [userId]);
        const profile = profileRes.rows[0];

        const nuevaXp = (profile.xp || 0) + 100;
        const nuevasMonedas = (profile.monedas || 0) + 4;
        const nuevoNivel = Math.floor(nuevaXp / 500) + 1;

        await client.query(`
          UPDATE public.profiles 
          SET xp = $1, monedas = $2, nivel = $3, ultima_actividad = CURRENT_DATE 
          WHERE id = $4;
        `, [nuevaXp, nuevasMonedas, nuevoNivel, userId]);

        recompensasOtorgadas = { xp: 100, monedas: 4, nivel_actual: nuevoNivel };
      }

      await client.query(`
        UPDATE public.wordle_attempts 
        SET intentos = $1, estado = $2 
        WHERE id = $3;
      `, [JSON.stringify(intentosPrevios), nuevoEstado, session.id]);

      await client.query('COMMIT');

      return {
        evaluacion: resultadoEvaluacion,
        estado: nuevoEstado,
        intentos_restantes: 6 - intentosPrevios.length,
        recompensas: recompensasOtorgadas,
        pista_educativa: (nuevoEstado !== 'en_proceso' || session.pista_revelada) ? pistaEducativa : null
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async unlockHint(userId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Asegurar que la sesión exista incluso si el usuario pide pista primero
      const session = await this.getOrCreateSession(client, userId);
      const palabraObj = await this.getPalabraDelDia(client);

      if (session.pista_revelada) {
        await client.query('COMMIT');
        return { pista: palabraObj.pista };
      }

      const profileRes = await client.query(`
        SELECT monedas FROM public.profiles WHERE id = $1 FOR UPDATE;
      `, [userId]);
      const profile = profileRes.rows[0];

      if ((profile.monedas || 0) < 3) {
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