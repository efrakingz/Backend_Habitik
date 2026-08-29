import { NotificationRepository } from '../repositories/notificationRepository';
import { AppNotification } from '../models/types';
import { Server as SocketIOServer } from 'socket.io';

export class NotificationService {
  private repo: NotificationRepository;

  constructor() {
    this.repo = new NotificationRepository();
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

    if (io && saved.family_id) {
      io.to(`familia_${saved.family_id}`).emit('evento_en_vivo', eventPayload);
      console.log(`📡 [Socket.io] Evento emitido a sala familia_${saved.family_id}:`, saved.title);
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
}
