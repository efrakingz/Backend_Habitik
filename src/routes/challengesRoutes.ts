import { Router } from 'express';
import {
  finalizarDuchaController,
  completarPuzzleController,
  bonusConstanciaController,
  obtenerPerfilController
} from '../controllers/challengesController';

const router = Router();

router.post('/reto/ducha/finalizar', finalizarDuchaController);
router.post('/reto/completar', completarPuzzleController);
router.post('/bonus/constancia', bonusConstanciaController);
router.get('/perfil/:user_id', obtenerPerfilController);

export default router;