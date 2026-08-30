import { Request, Response } from 'express';
import { RewardService } from '../services/rewardService';

const rewardService = new RewardService();

const parseRewardId = (value: string): number | null => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export const listRewards = async (req: Request, res: Response): Promise<void> => {
  const familyId = req.auth?.family_id;

  if (!familyId) {
    res.status(400).json({ message: 'No perteneces a ningun grupo familiar.' });
    return;
  }

  try {
    const rewards = await rewardService.listRewards(familyId);
    res.json(rewards);
  } catch (error) {
    console.error('[rewardController.listRewards]', error);
    res.status(500).json({ message: 'Error interno al listar recompensas.' });
  }
};

export const createReward = async (req: Request, res: Response): Promise<void> => {
  const familyId = req.auth?.family_id;
  const userId = req.auth?.user_id;

  if (!familyId || !userId) {
    res.status(400).json({ message: 'No perteneces a ningun grupo familiar.' });
    return;
  }

  try {
    const reward = await rewardService.createReward(familyId, userId, req.body);
    res.status(201).json(reward);
  } catch (error) {
    if (error instanceof Error && error.message === 'REWARD_TITLE_REQUIRED') {
      res.status(400).json({ message: 'El titulo de la recompensa es obligatorio.' });
      return;
    }
    if (error instanceof Error && error.message === 'INVALID_REWARD_COST') {
      res.status(400).json({ message: 'El costo debe ser un entero positivo.' });
      return;
    }
    console.error('[rewardController.createReward]', error);
    res.status(500).json({ message: 'Error interno al crear recompensa.' });
  }
};

export const updateRewardAvailability = async (req: Request, res: Response): Promise<void> => {
  const familyId = req.auth?.family_id;
  const rewardId = parseRewardId(req.params.id);

  if (!familyId) {
    res.status(400).json({ message: 'No perteneces a ningun grupo familiar.' });
    return;
  }
  if (!rewardId || typeof req.body.disponible !== 'boolean') {
    res.status(400).json({ message: 'reward id valido y disponible boolean son requeridos.' });
    return;
  }

  try {
    const reward = await rewardService.updateAvailability(rewardId, familyId, req.body.disponible);
    if (!reward) {
      res.status(404).json({ message: 'Recompensa no encontrada.' });
      return;
    }
    res.json(reward);
  } catch (error) {
    console.error('[rewardController.updateRewardAvailability]', error);
    res.status(500).json({ message: 'Error interno al actualizar recompensa.' });
  }
};

export const deleteReward = async (req: Request, res: Response): Promise<void> => {
  const familyId = req.auth?.family_id;
  const rewardId = parseRewardId(req.params.id);

  if (!familyId) {
    res.status(400).json({ message: 'No perteneces a ningun grupo familiar.' });
    return;
  }
  if (!rewardId) {
    res.status(400).json({ message: 'reward id valido es requerido.' });
    return;
  }

  try {
    const deleted = await rewardService.deleteReward(rewardId, familyId);
    if (!deleted) {
      res.status(404).json({ message: 'Recompensa no encontrada.' });
      return;
    }
    res.json({ message: 'Recompensa eliminada correctamente.' });
  } catch (error) {
    console.error('[rewardController.deleteReward]', error);
    res.status(500).json({ message: 'Error interno al eliminar recompensa.' });
  }
};

export const redeemReward = async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth?.user_id;
  const rewardId = parseRewardId(req.params.id);

  if (!userId) {
    res.status(401).json({ message: 'Token invalido.' });
    return;
  }
  if (!rewardId) {
    res.status(400).json({ message: 'reward id valido es requerido.' });
    return;
  }

  try {
    const result = await rewardService.redeemReward(rewardId, userId);
    res.status(201).json({
      message: 'Recompensa canjeada correctamente.',
      ...result
    });
  } catch (error) {
    if (!(error instanceof Error)) {
      res.status(500).json({ message: 'Error interno al canjear recompensa.' });
      return;
    }

    const statusByError: Record<string, number> = {
      PROFILE_WITHOUT_FAMILY: 400,
      REWARD_NOT_FOUND: 404,
      REWARD_NOT_AVAILABLE: 409,
      INSUFFICIENT_COINS: 409,
      FAMILY_REWARD_MONTHLY_LIMIT: 409,
      INDIVIDUAL_REWARD_DAILY_LIMIT: 409
    };

    const messageByError: Record<string, string> = {
      PROFILE_WITHOUT_FAMILY: 'El usuario no pertenece a ningun grupo familiar.',
      REWARD_NOT_FOUND: 'Recompensa no encontrada.',
      REWARD_NOT_AVAILABLE: 'La recompensa no esta disponible.',
      INSUFFICIENT_COINS: 'No tienes monedas suficientes.',
      FAMILY_REWARD_MONTHLY_LIMIT: 'Esta actividad familiar ya fue canjeada este mes.',
      INDIVIDUAL_REWARD_DAILY_LIMIT: 'Ya canjeaste esta recompensa hoy.'
    };

    if (statusByError[error.message]) {
      res.status(statusByError[error.message]).json({ message: messageByError[error.message] });
      return;
    }

    console.error('[rewardController.redeemReward]', error);
    res.status(500).json({ message: 'Error interno al canjear recompensa.' });
  }
};

export const reactivateRewardWindow = async (req: Request, res: Response): Promise<void> => {
  const familyId = req.auth?.family_id;
  const rewardId = parseRewardId(req.params.id);

  if (!familyId) {
    res.status(400).json({ message: 'No perteneces a ningun grupo familiar.' });
    return;
  }
  if (!rewardId) {
    res.status(400).json({ message: 'reward id valido es requerido.' });
    return;
  }

  try {
    const result = await rewardService.reactivateCurrentWindow(rewardId, familyId);
    res.json({
      message: 'Ventana de canje reactivada correctamente.',
      registros_eliminados: result.deleted
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'REWARD_NOT_FOUND') {
      res.status(404).json({ message: 'Recompensa no encontrada.' });
      return;
    }
    console.error('[rewardController.reactivateRewardWindow]', error);
    res.status(500).json({ message: 'Error interno al reactivar recompensa.' });
  }
};
