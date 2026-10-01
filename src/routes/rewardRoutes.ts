import { Router } from 'express';
import { RewardController } from '../controllers/rewardController';
import { verifyToken, requireAdmin } from '../middleware/auth';

const router = Router();
const rewardController = new RewardController();

// Todas las rutas requieren token de autenticación
router.use(verifyToken);

// 1. Obtener todas las recompensas de la familia
router.get('/', rewardController.getAll);

// 2. Crear recompensa (Restringido al Jefe de Hogar / Admin)
router.post('/crear', requireAdmin, rewardController.create);

// 3. Canjear recompensa (Disponible para todos)
router.post('/canjear', rewardController.redeem);

// 4. Obtener canjes pendientes (Solo Jefe de Hogar)
router.get('/canjes/pendientes', requireAdmin, rewardController.getPending);

// 5. Aprobar canje (Solo Jefe de Hogar)
router.patch('/canjes/:id/aprobar', requireAdmin, rewardController.approve);

// 6. Rechazar canje (Solo Jefe de Hogar)
router.patch('/canjes/:id/rechazar', requireAdmin, rewardController.reject);

export default router;