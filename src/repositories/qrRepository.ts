import { PoolClient } from 'pg';
import { query } from '../config/db';
import { QrToken } from '../models/types';

export class QrRepository {
  async createInviteToken(familyId: string, token: string, expiresAt: Date): Promise<QrToken> {
    const res = await query(
      `INSERT INTO public.qr_tokens (family_id, token, expires_at, used) 
       VALUES ($1, $2, $3, false) 
       RETURNING *`,
      [familyId, token, expiresAt]
    );
    return res.rows[0];
  }

  async findInviteToken(token: string): Promise<QrToken | null> {
    const res = await query('SELECT * FROM public.qr_tokens WHERE token = $1', [token]);
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  async markTokenAsUsed(token: string, client?: PoolClient): Promise<void> {
    const sql = 'UPDATE public.qr_tokens SET used = true WHERE token = $1';
    if (client) {
      await client.query(sql, [token]);
    } else {
      await query(sql, [token]);
    }
  }
}
