import { Request, Response } from 'express';
import { ChallengesService } from '../services/challengesService';

export const finalizarDuchaController = async (req: Request, res: Response) => {
  try {
    const { user_id, family_id, tiempo_segundos } = req.body;
    const data = await ChallengesService.finalizarDucha(user_id, family_id, Number(tiempo_segundos));
    return res.status(200).json({ ok: true, data });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
};

export const completarPuzzleController = async (req: Request, res: Response) => {
  try {
    const { user_id, errores } = req.body;
    const data = await ChallengesService.completarPuzzle(user_id, Number(errores || 0));
    return res.status(200).json({ ok: true, data });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
};

export const bonusConstanciaController = async (req: Request, res: Response) => {
  try {
    const { user_id } = req.body;
    const data = await ChallengesService.evaluarConstanciaDiaria(user_id);
    return res.status(200).json({ ok: true, data });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
};

export const obtenerPerfilController = async (req: Request, res: Response) => {
  try {
    const { user_id } = req.params;
    const data = await ChallengesService.obtenerPerfilGamificado(user_id);
    return res.status(200).json({ ok: true, data });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
};