import { pool } from '../config/db';
import { LogrosService } from './logrosService';
import { acreditarProgresoUsuario, evaluarLogrosTransversales } from './gamification/progressEngine';

export class ChallengesService {
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

      // 1. Acreditar XP, monedas, nivel, racha e historial en una sola operación
      const progreso = await acreditarProgresoUsuario({
        userId,
        xpGanada: xp,
        monedasGanadas: monedas,
        origenActividad: 'eco_puzzle',
        actualizarRacha: true,
      }, client);

      // 2. Evaluar logros aplicables y otorgar en un solo lote SQL
      const codigosBase: string[] = [];
      if (errores === 0) {
        codigosBase.push('MAESTRO_ECO', 'RECICLADOR_PERFECTO');

        const conteoPuzzleRes = await client.query(`
          SELECT COUNT(*)::int AS total 
          FROM public.historial_gamificacion 
          WHERE user_id = $1 AND origen_actividad = 'eco_puzzle';
        `, [userId]);
        const totalPuzzles = Number(conteoPuzzleRes.rows[0]?.total) || 0;

        if (totalPuzzles >= 10) {
          codigosBase.push('MEDALLA_PUZZLE_ORO');
        }
      }

      const todosLosLogros = evaluarLogrosTransversales(
        progreso.racha_dias,
        progreso.saldo_monedas,
        codigosBase
      );

      await LogrosService.otorgarLogrosEnLote(userId, todosLosLogros, client);

      await client.query('COMMIT');

      return {
        exito: true,
        xp_ganada: xp,
        monedas_ganadas: monedas,
        total_xp: progreso.total_xp,
        saldo_monedas: progreso.saldo_monedas,
        nivel_actual: progreso.nivel_actual,
        level_up: progreso.level_up,
        racha_dias: progreso.racha_dias
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
