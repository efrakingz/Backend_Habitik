import { pool } from '../config/db';

export class FeedService {
  /**
   * Obtiene el feed cronológico de actividades de una familia específica.
   */
  static async obtenerFeedFamiliar(familyId: string, limit: number = 20) {
    const client = await pool.connect();
    try {
      const query = `
        SELECT 
          hg.id,
          hg.user_id,
          p.nombre,
          hg.origen_actividad,
          hg.xp_otorgada,
          hg.monedas_otorgadas,
          hg.created_at
        FROM public.historial_gamificacion hg
        JOIN public.profiles p ON hg.user_id = p.id
        WHERE p.family_id = $1
        ORDER BY hg.created_at DESC
        LIMIT $2;
      `;
      const result = await client.query(query, [familyId, limit]);

      return result.rows.map(row => ({
        id: row.id,
        user_id: row.user_id,
        nombre: row.nombre || 'Familiar',
        avatar: null,
        tipo: row.origen_actividad,
        mensaje: FeedService.generarMensajeFeed(row.nombre || 'Familiar', row.origen_actividad),
        recompensas: {
          xp: row.xp_otorgada,
          monedas: row.monedas_otorgadas
        },
        fecha: row.created_at
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Genera el texto dinámico para la interfaz según el tipo de actividad.
   */
  private static generarMensajeFeed(nombre: string, actividad: string): string {
    switch (actividad) {
      case 'speedrun_ducha':
        return `${nombre} completó el Speedrun de la Ducha.`;
      case 'eco_puzzle':
        return `${nombre} armó el Eco-Puzzle.`;
      case 'logro':
        return `${nombre} desbloqueó una nueva medalla.`;
      case 'recompensa_nivel':
        return `${nombre} subió de nivel.`;
      default:
        return `${nombre} completó una actividad.`;
    }
  }
}