import { Router } from 'express';
import { createTriviaController } from '../controllers/triviaController';
import { verifyToken } from '../middleware/auth';
import { TriviaService, triviaService } from '../services/triviaService';

export function createTriviaRouter(service: TriviaService = triviaService): Router {
  const router = Router();
  const controller = createTriviaController(service);
  router.post('/iniciar', verifyToken, controller.iniciar);
  router.get('/pregunta', verifyToken, controller.pregunta);
  router.post('/respuesta', verifyToken, controller.responder);
  router.post('/vida-extra', verifyToken, controller.vidaExtra);
  router.post('/finalizar', verifyToken, controller.finalizar);
  return router;
}

export default createTriviaRouter();
