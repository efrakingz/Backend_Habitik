import { NotificationRepository } from '../repositories/notificationRepository';
import { AppNotification } from '../models/types';
import { Server as SocketIOServer } from 'socket.io';
import { broadcastFamilyLiveEvent } from '../utils/eventBroadcaster';

export class NotificationService {
  private repo: NotificationRepository;

  constructor() {
    this.repo = new NotificationRepository();
  }

  /**
   * Método estático invocado por servicios como InspeccionService
   */
  static async sendFamilyPushNotification(
    familyId: string,
    senderId: string,
    title: string,
    body: string,
    dataPayload?: Record<string, any> | null,
    io?: SocketIOServer | null
  ): Promise<AppNotification> {
    const instance = new NotificationService();
    return await instance.sendFamilyEvent(
      {
        family_id: familyId,
        sender_id: senderId,
        title,
        desc_text: body,
        type: dataPayload?.type || 'NOTIFICACION_FAMILIAR',
        payload: dataPayload,
      },
      io
    );
  }

  /**
   * Envía un evento familiar, lo guarda en la base de datos y lo transmite por WebSockets.
   * Aplica un control estricto de fatiga: máximo 4 notificaciones al día por familia.
   */
  async sendFamilyEvent(
    data: {
      family_id?: string | null;
      user_id?: string | null;
      sender_id?: string | null;
      sender_name?: string | null;
      title: string;
      desc_text: string;
      type?: string;
      visual?: { icon?: string; color?: string } | null;
      payload?: Record<string, any> | null;
    },
    io?: SocketIOServer | null
  ): Promise<AppNotification> {
    // Control estricto de fatiga: máximo 4 notificaciones al día por familia
    if (data.family_id) {
      try {
        const recent = await this.repo.getNotificationsByFamilyId(data.family_id, 10);
        const now = new Date();
        const countToday = recent.filter(n => {
          const d = new Date(n.created_at ?? Date.now());
          return (
            d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth() &&
            d.getDate() === now.getDate()
          );
        }).length;

        if (countToday >= 4) {
          console.log(`⚠️ [NotificationService] Límite diario estricto alcanzado (máximo 4 al día para familia ${data.family_id}). Notificación descartada.`);
          return {
            id: 'limit_exceeded',
            family_id: data.family_id,
            user_id: data.user_id,
            title: data.title,
            desc_text: data.desc_text,
            type: data.type || 'ALERTA_GENERAL',
            created_at: now,
            read: true,
          } as AppNotification;
        }
      } catch (err) {
        console.warn('⚠️ [NotificationService] Advertencia validando límite diario:', err);
      }
    }

    const saved = await this.repo.createNotification(data);

    const eventPayload = {
      id: saved.id,
      family_id: saved.family_id,
      user_id: saved.user_id,
      sender_id: saved.sender_id,
      usuario_nombre: saved.sender_name || 'Familiar',
      titulo: saved.title,
      mensaje: saved.desc_text,
      tipo: saved.type || 'ALERTA_GENERAL',
      visual: saved.visual,
      payload: saved.payload,
      creado_en: saved.created_at || new Date(),
    };

    // Emisión en tiempo real vía Socket.io para clientes activos
    if (io && saved.family_id) {
      broadcastFamilyLiveEvent(io, saved.family_id, eventPayload);
    }

    return saved;
  }

  /**
   * Obtiene las notificaciones históricas de la familia
   */
  async getFamilyHistory(familyId: string): Promise<AppNotification[]> {
    return await this.repo.getNotificationsByFamilyId(familyId);
  }

  /**
   * Elimina todas las notificaciones de una familia
   */
  async clearFamilyHistory(familyId: string): Promise<number> {
    return await this.repo.deleteFamilyNotifications(familyId);
  }

  /**
   * Marca una notificación como leída
   */
  async markAsRead(id: string): Promise<boolean> {
    return await this.repo.markAsRead(id);
  }

  /**
   * Purga notificaciones antiguas para proteger el almacenamiento
   */
  async purgeOldNotifications(days: number = 7): Promise<number> {
    return await this.repo.purgeOldNotifications(days);
  }
}
