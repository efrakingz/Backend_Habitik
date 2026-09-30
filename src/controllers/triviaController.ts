import { Request, Response } from 'express';
import { TriviaConflictError, TriviaNotFoundError, TriviaService, triviaService } from '../services/triviaService';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createTriviaController(service: TriviaService = triviaService) {
  const handleError = (error: unknown, res: Response) => {
    if (error instanceof TriviaNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }
    if (error instanceof TriviaConflictError) {
      res.status(409).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Error interno al procesar la trivia.' });
  };

  const sessionId = (req: Request, res: Response): string | null => {
    const value = req.method === 'GET' ? req.query.sesion_id : req.body?.sesion_id;
    if (typeof value !== 'string' || !uuidPattern.test(value)) {
      res.status(400).json({ message: 'sesion_id debe ser un UUID válido.' });
      return null;
    }
    return value;
  };

  return {
    iniciar: async (req: Request, res: Response) => {
      try {
        const result = await service.iniciar(req.auth!.user_id, req.auth!.family_id);
        res.status(result.created ? 201 : 200).json(result.session);
      } catch (error) {
        handleError(error, res);
      }
    },
    pregunta: async (req: Request, res: Response) => {
      const id = sessionId(req, res);
      if (!id) return;
      try {
        const question = await service.obtenerPregunta(req.auth!.user_id, id);
        res.status(200).json({
          pregunta_id: question.pregunta_id,
          pregunta: question.pregunta,
          alternativas: question.alternativas,
          categoria: question.categoria,
          dificultad: question.dificultad,
          limite_segundos: question.limite_segundos,
          iniciada_en: question.iniciada_en,
        });
      } catch (error) {
        handleError(error, res);
      }
    },
    responder: async (req: Request, res: Response) => {
      const id = sessionId(req, res);
      if (!id) return;
      const questionId = req.body?.pregunta_id;
      const selected = req.body?.opcion_seleccionada;
      if (typeof questionId !== 'string' || !uuidPattern.test(questionId)) {
        res.status(400).json({ message: 'pregunta_id debe ser un UUID válido.' });
        return;
      }
      if (selected !== null && (!Number.isInteger(selected) || selected < 0 || selected > 3)) {
        res.status(400).json({ message: 'opcion_seleccionada debe ser null o un entero entre 0 y 3.' });
        return;
      }
      try {
        res.status(200).json(await service.responder(req.auth!.user_id, id, questionId, selected));
      } catch (error) {
        handleError(error, res);
      }
    },
    vidaExtra: async (req: Request, res: Response) => {
      const id = sessionId(req, res);
      if (!id) return;
      try {
        res.status(200).json(await service.comprarVidaExtra(req.auth!.user_id, id));
      } catch (error) {
        handleError(error, res);
      }
    },
    finalizar: async (req: Request, res: Response) => {
      const id = sessionId(req, res);
      if (!id) return;
      try {
        res.status(200).json(await service.finalizar(req.auth!.user_id, id));
      } catch (error) {
        handleError(error, res);
      }
    },
  };
}
