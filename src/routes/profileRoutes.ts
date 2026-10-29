import { Router } from 'express';
import { ProfileController } from '../controllers/profileController';
import { verifyToken } from '../middleware/auth'; // Asegúrate de apuntar a tu middleware de token

const router = Router();

router.use(verifyToken);
router.put('/editar', ProfileController.editarPerfil);

export default router;