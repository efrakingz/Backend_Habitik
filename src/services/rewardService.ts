import { pool } from '../config/db';

export class RewardService {
  /**
   * Crear recompensa (Exclusivo para el Jefe de Hogar).
   */
  static async crearRecompensaFamiliar(
    jefeId: string, 
    titulo: string, 
    descripcion: string, 
    costoMonedas: number, 
    esFamiliar: boolean
  ) {
    const client = await pool.connect();
    try {
      const profileRes = await client.query(
        'SELECT family_id, rol FROM public.profiles WHERE id = $1', 
        [jefeId]
      );
      const profile = profileRes.rows[0];

      if (!profile || profile.rol !== 'jefe') {
        throw new Error('Solo el Jefe de Hogar tiene permisos para crear recompensas.');
      }

      const insertRes = await client.query(`
        INSERT INTO public.family_rewards (family_id, titulo, descripcion, costo, es_familiar, creador_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `, [profile.family_id, titulo, descripcion, costoMonedas, esFamiliar, jefeId]);

      return insertRes.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Listar recompensas disponibles para la familia.
   */
  static async listarRecompensasFamiliares(userId: string) {
    const client = await pool.connect();
    try {
      const profileRes = await client.query('SELECT family_id FROM public.profiles WHERE id = $1', [userId]);
      const familyId = profileRes.rows[0]?.family_id;

      if (!familyId) throw new Error('El usuario no pertenece a ninguna familia.');

      const rewardsRes = await client.query(`
        SELECT * FROM public.family_rewards
        WHERE family_id = $1 AND disponible = TRUE
        ORDER BY created_at DESC;
      `, [familyId]);

      return rewardsRes.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Canjear Recompensa con la regla de frecuencia:
   * - Individual (es_familiar = false): 1 canje diario por usuario.
   * - Familiar (es_familiar = true): 1 canje mensual para toda la familia.
   */
  static async canjearRecompensaFamiliar(userId: string, rewardId: number) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Obtener la recompensa
      const rewardRes = await client.query(
        'SELECT * FROM public.family_rewards WHERE id = $1 AND disponible = TRUE FOR UPDATE;', 
        [rewardId]
      );
      const reward = rewardRes.rows[0];

      if (!reward) throw new Error('La recompensa seleccionada no está disponible.');

      // 2. Obtener perfil de usuario y verificar monedas
      const profileRes = await client.query(
        'SELECT family_id, monedas FROM public.profiles WHERE id = $1 FOR UPDATE;', 
        [userId]
      );
      const profile = profileRes.rows[0];

      if (!profile) throw new Error('Perfil de usuario no encontrado.');
      if (profile.family_id !== reward.family_id) {
        throw new Error('Esta recompensa no pertenece a tu grupo familiar.');
      }
      if ((profile.monedas || 0) < reward.costo) {
        throw new Error('No tienes suficientes monedas para realizar este canje.');
      }

      // 3. Validar restricción contra la tabla 'canjes'
      if (reward.es_familiar) {
        // ACTIVIDAD FAMILIAR: Máximo 1 al mes para la familia
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const checkFamily = await client.query(`
          SELECT id FROM public.canjes
          WHERE reward_id = $1 AND family_id = $2 AND created_at >= $3;
        `, [rewardId, profile.family_id, startOfMonth.toISOString()]);

        if (checkFamily.rows.length > 0) {
          throw new Error('Esta actividad familiar ya fue canjeada este mes por un integrante del hogar.');
        }
      } else {
        // RECOMPENSA INDIVIDUAL: Máximo 1 al día por usuario
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const checkUserDaily = await client.query(`
          SELECT id FROM public.canjes
          WHERE reward_id = $1 AND user_id = $2 AND created_at >= $3;
        `, [rewardId, userId, startOfDay.toISOString()]);

        if (checkUserDaily.rows.length > 0) {
          throw new Error('Ya canjeaste esta recompensa hoy. Puedes volver a canjearla mañana.');
        }
      }

      // 4. Descontar monedas y registrar en 'canjes'
      const nuevoSaldo = profile.monedas - reward.costo;
      await client.query('UPDATE public.profiles SET monedas = $1 WHERE id = $2;', [nuevoSaldo, userId]);

      const redemptionRes = await client.query(`
        INSERT INTO public.canjes (reward_id, user_id, family_id, costo_pagado)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
      `, [rewardId, userId, profile.family_id, reward.costo]);

      if (reward.es_familiar) {
        await client.query('UPDATE public.family_rewards SET disponible = FALSE, last_redeemed_at = NOW() WHERE id = $1;', [rewardId]);
      } else {
        await client.query('UPDATE public.family_rewards SET last_redeemed_at = NOW() WHERE id = $1;', [rewardId]);
      }

      await client.query('COMMIT');

      return {
        exito: true,
        recompensa: reward.titulo,
        costo: reward.costo,
        monedas_restantes: nuevoSaldo,
        canje: redemptionRes.rows[0]
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reactivar manualmente un premio (Exclusivo Jefe de Hogar).
   */
  static async reactivarRecompensaManual(jefeId: string, rewardId: number, targetUserId?: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const profileRes = await client.query('SELECT family_id, rol FROM public.profiles WHERE id = $1', [jefeId]);
      const profile = profileRes.rows[0];

      if (!profile || profile.rol !== 'jefe') {
        throw new Error('Solo el Jefe de Hogar tiene permisos para reactivar recompensas.');
      }

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      if (targetUserId) {
        await client.query(`
          DELETE FROM public.canjes 
          WHERE reward_id = $1 AND user_id = $2 AND created_at >= $3;
        `, [rewardId, targetUserId, startOfMonth.toISOString()]);
      } else {
        await client.query(`
          DELETE FROM public.canjes 
          WHERE reward_id = $1 AND created_at >= $2;
        `, [rewardId, startOfMonth.toISOString()]);
      }

      await client.query('UPDATE public.family_rewards SET disponible = TRUE WHERE id = $1;', [rewardId]);

      await client.query('COMMIT');

      return { exito: true, message: 'Recompensa reactivada exitosamente por el Jefe de Hogar.' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}