import { pool } from '../config/db';

export class RewardService {
  
  /**
   * 1. Listar todas las recompensas de la familia
   */
  async getRewardsByFamily(familyId: string) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT id, titulo, descripcion, emoji, costo, disponible, es_familiar, created_at, last_redeemed_at, metadata
        FROM public.family_rewards
        WHERE family_id = $1
        ORDER BY created_at DESC;
      `, [familyId]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * 2. Crear recompensa (Restringido exclusivamente al rol 'admin' / Jefe de Hogar)
   */
  async createReward(userId: string, userRole: string, familyId: string, data: { titulo: string; descripcion: string; emoji?: string; costo: number; es_familiar: boolean; metadata?: any }) {
    if (userRole !== 'admin') {
      throw new Error('Acceso denegado: Solo el jefe de hogar puede crear recompensas.');
    }

    const { titulo, descripcion, emoji, costo, es_familiar, metadata } = data;
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        INSERT INTO public.family_rewards (family_id, titulo, descripcion, emoji, costo, disponible, creador_id, es_familiar, metadata)
        VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7, $8)
        RETURNING id, titulo, descripcion, emoji, costo, disponible, es_familiar, metadata;
      `, [familyId, titulo, descripcion, emoji || '🎁', costo, userId, es_familiar, metadata || JSON.stringify({ frecuencia: 'semanal' })]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * 3. Canjear recompensa (Valida saldo, cooldown familiar o límite diario personal, registra canje y avisa al admin)
   */
  async redeemReward(userId: string, rewardId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Obtener y bloquear el premio
      const rewardRes = await client.query(`
        SELECT id, costo, disponible, es_familiar, family_id, titulo, last_redeemed_at, metadata 
        FROM public.family_rewards 
        WHERE id = $1 FOR UPDATE;
      `, [rewardId]);

      if (rewardRes.rows.length === 0) {
        throw new Error('La recompensa no existe.');
      }

      const reward = rewardRes.rows[0];

      if (!reward.disponible) {
        throw new Error('Esta recompensa ya no se encuentra disponible.');
      }

      // ─────────────────────────────────────────────────────────────────
      // A. VALIDACIÓN PARA RECOMPENSAS FAMILIARES (Cooldown semanal o mensual)
      // ─────────────────────────────────────────────────────────────────
      if (reward.es_familiar && reward.last_redeemed_at) {
        const lastRedeemed = new Date(reward.last_redeemed_at);
        const now = new Date();
        
        const frecuencia = reward.metadata?.frecuencia || 'semanal'; 
        let limitMilliseconds = 7 * 24 * 60 * 60 * 1000; // 7 días por defecto
        let textoTiempo = 'una semana';

        if (frecuencia === 'mensual') {
          limitMilliseconds = 30 * 24 * 60 * 60 * 1000; // 30 días aprox
          textoTiempo = 'un mes';
        }

        const diferenciaTiempo = now.getTime() - lastRedeemed.getTime();

        if (diferenciaTiempo < limitMilliseconds) {
          throw new Error(`Esta recompensa familiar ya fue canjeada recientemente. Estará disponible nuevamente en ${textoTiempo}.`);
        }
      }

      // ─────────────────────────────────────────────────────────────────
      // B. VALIDACIÓN PARA RECOMPENSAS PERSONALES / INDIVIDUALES (Máximo 1 vez por día por usuario)
      // ─────────────────────────────────────────────────────────────────
      if (!reward.es_familiar) {
        const existingCanjeRes = await client.query(`
          SELECT id FROM public.canjes 
          WHERE user_id = $1 AND reward_id = $2 
          AND created_at >= CURRENT_DATE;
        `, [userId, rewardId]);

        if (existingCanjeRes.rows.length > 0) {
          throw new Error('Ya has canjeado esta recompensa personal hoy. Solo se permite un canje por día.');
        }
      }

      // Obtener perfil y saldo del usuario
      const profileRes = await client.query(`
        SELECT id, nombre, monedas, family_id FROM public.profiles WHERE id = $1 FOR UPDATE;
      `, [userId]);

      if (profileRes.rows.length === 0) {
        throw new Error('Perfil de usuario no encontrado.');
      }

      const profile = profileRes.rows[0];

      if (profile.family_id !== reward.family_id) {
        throw new Error('No puedes canjear recompensas de otra familia.');
      }

      if ((profile.monedas || 0) < reward.costo) {
        throw new Error('No tienes suficientes monedas para canjear este premio.');
      }

      // Descontar monedas
      await client.query(`
        UPDATE public.profiles SET monedas = monedas - $1 WHERE id = $2;
      `, [reward.costo, userId]);

      // Actualizar la fecha del último canje del premio (para las familiares)
      await client.query(`
        UPDATE public.family_rewards 
        SET last_redeemed_at = CURRENT_TIMESTAMP 
        WHERE id = $1;
      `, [rewardId]);

      // Registrar el canje en la tabla 'canjes'
      await client.query(`
        INSERT INTO public.canjes (reward_id, user_id, family_id, costo_pagado)
        VALUES ($1, $2, $3, $4);
      `, [rewardId, userId, profile.family_id, reward.costo]);

      // Enviar Notificación automática al Jefe de Hogar con estilo mejorado
      const adminRes = await client.query(`
        SELECT id FROM public.profiles WHERE family_id = $1 AND rol = 'Jefe' LIMIT 1;
      `, [profile.family_id]);

      if (adminRes.rows.length > 0) {
        const adminId = adminRes.rows[0].id;
        
        const emojiPremio = reward.emoji || '🎁';
        const tipoTexto = reward.es_familiar ? 'familiar 👨‍👩‍👧‍👦' : 'personal 👤';

        const titleNoti = `🎉 ¡Nuevo canje ${tipoTexto}!`;
        const descNoti = `${profile.nombre || 'Un integrante'} ha canjeado ${emojiPremio} "${reward.titulo}" por un costo de ${reward.costo} monedas 🪙.`;
        
        await client.query(`
          INSERT INTO public.notifications (user_id, title, desc_text, is_read, family_id, type, created_at)
          VALUES ($1, $2, $3, FALSE, $4, 'reward', CURRENT_TIMESTAMP);
        `, [adminId, titleNoti, descNoti, profile.family_id]);
      }

      // ⚠️ ¡CLAVE! Confirmar los cambios en la base de datos
      await client.query('COMMIT');

      return {
        success: true,
        message: `¡Canje exitoso de recompensa ${reward.es_familiar ? 'familiar' : 'personal'} ("${reward.titulo}")!`,
        monedas_restantes: profile.monedas - reward.costo
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}