import { Response } from 'express';
import { RewardService } from '../services/rewardService';

const rewardService = new RewardService();

export class RewardController {
  
  // Listar recompensas de la familia (incluyendo propuesta diaria del usuario y colectas activas)
  async getAll(req: any, res: Response) {
    try {
      const familyId = req.auth.family_id;
      const userId = req.auth.user_id;
      const data = await rewardService.getRewardsByFamily(familyId, userId);
      return res.status(200).json({ 
        success: true, 
        data: data.rewards, 
        rewards: data.rewards,
        propuesta_hoy: data.propuesta_hoy,
        colectas_activas: data.colectas_activas
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // Crear recompensa directa (Solo Jefe / Admin)
  async create(req: any, res: Response) {
    try {
      const userId = req.auth.user_id;
      const userRole = req.auth.rol || req.auth.role; 
      const familyId = req.auth.family_id;
      const io = req.app.get('io');

      const newReward = await rewardService.createReward(userId, userRole, familyId, req.body, io);
      return res.status(201).json({ success: true, data: newReward });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // Proponer recompensa personal (Miembros o Jefe, máx 1 diaria)
  async propose(req: any, res: Response) {
    try {
      const userId = req.auth.user_id;
      const familyId = req.auth.family_id;
      const io = req.app.get('io');

      const proposal = await rewardService.proposeReward(userId, familyId, req.body, io);
      return res.status(201).json({ 
        success: true, 
        message: '¡Propuesta enviada al Jefe de Hogar con éxito!', 
        data: proposal 
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // Obtener propuestas pendientes de aprobación (Solo Jefe)
  async getPendingProposals(req: any, res: Response) {
    try {
      const familyId = req.auth.family_id;
      const proposals = await rewardService.getPendingProposals(familyId);
      return res.status(200).json({ success: true, data: proposals });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // Aprobar propuesta fijando el costo en monedas (Solo Jefe)
  async approveProposal(req: any, res: Response) {
    try {
      const adminRole = req.auth.rol || req.auth.role;
      const familyId = req.auth.family_id;
      const { id } = req.params;
      const { costo } = req.body;
      const io = req.app.get('io');

      const result = await rewardService.approveProposal(adminRole, familyId, id, Number(costo), io);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // Rechazar propuesta (Solo Jefe)
  async rejectProposal(req: any, res: Response) {
    try {
      const adminRole = req.auth.rol || req.auth.role;
      const familyId = req.auth.family_id;
      const { id } = req.params;
      const { motivo } = req.body;
      const io = req.app.get('io');

      const result = await rewardService.rejectProposal(adminRole, familyId, id, motivo, io);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // Iniciar o aportar a una colecta familiar colaborativa
  async contributeColecta(req: any, res: Response) {
    try {
      const userId = req.auth.user_id;
      const familyId = req.auth.family_id;
      const { rewardId } = req.body;
      const io = req.app.get('io');

      const result = await rewardService.startOrContributeColecta(userId, familyId, rewardId, io);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // Canjear recompensa personal (1 vez al día por usuario)
  async redeem(req: any, res: Response) {
    try {
      const userId = req.auth.user_id;
      const { rewardId } = req.body;
      const io = req.app.get('io');

      const result = await rewardService.redeemReward(userId, rewardId, io);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // Obtener canjes personales pendientes (Para el panel del Jefe)
  async getPending(req: any, res: Response) {
    try {
      const familyId = req.auth.family_id;
      const pendings = await rewardService.getPendingCanjes(familyId);
      return res.status(200).json({ success: true, data: pendings });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // Aprobar canje personal (Solo Jefe)
  async approve(req: any, res: Response) {
    try {
      const adminRole = req.auth.rol || req.auth.role;
      const { id } = req.params;
      const io = req.app.get('io');

      const result = await rewardService.approveCanje(adminRole, id, io); 
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // Rechazar canje personal y reembolsar monedas (Solo Jefe)
  async reject(req: any, res: Response) {
    try {
      const adminRole = req.auth.rol || req.auth.role;
      const { id } = req.params;
      const { motivo } = req.body;
      const io = req.app.get('io');

      const result = await rewardService.rejectCanje(adminRole, id, motivo, io); 
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}