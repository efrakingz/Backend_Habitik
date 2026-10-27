import { Router } from 'express';
import { FeedController } from '../controllers/FeedController';
import { verifyToken } from '../middleware/auth';

const router = Router();

// GET /feed (Listar muro familiar con paginación cursor-based)
router.get('/', verifyToken, FeedController.listarFeed);

// POST /feed/:id/react (Reaccionar / Like con toggle atómico y emisión WebSocket)
router.post('/:id/react', verifyToken, FeedController.reaccionarActividad);
router.post('/:id/reaccionar', verifyToken, FeedController.reaccionarActividad);

// DELETE /feed/:id/react (Quitar reacción explícitamente)
router.delete('/:id/react', verifyToken, FeedController.eliminarReaccion);
router.delete('/:id/reaccionar', verifyToken, FeedController.eliminarReaccion);

export default router;