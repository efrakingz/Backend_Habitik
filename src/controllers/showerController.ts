import { Request, Response } from 'express';
import { ShowerService } from '../services/showerService';
import { StreakService } from '../services/streakService';

const showerService = new ShowerService();

/**
 * ============================================================
 * CONTROLADOR DE DUCHA Y RACHAS (RETO) — /reto
 * ============================================================
 */

/**
 * Momento 1: Inicia la ducha. Registra el timestamp de inicio en el servidor (NOW()).
 */
export const iniciarDucha = async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth?.user_id || req.body.user_id;

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
  } catch (error) {
    console.error('[showerController.iniciarDucha]', error);
    res.status(500).json({ success: false, message: 'Error interno al iniciar la ducha.' });
  }
};

/**
 * Momento 2: Finaliza la ducha. El backend calcula de forma autoritaria el tiempo
 * transcurrido, valida la regla anti-trampa (>= 180s) y otorga las recompensas.
 */
export const finalizarDucha = async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth?.user_id || req.body.user_id;

  if (!userId) {
    res.status(401).json({ message: 'No autenticado o user_id faltante.' });
    return;
  }

  try {
    const resultado = await showerService.finishShower(userId);

    if (!resultado.recompensas.es_valido) {
      res.status(400).json({
        message: 'Acción rechazada: La duración mínima para activar y registrar el reto es de 3 minutos (180 segundos).',
        guardado: false,
        valido: false,
        tiempo_segundos: resultado.recompensas.tiempo_segundos,
        razon: 'La ducha fue menor a 3 minutos.'
      });
      return;
    }

    const duracion = resultado.recompensas.tiempo_segundos;
    const minutos = Math.floor(duracion / 60);
    const segundos = duracion % 60;

    res.status(200).json({
      message: `Ducha medida y registrada exitosamente por el backend: ${minutos}m ${segundos}s.`,
      log: resultado.log,
      recompensas: {
        xp_ganada: resultado.recompensas.xp_ganada,
        monedas_ganadas: resultado.recompensas.monedas_ganadas,
        total_xp: resultado.recompensas.total_xp,
        saldo_monedas: resultado.recompensas.saldo_monedas,
        nivel_actual: resultado.recompensas.nivel_actual,
        level_up: resultado.recompensas.level_up
      },
      guardado: true,
      valido: true
    });
  } catch (error: any) {
    console.error('[showerController.finalizarDucha]', error);
    res.status(400).json({ message: error.message || 'Error interno al finalizar la ducha.' });
  }
};

/**
 * Consulta la racha semanal del usuario mediante el procedimiento almacenado
 * en PostgreSQL public.calcular_racha_semanal.
 */
export const getRachaSemanal = async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth?.user_id || req.params.user_id || req.query.user_id;

  if (!userId || typeof userId !== 'string') {
    res.status(400).json({ message: 'El parámetro user_id es obligatorio.' });
    return;
  }

  try {
    const racha = await StreakService.obtenerRachaSemanal(userId);
    res.status(200).json({
      ok: true,
      data: racha
    });
  } catch (error) {
    console.error('[showerController.getRachaSemanal]', error);
    res.status(500).json({ message: 'Error al calcular la racha semanal.' });
  }
};