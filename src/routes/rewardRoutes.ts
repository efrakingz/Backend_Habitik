import { Router } from 'express';
import { RewardController } from '../controllers/rewardController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/crear', authenticateToken, RewardController.crearRecompensa);
router.get('/listar', authenticateToken, RewardController.listarRecompensas);
router.post('/canjear', authenticateToken, RewardController.canjearRecompensa);
router.put('/reactivar', authenticateToken, RewardController.reactivarRecompensa);

export default router;