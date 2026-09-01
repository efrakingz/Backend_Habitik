import { pool } from '../config/db';

export class ChallengesService {
  /**
   * HU 2.1: Finalizar Speedrun de la Ducha
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
    mensaje?: string;
  }> {
    if (tiempoSegundos < 240) {
      return {
        es_valido: false,
        guardado: false,
        tiempo_segundos: tiempoSegundos,
        xp_ganada: 0,
        monedas_ganadas: 0,
        mensaje: 'La ducha fue menor a 4 minutos. No se registró nada en la base de datos.'
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

      const prof = await client.query(`SELECT xp, monedas, nivel FROM public.profiles WHERE id = $1;`, [userId]);
      if (prof.rows.length === 0) throw new Error('Perfil no encontrado.');

      const currentXp = prof.rows[0].xp || 0;
      const currentNivel = prof.rows[0].nivel || 1;

      const totalXp = currentXp + xp;
      const saldoMonedas = (prof.rows[0].monedas || 0) + monedas;

      const nuevoNivel = Math.floor(totalXp / 500) + 1;
      const levelUp = nuevoNivel > currentNivel;

      await client.query(`
        UPDATE public.profiles
        SET xp = $1, monedas = $2, nivel = $3, ultima_actividad = CURRENT_DATE
        WHERE id = $4;
      `, [totalXp, saldoMonedas, nuevoNivel, userId]);

      await client.query(`
        INSERT INTO public.historial_gamificacion (user_id, origen_actividad, monedas_otorgadas, xp_otorgada)
        VALUES ($1, 'speedrun_ducha', $2, $3);
      `, [userId, monedas, xp]);

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
        level_up: levelUp
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ... (mantén los métodos completarPuzzle, evaluarConstanciaDiaria y obtenerPerfilGamificado igual)
}