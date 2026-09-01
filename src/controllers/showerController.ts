import { Request, Response } from 'express';
import { ChallengesService } from '../services/challengesService';

/**
 * ============================================================
 * CONTROLADOR DE DUCHA (RETO) — /reto
 * ============================================================
 */
export const registerShower = async (req: Request, res: Response): Promise<void> => {
  // Extraer userId del JWT (req.auth) o del body como fallback
  const userId = req.auth?.user_id || (req as any).user?.id || req.body.user_id;
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
    // Delegar transacción completa SQL a ChallengesService
    const resultado = await ChallengesService.finalizarDucha(userId, familyId, duracion);

    if (!resultado.es_valido) {
      // Ducha menor a 3 minutos (< 180s) → regla anti-trampa activada
      res.status(200).json({
        message: 'Registro guardado, pero marcado como inválido. La ducha fue menor a 3 minutos.',
        log: resultado.log,
        recompensas: {
          xp_ganada: resultado.xp_ganada,
          monedas_ganadas: resultado.monedas_ganadas,
          total_xp: resultado.total_xp,
          saldo_monedas: resultado.saldo_monedas,
          nivel_actual: resultado.nivel_actual,
          level_up: resultado.level_up
        },
        valido: false,
        razon: 'La duración mínima válida es de 3 minutos (180 segundos).'
      });
      return;
    }

    // Ducha válida → guarda tiempo, suma XP/monedas y actualiza el perfil en PostgreSQL
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
        level_up: resultado.level_up
      },
      valido: true
    });
  } catch (error) {
    console.error('[showerController.registerShower]', error);
    res.status(500).json({ message: 'Error interno al registrar la ducha.' });
  }
};