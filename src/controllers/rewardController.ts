import { Request, Response } from 'express';
import { RewardService } from '../services/rewardService';

export class RewardController {
  static async crearRecompensa(req: Request, res: Response) {
    try {
      const jefeId = req.auth?.user_id || req.body.user_id;
      const { titulo, descripcion, costo_monedas, es_familiar } = req.body;

      if (!jefeId || !titulo || !costo_monedas) {
        return res.status(400).json({ ok: false, error: 'Parámetros obligatorios: user_id, titulo, costo_monedas.' });
      }

      const reward = await RewardService.crearRecompensaFamiliar(
        jefeId, 
        titulo, 
        descripcion || '', 
        Number(costo_monedas), 
        Boolean(es_familiar)
      );

      return res.status(201).json({ ok: true, data: reward });
    } catch (error: any) {
      return res.status(400).json({ ok: false, error: error.message });
    }
  }

  static async listarRecompensas(req: Request, res: Response) {
    try {
      const userId = req.auth?.user_id || req.query.user_id;
      const rewards = await RewardService.listarRecompensasFamiliares(String(userId));
      return res.status(200).json({ ok: true, data: rewards });
    } catch (error: any) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  }

  static async canjearRecompensa(req: Request, res: Response) {
    try {
      const userId = req.auth?.user_id || req.body.user_id;
      const { reward_id } = req.body;

      if (!userId || !reward_id) {
        return res.status(400).json({ ok: false, error: 'Parámetro reward_id requerido.' });
      }

      const result = await RewardService.canjearRecompensaFamiliar(userId, Number(reward_id));
      return res.status(200).json({ ok: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ ok: false, error: error.message });
    }
  }

  static async reactivarRecompensa(req: Request, res: Response) {
    try {
      const jefeId = req.auth?.user_id || req.body.user_id;
      const { reward_id, target_user_id } = req.body;

      if (!jefeId || !reward_id) {
        return res.status(400).json({ ok: false, error: 'Faltan parámetros (user_id, reward_id).' });
      }

      const result = await RewardService.reactivarRecompensaManual(jefeId, Number(reward_id), target_user_id);
      return res.status(200).json({ ok: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ ok: false, error: error.message });
    }
  }
}
