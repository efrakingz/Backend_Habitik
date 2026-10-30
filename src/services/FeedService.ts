import { pool } from '../config/db';

export interface FeedReaccion {
  id: string;
  tipo: string;
  user_id: string;
  usuario_nombre?: string;
  created_at: string;
}

export interface FeedItem {
  id: string;
  user_id: string;
  nombre: string;
  avatar: any;
  tipo: string;
  mensaje: string;
  imagen_url: string | null;
  recompensas: {
    xp: number;
    monedas: number;
  };
  fecha: string;
  total_reacciones: number;
  reacciones_conteo: Record<string, number>;
  mi_reaccion: string | null;
  reacciones: FeedReaccion[];
}

export class FeedService {
  private static tablesChecked = false;

  /**
   * Garantiza que la tabla de reacciones e índices existan en la base de datos.
   * Se ejecuta de forma idempotente una sola vez en el ciclo de vida de la aplicación.
   */
  private static async ensureTables() {
    if (FeedService.tablesChecked) return;
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.feed_reacciones (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          feed_id VARCHAR(100) NOT NULL,
          family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
          tipo_reaccion VARCHAR(30) NOT NULL DEFAULT 'like',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT unique_user_feed_reaccion UNIQUE (feed_id, user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_feed_reacciones_feed_id ON public.feed_reacciones(feed_id);
        CREATE INDEX IF NOT EXISTS idx_feed_reacciones_family_id ON public.feed_reacciones(family_id);
        CREATE INDEX IF NOT EXISTS idx_feed_reacciones_user_id ON public.feed_reacciones(user_id);
      `);
      FeedService.tablesChecked = true;
    } catch (err: any) {
      console.warn('[FeedService.ensureTables] Advertencia asegurando tabla feed_reacciones:', err.message);
    }
  }

  /**
   * Obtiene el feed unificado de actividades cronológicas de la familia con soporte
   * para avatar enriquecido, tareas completadas, fotos y agregación de reacciones sociales.
   */
  static async obtenerFeedFamiliar(
    familyId: string,
    limit: number = 20,
    cursorDate?: string,
    currentUserId?: string
  ): Promise<FeedItem[]> {
    await FeedService.ensureTables();
    const client = await pool.connect();

    try {
      const query = `
        WITH actividades AS (
          -- 1. Speedrun de Duchas (soporta finalizado_en o created_at)
          SELECT 
            sl.id::text AS id,
            sl.user_id,
            COALESCE(p.nombre, 'Familiar') AS nombre,
            p.avatar,
            'speedrun_ducha' AS origen_actividad,
            CONCAT(COALESCE(p.nombre, 'Un familiar'), ' completó el Speedrun de la Ducha en ', FLOOR(sl.duracion_segundos / 60), 'm ', (sl.duracion_segundos % 60), 's.') AS mensaje,
            NULL::text AS imagen_url,
            COALESCE(sl.xp_otorgada, 0) AS xp_otorgada,
            COALESCE(sl.monedas_otorgadas, 0) AS monedas_otorgadas,
            COALESCE(sl.finalizado_en, sl.created_at) AS created_at
          FROM public.shower_logs sl
          JOIN public.profiles p ON sl.user_id = p.id
          WHERE p.family_id = $1::uuid 
            AND sl.es_valido = TRUE 
            AND COALESCE(sl.finalizado_en, sl.created_at) IS NOT NULL

          UNION ALL

          -- 2. Tareas Familiares Completadas (HU Criterio de Aceptación)
          SELECT 
            t.id::text AS id,
            COALESCE(t.asignado_id, p.id) AS user_id,
            COALESCE(p.nombre, 'Familiar') AS nombre,
            p.avatar,
            'tarea_completada' AS origen_actividad,
            CONCAT(COALESCE(p.nombre, 'Un familiar'), ' completó la tarea: "', t.tarea, '".') AS mensaje,
            COALESCE(t.config->>'imagen_url', t.config->>'foto', NULL) AS imagen_url,
            COALESCE(t.xp, 0) AS xp_otorgada,
            0 AS monedas_otorgadas,
            t.created_at AS created_at
          FROM public.tasks t
          LEFT JOIN public.profiles p ON t.asignado_id = p.id
          WHERE t.family_id = $1::uuid 
            AND t.hecho = TRUE

          UNION ALL

          -- 3. Logros y Medallas Desbloqueadas
          SELECT 
            ul.id::text AS id,
            ul.user_id,
            COALESCE(p.nombre, 'Familiar') AS nombre,
            p.avatar,
            'logro' AS origen_actividad,
            CONCAT(COALESCE(p.nombre, 'Un familiar'), ' desbloqueó la medalla "', l.titulo, '".') AS mensaje,
            NULL::text AS imagen_url,
            0 AS xp_otorgada,
            COALESCE(l.monedas_recompensa, 0) AS monedas_otorgadas,
            ul.fecha_desbloqueo AS created_at
          FROM public.usuario_logros ul
          JOIN public.profiles p ON ul.user_id = p.id
          JOIN public.logros l ON ul.logro_id = l.id
          WHERE p.family_id = $1::uuid 
            AND ul.fecha_desbloqueo IS NOT NULL

          UNION ALL

          -- 4. Validaciones de Retos con Fotos / Evidencias (Cazador de Sombras)
          SELECT 
            rv.id::text AS id,
            rv.user_id,
            COALESCE(p.nombre, 'Familiar') AS nombre,
            p.avatar,
            'reto_evidencia' AS origen_actividad,
            CONCAT(COALESCE(p.nombre, 'Un familiar'), ' completó el reto "', COALESCE(rv.reto, 'Reto Ecológico'), '".') AS mensaje,
            CASE 
              WHEN jsonb_typeof(rv.evidencias) = 'array' AND jsonb_array_length(rv.evidencias) > 0 
                THEN COALESCE(rv.evidencias->0->>'url', rv.evidencias->>0)
              ELSE NULL
            END AS imagen_url,
            COALESCE(rv.xp, 0) AS xp_otorgada,
            COALESCE(rv.monedas, 0) AS monedas_otorgadas,
            rv.created_at AS created_at
          FROM public.reto_validations rv
          JOIN public.profiles p ON rv.user_id = p.id
          WHERE p.family_id = $1::uuid 
            AND rv.estado = 'aprobado'

          UNION ALL

          -- 5. Evidencias y Acciones Familiares Directas
          SELECT 
            e.id::text AS id,
            e.user_id,
            COALESCE(p.nombre, 'Familiar') AS nombre,
            p.avatar,
            'evidencia_accion' AS origen_actividad,
            CONCAT(COALESCE(p.nombre, 'Un familiar'), ' reportó: "', e.accion, '".') AS mensaje,
            CASE 
              WHEN jsonb_typeof(e.media) = 'array' AND jsonb_array_length(e.media) > 0 
                THEN COALESCE(e.media->0->>'url', e.media->>0)
              ELSE NULL
            END AS imagen_url,
            COALESCE(e.xp, 0) AS xp_otorgada,
            0 AS monedas_otorgadas,
            e.created_at AS created_at
          FROM public.evidences e
          JOIN public.profiles p ON e.user_id = p.id
          WHERE e.family_id = $1::uuid

          UNION ALL

          -- 6. Canjes de Premios en la Tienda
          SELECT 
            c.id::text AS id,
            c.user_id,
            COALESCE(p.nombre, 'Familiar') AS nombre,
            p.avatar,
            'canje' AS origen_actividad,
            CONCAT(COALESCE(p.nombre, 'Un familiar'), ' canjeó el premio "', fr.titulo, '".') AS mensaje,
            NULL::text AS imagen_url,
            0 AS xp_otorgada,
            0 AS monedas_otorgadas,
            c.created_at AS created_at
          FROM public.canjes c
          JOIN public.profiles p ON c.user_id = p.id
          JOIN public.family_rewards fr ON c.reward_id = fr.id
          WHERE p.family_id = $1::uuid

          UNION ALL

          -- 7. Actividades Generales (Eco-Puzzle, Wordle, Bonus Constancia, Subida de Nivel)
          SELECT 
            hg.id::text AS id,
            hg.user_id,
            COALESCE(p.nombre, 'Familiar') AS nombre,
            p.avatar,
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
          WHERE p.family_id = $1::uuid 
            AND hg.origen_actividad NOT IN ('speedrun_ducha', 'logro', 'canje')
        )
        SELECT 
          a.id,
          a.user_id,
          a.nombre,
          a.avatar,
          a.origen_actividad,
          a.mensaje,
          a.imagen_url,
          a.xp_otorgada,
          a.monedas_otorgadas,
          a.created_at,
          COALESCE(
            json_agg(
              json_build_object(
                'id', r.id,
                'tipo', r.tipo_reaccion,
                'user_id', r.user_id,
                'usuario_nombre', pr.nombre,
                'created_at', r.created_at
              )
            ) FILTER (WHERE r.id IS NOT NULL),
            '[]'
          ) AS reacciones_raw
        FROM actividades a
        LEFT JOIN public.feed_reacciones r ON r.feed_id = a.id
        LEFT JOIN public.profiles pr ON r.user_id = pr.id
        WHERE ($2::timestamptz IS NULL OR a.created_at < $2::timestamptz)
        GROUP BY 
          a.id, a.user_id, a.nombre, a.avatar, a.origen_actividad, 
          a.mensaje, a.imagen_url, a.xp_otorgada, a.monedas_otorgadas, a.created_at
        ORDER BY a.created_at DESC
        LIMIT $3;
      `;

      const result = await client.query(query, [
        familyId,
        cursorDate ? new Date(cursorDate).toISOString() : null,
        Math.max(1, Math.min(limit, 100))
      ]);

      return result.rows.map(row => {
        const reacciones: FeedReaccion[] = Array.isArray(row.reacciones_raw) ? row.reacciones_raw : [];
        const conteoPorTipo: Record<string, number> = {};
        let miReaccion: string | null = null;

        for (const r of reacciones) {
          const t = r.tipo || 'like';
          conteoPorTipo[t] = (conteoPorTipo[t] || 0) + 1;
          if (currentUserId && String(r.user_id) === String(currentUserId)) {
            miReaccion = t;
          }
        }

        return {
          id: row.id,
          user_id: row.user_id,
          nombre: row.nombre,
          avatar: row.avatar || null,
          tipo: row.origen_actividad,
          mensaje: row.mensaje,
          imagen_url: row.imagen_url || null,
          recompensas: {
            xp: Number(row.xp_otorgada) || 0,
            monedas: Number(row.monedas_otorgadas) || 0
          },
          fecha: row.created_at,
          total_reacciones: reacciones.length,
          reacciones_conteo: conteoPorTipo,
          mi_reaccion: miReaccion,
          reacciones
        };
      });
    } finally {
      client.release();
    }
  }

  /**
   * Registra, actualiza o remueve (toggle) una reacción de un familiar a una actividad.
   * Garantiza idempotencia mediante restricción única en la base de datos.
   */
  static async reaccionar(
    feedId: string,
    familyId: string,
    userId: string,
    tipoReaccion: string = 'like'
  ): Promise<{
    accion: 'creada' | 'actualizada' | 'eliminada';
    tipo: string;
    reaccionado: boolean;
    total_reacciones: number;
    reacciones_conteo: Record<string, number>;
    usuario_nombre?: string;
  }> {
    await FeedService.ensureTables();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Obtener nombre del usuario que reacciona
      const userRes = await client.query(
        `SELECT nombre FROM public.profiles WHERE id = $1;`,
        [userId]
      );
      const usuarioNombre = userRes.rows[0]?.nombre || 'Un familiar';

      // 2. Verificar si ya existe una reacción de este usuario en esta actividad
      const existingRes = await client.query(
        `SELECT id, tipo_reaccion FROM public.feed_reacciones WHERE feed_id = $1 AND user_id = $2 FOR UPDATE;`,
        [feedId, userId]
      );

      let accion: 'creada' | 'actualizada' | 'eliminada';
      let reaccionado = false;
      const normalizedTipo = (tipoReaccion || 'like').trim().toLowerCase();

      if (existingRes.rows.length > 0) {
        const actual = existingRes.rows[0];
        if (actual.tipo_reaccion === normalizedTipo) {
          // Toggle OFF: Si pulsó el mismo emoji, se quita la reacción
          await client.query(`DELETE FROM public.feed_reacciones WHERE id = $1;`, [actual.id]);
          accion = 'eliminada';
          reaccionado = false;
        } else {
          // Cambio de tipo de reacción (ej. de 'like' a 'fuego')
          await client.query(
            `UPDATE public.feed_reacciones SET tipo_reaccion = $1, created_at = NOW() WHERE id = $2;`,
            [normalizedTipo, actual.id]
          );
          accion = 'actualizada';
          reaccionado = true;
        }
      } else {
        // Nueva reacción
        await client.query(
          `INSERT INTO public.feed_reacciones (feed_id, family_id, user_id, tipo_reaccion)
           VALUES ($1, $2, $3, $4);`,
          [feedId, familyId, userId, normalizedTipo]
        );
        accion = 'creada';
        reaccionado = true;
      }

      // 3. Consultar conteos consolidados actualizados
      const conteoRes = await client.query(
        `SELECT tipo_reaccion, COUNT(*)::int AS total
         FROM public.feed_reacciones
         WHERE feed_id = $1
         GROUP BY tipo_reaccion;`,
        [feedId]
      );

      const conteoPorTipo: Record<string, number> = {};
      let totalReacciones = 0;

      for (const row of conteoRes.rows) {
        const count = Number(row.total) || 0;
        conteoPorTipo[row.tipo_reaccion] = count;
        totalReacciones += count;
      }

      await client.query('COMMIT');

      return {
        accion,
        tipo: normalizedTipo,
        reaccionado,
        total_reacciones: totalReacciones,
        reacciones_conteo: conteoPorTipo,
        usuario_nombre: usuarioNombre
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Elimina explícitamente una reacción del usuario en una actividad.
   */
  static async eliminarReaccion(feedId: string, userId: string) {
    await FeedService.ensureTables();
    const result = await pool.query(
      `DELETE FROM public.feed_reacciones WHERE feed_id = $1 AND user_id = $2 RETURNING id;`,
      [feedId, userId]
    );

    const conteoRes = await pool.query(
      `SELECT tipo_reaccion, COUNT(*)::int AS total
       FROM public.feed_reacciones
       WHERE feed_id = $1
       GROUP BY tipo_reaccion;`,
      [feedId]
    );

    const conteoPorTipo: Record<string, number> = {};
    let totalReacciones = 0;

    for (const row of conteoRes.rows) {
      const count = Number(row.total) || 0;
      conteoPorTipo[row.tipo_reaccion] = count;
      totalReacciones += count;
    }

    return {
      eliminado: (result.rowCount || 0) > 0,
      total_reacciones: totalReacciones,
      reacciones_conteo: conteoPorTipo
    };
  }
}