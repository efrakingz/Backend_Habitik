import { CreateFamilyRewardInput } from '../models/types';
import { RewardRepository } from '../repositories/rewardRepository';

const rewardRepository = new RewardRepository();

export class RewardService {
  listRewards(familyId: string) {
    return rewardRepository.listByFamily(familyId);
  }

  createReward(familyId: string, creatorId: string, input: CreateFamilyRewardInput) {
    if (!input.titulo || input.titulo.trim().length === 0) {
      throw new Error('REWARD_TITLE_REQUIRED');
    }

    if (input.costo !== undefined && (!Number.isInteger(input.costo) || input.costo <= 0)) {
      throw new Error('INVALID_REWARD_COST');
    }

    return rewardRepository.create(familyId, creatorId, input);
  }

  updateAvailability(rewardId: number, familyId: string, disponible: boolean) {
    return rewardRepository.updateAvailability(rewardId, familyId, disponible);
  }

  deleteReward(rewardId: number, familyId: string) {
    return rewardRepository.delete(rewardId, familyId);
  }

  async redeemReward(rewardId: number, userId: string) {
    return rewardRepository.withTransaction(async (client) => {
      const profile = await rewardRepository.getProfileForUpdate(client, userId);
      if (!profile || !profile.family_id) {
        throw new Error('PROFILE_WITHOUT_FAMILY');
      }

      const reward = await rewardRepository.getRewardForUpdate(client, rewardId);
      if (!reward || reward.family_id !== profile.family_id) {
        throw new Error('REWARD_NOT_FOUND');
      }

      if (!reward.disponible) {
        throw new Error('REWARD_NOT_AVAILABLE');
      }

      if ((profile.monedas || 0) < reward.costo) {
        throw new Error('INSUFFICIENT_COINS');
      }

      const existingRedemptions = reward.es_familiar
        ? await rewardRepository.countFamilyRedemptionsThisMonth(client, profile.family_id, rewardId)
        : await rewardRepository.countIndividualRedemptionsToday(client, userId, rewardId);

      if (existingRedemptions > 0) {
        throw new Error(reward.es_familiar ? 'FAMILY_REWARD_MONTHLY_LIMIT' : 'INDIVIDUAL_REWARD_DAILY_LIMIT');
      }

      const updatedProfile = await rewardRepository.subtractCoins(client, userId, reward.costo);
      const redemption = await rewardRepository.createRedemption(
        client,
        reward.id,
        userId,
        profile.family_id,
        reward.costo
      );
      await rewardRepository.markRedeemedNow(client, reward.id);

      return {
        reward,
        redemption,
        monedas_restantes: updatedProfile.monedas
      };
    });
  }

  async reactivateCurrentWindow(rewardId: number, familyId: string) {
    const reward = await rewardRepository.findByFamily(rewardId, familyId);
    if (!reward) {
      throw new Error('REWARD_NOT_FOUND');
    }

    const deleted = await rewardRepository.clearCurrentRedemptionWindow(
      rewardId,
      familyId,
      reward.es_familiar
    );

    return { deleted };
  }
}
