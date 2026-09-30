import { Router } from 'express';
import { RewardController } from '../controllers/rewardController';
import { verifyToken, requireAdmin } from '../middleware/auth';

const router = Router();
const rewardController = new RewardController();

// Todas las rutas de premios requieren estar autenticado
router.use(verifyToken);

// 1. GET /rewards -> Listar premios de la familia
router.get('/', rewardController.getAll);

// 2. POST /rewards/crear -> Crear premio (Restringido a Jefe de Hogar / Admin)
router.post('/crear', requireAdmin, rewardController.create);

// 3. POST /rewards/canjear -> Canjear premio (Disponible para todos)
router.post('/canjear', rewardController.redeem);

export default router;