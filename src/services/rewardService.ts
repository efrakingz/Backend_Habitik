import { pool } from '../config/db';

export class RewardService {
  
  /**
   * 1. Listar todas las recompensas activas de la familia,
   *    junto con la propuesta diaria del usuario y las colectas familiares activas.
   */
  async getRewardsByFamily(familyId: string, currentUserId?: string) {
    const client = await pool.connect();
    try {
      // 1. Recompensas activas
      const rewardsRes = await client.query(`
        SELECT id, titulo, descripcion, emoji, costo, disponible, es_familiar, 
               created_at, last_redeemed_at, metadata, estado, propuesto_por
        FROM public.family_rewards
        WHERE family_id = $1 AND estado = 'activo'
        ORDER BY created_at DESC;
      `, [familyId]);

      // 2. Propuesta enviada hoy por el usuario actual (si existe)
      let propuestaHoy: any = null;
      if (currentUserId) {
        const propRes = await client.query(`
          SELECT id, titulo, descripcion, emoji, costo, estado, fecha_propuesta, created_at
          FROM public.family_rewards
          WHERE propuesto_por = $1 AND fecha_propuesta = CURRENT_DATE
          ORDER BY created_at DESC
          LIMIT 1;
        `, [currentUserId]);
        if (propRes.rows.length > 0) {
          propuestaHoy = propRes.rows[0];
        }
      }

      // 3. Colectas familiares en curso
      const colectasRes = await client.query(`
        SELECT c.id as canje_id, c.reward_id, c.total_requerido, c.total_recaudado, c.estado,
               json_agg(json_build_object(
                 'user_id', ca.user_id,
                 'nombre', p.nombre,
                 'avatar', p.avatar,
                 'monto_asignado', ca.monto_asignado,
                 'monto_pagado', ca.monto_pagado,
                 'pagado', ca.pagado
               )) as aportes
        FROM public.canjes c
        JOIN public.canje_aportes ca ON c.id = ca.canje_id
        JOIN public.profiles p ON ca.user_id = p.id
        WHERE c.family_id = $1 AND c.es_colecta = true AND c.estado = 'recaudando'
        GROUP BY c.id, c.reward_id, c.total_requerido, c.total_recaudado, c.estado;
      `, [familyId]);

      // Mapear colectas por reward_id
      const colectasMap = new Map<string, any>();
      for (const col of colectasRes.rows) {
        colectasMap.set(String(col.reward_id), col);
      }

      // Adjuntar colecta si aplica
      const items = rewardsRes.rows.map(r => {
        const col = colectasMap.get(String(r.id));
        return {
          ...r,
          colecta_activa: col || null
        };
      });

      return {
        rewards: items,
        propuesta_hoy: propuestaHoy,
        colectas_activas: colectasRes.rows
      };
    } finally {
      client.release();
    }
  }

  /**
   * 2. Crear recompensa directa (Restringido exclusivamente al rol 'Jefe' / Admin)
   */
  async createReward(
    userId: string, 
    userRole: string, 
    familyId: string, 
    data: { titulo: string; descripcion: string; emoji?: string; costo: number; es_familiar: boolean; metadata?: any },
    io?: any
  ) {
    const roleNormalized = (userRole || '').toLowerCase();
    if (roleNormalized !== 'jefe' && roleNormalized !== 'admin') {
      throw new Error('Acceso denegado: Solo el jefe de hogar puede crear recompensas directamente.');
    }

    const { titulo, descripcion, emoji, costo, es_familiar, metadata } = data;
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        INSERT INTO public.family_rewards (family_id, titulo, descripcion, emoji, costo, disponible, creador_id, es_familiar, estado, metadata)
        VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7, 'activo', $8)
        RETURNING id, titulo, descripcion, emoji, costo, disponible, es_familiar, estado, metadata;
      `, [familyId, titulo, descripcion, emoji || '🎁', costo, userId, es_familiar, metadata || JSON.stringify({ frecuencia: 'semanal' })]);

      const created = result.rows[0];

      // Emitir evento WebSocket para que la tienda de todos los miembros se actualice
      if (io) {
        io.to(`familia_${familyId}`).emit('evento_en_vivo', {
          tipo: 'PREMIO_CREADO',
          family_id: familyId,
          titulo: '🎁 ¡Nuevo premio en la tienda!',
          mensaje: `Se ha agregado "${titulo}" a los premios ${es_familiar ? 'familiares' : 'personales'}.`,
          reward: created
        });
      }

      return created;
    } finally {
      client.release();
    }
  }

  /**
   * 3. Proponer recompensa personal (Disponible para miembros, máximo 1 diaria)
   */
  async proposeReward(
    userId: string,
    familyId: string,
    data: { titulo: string; descripcion?: string; emoji?: string },
    io?: any
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Validar si ya propuso hoy
      const existingProp = await client.query(`
        SELECT id FROM public.family_rewards 
        WHERE propuesto_por = $1 AND fecha_propuesta = CURRENT_DATE;
      `, [userId]);

      if (existingProp.rows.length > 0) {
        throw new Error('Ya has enviado una propuesta hoy. Solo se permite 1 propuesta diaria.');
      }

      // Obtener nombre del usuario que propone
      const profileRes = await client.query(`
        SELECT nombre FROM public.profiles WHERE id = $1;
      `, [userId]);
      const userName = profileRes.rows[0]?.nombre || 'Un familiar';

      // Insertar premio en estado 'propuesto' con costo 0 (el Jefe lo asigna)
      const insertRes = await client.query(`
        INSERT INTO public.family_rewards (
          family_id, titulo, descripcion, emoji, costo, disponible, 
          creador_id, propuesto_por, es_familiar, estado, fecha_propuesta, metadata
        )
        VALUES ($1, $2, $3, $4, 0, FALSE, $5, $5, FALSE, 'propuesto', CURRENT_DATE, '{}'::jsonb)
        RETURNING *;
      `, [familyId, data.titulo.trim(), data.descripcion?.trim() || '', data.emoji || '🎁', userId]);

      const propuesta = insertRes.rows[0];

      // Buscar al Jefe del hogar para enviarle notificación directa
      const adminRes = await client.query(`
        SELECT id FROM public.profiles 
        WHERE family_id = $1 AND (LOWER(rol) = 'jefe' OR LOWER(rol) = 'admin') 
        LIMIT 1;
      `, [familyId]);

      if (adminRes.rows.length > 0) {
        const adminId = adminRes.rows[0].id;
        const titleNoti = '🎁 ¡Nueva propuesta de premio!';
        const descNoti = `${userName} te ha propuesto un premio personal: "${data.titulo}". Asígnale un valor en monedas en tu Panel de Control.`;

        await client.query(`
          INSERT INTO public.notifications (
            user_id, family_id, sender_id, sender_name, title, desc_text, 
            type, created_at, visual, payload
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'PROPUESTA_NUEVA', CURRENT_TIMESTAMP, 
                  '{"icon": "card_giftcard", "color": "#43A047"}'::jsonb, 
                  $7::jsonb);
        `, [adminId, familyId, userId, userName, titleNoti, descNoti, JSON.stringify({ reward_id: propuesta.id })]);

        if (io) {
          io.to(`familia_${familyId}`).emit('evento_en_vivo', {
            tipo: 'PROPUESTA_NUEVA',
            user_id: adminId,
            family_id: familyId,
            titulo: titleNoti,
            mensaje: descNoti,
            reward_id: propuesta.id
          });
        }
      }

      await client.query('COMMIT');
      return propuesta;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 4. Obtener propuestas pendientes de la familia (Para el panel del Jefe)
   */
  async getPendingProposals(familyId: string) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT r.id, r.family_id, r.titulo, r.descripcion, r.emoji, r.created_at, r.fecha_propuesta,
               p.id as usuario_id, p.nombre as usuario_nombre, p.avatar as usuario_avatar, p.monedas as usuario_monedas
        FROM public.family_rewards r
        JOIN public.profiles p ON r.propuesto_por = p.id
        WHERE r.family_id = $1 AND r.estado = 'propuesto'
        ORDER BY r.created_at DESC;
      `, [familyId]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * 5. Aprobar propuesta asignando el costo en monedas (Solo Jefe de Hogar)
   */
  async approveProposal(
    adminRole: string, 
    familyId: string, 
    rewardId: string | number, 
    costo: number, 
    io?: any
  ) {
    const roleNormalized = (adminRole || '').toLowerCase();
    if (roleNormalized !== 'jefe' && roleNormalized !== 'admin') {
      throw new Error('Acceso denegado: Solo el jefe de hogar puede aprobar propuestas.');
    }

    if (!costo || costo < 1) {
      throw new Error('Debes asignar un costo válido en monedas mayor a 0.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const propRes = await client.query(`
        SELECT * FROM public.family_rewards 
        WHERE id = $1 AND family_id = $2 AND estado = 'propuesto' 
        FOR UPDATE;
      `, [rewardId, familyId]);

      if (propRes.rows.length === 0) {
        throw new Error('La propuesta no existe o ya fue procesada.');
      }

      const prop = propRes.rows[0];

      // Actualizar premio a estado 'activo' con el costo asignado
      await client.query(`
        UPDATE public.family_rewards 
        SET costo = $1, estado = 'activo', disponible = TRUE 
        WHERE id = $2;
      `, [costo, rewardId]);

      // Notificar al miembro que propuso
      if (prop.propuesto_por) {
        const titleNoti = '🎉 ¡Tu propuesta fue aprobada!';
        const descNoti = `El Jefe aprobó tu premio "${prop.titulo}" con un costo de ${costo} 🪙. ¡Ya puedes canjearlo en la tienda!`;

        await client.query(`
          INSERT INTO public.notifications (
            user_id, family_id, title, desc_text, type, created_at, visual, payload
          )
          VALUES ($1, $2, $3, $4, 'PROPUESTA_APROBADA', CURRENT_TIMESTAMP, 
                  '{"icon": "check_circle", "color": "#43A047"}'::jsonb, 
                  $5::jsonb);
        `, [prop.propuesto_por, familyId, titleNoti, descNoti, JSON.stringify({ reward_id: prop.id, costo })]);

        if (io) {
          io.to(`familia_${familyId}`).emit('evento_en_vivo', {
            tipo: 'PROPUESTA_APROBADA',
            user_id: prop.propuesto_por,
            family_id: familyId,
            reward_id: prop.id,
            reward_titulo: prop.titulo,
            costo,
            titulo: titleNoti,
            mensaje: descNoti
          });
        }
      }

      await client.query('COMMIT');
      return { success: true, message: 'Propuesta aprobada y publicada en la tienda.' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 6. Rechazar propuesta (Solo Jefe de Hogar)
   */
  async rejectProposal(
    adminRole: string, 
    familyId: string, 
    rewardId: string | number, 
    motivo?: string, 
    io?: any
  ) {
    const roleNormalized = (adminRole || '').toLowerCase();
    if (roleNormalized !== 'jefe' && roleNormalized !== 'admin') {
      throw new Error('Acceso denegado: Solo el jefe de hogar puede rechazar propuestas.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const propRes = await client.query(`
        SELECT * FROM public.family_rewards 
        WHERE id = $1 AND family_id = $2 AND estado = 'propuesto' 
        FOR UPDATE;
      `, [rewardId, familyId]);

      if (propRes.rows.length === 0) {
        throw new Error('La propuesta no existe o ya fue procesada.');
      }

      const prop = propRes.rows[0];

      await client.query(`
        UPDATE public.family_rewards 
        SET estado = 'rechazado', disponible = FALSE 
        WHERE id = $1;
      `, [rewardId]);

      // Notificar al miembro que propuso
      if (prop.propuesto_por) {
        const titleNoti = '❌ Propuesta no aprobada';
        const motivoText = motivo ? ` Motivo: ${motivo}` : '';
        const descNoti = `El Jefe no aprobó tu propuesta de premio "${prop.titulo}".${motivoText}`;

        await client.query(`
          INSERT INTO public.notifications (
            user_id, family_id, title, desc_text, type, created_at, visual
          )
          VALUES ($1, $2, $3, $4, 'PROPUESTA_RECHAZADA', CURRENT_TIMESTAMP, 
                  '{"icon": "cancel", "color": "#D32F2F"}'::jsonb);
        `, [prop.propuesto_por, familyId, titleNoti, descNoti]);

        if (io) {
          io.to(`familia_${familyId}`).emit('evento_en_vivo', {
            tipo: 'PROPUESTA_RECHAZADA',
            user_id: prop.propuesto_por,
            family_id: familyId,
            reward_id: prop.id,
            reward_titulo: prop.titulo,
            motivo,
            titulo: titleNoti,
            mensaje: descNoti
          });
        }
      }

      await client.query('COMMIT');
      return { success: true, message: 'Propuesta rechazada con éxito.' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 7. Iniciar o aportar a una colecta familiar colaborativa.
   *    Divide el costo equitativamente entre todos los miembros de la familia.
   *    Al llegar al 100%, se auto-completa y queda canjeada para toda la familia.
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
        // Obtener todos los miembros actuales de la familia
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

        // Crear el canje en estado 'recaudando'
        const insertCanjeRes = await client.query(`
          INSERT INTO public.canjes (
            reward_id, user_id, family_id, costo_pagado, estado, 
            es_colecta, total_requerido, total_recaudado, created_at
          )
          VALUES ($1, $2, $3, 0, 'recaudando', TRUE, $4, 0, CURRENT_TIMESTAMP)
          RETURNING id;
        `, [rewardId, userId, familyId, totalRequerido]);

        canjeId = insertCanjeRes.rows[0].id;

        // Crear registros de aportes para todos los integrantes
        for (let i = 0; i < N; i++) {
          const m = members[i];
          const cuota = baseQuota + (i < remainder ? 1 : 0);
          if (m.id === userId) {
            cuotaUsuario = cuota;
          }
          await client.query(`
            INSERT INTO public.canje_aportes (canje_id, user_id, monto_asignado, monto_pagado, pagado)
            VALUES ($1, $2, $3, 0, FALSE);
          `, [canjeId, m.id, cuota]);
        }

        if (currentUser.monedas < cuotaUsuario) {
          throw new Error(`No tienes suficientes monedas (${currentUser.monedas} 🪙) para pagar tu cuota inicial de ${cuotaUsuario} 🪙.`);
        }

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

        // Descontar monedas
        await client.query(`
          UPDATE public.profiles SET monedas = monedas - $1 WHERE id = $2;
        `, [cuotaUsuario, userId]);

        // Registrar pago
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
        // Marcar canje completado automáticamente
        await client.query(`
          UPDATE public.canjes 
          SET estado = 'completado' 
          WHERE id = $1;
        `, [canjeId]);

        // Actualizar cooldown del premio
        await client.query(`
          UPDATE public.family_rewards 
          SET last_redeemed_at = CURRENT_TIMESTAMP 
          WHERE id = $1;
        `, [rewardId]);

        // Notificar a toda la familia
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
          io.to(`familia_${familyId}`).emit('evento_en_vivo', {
            tipo: 'COLECTA_COMPLETADA',
            family_id: familyId,
            reward_id: reward.id,
            reward_titulo: reward.titulo,
            titulo: titleFamily,
            mensaje: descFamily
          });
        }
      } else {
        // Notificar que la colecta se inició o se sumó un aporte
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
          io.to(`familia_${familyId}`).emit('evento_en_vivo', {
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

  /**
   * 8. Canjear recompensa personal (1 vez al día por usuario)
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

      // Validación de 1 canje por día para este premio por este usuario
      const existingCanjeRes = await client.query(`
        SELECT id FROM public.canjes 
        WHERE user_id = $1 AND reward_id = $2 
        AND created_at >= CURRENT_DATE;
      `, [userId, rewardId]);

      if (existingCanjeRes.rows.length > 0) {
        throw new Error('Ya has canjeado esta recompensa personal hoy. Solo se permite un canje diario.');
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
        throw new Error(`No tienes suficientes monedas (${profile.monedas || 0} 🪙) para canjear este premio de ${reward.costo} 🪙.`);
      }

      // Descontar monedas
      await client.query(`
        UPDATE public.profiles SET monedas = monedas - $1 WHERE id = $2;
      `, [reward.costo, userId]);

      // Registrar canje en estado 'pendiente' para aprobación del Jefe
      const insertCanjeRes = await client.query(`
        INSERT INTO public.canjes (reward_id, user_id, family_id, costo_pagado, estado, created_at)
        VALUES ($1, $2, $3, $4, 'pendiente', CURRENT_TIMESTAMP)
        RETURNING id;
      `, [rewardId, userId, profile.family_id, reward.costo]);

      const canjeId = insertCanjeRes.rows[0].id;

      // Buscar al Jefe para notificarle
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
          io.to(`familia_${profile.family_id}`).emit('evento_en_vivo', {
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
   * 9. Obtener canjes personales pendientes (Para el panel del Jefe)
   */
  async getPendingCanjes(familyId: string) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
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
    } finally {
      client.release();
    }
  }

  /**
   * 10. Aprobar un canje pendiente y notificar al miembro (Solo Jefe de Hogar)
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

      // Notificar al miembro que realizó el canje
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
        io.to(`familia_${canje.family_id}`).emit('evento_en_vivo', {
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
   * 11. Rechazar canje pendiente, reembolsar monedas y notificar (Solo Jefe de Hogar)
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

      // Cambiar estado a rechazado
      await client.query(`
        UPDATE public.canjes SET estado = 'rechazado' WHERE id = $1;
      `, [canjeId]);

      // Reembolsar las monedas al usuario
      await client.query(`
        UPDATE public.profiles SET monedas = monedas + $1 WHERE id = $2;
      `, [canje.costo_pagado, canje.user_id]);

      // Notificar al miembro del rechazo y reembolso
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
        io.to(`familia_${canje.family_id}`).emit('evento_en_vivo', {
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