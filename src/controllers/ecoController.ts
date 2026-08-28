import { Request, Response } from 'express';
// Importamos la capa de servicio que contiene la lógica de negocio del Eco-Puzzle
import { EcoService } from '../services/ecoService';

export class EcoController {
  /**
   * Controlador de entrada HTTP para procesar la finalización del juego Eco-Puzzle.
   * Maneja las peticiones de tipo POST /eco/completar.
   */
  static async completarEcoPuzzle(req: Request, res: Response) {
    try {
      // Extraemos el 'userId' desde el token JWT inyectado en el middleware (req.user)
      // O en su defecto, lo buscamos en el cuerpo de la petición (soporte de pruebas)
      const userId = (req as any).user?.id || req.body.user_id;

      // Desestructuramos los parámetros numéricos enviados en el JSON del body
      const { errores, tiempo_segundos } = req.body;

      // VALIDACIÓN DE ENTRADA: Verificamos que los parámetros requeridos no vengan undefined o nulos
      if (!userId || errores === undefined || tiempo_segundos === undefined) {
        return res.status(400).json({ 
          ok: false,
          error: 'Faltan parámetros obligatorios en la petición (user_id, errores, tiempo_segundos)' 
        });
      }

      // Invocamos al servicio convirtiendo explícitamente a números para evitar problemas de tipos de datos
      const result = await EcoService.completarEcoPuzzle(
        userId, 
        Number(errores), 
        Number(tiempo_segundos)
      );

      // Respondemos con un código HTTP 200 (Éxito) y estructuramos el JSON de respuesta
      return res.status(200).json({
        ok: true,
        message: result.recompensas.valido 
          ? 'Eco-Puzzle completado con éxito' 
          : 'Partida finalizada sin recompensas. Superaste el límite de 3 errores o el tiempo máximo de 60 segundos.',
        data: result
      });

    } catch (error: any) {
      // Capturamos cualquier excepción imprevista y devolvemos un código HTTP 500 (Internal Server Error)
      console.error('Error en EcoController.completarEcoPuzzle:', error);
      return res.status(500).json({ 
        ok: false,
        error: error.message || 'Ocurrió un error interno al procesar el reto' 
      });
    }
  }
}