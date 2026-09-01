import { PoolClient } from 'pg';
import { pool, query } from '../config/db';
import {
  CreateFamilyRewardInput,
  FamilyReward,
  FamilyRewardRedemption,
  Profile
} from '../models/types';

export class RewardRepository {
  async listByFamily(familyId: string): Promise<FamilyReward[]> {
    const res = await query(
      `SELECT *
       FROM public.family_rewards
       WHERE family_id = $1
       ORDER BY created_at DESC`,
      [familyId]
    );
    return res.rows;
  }

  async findByFamily(rewardId: number, familyId: string): Promise<FamilyReward | null> {
    const res = await query(
      `SELECT *
       FROM public.family_rewards
       WHERE id = $1 AND family_id = $2`,
      [rewardId, familyId]
    );
    return res.rows[0] || null;
  }

  async create(familyId: string, creatorId: string, input: CreateFamilyRewardInput): Promise<FamilyReward> {
    const res = await query(
      `INSERT INTO public.family_rewards
       (id, family_id, titulo, descripcion, emoji, costo, disponible, es_familiar, creador_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8, $9::jsonb)
       RETURNING *`,
      [
        Date.now(),
        familyId,
        input.titulo.trim(),
        input.descripcion?.trim() || null,
        input.emoji || 'gift',
        input.costo ?? 100,
        input.es_familiar ?? false,
        creatorId,
        JSON.stringify(input.metadata || {})
      ]
    );
    return res.rows[0];
  }

  async updateAvailability(rewardId: number, familyId: string, disponible: boolean): Promise<FamilyReward | null> {
    const res = await query(
      `UPDATE public.family_rewards
       SET disponible = $3
       WHERE id = $1 AND family_id = $2
       RETURNING *`,
      [rewardId, familyId, disponible]
    );
    return res.rows[0] || null;
  }

  async delete(rewardId: number, familyId: string): Promise<boolean> {
    const res = await query(
      `DELETE FROM public.family_rewards
       WHERE id = $1 AND family_id = $2`,
      [rewardId, familyId]
    );
    return (res.rowCount || 0) > 0;
  }

  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getProfileForUpdate(client: PoolClient, userId: string): Promise<Profile | null> {
    const res = await client.query(
      `SELECT *
       FROM public.profiles
       WHERE id = $1
       FOR UPDATE`,
      [userId]
    );
    return res.rows[0] || null;
  }

  async getRewardForUpdate(client: PoolClient, rewardId: number): Promise<FamilyReward | null> {
    const res = await client.query(
      `SELECT *
       FROM public.family_rewards
       WHERE id = $1
       FOR UPDATE`,
      [rewardId]
    );
    return res.rows[0] || null;
  }

  async countIndividualRedemptionsToday(client: PoolClient, userId: string, rewardId: number): Promise<number> {
    const res = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM public.canjes
       WHERE user_id = $1
         AND reward_id = $2
         AND created_at >= date_trunc('day', NOW())`,
      [userId, rewardId]
    );
    return res.rows[0].total;
  }

  async countFamilyRedemptionsThisMonth(client: PoolClient, familyId: string, rewardId: number): Promise<number> {
    const res = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM public.canjes
       WHERE family_id = $1
         AND reward_id = $2
         AND created_at >= date_trunc('month', NOW())`,
      [familyId, rewardId]
    );
    return res.rows[0].total;
  }

  async subtractCoins(client: PoolClient, userId: string, cost: number): Promise<Profile> {
    const res = await client.query(
      `UPDATE public.profiles
       SET monedas = monedas - $2
       WHERE id = $1
       RETURNING *`,
      [userId, cost]
    );
    return res.rows[0];
  }

  async createRedemption(
    client: PoolClient,
    rewardId: number,
    userId: string,
    familyId: string,
    cost: number
  ): Promise<FamilyRewardRedemption> {
    const res = await client.query(
      `INSERT INTO public.canjes
       (reward_id, user_id, family_id, costo_pagado)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [rewardId, userId, familyId, cost]
    );
    return res.rows[0];
  }

  async markRedeemedNow(client: PoolClient, rewardId: number): Promise<void> {
    await client.query(
      `UPDATE public.family_rewards
       SET last_redeemed_at = NOW()
       WHERE id = $1`,
      [rewardId]
    );
  }

  async clearCurrentRedemptionWindow(rewardId: number, familyId: string, esFamiliar: boolean): Promise<number> {
    const sql = esFamiliar
      ? `DELETE FROM public.canjes
         WHERE reward_id = $1
           AND family_id = $2
           AND created_at >= date_trunc('month', NOW())`
      : `DELETE FROM public.canjes
         WHERE reward_id = $1
           AND family_id = $2
           AND created_at >= date_trunc('day', NOW())`;

    const res = await query(sql, [rewardId, familyId]);
    return res.rowCount || 0;
  }
}
