import { pool } from '../config/db';

export class FeedService {
  /**
   * Obtiene el feed unificado de actividades de TODOS los integrantes de la familia.
   */
  static async obtenerFeedFamiliar(familyId: string, limit: number = 30) {
    const client = await pool.connect();
    try {
      const query = `
        SELECT 
          id,
          user_id,
          nombre,
          origen_actividad,
          mensaje,
          imagen_url,
          xp_otorgada,
          monedas_otorgadas,
          created_at
        FROM (
          -- 1. Speedrun de Duchas
          SELECT 
            sl.id::text AS id,
            sl.user_id,
            COALESCE(p.nombre, 'Familiar') AS nombre,
            'speedrun_ducha' AS origen_actividad,
            CONCAT(COALESCE(p.nombre, 'Un familiar'), ' completó el Speedrun de la Ducha en ', FLOOR(sl.duracion_segundos / 60), 'm ', (sl.duracion_segundos % 60), 's.') AS mensaje,
            NULL::text AS imagen_url,
            COALESCE(sl.xp_otorgada, 0) AS xp_otorgada,
            COALESCE(sl.monedas_otorgadas, 0) AS monedas_otorgadas,
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
            NULL::text AS imagen_url,
            0 AS xp_otorgada,
            l.monedas_recompensa AS monedas_otorgadas,
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
            NULL::text AS imagen_url,
            0 AS xp_otorgada,
            0 AS monedas_otorgadas,
            c.created_at AS created_at
          FROM public.canjes c
          JOIN public.profiles p ON c.user_id = p.id
          JOIN public.family_rewards fr ON c.reward_id = fr.id
          WHERE p.family_id::text = $1::text

          UNION ALL

          -- 4. Validaciones de Retos con Fotos / Evidencias (Cazador de Sombras)
          SELECT 
            rv.id::text AS id,
            rv.user_id,
            COALESCE(p.nombre, 'Familiar') AS nombre,
            'reto_evidencia' AS origen_actividad,
            CONCAT(COALESCE(p.nombre, 'Un familiar'), ' completó el reto "', COALESCE(rv.reto, 'Reto Ecológico'), '".') AS mensaje,
            rv.evidencias->>0 AS imagen_url,
            COALESCE(rv.xp, 0) AS xp_otorgada,
            COALESCE(rv.monedas, 0) AS monedas_otorgadas,
            rv.created_at AS created_at
          FROM public.reto_validations rv
          JOIN public.profiles p ON rv.user_id = p.id
          WHERE p.family_id::text = $1::text 
            AND rv.estado = 'aprobado'

          UNION ALL

          -- 5. Actividades Generales (Eco-Puzzle, Wordle, Bonus Constancia, Subida de Nivel)
          SELECT 
            hg.id::text AS id,
            hg.user_id,
            COALESCE(p.nombre, 'Familiar') AS nombre,
            hg.origen_actividad,
            CASE 
              WHEN hg.origen_actividad = 'eco_puzzle' 
                THEN CONCAT(COALESCE(p.nombre, 'Un familiar'), ' armó el Eco-Puzzle con éxito.')
              WHEN hg.origen_actividad = 'wordle' 
                THEN CONCAT(COALESCE(p.nombre, 'Un familiar'), ' adivinó la palabra en Eco-Wordle.')
              WHEN hg.origen_actividad = 'bonus_constancia' 
                THEN CONCAT(COALESCE(p.nombre, 'Un familiar'), ' obtuvo el Bonus de Constancia Diaria.')
              WHEN hg.origen_actividad = 'recompensa_nivel' 
                THEN CONCAT(COALESCE(p.nombre, 'Un familiar'), ' subió de nivel.')
              ELSE CONCAT(COALESCE(p.nombre, 'Un familiar'), ' completó una actividad.')
            END AS mensaje,
            NULL::text AS imagen_url,
            COALESCE(hg.xp_otorgada, 0) AS xp_otorgada,
            COALESCE(hg.monedas_otorgadas, 0) AS monedas_otorgadas,
            hg.created_at AS created_at
          FROM public.historial_gamificacion hg
          JOIN public.profiles p ON hg.user_id = p.id
          WHERE p.family_id::text = $1::text 
            AND hg.origen_actividad NOT IN ('speedrun_ducha', 'logro', 'canje')
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
        imagen_url: row.imagen_url || null,
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
}