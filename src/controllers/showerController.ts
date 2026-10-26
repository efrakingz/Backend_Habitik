import { Request, Response } from 'express';
import { ShowerService } from '../services/showerService';
import { StreakService } from '../services/streakService';

const showerService = new ShowerService();

export const iniciarDucha = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).auth?.user_id || req.body.user_id;

  if (!userId) {
    res.status(401).json({ message: 'No autenticado o user_id faltante.' });
    return;
  }

  try {
    const resultado = await showerService.startShower(userId);
    res.status(201).json({
      success: true,
      message: 'Ducha iniciada correctamente en el servidor.',
      data: resultado
    });
  } catch (error: any) {
    console.error('[showerController.iniciarDucha]', error);
    res.status(500).json({ success: false, message: 'Error interno al iniciar la ducha.' });
  }
};

export const finalizarDucha = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).auth?.user_id || req.body.user_id;
  const { duracion_segundos } = req.body;

  if (!userId) {
    res.status(401).json({ message: 'No autenticado o user_id faltante.' });
    return;
  }

  try {
    const resultado = await showerService.finishShower(userId, duracion_segundos ? Number(duracion_segundos) : undefined);

    if (!resultado.recompensas.es_valido) {
      res.status(400).json({
        message: 'Acción rechazada: La duración mínima para registrar el reto es de 4 minutos (240 segundos).',
        guardado: false,
        valido: false,
        tiempo_segundos: resultado.recompensas.tiempo_segundos
      });
      return;
    }

    const duracion = resultado.recompensas.tiempo_segundos;
    const minutos = Math.floor(duracion / 60);
    const segundos = duracion % 60;

    res.status(200).json({
      message: `Ducha registrada exitosamente por el backend: ${minutos}m ${segundos}s.`,
      log: resultado.log,
      recompensas: resultado.recompensas,
      guardado: true,
      valido: true
    });
  } catch (error: any) {
    console.error('[showerController.finalizarDucha]', error);
    res.status(400).json({ message: error.message || 'Error interno al finalizar la ducha.' });
  }
};

export const getRachaSemanal = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).auth?.user_id || req.params.user_id || req.query.user_id;

  if (!userId || typeof userId !== 'string') {
    res.status(400).json({ message: 'El parámetro user_id es obligatorio.' });
    return;
  }

  try {
    const racha = await StreakService.obtenerRachaSemanal(userId);
    res.status(200).json({ ok: true, data: racha });
  } catch (error: any) {
    console.error('[showerController.getRachaSemanal]', error);
    res.status(500).json({ message: 'Error al calcular la racha semanal.' });
  }
};