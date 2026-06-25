import { Router } from 'express';
import { registerShower } from '../controllers/showerController';
import { verifyToken } from '../middleware/auth';

const router = Router();

// HU 2.1: Registrar duración de la ducha con validación anti-trampa
router.post('/ducha', verifyToken, registerShower);

export default router;
