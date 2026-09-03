import { Request, Response } from 'express';
import { ChallengesService } from '../services/challengesService';

/**
 * ============================================================
 * CONTROLADOR DE DUCHA (RETO) — /reto
 * ============================================================
 */
export const registerShower = async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth?.user_id || req.body.user_id;
  const familyId = req.auth?.family_id || req.body.family_id || null;

  if (!userId) {
    res.status(401).json({ message: 'No autenticado o user_id faltante.' });
    return;
  }

  const { duracion_segundos } = req.body;

  if (duracion_segundos === undefined || duracion_segundos === null) {
    res.status(400).json({
      message: 'El campo duracion_segundos es requerido.',
      hint: 'Envía el tiempo medido en segundos: { "duracion_segundos": 240 }'
    });
    return;
  }

  const duracion = Number(duracion_segundos);

  if (isNaN(duracion) || duracion <= 0) {
    res.status(400).json({
      message: 'duracion_segundos debe ser un número entero positivo.'
    });
    return;
  }

  try {
    const resultado = await ChallengesService.finalizarDucha(userId, familyId, duracion);

    if (!resultado.guardado) {
      res.status(400).json({
        message: 'Acción rechazada: La duración mínima para activar y registrar el reto es de 4 minutos (240 segundos).',
        guardado: false,
        valido: false,
        razon: resultado.mensaje
      });
      return;
    }

    const minutos = Math.floor(duracion / 60);
    const segundos = duracion % 60;

    res.status(201).json({
      message: `Ducha registrada exitosamente: ${minutos}m ${segundos}s.`,
      log: resultado.log,
      recompensas: {
        xp_ganada: resultado.xp_ganada,
        monedas_ganadas: resultado.monedas_ganadas,
        total_xp: resultado.total_xp,
        saldo_monedas: resultado.saldo_monedas,
        nivel_actual: resultado.nivel_actual,
        level_up: resultado.level_up,
        racha_dias: resultado.racha_dias
      },
      guardado: true,
      valido: true
    });
  } catch (error) {
    console.error('[showerController.registerShower]', error);
    res.status(500).json({ message: 'Error interno al registrar la ducha.' });
  }
};
