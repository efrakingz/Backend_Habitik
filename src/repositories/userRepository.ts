import { PoolClient } from 'pg';
import { query } from '../config/db';
import { User, Profile } from '../models/types';

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const res = await query('SELECT * FROM public.users WHERE email = $1', [email.toLowerCase().trim()]);
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  async findById(id: string): Promise<User | null> {
    const res = await query('SELECT * FROM public.users WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  async createUser(email: string, passwordHash: string, client?: PoolClient): Promise<string> {
    const sql = 'INSERT INTO public.users (email, password_hash) VALUES ($1, $2) RETURNING id';
    const params = [email.toLowerCase().trim(), passwordHash];
    
    const res = client 
      ? await client.query(sql, params)
      : await query(sql, params);
      
    return res.rows[0].id;
  }

  async createProfile(profile: Partial<Profile>, client?: PoolClient): Promise<Profile> {
    const sql = `
      INSERT INTO public.profiles 
      (id, email, nombre, avatar_letra, avatar_color, rol, xp, nivel, monedas) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING *
    `;
    const params = [
      profile.id,
      profile.email?.toLowerCase().trim(),
      profile.nombre,
      profile.avatar_letra || 'U',
      profile.avatar_color || '#2e7d32',
      profile.rol || 'miembro',
      profile.xp || 0,
      profile.nivel || 1,
      profile.monedas || 0
    ];

    const res = client
      ? await client.query(sql, params)
      : await query(sql, params);

    return res.rows[0];
  }

  async getProfileById(id: string): Promise<Profile | null> {
    const sql = `
      SELECT p.*, f.nombre AS family_name, f.family_code 
      FROM public.profiles p 
      LEFT JOIN public.families f ON p.family_id = f.id 
      WHERE p.id = $1
    `;
    const res = await query(sql, [id]);
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }
}
