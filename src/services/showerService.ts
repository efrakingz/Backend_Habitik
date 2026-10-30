import { pool } from '../config/db';
import { LogrosService } from './logrosService';
import { acreditarProgresoUsuario, evaluarLogrosTransversales } from './gamification/progressEngine';

export class ShowerService {
  /**
   * Momento 1: Iniciar ducha en el servidor
   */
  async startShower(userId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const activeRes = await client.query(`
        SELECT id, iniciado_en FROM public.shower_logs
        WHERE user_id = $1 AND estado = 'en_proceso'
        ORDER BY iniciado_en DESC LIMIT 1;
      `, [userId]);

      if (activeRes.rows.length > 0) {
        await client.query('COMMIT');
        return {
          id: activeRes.rows[0].id,
          iniciado_en: activeRes.rows[0].iniciado_en,
          mensaje: 'Ya tenías una ducha activa en curso.'
        };
      }

      const insertRes = await client.query(`
        INSERT INTO public.shower_logs (user_id, duracion_segundos, estado, es_valido, iniciado_en)
        VALUES ($1, 0, 'en_proceso', FALSE, CURRENT_TIMESTAMP)
        RETURNING id, iniciado_en;
      `, [userId]);

      await client.query('COMMIT');
      return insertRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Momento 2: Finalizar ducha, calcular recompensas y disparar logros en lote
   */
  async finishShower(userId: string, duracionSegundosManual?: number) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Obtener la ducha en proceso
      const showerRes = await client.query(`
        SELECT id, iniciado_en FROM public.shower_logs
        WHERE user_id = $1 AND estado = 'en_proceso'
        ORDER BY iniciado_en DESC LIMIT 1
        FOR UPDATE;
      `, [userId]);

      let showerLogId: string | null = null;
      let duracionSegundos = duracionSegundosManual || 0;

      if (showerRes.rows.length > 0) {
        showerLogId = showerRes.rows[0].id;
        const iniciadoEn = new Date(showerRes.rows[0].iniciado_en).getTime();
        duracionSegundos = Math.floor((Date.now() - iniciadoEn) / 1000);
      } else if (!duracionSegundosManual) {
        throw new Error('No hay ninguna ducha activa registrada para finalizar.');
      }

      // 2. Reglas de Negocio del Backend (< 240s = no válido)
      if (duracionSegundos < 240) {
        if (showerLogId) {
          await client.query(`
            UPDATE public.shower_logs
            SET estado = 'invalido', es_valido = FALSE, duracion_segundos = $1, finalizado_en = CURRENT_TIMESTAMP
            WHERE id = $2;
          `, [duracionSegundos, showerLogId]);
        }
        await client.query('COMMIT');

        return {
          recompensas: {
            es_valido: false,
            tiempo_segundos: duracionSegundos,
            xp_ganada: 0,
            monedas_ganadas: 0
          }
        };
      }

      // 3. Escala de recompensas
      let xp = 50;
      let monedas = 0;

      if (duracionSegundos <= 300) {
        xp = 200;
        monedas = 2;
      } else if (duracionSegundos <= 480) {
        xp = 100;
        monedas = 1;
      }

      // 4. Actualizar registro en shower_logs
      const logQuery = showerLogId
        ? client.query(`
            UPDATE public.shower_logs
            SET duracion_segundos = $1, estado = 'valido', es_valido = TRUE,
                xp_otorgada = $2, monedas_otorgadas = $3, finalizado_en = CURRENT_TIMESTAMP
            WHERE id = $4
            RETURNING *;
          `, [duracionSegundos, xp, monedas, showerLogId])
        : client.query(`
            INSERT INTO public.shower_logs (user_id, duracion_segundos, estado, es_valido, xp_otorgada, monedas_otorgadas, finalizado_en)
            VALUES ($1, $2, 'valido', TRUE, $3, $4, CURRENT_TIMESTAMP)
            RETURNING *;
          `, [userId, duracionSegundos, xp, monedas]);

      const logRes = await logQuery;
      const logActualizado = logRes.rows[0];

      // 5. Acreditar XP, monedas, nivel, racha e historial en una sola operación unificada
      const progreso = await acreditarProgresoUsuario({
        userId,
        xpGanada: xp,
        monedasGanadas: monedas,
        origenActividad: 'speedrun_ducha',
        actualizarRacha: true,
      }, client);

      // 6. Evaluar y otorgar todos los logros aplicables en un único lote SQL
      const conteoDuchasRes = await client.query(`
        SELECT COUNT(*)::int AS total 
        FROM public.shower_logs 
        WHERE user_id = $1 AND es_valido = TRUE;
      `, [userId]);
      const totalDuchas = Number(conteoDuchasRes.rows[0]?.total) || 0;

      const codigosBase = ['PRIMERA_DUCHA'];
      if (duracionSegundos <= 240) codigosBase.push('DUCHA_FLASH');
      if (totalDuchas >= 5) codigosBase.push('MEDALLA_DUCHA_BRONCE');

      const todosLosLogros = evaluarLogrosTransversales(
        progreso.racha_dias,
        progreso.saldo_monedas,
        codigosBase
      );

      await LogrosService.otorgarLogrosEnLote(userId, todosLosLogros, client);

      await client.query('COMMIT');

      return {
        log: logActualizado,
        recompensas: {
          es_valido: true,
          tiempo_segundos: duracionSegundos,
          xp_ganada: xp,
          monedas_ganadas: monedas,
          total_xp: progreso.total_xp,
          saldo_monedas: progreso.saldo_monedas,
          nivel_actual: progreso.nivel_actual,
          level_up: progreso.level_up,
          racha_dias: progreso.racha_dias
        }
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
