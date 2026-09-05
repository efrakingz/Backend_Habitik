import { Router } from 'express';
import { obtenerLogros, reclamarLogro } from '../controllers/logrosController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.get('/:userId', verifyToken, obtenerLogros);
router.post('/reclamar', verifyToken, reclamarLogro);

export default router;