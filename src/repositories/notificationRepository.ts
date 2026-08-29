import { query } from '../config/db';
import { AppNotification } from '../models/types';

export class NotificationRepository {
  /**
   * Inserta una nueva notificación o alerta familiar
   */
  async createNotification(data: {
    family_id?: string | null;
    user_id?: string | null;
    sender_id?: string | null;
    sender_name?: string | null;
    title: string;
    desc_text: string;
    type?: string;
    visual?: { icon?: string; color?: string } | null;
    payload?: Record<string, any> | null;
  }): Promise<AppNotification> {
    const visualJson = JSON.stringify(data.visual || { icon: 'notifications', color: '#388E3C' });
    const payloadJson = JSON.stringify(data.payload || {});

    const res = await query(
      `INSERT INTO public.notifications 
        (family_id, user_id, sender_id, sender_name, title, desc_text, type, visual, payload, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, false)
       RETURNING *`,
      [
        data.family_id || null,
        data.user_id || null,
        data.sender_id || null,
        data.sender_name || null,
        data.title,
        data.desc_text,
        data.type || 'ALERTA_GENERAL',
        visualJson,
        payloadJson,
      ]
    );
    return res.rows[0];
  }

  /**
   * Obtiene el historial de notificaciones de la familia (o del usuario)
   */
  async getNotificationsByFamilyId(familyId: string, limit: number = 50): Promise<AppNotification[]> {
    const res = await query(
      `SELECT n.*, 
              COALESCE(n.sender_name, p.nombre, 'Familiar') as usuario_nombre
       FROM public.notifications n
       LEFT JOIN public.profiles p ON n.sender_id = p.id
       WHERE n.family_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2`,
      [familyId, limit]
    );
    return res.rows;
  }

  /**
   * Obtiene las notificaciones personales de un usuario
   */
  async getNotificationsByUserId(userId: string, limit: number = 50): Promise<AppNotification[]> {
    const res = await query(
      `SELECT * FROM public.notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return res.rows;
  }

  /**
   * Marca una notificación como leída
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    const res = await query(
      `UPDATE public.notifications 
       SET is_read = true 
       WHERE id = $1 RETURNING id`,
      [notificationId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Limpia/elimina el historial de notificaciones de una familia
   */
  async deleteFamilyNotifications(familyId: string): Promise<number> {
    const res = await query(
      `DELETE FROM public.notifications 
       WHERE family_id = $1`,
      [familyId]
    );
    return res.rowCount ?? 0;
  }
}
