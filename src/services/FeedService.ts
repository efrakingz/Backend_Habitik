import { pool } from '../config/db';

export class FeedService {
  /**
   * Obtiene el feed unificado con las actividades de TODOS los miembros de la familia.
   */
  static async obtenerFeedFamiliar(familyId: string, limit: number = 20) {
    const client = await pool.connect();
    try {
      const query = `
        SELECT 
          id,
          user_id,
          nombre,
          origen_actividad,
          mensaje,
          created_at
        FROM (
          -- 1. Speedrun de Duchas
          SELECT 
            sl.id::text AS id,
            sl.user_id,
            COALESCE(p.nombre, 'Familiar') AS nombre,
            'speedrun_ducha' AS origen_actividad,
            CONCAT(COALESCE(p.nombre, 'Un familiar'), ' completó el Speedrun de la Ducha.') AS mensaje,
            sl.finalizado_en AS created_at
          FROM public.shower_logs sl
          JOIN public.profiles p ON sl.user_id = p.id
          WHERE p.family_id::text = $1::text 
            AND sl.es_valido = TRUE 
            AND sl.finalizado_en IS NOT NULL

          UNION ALL

          -- 2. Logros y Medallas Desbloqueadas
          SELECT 
            ul.id::text AS id,
            ul.user_id,
            COALESCE(p.nombre, 'Familiar') AS nombre,
            'logro' AS origen_actividad,
            CONCAT(COALESCE(p.nombre, 'Un familiar'), ' desbloqueó la medalla "', l.titulo, '".') AS mensaje,
            ul.fecha_desbloqueo AS created_at
          FROM public.usuario_logros ul
          JOIN public.profiles p ON ul.user_id = p.id
          JOIN public.logros l ON ul.logro_id = l.id
          WHERE p.family_id::text = $1::text 
            AND ul.fecha_desbloqueo IS NOT NULL

          UNION ALL

          -- 3. Canjes de Premios en la Tienda
          SELECT 
            c.id::text AS id,
            c.user_id,
            COALESCE(p.nombre, 'Familiar') AS nombre,
            'canje' AS origen_actividad,
            CONCAT(COALESCE(p.nombre, 'Un familiar'), ' canjeó el premio "', fr.titulo, '".') AS mensaje,
            c.created_at AS created_at
          FROM public.canjes c
          JOIN public.profiles p ON c.user_id = p.id
          JOIN public.family_rewards fr ON c.reward_id = fr.id
          WHERE p.family_id::text = $1::text

          UNION ALL

          -- 4. Eco-Puzzles y Subidas de Nivel (Historial Gamificación)
          SELECT 
            hg.id::text AS id,
            hg.user_id,
            COALESCE(p.nombre, 'Familiar') AS nombre,
            hg.origen_actividad,
            CASE 
              WHEN hg.origen_actividad = 'eco_puzzle' 
                THEN CONCAT(COALESCE(p.nombre, 'Un familiar'), ' armó el Eco-Puzzle con éxito.')
              WHEN hg.origen_actividad = 'recompensa_nivel' 
                THEN CONCAT(COALESCE(p.nombre, 'Un familiar'), ' subió de nivel.')
              ELSE CONCAT(COALESCE(p.nombre, 'Un familiar'), ' completó una actividad.')
            END AS mensaje,
            hg.created_at AS created_at
          FROM public.historial_gamificacion hg
          JOIN public.profiles p ON hg.user_id = p.id
          WHERE p.family_id::text = $1::text 
            AND hg.origen_actividad NOT IN ('speedrun_ducha', 'logro')
        ) feed_unificado
        ORDER BY created_at DESC
        LIMIT $2;
      `;

      const result = await client.query(query, [familyId, limit]);

      return result.rows.map(row => ({
        id: row.id,
        user_id: row.user_id,
        nombre: row.nombre,
        avatar: null,
        tipo: row.origen_actividad,
        mensaje: row.mensaje,
        fecha: row.created_at
      }));
    } finally {
      client.release();
    }
  }
}