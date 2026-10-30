import { pool } from '../../config/db';
import { broadcastFamilyLiveEvent } from '../../utils/eventBroadcaster';

export class RewardRedemptionService {
  /**
   * Canjear recompensa personal (1 vez al día por usuario)
   */
  async redeemReward(userId: string, rewardId: string | number, io?: any) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const rewardRes = await client.query(`
        SELECT id, costo, disponible, es_familiar, family_id, titulo, emoji, metadata 
        FROM public.family_rewards 
        WHERE id = $1 FOR UPDATE;
      `, [rewardId]);

      if (rewardRes.rows.length === 0) {
        throw new Error('La recompensa no existe.');
      }

      const reward = rewardRes.rows[0];

      if (reward.es_familiar) {
        throw new Error('Las recompensas familiares son colaborativas. Usa la opción de colecta familiar.');
      }

      if (!reward.disponible) {
        throw new Error('Esta recompensa ya no se encuentra disponible.');
      }

      const existingCanjeRes = await client.query(`
        SELECT id FROM public.canjes 
        WHERE user_id = $1 AND reward_id = $2 
        AND created_at >= CURRENT_DATE;
      `, [userId, rewardId]);

      if (existingCanjeRes.rows.length > 0) {
        throw new Error('Ya has canjeado esta recompensa personal hoy. Solo se permite un canje diario.');
      }

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
        throw new Error(`No tienes suficientes monedas (${profile.monedas || 0} 🪙) para canjear este premio de ${reward.costo} 🪙.`);
      }

      await client.query(`
        UPDATE public.profiles SET monedas = monedas - $1 WHERE id = $2;
      `, [reward.costo, userId]);

      const insertCanjeRes = await client.query(`
        INSERT INTO public.canjes (reward_id, user_id, family_id, costo_pagado, estado, created_at)
        VALUES ($1, $2, $3, $4, 'pendiente', CURRENT_TIMESTAMP)
        RETURNING id;
      `, [rewardId, userId, profile.family_id, reward.costo]);

      const canjeId = insertCanjeRes.rows[0].id;

      const adminRes = await client.query(`
        SELECT id FROM public.profiles 
        WHERE family_id = $1 AND (LOWER(rol) = 'jefe' OR LOWER(rol) = 'admin') 
        LIMIT 1;
      `, [profile.family_id]);

      if (adminRes.rows.length > 0) {
        const adminId = adminRes.rows[0].id;
        const emojiPremio = reward.emoji || '🎁';
        const titleNoti = '🔔 ¡Nueva solicitud de canje!';
        const descNoti = `${profile.nombre} ha solicitado canjear ${emojiPremio} "${reward.titulo}" (${reward.costo} 🪙).`;

        await client.query(`
          INSERT INTO public.notifications (
            user_id, family_id, sender_id, sender_name, title, desc_text, 
            type, created_at, visual, payload
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'CANJE_SOLICITADO', CURRENT_TIMESTAMP, 
                  '{"icon": "pending_actions", "color": "#FFA000"}'::jsonb, 
                  $7::jsonb);
        `, [adminId, profile.family_id, userId, profile.nombre, titleNoti, descNoti, JSON.stringify({ canje_id: canjeId, reward_id: reward.id })]);

        if (io) {
          broadcastFamilyLiveEvent(io, profile.family_id, {
            tipo: 'CANJE_SOLICITADO',
            user_id: adminId,
            family_id: profile.family_id,
            canje_id: canjeId,
            reward_id: reward.id,
            reward_titulo: reward.titulo,
            usuario_nombre: profile.nombre,
            costo: reward.costo,
            titulo: titleNoti,
            mensaje: descNoti
          });
        }
      }

      await client.query('COMMIT');

      return {
        success: true,
        message: `¡Canje solicitado exitosamente para "${reward.titulo}"! Espera la confirmación del Jefe.`,
        monedas_restantes: profile.monedas - reward.costo
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obtener canjes personales pendientes (Para el panel del Jefe)
   */
  async getPendingCanjes(familyId: string) {
    const result = await pool.query(`
      SELECT c.id, c.reward_id, c.user_id, c.costo_pagado, c.estado, c.created_at,
             p.nombre as usuario_nombre, p.avatar as usuario_avatar,
             r.titulo as reward_titulo, r.emoji as reward_emoji
      FROM public.canjes c
      JOIN public.profiles p ON c.user_id = p.id
      JOIN public.family_rewards r ON c.reward_id = r.id
      WHERE c.family_id = $1 AND c.estado = 'pendiente' AND c.es_colecta = FALSE
      ORDER BY c.created_at DESC;
    `, [familyId]);
    return result.rows;
  }

  /**
   * Aprobar un canje pendiente y notificar al miembro (Solo Jefe de Hogar)
   */
  async approveCanje(adminRole: string, canjeId: string | number, io?: any) {
    const roleNormalized = (adminRole || '').toLowerCase();
    if (roleNormalized !== 'jefe' && roleNormalized !== 'admin') {
      throw new Error('Acceso denegado: Solo el jefe de hogar puede aprobar canjes.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const canjeRes = await client.query(`
        SELECT c.id, c.user_id, c.family_id, c.reward_id, c.costo_pagado, c.estado,
               r.titulo as reward_titulo
        FROM public.canjes c
        JOIN public.family_rewards r ON c.reward_id = r.id
        WHERE c.id = $1 FOR UPDATE;
      `, [canjeId]);

      if (canjeRes.rows.length === 0) {
        throw new Error('La solicitud de canje no existe.');
      }

      const canje = canjeRes.rows[0];

      if (canje.estado !== 'pendiente') {
        throw new Error(`Esta solicitud ya fue procesada anteriormente (${canje.estado}).`);
      }

      await client.query(`
        UPDATE public.canjes SET estado = 'aprobado' WHERE id = $1;
      `, [canjeId]);

      const titleNoti = '🎉 ¡Canje aprobado!';
      const descNoti = `El Jefe aprobó tu solicitud de "${canje.reward_titulo}". ¡Disfrútalo!`;

      await client.query(`
        INSERT INTO public.notifications (
          user_id, family_id, title, desc_text, type, created_at, visual, payload
        )
        VALUES ($1, $2, $3, $4, 'CANJE_APROBADO', CURRENT_TIMESTAMP, 
                '{"icon": "check_circle", "color": "#43A047"}'::jsonb, 
                $5::jsonb);
      `, [canje.user_id, canje.family_id, titleNoti, descNoti, JSON.stringify({ canje_id: canje.id, reward_id: canje.reward_id })]);

      if (io) {
        broadcastFamilyLiveEvent(io, canje.family_id, {
          tipo: 'CANJE_APROBADO',
          user_id: canje.user_id,
          family_id: canje.family_id,
          reward_titulo: canje.reward_titulo,
          canje_id: canje.id,
          titulo: titleNoti,
          mensaje: descNoti
        });
      }

      await client.query('COMMIT');
      return { success: true, message: '¡Canje aprobado exitosamente!' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Rechazar canje pendiente, reembolsar monedas y notificar (Solo Jefe de Hogar)
   */
  async rejectCanje(adminRole: string, canjeId: string | number, motivo?: string, io?: any) {
    const roleNormalized = (adminRole || '').toLowerCase();
    if (roleNormalized !== 'jefe' && roleNormalized !== 'admin') {
      throw new Error('Acceso denegado: Solo el jefe de hogar puede rechazar canjes.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const canjeRes = await client.query(`
        SELECT c.id, c.user_id, c.family_id, c.reward_id, c.costo_pagado, c.estado,
               r.titulo as reward_titulo
        FROM public.canjes c
        JOIN public.family_rewards r ON c.reward_id = r.id
        WHERE c.id = $1 FOR UPDATE;
      `, [canjeId]);

      if (canjeRes.rows.length === 0) {
        throw new Error('La solicitud de canje no existe.');
      }

      const canje = canjeRes.rows[0];

      if (canje.estado !== 'pendiente') {
        throw new Error(`Esta solicitud ya fue procesada anteriormente (${canje.estado}).`);
      }

      await client.query(`
        UPDATE public.canjes SET estado = 'rechazado' WHERE id = $1;
      `, [canjeId]);

      await client.query(`
        UPDATE public.profiles SET monedas = monedas + $1 WHERE id = $2;
      `, [canje.costo_pagado, canje.user_id]);

      const titleNoti = '❌ Solicitud rechazada';
      const motivoText = motivo ? ` Motivo: ${motivo}` : '';
      const descNoti = `El Jefe rechazó tu solicitud de "${canje.reward_titulo}". Tus ${canje.costo_pagado} monedas fueron reembolsadas.${motivoText}`;

      await client.query(`
        INSERT INTO public.notifications (
          user_id, family_id, title, desc_text, type, created_at, visual, payload
        )
        VALUES ($1, $2, $3, $4, 'CANJE_RECHAZADO', CURRENT_TIMESTAMP, 
                '{"icon": "cancel", "color": "#D32F2F"}'::jsonb, 
                $5::jsonb);
      `, [canje.user_id, canje.family_id, titleNoti, descNoti, JSON.stringify({ canje_id: canje.id, reward_id: canje.reward_id, motivo })]);

      if (io) {
        broadcastFamilyLiveEvent(io, canje.family_id, {
          tipo: 'CANJE_RECHAZADO',
          user_id: canje.user_id,
          family_id: canje.family_id,
          reward_titulo: canje.reward_titulo,
          canje_id: canje.id,
          motivo,
          titulo: titleNoti,
          mensaje: descNoti
        });
      }

      await client.query('COMMIT');
      return { success: true, message: 'Canje rechazado y monedas reembolsadas al usuario con éxito.' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
