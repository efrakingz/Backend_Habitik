import { Request, Response } from 'express';
import { FeedService } from '../services/FeedService';

export class FeedController {
  /**
   * GET /feed o GET /api/familia/feed
   * Lista cronológicamente las actividades recientes del muro familiar con avatares,
   * tareas completadas, fotos y estado de reacciones/likes.
   * Limitado a 4 cards por defecto para prevenir sobrecarga.
   */
  static async listarFeed(req: Request, res: Response) {
    try {
      const familyId = (req as any).auth?.family_id || (req as any).user?.family_id || (req.query.family_id as string);
      const currentUserId = (req as any).auth?.user_id || (req as any).auth?.userId || (req as any).user?.id;

      if (!familyId) {
        return res.status(403).json({
          success: false,
          message: 'El usuario no pertenece a ninguna familia o no se proveyó family_id.'
        });
      }

      // Parámetros de paginación (limitado a 4 cards máximo por petición para prevenir sobrecarga)
      const rawLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 4;
      const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 20) : 4;
      const cursor = req.query.cursor ? String(req.query.cursor) : undefined;

      const feed = await FeedService.obtenerFeedFamiliar(familyId, limit, cursor, currentUserId);

      // Calcular cursor para la siguiente página si hay elementos
      const nextCursor = feed.length > 0 && feed.length >= limit ? feed[feed.length - 1].fecha : null;

      return res.status(200).json({
        success: true,
        data: feed,
        pagination: {
          limit,
          count: feed.length,
          next_cursor: nextCursor,
          has_more: feed.length >= limit
        }
      });
    } catch (error: any) {
      console.error('[FeedController.listarFeed]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /feed/:id/react o POST /api/familia/feed/:id/react
   * Registra, actualiza o remueve (toggle) una reacción/like en una actividad del muro.
   * Emite el evento en tiempo real vía WebSockets a toda la familia de forma silenciosa
   * (sin crear alertas ni guardar notificaciones).
   */
  static async reaccionarActividad(req: Request, res: Response) {
    try {
      const feedId = req.params.id;
      const familyId = (req as any).auth?.family_id || (req as any).user?.family_id || req.body.family_id;
      const userId = (req as any).auth?.user_id || (req as any).auth?.userId || (req as any).user?.id || req.body.user_id;
      const tipoReaccion = req.body.tipo || req.body.tipo_reaccion || req.body.reaction || 'like';

      if (!feedId) {
        return res.status(400).json({ success: false, message: 'El ID de la actividad es obligatorio.' });
      }

      if (!userId || !familyId) {
        return res.status(403).json({
          success: false,
          message: 'No autenticado o falta asociar perfil familiar.'
        });
      }

      const resultado = await FeedService.reaccionar(feedId, familyId, userId, tipoReaccion);

      // Emisión en tiempo real vía WebSockets solo para sincronizar contadores del muro
      // (sin notificación de sistema, sin título y sin persistir en bandeja de notificaciones)
      const io = req.app.get('io');
      if (io && familyId) {
        io.to(`familia_${familyId}`).emit('evento_en_vivo', {
          id: `react_${feedId}_${userId}`,
          family_id: familyId,
          user_id: userId,
          tipo: 'FEED_REACCION',
          es_notificacion: false,
          silencioso: true,
          payload: {
            feed_id: feedId,
            tipo: resultado.tipo,
            accion: resultado.accion,
            reaccionado: resultado.reaccionado,
            total_reacciones: resultado.total_reacciones,
            reacciones_conteo: resultado.reacciones_conteo
          }
        });
      }

      return res.status(200).json({
        success: true,
        message:
          resultado.accion === 'eliminada'
            ? 'Reacción removida.'
            : resultado.accion === 'actualizada'
            ? 'Reacción actualizada.'
            : 'Reacción agregada.',
        data: resultado
      });
    } catch (error: any) {
      console.error('[FeedController.reaccionarActividad]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * DELETE /feed/:id/react
   * Remueve explícitamente la reacción del usuario a una actividad.
   */
  static async eliminarReaccion(req: Request, res: Response) {
    try {
      const feedId = req.params.id;
      const userId = (req as any).auth?.user_id || (req as any).auth?.userId || (req as any).user?.id || req.body.user_id;

      if (!feedId || !userId) {
        return res.status(400).json({ success: false, message: 'feedId y userId son requeridos.' });
      }

      const resultado = await FeedService.eliminarReaccion(feedId, userId);

      return res.status(200).json({
        success: true,
        message: resultado.eliminado ? 'Reacción eliminada.' : 'No existía reacción previa.',
        data: resultado
      });
    } catch (error: any) {
      console.error('[FeedController.eliminarReaccion]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
