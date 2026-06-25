import { ShowerRepository } from '../repositories/showerRepository';
import { ShowerLog } from '../models/types';
import { query } from '../config/db';

const showerRepository = new ShowerRepository();

export class ShowerService {
  async registerShowerTime(userId: string, duracionSegundos: number): Promise<ShowerLog> {
    // Asegurar que la tabla exista
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS public.shower_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
          duracion_segundos INTEGER NOT NULL,
          estado VARCHAR(50) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    } catch (e) {
      // Ignorar si ya existe
    }

    // CA-2.1-2: Validación anti-trampa (< 3 minutos = 180 segundos es inválido)
    const estado = duracionSegundos >= 180 ? 'valido' : 'invalido';

    const log = await showerRepository.saveShowerLog(userId, duracionSegundos, estado);
    return log;
  }
}
