import { Request, Response } from 'express';
import { EcoService } from '../services/ecoService';

export class EcoController {
  static async completarEcoPuzzle(req: Request, res: Response) {
    try {
      const userId = req.auth?.user_id || req.body.user_id;

      const { errores, tiempo_segundos } = req.body;

      if (!userId || errores === undefined || tiempo_segundos === undefined) {
        return res.status(400).json({ 
          ok: false,
          error: 'Faltan parámetros obligatorios en la petición (user_id, errores, tiempo_segundos)' 
        });
      }

      const result = await EcoService.completarEcoPuzzle(
        userId, 
        Number(errores), 
        Number(tiempo_segundos)
      );

      return res.status(200).json({
        ok: true,
        message: result.recompensas.valido 
          ? 'Eco-Puzzle completado con éxito' 
          : 'Partida finalizada sin recompensas. Superaste el límite de 3 errores o el tiempo máximo de 60 segundos.',
        data: result
      });

    } catch (error: any) {
      console.error('Error en EcoController.completarEcoPuzzle:', error);
      return res.status(500).json({ 
        ok: false,
        error: error.message || 'Ocurrió un error interno al procesar el reto' 
      });
    }
  }
}
