import { Request, Response } from 'express';
import { WordleService } from '../services/wordleService';

const wordleService = new WordleService();

export const getWordleHoy = async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth?.user_id || req.body.user_id;
  if (!userId) {
    res.status(401).json({ message: 'No autenticado.' });
    return;
  }

  try {
    const data = await wordleService.getTodayGame(userId);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Error al obtener el Wordle.' });
  }
};

export const postWordleIntentar = async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth?.user_id || req.body.user_id;
  const { intento } = req.body;

  if (!userId || !intento) {
    res.status(400).json({ message: 'Faltan datos requeridos (user_id o intento).' });
    return;
  }

  try {
    const resultado = await wordleService.submitGuess(userId, intento);
    res.status(200).json({ success: true, ...resultado });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Error al procesar el intento.' });
  }
};

export const postWordlePista = async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth?.user_id || req.body.user_id;
  if (!userId) {
    res.status(401).json({ message: 'No autenticado.' });
    return;
  }

  try {
    const resultado = await wordleService.unlockHint(userId);
    res.status(200).json({ success: true, ...resultado });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Error al canjear la pista.' });
  }
};