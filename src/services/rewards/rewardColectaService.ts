import { pool } from '../../config/db';
import { broadcastFamilyLiveEvent } from '../../utils/eventBroadcaster';
import { LogrosService } from '../logrosService';

export class RewardColectaService {
  /**
   * Iniciar o aportar a una colecta familiar colaborativa.
   * Divide el costo equitativamente entre todos los miembros de la familia usando batch UNNEST.
   * Al llegar al 100%, se auto-completa y queda canjeada para toda la familia.
   */
  async startOrContributeColecta(
    userId: string,
    familyId: string,
    rewardId: string | number,
    io?: any
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Obtener y bloquear el premio
      const rewardRes = await client.query(`
        SELECT id, titulo, emoji, costo, es_familiar, disponible, family_id, last_redeemed_at, metadata
        FROM public.family_rewards
        WHERE id = $1 FOR UPDATE;
      `, [rewardId]);

      if (rewardRes.rows.length === 0) {
        throw new Error('La recompensa familiar no existe.');
      }

      const reward = rewardRes.rows[0];

      if (!reward.es_familiar) {
        throw new Error('Esta recompensa es de tipo personal. Usa el canje individual.');
      }

      if (!reward.disponible) {
        throw new Error('Esta recompensa ya no está disponible.');
      }

      // Validar cooldown familiar
      if (reward.last_redeemed_at) {
        const lastRedeemed = new Date(reward.last_redeemed_at);
        const now = new Date();
        const frecuencia = reward.metadata?.frecuencia || 'semanal';
        let limitMs = 7 * 24 * 60 * 60 * 1000;
        let textoTiempo = 'una semana';

        if (frecuencia === 'mensual') {
          limitMs = 30 * 24 * 60 * 60 * 1000;
          textoTiempo = 'un mes';
        } else if (frecuencia === 'unico') {
          throw new Error('Esta recompensa familiar de tipo único ya fue canjeada anteriormente.');
        }

        if (now.getTime() - lastRedeemed.getTime() < limitMs) {
          throw new Error(`Esta recompensa familiar ya fue canjeada recientemente. Estará disponible en ${textoTiempo}.`);
        }
      }

      // Obtener saldo del usuario actual
      const userRes = await client.query(`
        SELECT id, nombre, monedas FROM public.profiles WHERE id = $1 FOR UPDATE;
      `, [userId]);
      const currentUser = userRes.rows[0];

      // 2. Buscar si ya existe una colecta en curso para este premio
      const existingCanjeRes = await client.query(`
        SELECT id, total_requerido, total_recaudado, estado
        FROM public.canjes
        WHERE reward_id = $1 AND family_id = $2 AND es_colecta = TRUE AND estado = 'recaudando'
        FOR UPDATE;
      `, [rewardId, familyId]);

      let canjeId: string;
      let totalRequerido = reward.costo;
      let nuevoRecaudado = 0;
      let cuotaUsuario = 0;
      let esNuevoInicio = false;

      if (existingCanjeRes.rows.length === 0) {
        // --- INICIAR NUEVA COLECTA ---
        esNuevoInicio = true;
        const membersRes = await client.query(`
          SELECT id, nombre, rol, monedas 
          FROM public.profiles 
          WHERE family_id = $1 
          ORDER BY (CASE WHEN LOWER(rol) = 'jefe' THEN 1 ELSE 2 END), created_at ASC;
        `, [familyId]);

        const members = membersRes.rows;
        if (members.length === 0) {
          throw new Error('No hay integrantes en esta familia.');
        }

        const N = members.length;
        const baseQuota = Math.floor(reward.costo / N);
        const remainder = reward.costo % N;

        const insertCanjeRes = await client.query(`
          INSERT INTO public.canjes (
            reward_id, user_id, family_id, costo_pagado, estado, 
            es_colecta, total_requerido, total_recaudado, created_at
          )
          VALUES ($1, $2, $3, 0, 'recaudando', TRUE, $4, 0, CURRENT_TIMESTAMP)
          RETURNING id;
        `, [rewardId, userId, familyId, totalRequerido]);

        canjeId = insertCanjeRes.rows[0].id;

        const canjeIds: string[] = [];
        const userIds: string[] = [];
        const cuotas: number[] = [];

        for (let i = 0; i < N; i++) {
          const m = members[i];
          const cuota = baseQuota + (i < remainder ? 1 : 0);
          if (m.id === userId) {
            cuotaUsuario = cuota;
          }
          canjeIds.push(canjeId);
          userIds.push(m.id);
          cuotas.push(cuota);
        }

        if (currentUser.monedas < cuotaUsuario) {
          throw new Error(`No tienes suficientes monedas (${currentUser.monedas} 🪙) para pagar tu cuota inicial de ${cuotaUsuario} 🪙.`);
        }

        // Batch INSERT de todos los aportes en un solo round-trip usando UNNEST
        await client.query(`
          INSERT INTO public.canje_aportes (canje_id, user_id, monto_asignado, monto_pagado, pagado)
          SELECT c_id, u_id, cuota, 0, FALSE
          FROM UNNEST($1::uuid[], $2::uuid[], $3::int[]) AS t(c_id, u_id, cuota);
        `, [canjeIds, userIds, cuotas]);

        // Pagar la cuota del usuario actual
        await client.query(`
          UPDATE public.profiles SET monedas = monedas - $1 WHERE id = $2;
        `, [cuotaUsuario, userId]);

        await client.query(`
          UPDATE public.canje_aportes 
          SET monto_pagado = $1, pagado = TRUE, pagado_en = CURRENT_TIMESTAMP 
          WHERE canje_id = $2 AND user_id = $3;
        `, [cuotaUsuario, canjeId, userId]);

        nuevoRecaudado = cuotaUsuario;
        await client.query(`
          UPDATE public.canjes 
          SET total_recaudado = $1, costo_pagado = $1 
          WHERE id = $2;
        `, [nuevoRecaudado, canjeId]);

      } else {
        // --- APORTAR A COLECTA EXISTENTE ---
        const canjeActual = existingCanjeRes.rows[0];
        canjeId = canjeActual.id;
        totalRequerido = canjeActual.total_requerido;

        const aporteRes = await client.query(`
          SELECT id, monto_asignado, pagado 
          FROM public.canje_aportes 
          WHERE canje_id = $1 AND user_id = $2 
          FOR UPDATE;
        `, [canjeId, userId]);

        if (aporteRes.rows.length === 0) {
          throw new Error('No estabas registrado en esta colecta familiar.');
        }

        const aporte = aporteRes.rows[0];
        if (aporte.pagado) {
          throw new Error('Ya has aportado tu cuota para este canje familiar.');
        }

        cuotaUsuario = aporte.monto_asignado;

        if (currentUser.monedas < cuotaUsuario) {
          throw new Error(`No tienes suficientes monedas (${currentUser.monedas} 🪙) para aportar tu cuota de ${cuotaUsuario} 🪙.`);
        }

        await client.query(`
          UPDATE public.profiles SET monedas = monedas - $1 WHERE id = $2;
        `, [cuotaUsuario, userId]);

        await client.query(`
          UPDATE public.canje_aportes 
          SET monto_pagado = $1, pagado = TRUE, pagado_en = CURRENT_TIMESTAMP 
          WHERE id = $2;
        `, [cuotaUsuario, aporte.id]);

        nuevoRecaudado = canjeActual.total_recaudado + cuotaUsuario;
        await client.query(`
          UPDATE public.canjes 
          SET total_recaudado = $1, costo_pagado = $1 
          WHERE id = $2;
        `, [nuevoRecaudado, canjeId]);
      }

      // 3. Verificar si se completó el 100% de la colecta
      const autoCompletada = nuevoRecaudado >= totalRequerido;

      if (autoCompletada) {
        await client.query(`
          UPDATE public.canjes 
          SET estado = 'completado' 
          WHERE id = $1;
        `, [canjeId]);

        await client.query(`
          UPDATE public.family_rewards 
          SET last_redeemed_at = CURRENT_TIMESTAMP 
          WHERE id = $1;
        `, [rewardId]);

        const titleFamily = '🏆 ¡Meta familiar lograda!';
        const descFamily = `¡Toda la familia aportó y completaron "${reward.titulo}"! El premio ha sido canjeado exitosamente.`;

        await client.query(`
          INSERT INTO public.notifications (
            family_id, title, desc_text, type, created_at, visual, payload
          )
          VALUES ($1, $2, $3, 'COLECTA_COMPLETADA', CURRENT_TIMESTAMP, 
                  '{"icon": "celebration", "color": "#FFA000"}'::jsonb, 
                  $4::jsonb);
        `, [familyId, titleFamily, descFamily, JSON.stringify({ reward_id: reward.id, canje_id: canjeId })]);

        if (io) {
          broadcastFamilyLiveEvent(io, familyId, {
            tipo: 'COLECTA_COMPLETADA',
            family_id: familyId,
            reward_id: reward.id,
            reward_titulo: reward.titulo,
            titulo: titleFamily,
            mensaje: descFamily
          });
        }
      } else {
        const titleNoti = esNuevoInicio
          ? `🤝 ¡Nueva colecta familiar: ${reward.titulo}!`
          : `🪙 ¡Aporte registrado a ${reward.titulo}!`;
        const descNoti = esNuevoInicio
          ? `${currentUser.nombre} inició la colecta aportando ${cuotaUsuario} 🪙. Faltan ${totalRequerido - nuevoRecaudado} 🪙 para completarla.`
          : `${currentUser.nombre} aportó ${cuotaUsuario} 🪙. Van ${nuevoRecaudado} de ${totalRequerido} 🪙.`;

        await client.query(`
          INSERT INTO public.notifications (
            family_id, sender_id, sender_name, title, desc_text, type, created_at, visual, payload
          )
          VALUES ($1, $2, $3, $4, $5, 'COLECTA_APORTE', CURRENT_TIMESTAMP, 
                  '{"icon": "savings", "color": "#2E7D32"}'::jsonb, 
                  $6::jsonb);
        `, [familyId, userId, currentUser.nombre, titleNoti, descNoti, JSON.stringify({ reward_id: reward.id, canje_id: canjeId })]);

        if (io) {
          broadcastFamilyLiveEvent(io, familyId, {
            tipo: esNuevoInicio ? 'COLECTA_INICIADA' : 'COLECTA_APORTE',
            family_id: familyId,
            reward_id: reward.id,
            reward_titulo: reward.titulo,
            usuario_nombre: currentUser.nombre,
            cuota_aportada: cuotaUsuario,
            total_recaudado: nuevoRecaudado,
            total_requerido: totalRequerido,
            titulo: titleNoti,
            mensaje: descNoti
          });
        }
      }

      // Otorgar logros en lote (1 sola query en vez de 4)
      await LogrosService.otorgarLogrosEnLote(userId, ['MEDALLA_FAMILIA', 'ESPIRITU_FAMILIAR'], client);
      await client.query('COMMIT');

      return {
        success: true,
        auto_completada: autoCompletada,
        canje_id: canjeId,
        monto_pagado: cuotaUsuario,
        total_recaudado: nuevoRecaudado,
        total_requerido: totalRequerido,
        monedas_restantes: currentUser.monedas - cuotaUsuario,
        message: autoCompletada
          ? `¡Felicitaciones! Se completó el 100% de la colecta para "${reward.titulo}".`
          : `¡Aporte de ${cuotaUsuario} 🪙 registrado con éxito! Faltan ${totalRequerido - nuevoRecaudado} 🪙.`
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
