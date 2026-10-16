import { Router } from 'express';
import { RewardController } from '../controllers/rewardController';
import { verifyToken, requireAdmin } from '../middleware/auth';

const router = Router();
const rewardController = new RewardController();

// Todas las rutas requieren token de autenticación
router.use(verifyToken);

// 1. Obtener todas las recompensas de la familia, propuesta de hoy y colectas activas
router.get('/', rewardController.getAll);

// 2. Crear recompensa directamente (Restringido al Jefe de Hogar / Admin)
router.post('/crear', requireAdmin, rewardController.create);

// 3. Proponer recompensa personal (Disponible para miembros, máx 1 por día)
router.post('/proponer', rewardController.propose);

// 4. Obtener propuestas pendientes de aprobación (Solo Jefe de Hogar)
router.get('/propuestas/pendientes', requireAdmin, rewardController.getPendingProposals);

// 5. Aprobar propuesta asignando monedas (Solo Jefe de Hogar)
router.patch('/propuestas/:id/aprobar', requireAdmin, rewardController.approveProposal);

// 6. Rechazar propuesta (Solo Jefe de Hogar)
router.patch('/propuestas/:id/rechazar', requireAdmin, rewardController.rejectProposal);

// 7. Iniciar o aportar a una colecta familiar colaborativa (Cualquier integrante)
router.post('/colecta/aportar', rewardController.contributeColecta);

// 8. Canjear recompensa personal individual (Disponible para todos, máx 1 vez al día)
router.post('/canjear', rewardController.redeem);

// 9. Obtener canjes personales pendientes de aprobación (Solo Jefe de Hogar)
router.get('/canjes/pendientes', requireAdmin, rewardController.getPending);

// 10. Aprobar canje personal (Solo Jefe de Hogar)
router.patch('/canjes/:id/aprobar', requireAdmin, rewardController.approve);

// 11. Rechazar canje personal y reembolsar monedas (Solo Jefe de Hogar)
router.patch('/canjes/:id/rechazar', requireAdmin, rewardController.reject);

export default router;