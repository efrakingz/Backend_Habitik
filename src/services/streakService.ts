import { PoolClient } from 'pg';
import { pool } from '../config/db';

export interface RachaSemanalResult {
  user_id: string;
  inicio_semana: string;
  fin_semana: string;
  dias: boolean[];
  dias_activos: number;
  racha_dias: number;
  racha_semanas: number;
}

export class StreakService {
  /**
   * Resetea la racha a 0 para un usuario si pasaron más de 1 día sin actividad (racha rota).
   * Si la última actividad fue hoy o ayer, la racha se conserva intacta esperando el día.
   */
  static async verificarYResetearRacha(userId: string, client?: PoolClient): Promise<number> {
    const sql = `
      UPDATE public.profiles
      SET racha_dias = 0
      WHERE id = $1
        AND (ultima_actividad IS NULL OR ultima_actividad < CURRENT_DATE - 1)
        AND racha_dias > 0
      RETURNING racha_dias;
    `;
    const res = client ? await client.query(sql, [userId]) : await pool.query(sql, [userId]);
    return res.rowCount || 0;
  }

  /**
   * Resetea la racha a 0 globalmente para todos los usuarios cuya racha haya expirado.
   */
  static async resetearRachasExpiradasGlobal(client?: PoolClient): Promise<number> {
    const sql = `
      UPDATE public.profiles
      SET racha_dias = 0
      WHERE (ultima_actividad IS NULL OR ultima_actividad < CURRENT_DATE - 1)
        AND racha_dias > 0;
    `;
    const res = client ? await client.query(sql) : await pool.query(sql);
    return res.rowCount || 0;
  }

  static async actualizarRachaDiaria(client: PoolClient, userId: string): Promise<{
    racha_dias: number;
    ultima_actividad: Date;
  }> {
    const res = await client.query(`
      UPDATE public.profiles
      SET
        racha_dias = CASE
          WHEN ultima_actividad = CURRENT_DATE THEN GREATEST(COALESCE(racha_dias, 0), 1)
          WHEN ultima_actividad = CURRENT_DATE - 1 THEN COALESCE(racha_dias, 0) + 1
          ELSE 1
        END,
        ultima_actividad = CURRENT_DATE
      WHERE id = $1
      RETURNING racha_dias, ultima_actividad;
    `, [userId]);

    if (res.rows.length === 0) {
      throw new Error('Perfil no encontrado.');
    }

    return {
      racha_dias: res.rows[0].racha_dias || 0,
      ultima_actividad: res.rows[0].ultima_actividad
    };
  }

  /**
   * Invoca el procedimiento almacenado en PostgreSQL public.calcular_racha_semanal
   * para calcular los 7 días (L-D) completados de la semana actual,
   * total de días activos, semanas consecutivas y racha diaria acumulada.
   */
  static async obtenerRachaSemanal(userId: string): Promise<RachaSemanalResult> {
    const res = await pool.query(
      `SELECT public.calcular_racha_semanal($1::uuid) as racha;`,
      [userId]
    );

    if (res.rows.length === 0 || !res.rows[0].racha) {
      throw new Error('No se pudo calcular la racha semanal para el usuario.');
    }

    return res.rows[0].racha as RachaSemanalResult;
  }
}

