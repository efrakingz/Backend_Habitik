import { Request, Response } from 'express';
import { LogrosService } from '../services/logrosService';

export const obtenerLogros = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || req.params.userId;
    // Asegúrate de que en LogrosService el método se llame 'obtenerLogrosUsuario'
    const logros = await LogrosService.obtenerLogrosUsuario(userId);
    
    res.status(200).json({
      ok: true,
      logros: logros
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error al obtener logros.', error: error.message });
  }
};

export const reclamarLogroController = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.user_id || (req as any).auth?.id || (req as any).user?.id || req.body.user_id;
    const logroId = req.body.logroId || req.body.logro_id;

    if (!userId) {
      return res.status(401).json({ message: 'Usuario no autenticado.' });
    }

    if (!logroId) {
      return res.status(400).json({ message: 'El campo logroId es obligatorio.' });
    }

    const resultado = await LogrosService.reclamarRecompensa(userId, logroId);
    return res.status(200).json({
      message: 'Monedas de logro otorgadas con éxito.',
      data: resultado
    });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};