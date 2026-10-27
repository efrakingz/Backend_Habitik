import { Request, Response } from 'express';
import { FeedService } from '../services/FeedService';

export class FeedController {
  static async listarFeed(req: Request, res: Response) {
    try {
      const familyId = (req as any).auth?.family_id;

      if (!familyId) {
        return res.status(403).json({ message: 'El usuario no pertenece a ninguna familia.' });
      }

      // Parámetro opcional de paginación
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

      const feed = await FeedService.obtenerFeedFamiliar(familyId, limit);

      return res.status(200).json({
        success: true,
        data: feed
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}