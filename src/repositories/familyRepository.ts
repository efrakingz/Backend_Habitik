import { PoolClient } from 'pg';
import { query } from '../config/db';
import { Family } from '../models/types';

export class FamilyRepository {
  async createFamily(nombre: string, familyCode: string, client?: PoolClient): Promise<Family> {
    const sql = `
      INSERT INTO public.families (nombre, family_code) 
      VALUES ($1, $2) 
      RETURNING *
    `;
    const params = [nombre, familyCode];

    const res = client
      ? await client.query(sql, params)
      : await query(sql, params);

    return res.rows[0];
  }

  async updateProfileFamily(profileId: string, familyId: string | null, rol: string, client?: PoolClient): Promise<void> {
    const sql = 'UPDATE public.profiles SET family_id = $1, rol = $2 WHERE id = $3';
    const params = [familyId, rol, profileId];

    if (client) {
      await client.query(sql, params);
    } else {
      await query(sql, params);
    }
  }

  async findByCode(familyCode: string): Promise<Family | null> {
    const res = await query('SELECT * FROM public.families WHERE family_code = $1', [familyCode.toUpperCase().trim()]);
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  async findById(familyId: string): Promise<Family | null> {
    const res = await query('SELECT * FROM public.families WHERE id = $1', [familyId]);
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  async updateFamilyName(familyId: string, nombre: string): Promise<Family> {
    const res = await query(
      'UPDATE public.families SET nombre = $1 WHERE id = $2 RETURNING *',
      [nombre, familyId]
    );
    return res.rows[0];
  }
}
