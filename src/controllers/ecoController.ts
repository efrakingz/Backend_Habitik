import { Request, Response } from 'express';
import { ChallengesService } from '../services/challengesService';

/**
 * Controller para registrar el término del Eco-Puzzle y otorgar XP/Monedas
 */
export const completarPuzzle = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Extraer el userId del token JWT (inyectado en req.auth o req.user)
    const userId = (req as any).auth?.user_id || (req as any).auth?.userId || (req as any).user?.id || req.body.user_id;

    if (!userId) {
      res.status(401).json({ message: 'No autenticado o user_id faltante.' });
      return;
    }

    const { errores } = req.body;

    // 2. Validar que la cantidad de errores sea válida
    if (errores === undefined || errores === null || typeof errores !== 'number') {
      res.status(400).json({ 
        message: 'El campo "errores" es obligatorio y debe ser un número.' 
      });
      return;
    }

    // 3. Delegar la transacción SQL a ChallengesService
    const resultado = await ChallengesService.completarPuzzle(userId, errores);

    // 4. Retornar las recompensas otorgadas y el nuevo estado del perfil
    res.status(200).json({
      message: 'Eco-Puzzle completado exitosamente.',
      recompensas: resultado
    });
  } catch (error: any) {
    console.error('[ecoController.completarPuzzle]', error);

    // Manejar el límite de errores configurado en las reglas de negocio (>3 errores)
    if (error.message?.includes('límite de 3 errores')) {
      res.status(400).json({ message: error.message });
      return;
    }

    res.status(500).json({ 
      message: 'Error interno al procesar el Eco-Puzzle.', 
      error: error.message 
    });
  }
};