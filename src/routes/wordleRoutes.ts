import { Router } from 'express';
import { getWordleHoy, postWordleIntentar, postWordlePista } from '../controllers/wordleController';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.get('/hoy', verifyToken, getWordleHoy);
router.post('/intentar', verifyToken, postWordleIntentar);
router.post('/pista', verifyToken, postWordlePista);

export default router;