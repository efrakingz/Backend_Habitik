import { Request, Response } from 'express';
import { NotificationService } from '../services/notificationService';
import { Server as SocketIOServer } from 'socket.io';

const notificationService = new NotificationService();

export class NotificationController {
  /**
   * POST /notifications/evento  &  POST /api/eventos
   * Dispara una alerta familiar en tiempo real y la persiste
   */
  static async sendEvent(req: Request, res: Response) {
    try {
      const io: SocketIOServer = req.app.get('io');
      const {
        family_id,
        familia_id,
        user_id,
        usuario_id,
        sender_id,
        sender_name,
        usuario_nombre,
        title,
        titulo,
        desc_text,
        mensaje,
        type,
        tipo,
        visual,
        payload,
      } = req.body;

      const finalFamilyId = family_id || familia_id;
      const finalSenderId = sender_id || usuario_id || user_id;
      const finalUserId = user_id || usuario_id || sender_id || finalSenderId;
      const finalSenderName = sender_name || usuario_nombre;
      const finalTitle = title || titulo || '📢 Alerta Familiar';
      const finalDesc = desc_text || mensaje || 'Nueva alerta enviada';
      const finalType = type || tipo || 'ALERTA_GENERAL';

      if (!finalFamilyId) {
        return res.status(400).json({
          exito: false,
          message: 'family_id (o familia_id) es requerido para enviar una alerta familiar.',
        });
      }

      const created = await notificationService.sendFamilyEvent(
        {
          family_id: finalFamilyId,
          user_id: finalUserId || null,
          sender_id: finalSenderId || null,
          sender_name: finalSenderName || null,
          title: finalTitle,
          desc_text: finalDesc,
          type: finalType,
          visual: visual || { icon: 'notifications', color: '#388E3C' },
          payload: payload || {},
        },
        io
      );

      return res.status(201).json({
        exito: true,
        evento: {
          id: created.id,
          family_id: created.family_id,
          user_id: created.user_id,
          sender_id: created.sender_id,
          usuario_nombre: created.sender_name || 'Familiar',
          titulo: created.title,
          mensaje: created.desc_text,
          tipo: created.type,
          creado_en: created.created_at,
        },
        notificacion: created,
      });
    } catch (err: any) {
      console.error('[NotificationController.sendEvent]', err);
      return res.status(500).json({
        exito: false,
        message: 'Error al procesar la notificación.',
        error: err.message,
      });
    }
  }

  /**
   * GET /notifications/familia/:family_id  &  GET /api/familia/:familia_id/eventos
   * Obtiene el historial de notificaciones de la familia
   */
  static async getFamilyNotifications(req: Request, res: Response) {
    try {
      const familyId = req.params.family_id || req.params.familia_id;
      if (!familyId) {
        return res.status(400).json({ exito: false, message: 'ID de familia requerido' });
      }

      const notificaciones = await notificationService.getFamilyHistory(familyId);
      
      const eventos = notificaciones.map((n) => ({
        id: n.id,
        family_id: n.family_id,
        user_id: n.user_id,
        usuario_origen_id: n.sender_id,
        usuario_nombre: n.sender_name || 'Familiar',
        titulo: n.title,
        mensaje: n.desc_text,
        tipo: n.type,
        visual: n.visual,
        payload: n.payload,
        is_read: n.is_read,
        creado_en: n.created_at,
      }));

      return res.json({
        exito: true,
        notificaciones,
        eventos,
      });
    } catch (err: any) {
      console.error('[NotificationController.getFamilyNotifications]', err);
      return res.status(500).json({
        exito: false,
        message: 'Error al obtener el historial.',
        error: err.message,
      });
    }
  }

  /**
   * DELETE /notifications/familia/:family_id  &  DELETE /api/familia/:familia_id/eventos
   * Limpia el historial de notificaciones familiares
   */
  static async clearFamilyNotifications(req: Request, res: Response) {
    try {
      const familyId = req.params.family_id || req.params.familia_id;
      if (!familyId) {
        return res.status(400).json({ exito: false, message: 'ID de familia requerido' });
      }

      const deletedCount = await notificationService.clearFamilyHistory(familyId);
      return res.json({
        exito: true,
        message: `Historial eliminado (${deletedCount} registros)`,
      });
    } catch (err: any) {
      console.error('[NotificationController.clearFamilyNotifications]', err);
      return res.status(500).json({
        exito: false,
        message: 'Error al limpiar el historial.',
        error: err.message,
      });
    }
  }

  /**
   * PATCH /notifications/:id/leida
   * Marca una notificación específica como leída
   */
  static async markRead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const success = await notificationService.markAsRead(id);
      return res.json({ exito: success });
    } catch (err: any) {
      return res.status(500).json({ exito: false, error: err.message });
    }
  }
}
