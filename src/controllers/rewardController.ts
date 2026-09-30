import { Response } from 'express';
import { RewardService } from '../services/rewardService';

const rewardService = new RewardService();

export class RewardController {
  
  // Listar recompensas de la familia
  async getAll(req: any, res: Response) {
    try {
      const familyId = req.auth.family_id;
      const rewards = await rewardService.getRewardsByFamily(familyId);
      return res.status(200).json({ success: true, data: rewards });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // Crear recompensa (Solo Admin / Jefe de Hogar)
  async create(req: any, res: Response) {
    try {
      const userId = req.auth.user_id;
      const userRole = req.auth.role; 
      const familyId = req.auth.family_id;

      const newReward = await rewardService.createReward(userId, userRole, familyId, req.body);
      return res.status(201).json({ success: true, data: newReward });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // Canjear recompensa (Cualquier usuario)
  async redeem(req: any, res: Response) {
    try {
      const userId = req.auth.user_id;
      const { rewardId } = req.body;

      const result = await rewardService.redeemReward(userId, rewardId);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}