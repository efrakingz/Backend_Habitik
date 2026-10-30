import { pool } from '../../config/db';
import { broadcastFamilyLiveEvent } from '../../utils/eventBroadcaster';

export class RewardProposalService {
  /**
   * Proponer recompensa personal (Disponible para miembros, máximo 1 diaria)
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
          broadcastFamilyLiveEvent(io, familyId, {
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
   * Obtener propuestas pendientes de la familia (Para el panel del Jefe)
   */
  async getPendingProposals(familyId: string) {
    const result = await pool.query(`
      SELECT r.id, r.family_id, r.titulo, r.descripcion, r.emoji AS icono, r.es_familiar, r.costo, r.created_at, r.fecha_propuesta,
             p.id as usuario_id, p.nombre as usuario_nombre, p.avatar as usuario_avatar, p.monedas as usuario_monedas
      FROM public.family_rewards r
      JOIN public.profiles p ON r.propuesto_por = p.id
      WHERE r.family_id = $1 AND r.estado = 'propuesto'
      ORDER BY r.created_at DESC;
    `, [familyId]);
    return result.rows;
  }

  /**
   * Aprobar propuesta asignando el costo en monedas y modo (Solo Jefe de Hogar)
   */
  async approveProposal(
    adminRole: string,
    familyId: string,
    rewardId: string | number,
    costo: number,
    options?: {
      es_familiar?: boolean;
      titulo?: string;
      descripcion?: string;
      icono?: string;
      emoji?: string;
    },
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

      const isFamiliar = options?.es_familiar !== undefined ? Boolean(options.es_familiar) : Boolean(prop.es_familiar);
      const nuevoTitulo = (options?.titulo && options.titulo.trim().length > 0) ? options.titulo.trim() : prop.titulo;
      const nuevaDesc = options?.descripcion !== undefined ? options.descripcion.trim() : prop.descripcion;
      const nuevoIcono = options?.icono || options?.emoji || prop.icono || prop.emoji || '🎁';

      await client.query(`
        UPDATE public.family_rewards 
        SET costo = $1, estado = 'activo', disponible = TRUE, es_familiar = $2, titulo = $3, descripcion = $4, emoji = $5
        WHERE id = $6;
      `, [costo, isFamiliar, nuevoTitulo, nuevaDesc, nuevoIcono, rewardId]);

      const titleNoti = isFamiliar
        ? '🎉 ¡Propuesta aprobada como Colecta Familiar!'
        : '🎉 ¡Tu propuesta fue aprobada!';
      const descNoti = isFamiliar
        ? `El Jefe aprobó "${nuevoTitulo}" como Premio Familiar Colaborativo (${costo} 🪙 entre todos). ¡Ya pueden iniciar la colecta en la tienda!`
        : `El Jefe aprobó tu premio "${nuevoTitulo}" con un costo de ${costo} 🪙. ¡Ya puedes canjearlo en la tienda!`;

      await client.query(`
        INSERT INTO public.notifications (
          user_id, family_id, title, desc_text, type, created_at, visual, payload
        )
        VALUES ($1, $2, $3, $4, 'PROPUESTA_APROBADA', CURRENT_TIMESTAMP, 
                $5::jsonb, 
                $6::jsonb);
      `, [
        isFamiliar ? null : prop.propuesto_por,
        familyId,
        titleNoti,
        descNoti,
        JSON.stringify({ icon: isFamiliar ? 'groups' : 'check_circle', color: isFamiliar ? '#FFA000' : '#43A047' }),
        JSON.stringify({ reward_id: prop.id, costo, es_familiar: isFamiliar, titulo: nuevoTitulo })
      ]);

      if (io) {
        broadcastFamilyLiveEvent(io, familyId, {
          tipo: 'PROPUESTA_APROBADA',
          user_id: prop.propuesto_por,
          family_id: familyId,
          reward_id: prop.id,
          reward_titulo: nuevoTitulo,
          costo,
          es_familiar: isFamiliar,
          titulo: titleNoti,
          mensaje: descNoti
        });
      }

      await client.query('COMMIT');
      return {
        success: true,
        message: isFamiliar
          ? 'Propuesta aprobada y publicada como Colecta Familiar Colaborativa.'
          : 'Propuesta aprobada y publicada como Premio Personal.'
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Rechazar propuesta (Solo Jefe de Hogar)
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
          broadcastFamilyLiveEvent(io, familyId, {
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
}
