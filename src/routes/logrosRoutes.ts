import { Router } from 'express';
import { obtenerLogros, reclamarLogro } from '../controllers/logrosController';
import { verifyToken } from '../middleware/auth'; // Ajusta la ruta de tu middleware si es distinta

const router = Router();

// GET /logros/:userId -> Devuelve la vitrina completa
router.get('/:userId', verifyToken, obtenerLogros);

// POST /logros/reclamar -> Abona las monedas del logro al perfil
router.post('/reclamar', verifyToken, reclamarLogro);

export default router;