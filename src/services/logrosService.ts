import { pool } from '../config/db';

export class LogrosService {
  /**
   * Otorga múltiples logros en una sola consulta SQL atómica (1 solo round-trip).
   */
  static async otorgarLogrosEnLote(userId: string, codigosLogro: string[], dbClient?: any): Promise<void> {
    const codigosUnicos = Array.from(new Set(codigosLogro.filter(Boolean)));
    if (codigosUnicos.length === 0) return;

    const executor = dbClient || pool;
    try {
      await executor.query(
        `INSERT INTO public.usuario_logros (user_id, logro_id)
         SELECT $1, id
         FROM public.logros
         WHERE codigo = ANY($2::text[])
         ON CONFLICT (user_id, logro_id) DO NOTHING;`,
        [userId, codigosUnicos]
      );
    } catch (error) {
      console.error(`Error al otorgar logros en lote [${codigosUnicos.join(', ')}]:`, error);
    }
  }

  /**
   * Otorga un logro individual delegando al motor en lote (1 sola consulta SQL).
   */
  static async otorgarLogroSiAplica(userId: string, codigoLogro: string, dbClient?: any): Promise<void> {
    await LogrosService.otorgarLogrosEnLote(userId, [codigoLogro], dbClient);
  }

  /**
   * Obtiene la vitrina de logros del usuario
   */
  static async obtenerLogrosUsuario(userId: string) {
    const query = `
      SELECT 
        l.id,
        l.codigo,
        l.titulo,
        l.descripcion,
        l.monedas_recompensa,
        (ul.id IS NOT NULL) AS desbloqueado,
        COALESCE(ul.reclamado, false) AS reclamado,
        ul.fecha_desbloqueo
      FROM public.logros l
      LEFT JOIN public.usuario_logros ul 
        ON l.id = ul.logro_id AND ul.user_id = $1
      ORDER BY l.created_at ASC;
    `;
    const res = await pool.query(query, [userId]);
    return res.rows;
  }

  /**
   * Reclama las monedas de un logro desbloqueado
   */
  static async reclamarRecompensa(userId: string, logroId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const ulRes = await client.query(`
        SELECT ul.id, l.monedas_recompensa, ul.reclamado
        FROM public.usuario_logros ul
        JOIN public.logros l ON ul.logro_id = l.id
        WHERE ul.user_id = $1 AND (ul.logro_id = $2 OR ul.id = $2 OR l.id = $2)
        FOR UPDATE OF ul;
      `, [userId, logroId]);

      if (ulRes.rows.length === 0) {
        throw new Error('Aún no has desbloqueado este logro.');
      }

      if (ulRes.rows[0].reclamado) {
        throw new Error('Este logro ya fue reclamado previamente.');
      }

      const monedasAGanar = ulRes.rows[0].monedas_recompensa;
      const registroId = ulRes.rows[0].id;

      await client.query(`
        UPDATE public.usuario_logros 
        SET reclamado = true 
        WHERE id = $1;
      `, [registroId]);

      const profRes = await client.query(`
        UPDATE public.profiles
        SET monedas = COALESCE(monedas, 0) + $1
        WHERE id = $2
        RETURNING monedas;
      `, [monedasAGanar, userId]);

      await client.query(`
        INSERT INTO public.historial_gamificacion (user_id, origen_actividad, monedas_otorgadas, xp_otorgada)
        VALUES ($1, 'logro', $2, 0);
      `, [userId, monedasAGanar]);

      await client.query('COMMIT');

      return {
        exito: true,
        monedas_ganadas: monedasAGanar,
        saldo_monedas: profRes.rows[0]?.monedas
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Calcula el nivel del usuario con la fórmula estándar Floor(XP / 500) + 1 (máximo 99)
   */
  static async obtenerNivelCalculado(userId: string) {
    const res = await pool.query(
      `SELECT public.obtener_nivel_usuario($1) AS nivel_actual, p.xp 
       FROM public.profiles p 
       WHERE p.id = $1;`,
      [userId]
    );

    if (res.rows.length === 0) return 1;

    const nivelSql = res.rows[0]?.nivel_actual;
    const xpUser = res.rows[0]?.xp || 0;
    const nivelAlgoritmico = Math.min(99, Math.floor(xpUser / 500) + 1);

    return nivelSql || nivelAlgoritmico;
  }
}
