import { query } from '../config/db';
import { ShowerLog } from '../models/types';

export class ShowerRepository {
  async saveShowerLog(userId: string, duracionSegundos: number, estado: 'valido' | 'invalido'): Promise<ShowerLog> {
    const res = await query(
      `INSERT INTO public.shower_logs (user_id, duracion_segundos, estado) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [userId, duracionSegundos, estado]
    );
    return res.rows[0];
  }

  async getShowerLogsByUserId(userId: string): Promise<ShowerLog[]> {
    const res = await query(
      `SELECT * FROM public.shower_logs 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );
    return res.rows;
  }
}
