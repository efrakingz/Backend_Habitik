import { PoolClient } from 'pg';

export class StreakService {
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
}
