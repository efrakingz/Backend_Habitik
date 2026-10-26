import { pool } from '../config/db';
import { StreakService } from './streakService';
import { LogrosService } from './logrosService';

export class ChallengesService {
  /**
   * HU 2.1: Finalizar Speedrun de la Ducha
   * Regla de negocio:
   * - Menor a 4 minutos (<240s): NO se guarda nada en BD.
   * - De 4 a 5 min (240s - 300s): 200 XP, 2 monedas.
   * - De 5 a 8 min (301s - 480s): 100 XP, 1 moneda.
   * - Mayor a 8 min (>480s): 50 XP, 0 monedas.
   */
  static async finalizarDucha(userId: string, familyId: string | null, tiempoSegundos: number): Promise<{
    log?: any;
    guardado: boolean;
    es_valido: boolean;
    tiempo_segundos: number;
    xp_ganada: number;
    monedas_ganadas: number;
    total_xp?: number;
    saldo_monedas?: number;
    nivel_actual?: number;
    level_up?: boolean;
    racha_dias?: number;
    mensaje?: string;
  }> {
    if (tiempoSegundos < 240) {
      return {
        es_valido: false,
        guardado: false,
        tiempo_segundos: tiempoSegundos,
        xp_ganada: 0,
        monedas_ganadas: 0,
        mensaje: 'La ducha fue menor a 4 minutos (240s). No se registró nada en la base de datos.'
      };
    }

    let xp = 0;
    let monedas = 0;

    if (tiempoSegundos <= 300) {
      xp = 200;
      monedas = 2;
    } else if (tiempoSegundos <= 480) {
      xp = 100;
      monedas = 1;
    } else {
      xp = 50;
      monedas = 0;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertRes = await client.query(`
        INSERT INTO public.shower_logs (
          user_id, family_id, duracion_segundos, estado, es_valido, xp_otorgada, monedas_otorgadas
        )
        VALUES ($1, $2, $3, 'valido', true, $4, $5)
        RETURNING *;
      `, [userId, familyId, tiempoSegundos, xp, monedas]);

      const logInsertado = insertRes.rows[0];

      const prof = await client.query(`SELECT xp, monedas, nivel FROM public.profiles WHERE id = $1 FOR UPDATE;`, [userId]);
      if (prof.rows.length === 0) throw new Error('Perfil no encontrado.');

      const currentXp = prof.rows[0].xp || 0;
      const currentNivel = prof.rows[0].nivel || 1;

      const totalXp = currentXp + xp;
      const saldoMonedas = (prof.rows[0].monedas || 0) + monedas;

      // 1. Actualizamos la XP y Monedas acumuladas en profiles
      await client.query(`
        UPDATE public.profiles
        SET xp = $1, monedas = $2
        WHERE id = $3;
      `, [totalXp, saldoMonedas, userId]);

      // 2. Consultamos el nuevo nivel recalculado desde PostgreSQL
      const nivelRes = await client.query(`SELECT public.obtener_nivel_usuario($1) AS nuevo_nivel;`, [userId]);
      const nuevoNivel = nivelRes.rows[0]?.nuevo_nivel || Math.min(99, Math.floor(totalXp / 500) + 1);
      const levelUp = nuevoNivel > currentNivel;

      // 3. Guardamos el nivel resultante
      await client.query(`
        UPDATE public.profiles
        SET nivel = $1
        WHERE id = $2;
      `, [nuevoNivel, userId]);

      const streak = await StreakService.actualizarRachaDiaria(client, userId);

      await client.query(`
        INSERT INTO public.historial_gamificacion (user_id, origen_actividad, monedas_otorgadas, xp_otorgada)
        VALUES ($1, 'speedrun_ducha', $2, $3);
      `, [userId, monedas, xp]);

      // 🏆 DISPARADORES DE LOGROS AUTOMÁTICOS (Speedrun de la Ducha)
      await LogrosService.otorgarLogroSiAplica(userId, 'PRIMERA_DUCHA', client);

      if (tiempoSegundos <= 240) {
        await LogrosService.otorgarLogroSiAplica(userId, 'DUCHA_FLASH', client);
      }

      // Logro acumulativo: 5 duchas válidas
      const conteoDuchasRes = await client.query(`
        SELECT COUNT(*) AS total 
        FROM public.shower_logs 
        WHERE user_id = $1 AND es_valido = TRUE;
      `, [userId]);
      const totalDuchas = parseInt(conteoDuchasRes.rows[0]?.total || '0', 10);

      if (totalDuchas >= 5) {
        await LogrosService.otorgarLogroSiAplica(userId, 'MEDALLA_DUCHA_BRONCE', client);
      }

      // Logros por Rachas Consecutivas
      if (streak.racha_dias >= 3) {
        await LogrosService.otorgarLogroSiAplica(userId, 'RACHA_3', client);
      }
      if (streak.racha_dias >= 7) {
        await LogrosService.otorgarLogroSiAplica(userId, 'RACHA_7', client);
      }

      // Logro por acumulado de monedas
      if (saldoMonedas >= 100) {
        await LogrosService.otorgarLogroSiAplica(userId, 'BILLETERA_ECO', client);
      }

      await client.query('COMMIT');

      return {
        log: logInsertado,
        guardado: true,
        es_valido: true,
        tiempo_segundos: tiempoSegundos,
        xp_ganada: xp,
        monedas_ganadas: monedas,
        total_xp: totalXp,
        saldo_monedas: saldoMonedas,
        nivel_actual: nuevoNivel,
        level_up: levelUp,
        racha_dias: streak.racha_dias
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * HU 2.4: Completar Eco-Puzzle
   */
  static async completarPuzzle(userId: string, errores: number) {
    if (errores > 3) {
      throw new Error('Has superado el límite de 3 errores permitidos.');
    }

    const xp = 150;
    const monedas = 2;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const prof = await client.query(`SELECT xp, monedas, nivel FROM public.profiles WHERE id = $1 FOR UPDATE;`, [userId]);
      if (prof.rows.length === 0) throw new Error('Perfil no encontrado.');

      const totalXp = (prof.rows[0].xp || 0) + xp;
      const saldoMonedas = (prof.rows[0].monedas || 0) + monedas;
      const currentNivel = prof.rows[0].nivel || 1;

      // 1. Actualizamos XP y Monedas acumuladas
      await client.query(`
        UPDATE public.profiles
        SET xp = $1, monedas = $2
        WHERE id = $3;
      `, [totalXp, saldoMonedas, userId]);

      // 2. Obtenemos el nivel recalculado
      const nivelRes = await client.query(`SELECT public.obtener_nivel_usuario($1) AS nuevo_nivel;`, [userId]);
      const nuevoNivel = nivelRes.rows[0]?.nuevo_nivel || Math.min(99, Math.floor(totalXp / 500) + 1);
      const levelUp = nuevoNivel > currentNivel;

      // 3. Guardamos el nivel resultante
      await client.query(`
        UPDATE public.profiles
        SET nivel = $1
        WHERE id = $2;
      `, [nuevoNivel, userId]);

      const streak = await StreakService.actualizarRachaDiaria(client, userId);

      await client.query(`
        INSERT INTO public.historial_gamificacion (user_id, origen_actividad, monedas_otorgadas, xp_otorgada)
        VALUES ($1, 'eco_puzzle', $2, $3);
      `, [userId, monedas, xp]);

      // 🏆 DISPARADORES DE LOGROS AUTOMÁTICOS (Eco-Puzzle)
      if (errores === 0) {
        await LogrosService.otorgarLogroSiAplica(userId, 'MAESTRO_ECO', client);
        await LogrosService.otorgarLogroSiAplica(userId, 'RECICLADOR_PERFECTO', client);

        // Conteo acumulativo de puzzles sin errores
        const conteoPuzzleRes = await client.query(`
          SELECT COUNT(*) AS total 
          FROM public.historial_gamificacion 
          WHERE user_id = $1 AND origen_actividad = 'eco_puzzle';
        `, [userId]);
        const totalPuzzlesPerfectos = parseInt(conteoPuzzleRes.rows[0]?.total || '0', 10);

        if (totalPuzzlesPerfectos >= 10) {
          await LogrosService.otorgarLogroSiAplica(userId, 'MEDALLA_PUZZLE_ORO', client);
        }
      }

      // Logros por Rachas Consecutivas
      if (streak.racha_dias >= 3) {
        await LogrosService.otorgarLogroSiAplica(userId, 'RACHA_3', client);
      }
      if (streak.racha_dias >= 7) {
        await LogrosService.otorgarLogroSiAplica(userId, 'RACHA_7', client);
      }

      // Logro por acumulado de monedas
      if (saldoMonedas >= 100) {
        await LogrosService.otorgarLogroSiAplica(userId, 'BILLETERA_ECO', client);
      }

      await client.query('COMMIT');

      return {
        exito: true,
        xp_ganada: xp,
        monedas_ganadas: monedas,
        total_xp: totalXp,
        saldo_monedas: saldoMonedas,
        nivel_actual: nuevoNivel,
        level_up: levelUp,
        racha_dias: streak.racha_dias
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async evaluarConstanciaDiaria(userId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const resCount = await client.query(`
        SELECT COUNT(DISTINCT origen_actividad) as total
        FROM public.historial_gamificacion
        WHERE user_id = $1
          AND DATE(created_at) = CURRENT_DATE
          AND origen_actividad IN ('speedrun_ducha', 'eco_puzzle');
      `, [userId]);

      const totalRetos = parseInt(resCount.rows[0].total || '0');

      if (totalRetos < 2) {
        await client.query('COMMIT');
        return { activado: false, xp_bonus: 0, monedas_bonus: 0 };
      }

      const claim = await client.query(`
        INSERT INTO public.daily_bonus_claims (user_id, bonus_date)
        VALUES ($1, CURRENT_DATE)
        ON CONFLICT (user_id, bonus_date) DO NOTHING
        RETURNING id;
      `, [userId]);

      if (claim.rows.length === 0) {
        await client.query('COMMIT');
        return { activado: false, xp_bonus: 0, monedas_bonus: 0, ya_cobrado: true };
      }

      const prof = await client.query(`SELECT xp, monedas, nivel FROM public.profiles WHERE id = $1 FOR UPDATE;`, [userId]);
      if (prof.rows.length === 0) throw new Error('Perfil no encontrado.');

      const totalXp = (prof.rows[0].xp || 0) + 30;
      const saldoMonedas = (prof.rows[0].monedas || 0) + 5;

      await client.query(`
        UPDATE public.profiles
        SET xp = $1, monedas = $2
        WHERE id = $3;
      `, [totalXp, saldoMonedas, userId]);

      const nivelRes = await client.query(`SELECT public.obtener_nivel_usuario($1) AS nuevo_nivel;`, [userId]);
      const nuevoNivel = nivelRes.rows[0]?.nuevo_nivel || Math.min(99, Math.floor(totalXp / 500) + 1);

      await client.query(`
        UPDATE public.profiles
        SET nivel = $1
        WHERE id = $2;
      `, [nuevoNivel, userId]);

      await client.query(`
        INSERT INTO public.historial_gamificacion (user_id, origen_actividad, monedas_otorgadas, xp_otorgada)
        VALUES ($1, 'bonus_constancia', 5, 30);
      `, [userId]);

      if (saldoMonedas >= 100) {
        await LogrosService.otorgarLogroSiAplica(userId, 'BILLETERA_ECO', client);
      }

      await client.query('COMMIT');
      return { activado: true, xp_bonus: 30, monedas_bonus: 5, total_xp: totalXp, saldo_monedas: saldoMonedas, nivel_actual: nuevoNivel };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async obtenerPerfilGamificado(userId: string) {
    const client = await pool.connect();
    try {
      await StreakService.verificarYResetearRacha(userId, client);

      const res = await client.query(`
        SELECT id, xp, monedas, racha_dias FROM public.profiles WHERE id = $1;
      `, [userId]);

      if (res.rows.length === 0) throw new Error('Perfil no encontrado.');

      const p = res.rows[0];
      const xpTotal = p.xp || 0;

      const nivelRes = await client.query(`SELECT public.obtener_nivel_usuario($1) AS nivel;`, [userId]);
      const nivelActual = nivelRes.rows[0]?.nivel || Math.min(99, Math.floor(xpTotal / 500) + 1);

      const porcentajeProgreso = Number(((xpTotal % 500) / 500 * 100).toFixed(2));

      return {
        user_id: p.id,
        xp_total: xpTotal,
        nivel: nivelActual,
        porcentaje_siguiente_nivel: `${porcentajeProgreso}%`,
        saldo_monedas: p.monedas || 0,
        racha_dias: p.racha_dias || 0
      };
    } finally {
      client.release();
    }
  }
}