import { Router } from 'express';
import {
  createReward,
  deleteReward,
  listRewards,
  reactivateRewardWindow,
  redeemReward,
  updateRewardAvailability
} from '../controllers/rewardController';
import { requireAdmin, verifyToken } from '../middleware/auth';

const router = Router();

router.get('/', verifyToken, listRewards);
router.post('/', verifyToken, requireAdmin, createReward);
router.patch('/:id/disponibilidad', verifyToken, requireAdmin, updateRewardAvailability);
router.delete('/:id', verifyToken, requireAdmin, deleteReward);
router.post('/:id/canjear', verifyToken, redeemReward);
router.delete('/:id/canjeos/ventana-actual', verifyToken, requireAdmin, reactivateRewardWindow);

export default router;
