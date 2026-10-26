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

export const reclamarLogro = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || req.body.user_id;
    const { logroId } = req.body;

    if (!logroId) {
      res.status(400).json({ message: 'El campo logroId es obligatorio.' });
      return;
    }

    const resultado = await LogrosService.reclamarRecompensa(userId, logroId);
    res.status(200).json({
      message: 'Recompensa de logro reclamada exitosamente.',
      data: resultado
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};