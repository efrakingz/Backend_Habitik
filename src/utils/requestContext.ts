import { Request } from 'express';
import { pool } from '../config/db';

/**
 * Extrae el user_id autenticado desde el token JWT (`req.auth` o `req.user`).
 */
export function resolveUserId(req: Request): string | null {
  return (req as any).auth?.user_id || (req as any).user?.id || null;
}

/**
 * Resuelve el family_id del usuario de forma robusta y unificada:
 * 1. Desde req.auth.family_id o req.user.family_id (payload del token JWT)
 * 2. Si viene por query param (?family_id=...) o header (x-family-id)
 * 3. Si no viene en el token (ej: emitido antes del onboarding o de unirse),
 *    se consulta directamente a public.profiles por user_id en la BD.
 */
export async function resolveFamilyId(req: Request): Promise<string | null> {
  const tokenFamilyId = (req as any).auth?.family_id || (req as any).user?.family_id;
  if (tokenFamilyId) return String(tokenFamilyId);

  if (req.query.family_id && typeof req.query.family_id === 'string' && req.query.family_id.trim().length > 0) {
    return req.query.family_id.trim();
  }

  if (req.headers['x-family-id'] && typeof req.headers['x-family-id'] === 'string' && req.headers['x-family-id'].trim().length > 0) {
    return req.headers['x-family-id'].trim();
  }

  const userId = resolveUserId(req);
  if (userId) {
    const prof = await pool.query('SELECT family_id FROM public.profiles WHERE id = $1', [userId]);
    if (prof.rows.length > 0 && prof.rows[0].family_id) {
      return String(prof.rows[0].family_id);
    }
  }

  return null;
}
