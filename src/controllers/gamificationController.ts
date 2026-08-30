import { Request, Response } from 'express';
import { GamificationService } from '../services/gamificationService';

/**
 * Controlador de Express encargado de procesar la petición HTTP para acreditar recompensas de juegos.
 */
export const otorgarRecompensaController = async (req: Request, res: Response) => {
  try {
    // Extraer los datos enviados en el cuerpo (body) de la solicitud JSON
    const { user_id, origen_actividad, progreso_porcentaje } = req.body;

    // Validación de parámetros de entrada obligatorios
    if (!user_id || !origen_actividad) {
      return res.status(400).json({
        ok: false,
        error: 'Faltan parámetros obligatorios (user_id, origen_actividad).'
      });
    }

    // Ejecutar el servicio de cálculo y acreditación de la recompensa
    const resultado = await GamificationService.otorgarRecompensaPorProgreso(
      user_id,
      origen_actividad,
      progreso_porcentaje !== undefined ? Number(progreso_porcentaje) : 100
    );

    // Responder con código HTTP 200 OK y la información detallada del saldo
    return res.status(200).json({
      ok: true,
      mensaje: 'Recompensa acreditada con éxito.',
      data: resultado
    });
  } catch (error: any) {
    // Manejo de errores de servidor o validación de reglas
    return res.status(500).json({
      ok: false,
      error: error.message || 'Error al procesar la recompensa de gamificación.'
    });
  }
};