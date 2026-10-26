import { pool } from '../config/db';

export class LogrosService {
  /**
   * Otorga un logro a un usuario si cumple los criterios.
   * Permite recibir un cliente de BD externo (dbClient) para integrarse 
   * en transacciones existentes sin saturar o bloquear el pool.
   */
  static async otorgarLogroSiAplica(userId: string, codigoLogro: string, dbClient?: any) {
    const client = dbClient || await pool.connect();
    const esConexionPropia = !dbClient;

    try {
      if (esConexionPropia) {
        await client.query('BEGIN');
      }

      const logroRes = await client.query(
        `SELECT id FROM public.logros WHERE codigo = $1;`,
        [codigoLogro]
      );

      if (logroRes.rows.length > 0) {
        const logroId = logroRes.rows[0].id;

        // Registrar desbloqueo si no existe previamente
        await client.query(
          `INSERT INTO public.usuario_logros (user_id, logro_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, logro_id) DO NOTHING;`,
          [userId, logroId]
        );
      }

      if (esConexionPropia) {
        await client.query('COMMIT');
      }
    } catch (error) {
      if (esConexionPropia) {
        await client.query('ROLLBACK');
      }
      console.error(`Error al otorgar logro ${codigoLogro}:`, error);
    } finally {
      if (esConexionPropia) {
        client.release();
      }
    }
  }

  /**
   * Obtiene la lista de logros del catálogo y su estado para un usuario
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
   * Reclama las monedas de un logro desbloqueado.
   * Acepta tanto el id del catálogo (logros.id) como el registro (usuario_logros.id).
   */
  static async reclamarRecompensa(userId: string, logroId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Buscar coincidencia flexible por ID de catálogo o ID de registro
      const ulRes = await client.query(
        `SELECT ul.id, l.monedas_recompensa, ul.reclamado
         FROM public.usuario_logros ul
         JOIN public.logros l ON ul.logro_id = l.id
         WHERE ul.user_id = $1 AND (ul.logro_id = $2 OR ul.id = $2 OR l.id = $2);`,
        [userId, logroId]
      );

      if (ulRes.rows.length === 0) {
        throw new Error('Aún no has desbloqueado este logro.');
      }

      if (ulRes.rows[0].reclamado) {
        throw new Error('Este logro ya fue reclamado previamente.');
      }

      const monedasAGanar = ulRes.rows[0].monedas_recompensa;
      const usuarioLogroId = ulRes.rows[0].id;

      // 2. Marcar como reclamado usando la clave primaria del registro
      await client.query(
        `UPDATE public.usuario_logros 
         SET reclamado = true 
         WHERE id = $1;`,
        [usuarioLogroId]
      );

      // 3. Sumar monedas al perfil del usuario
      const profRes = await client.query(
        `UPDATE public.profiles
         SET monedas = COALESCE(monedas, 0) + $1
         WHERE id = $2
         RETURNING monedas;`,
        [monedasAGanar, userId]
      );

      // 4. Auditoría en el historial de gamificación
      await client.query(
        `INSERT INTO public.historial_gamificacion (user_id, origen_actividad, monedas_otorgadas, xp_otorgada)
         VALUES ($1, 'logro', $2, 0);`,
        [userId, monedasAGanar]
      );

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
   * Reclamar recompensa de 10 monedas por cada nivel subido.
   */
  static async reclamarRecompensaNivel(userId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const profRes = await client.query(
        `SELECT nivel, ultimo_nivel_reclamado, monedas, xp FROM public.profiles WHERE id = $1 FOR UPDATE;`, 
        [userId]
      );

      if (profRes.rows.length === 0) throw new Error('Perfil no encontrado.');

      const perfil = profRes.rows[0];
      
      const nivelRes = await client.query(
        `SELECT public.obtener_nivel_usuario($1) AS nivel_actual;`,
        [userId]
      );
      
      const nivelSql = nivelRes.rows[0]?.nivel_actual;
      const xpUser = perfil.xp || 0;
      const nivelAlgoritmico = Math.min(99, Math.floor(xpUser / 500) + 1);
      
      const nivelActual = nivelSql || nivelAlgoritmico || 1;
      const ultimoReclamado = perfil.ultimo_nivel_reclamado || 1;

      const nivelesPorCobrar = nivelActual - ultimoReclamado;

      if (nivelesPorCobrar <= 0) {
        await client.query('ROLLBACK');
        return { 
          exito: false, 
          mensaje: 'No tienes nuevas recompensas de nivel pendientes por reclamar.' 
        };
      }

      const monedasGanadas = nivelesPorCobrar * 10;
      const nuevoSaldo = (perfil.monedas || 0) + monedasGanadas;

      await client.query(`
        UPDATE public.profiles 
        SET monedas = $1, ultimo_nivel_reclamado = $2 
        WHERE id = $3;
      `, [nuevoSaldo, nivelActual, userId]);

      await client.query(`
        INSERT INTO public.historial_gamificacion (user_id, origen_actividad, monedas_otorgadas, xp_otorgada)
        VALUES ($1, 'recompensa_nivel', $2, 0);
      `, [userId, monedasGanadas]);

      await client.query('COMMIT');

      return {
        exito: true,
        mensaje: `¡Has reclamado ${monedasGanadas} monedas por subir ${nivelesPorCobrar} nivel(es)!`,
        monedas_ganadas: monedasGanadas,
        nuevo_saldo: nuevoSaldo,
        ultimo_nivel_reclamado: nivelActual
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Consulta el nivel calculado algorítmicamente desde PostgreSQL
   * o calcula la equivalencia con la fórmula Floor(XP / 500) + 1
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