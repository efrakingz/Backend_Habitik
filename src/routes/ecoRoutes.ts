import { Router } from 'express';
import { completarPuzzle } from '../controllers/ecoController';
import { verifyToken } from '../middleware/auth';

const router = Router();

// Ruta protegida con JWT para registrar término del Eco-Puzzle
router.post('/completar', verifyToken, completarPuzzle);

export default router;