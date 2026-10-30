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
   * Envía un evento familiar, lo guarda en la base de datos y lo transmite por WebSockets
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
   * Limpia el historial de la familia
   */
  async clearFamilyHistory(familyId: string): Promise<number> {
    return await this.repo.deleteFamilyNotifications(familyId);
  }

  /**
   * Marca una notificación como leída
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    return await this.repo.markAsRead(notificationId);
  }

  /**
   * Purgado periódico de notificaciones antiguas (retención por defecto: 7 días)
   */
  async purgeOldNotifications(days: number = 7): Promise<number> {
    return await this.repo.purgeOldNotifications(days);
  }
}