import { Request, Response } from 'express';
import { LogrosService } from '../services/logrosService';

export const obtenerLogros = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.user_id || req.params.userId;
    const logros = await LogrosService.obtenerLogrosUsuario(userId);
    const nivel = await LogrosService.obtenerNivelCalculado(userId);

    res.status(200).json({
      nivel_actual: nivel,
      logros: logros
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error al consultar logros.', error: error.message });
  }
};

export const reclamarLogro = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Prioriza el token, pero acepta 'user_id' o 'userId' del body para pruebas
    const userId = (req as any).user?.id || (req as any).user?.user_id || req.body.user_id || req.body.userId;
    const { logroId } = req.body;

    if (!userId) {
      res.status(400).json({ message: 'No se identificó el ID de usuario. Envía el token de autenticación o el campo user_id en el body.' });
      return;
    }

    if (!logroId) {
      res.status(400).json({ message: 'El parámetro logroId es requerido.' });
      return;
    }

    const resultado = await LogrosService.reclamarRecompensa(userId, logroId);
    res.status(200).json({
      message: 'Monedas de logro otorgadas con éxito.',
      data: resultado
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};