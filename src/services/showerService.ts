import { pool } from '../config/db';
import { StreakService } from './streakService';
import { LogrosService } from './logrosService';

export class ShowerService {
  /**
   * Momento 1: Iniciar ducha en el servidor
   */
  async startShower(userId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Buscar si ya existe una ducha en proceso
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

      // Crear nuevo registro de inicio
      const insertRes = await client.query(`
        INSERT INTO public.shower_logs (user_id, estado, es_valido, iniciado_en)
        VALUES ($1, 'en_proceso', FALSE, CURRENT_TIMESTAMP)
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
   * Momento 2: Finalizar ducha, calcular recompensas y disparar logros automáticamente
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
        const ahora = Date.now();
        duracionSegundos = Math.floor((ahora - iniciadoEn) / 1000);
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
      let xp = 0;
      let monedas = 0;

      if (duracionSegundos <= 300) {
        xp = 200;
        monedas = 2;
      } else if (duracionSegundos <= 480) {
        xp = 100;
        monedas = 1;
      } else {
        xp = 50;
        monedas = 0;
      }

      // 4. Actualizar saldo del perfil
      const prof = await client.query(`
        SELECT xp, monedas, nivel FROM public.profiles WHERE id = $1 FOR UPDATE;
      `, [userId]);

      if (prof.rows.length === 0) throw new Error('Perfil no encontrado.');

      const currentXp = prof.rows[0].xp || 0;
      const currentNivel = prof.rows[0].nivel || 1;
      const totalXp = currentXp + xp;
      const saldoMonedas = (prof.rows[0].monedas || 0) + monedas;

      await client.query(`
        UPDATE public.profiles
        SET xp = $1, monedas = $2
        WHERE id = $3;
      `, [totalXp, saldoMonedas, userId]);

      // 5. Recalcular nivel dinámico mediante SQL
      const nivelRes = await client.query(`SELECT public.obtener_nivel_usuario($1) AS nuevo_nivel;`, [userId]);
      const nuevoNivel = nivelRes.rows[0]?.nuevo_nivel || Math.min(99, Math.floor(totalXp / 500) + 1);
      const levelUp = nuevoNivel > currentNivel;

      await client.query(`
        UPDATE public.profiles
        SET nivel = $1
        WHERE id = $2;
      `, [nuevoNivel, userId]);

      // 6. Actualizar registro en shower_logs e historial
      let logActualizado = null;
      if (showerLogId) {
        const updateLogRes = await client.query(`
          UPDATE public.shower_logs
          SET 
            duracion_segundos = $1,
            estado = 'valido',
            es_valido = TRUE,
            xp_otorgada = $2,
            monedas_otorgadas = $3,
            finalizado_en = CURRENT_TIMESTAMP
          WHERE id = $4
          RETURNING *;
        `, [duracionSegundos, xp, monedas, showerLogId]);
        logActualizado = updateLogRes.rows[0];
      } else {
        const insertLogRes = await client.query(`
          INSERT INTO public.shower_logs (user_id, duracion_segundos, estado, es_valido, xp_otorgada, monedas_otorgadas, finalizado_en)
          VALUES ($1, $2, 'valido', TRUE, $3, $4, CURRENT_TIMESTAMP)
          RETURNING *;
        `, [userId, duracionSegundos, xp, monedas]);
        logActualizado = insertLogRes.rows[0];
      }

      const streak = await StreakService.actualizarRachaDiaria(client, userId);

      await client.query(`
        INSERT INTO public.historial_gamificacion (user_id, origen_actividad, monedas_otorgadas, xp_otorgada)
        VALUES ($1, 'speedrun_ducha', $2, $3);
      `, [userId, monedas, xp]);

      // 7. 🏆 DISPARADORES DE LOGROS AUTOMÁTICOS
      await LogrosService.otorgarLogroSiAplica(userId, 'PRIMERA_DUCHA', client);

      if (duracionSegundos <= 240) {
        await LogrosService.otorgarLogroSiAplica(userId, 'DUCHA_FLASH', client);
      }

      // Conteo acumulativo de duchas válidas
      const conteoDuchasRes = await client.query(`
        SELECT COUNT(*) AS total 
        FROM public.shower_logs 
        WHERE user_id = $1 AND es_valido = TRUE;
      `, [userId]);
      const totalDuchas = parseInt(conteoDuchasRes.rows[0]?.total || '0', 10);

      if (totalDuchas >= 5) {
        await LogrosService.otorgarLogroSiAplica(userId, 'MEDALLA_DUCHA_BRONCE', client);
      }

      if (streak.racha_dias >= 3) {
        await LogrosService.otorgarLogroSiAplica(userId, 'RACHA_3', client);
      }
      if (streak.racha_dias >= 7) {
        await LogrosService.otorgarLogroSiAplica(userId, 'RACHA_7', client);
      }

      if (saldoMonedas >= 100) {
        await LogrosService.otorgarLogroSiAplica(userId, 'BILLETERA_ECO', client);
      }

      await client.query('COMMIT');

      return {
        log: logActualizado,
        recompensas: {
          es_valido: true,
          tiempo_segundos: duracionSegundos,
          xp_ganada: xp,
          monedas_ganadas: monedas,
          total_xp: totalXp,
          saldo_monedas: saldoMonedas,
          nivel_actual: nuevoNivel,
          level_up: levelUp,
          racha_dias: streak.racha_dias
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