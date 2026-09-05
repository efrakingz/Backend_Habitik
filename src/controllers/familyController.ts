import { Request, Response } from 'express';
import { FamilyService } from '../services/familyService';
import { pool } from '../config/db';

const familyService = new FamilyService();

/**
 * Resuelve el family_id del usuario de forma robusta:
 * 1. Desde req.auth.family_id (payload del token JWT)
 * 2. Si viene por query param (?family_id=...) o header (x-family-id)
 * 3. Si no viene en el token (ej: emitido antes del onboarding o de unirse),
 *    se consulta directamente a public.profiles por req.auth.user_id en la BD.
 */
async function resolveFamilyId(req: Request): Promise<string | null> {
  if (req.auth?.family_id) return req.auth.family_id;
  if (req.query.family_id && typeof req.query.family_id === 'string' && req.query.family_id.trim().length > 0) {
    return req.query.family_id.trim();
  }
  if (req.headers['x-family-id'] && typeof req.headers['x-family-id'] === 'string' && req.headers['x-family-id'].trim().length > 0) {
    return req.headers['x-family-id'].trim();
  }
  if (req.auth?.user_id) {
    const prof = await pool.query('SELECT family_id FROM public.profiles WHERE id = $1', [req.auth.user_id]);
    if (prof.rows.length > 0 && prof.rows[0].family_id) {
      return prof.rows[0].family_id;
    }
  }
  return null;
}

/**
 * ============================================================
 * CONTROLADOR DE HOGAR FAMILIAR — /familia
 * ============================================================
 *
 * Maneja la creación y gestión del hogar:
 *   - Generar tokens de invitación QR para que otros se unan
 *   - Unirse a un hogar existente mediante un token de invitación
 *   - Actualizar el nombre del hogar (con restricción de 60 días)
 *
 * 📦 DATOS GUARDADOS EN LA BD:
 *   public.qr_tokens  → token UUID, family_id, expires_at, used (false/true)
 *   public.profiles   → family_id actualizado al unirse, rol = 'Miembro'
 *   public.families   → nombre actualizado al cambiar el nombre del hogar
 *
 * 🔐 SEGURIDAD:
 *   - GET /familia/invite     → requiere token JWT + rol 'admin' (solo Jefes)
 *   - POST /familia/join      → requiere token JWT (cualquier usuario autenticado)
 *   - PATCH /familia/nombre   → requiere token JWT + rol 'admin' (solo Jefes)
 */

/**
 * GET /familia/invite
 *
 * ✅ Genera un token único de invitación para unirse al hogar.
 *    El token expira en 10 MINUTOS y solo puede ser usado UNA VEZ.
 *
 * 🔐 REQUIERE: JWT válido + rol 'admin' (Jefe de Familia)
 *
 * 📥 BODY: No requiere body.
 *    El family_id se extrae automáticamente del token JWT en req.auth.family_id
 *
 * 📤 RESPUESTA EXITOSA 201:
 * {
 *   "message":      "Token de invitación generado. Válido por 10 minutos.",
 *   "invite_token": "550e8400-e29b-41d4-a716-446655440000",  ← usar este en el QR
 *   "expires_at":   "2025-01-15T14:30:00.000Z",
 *   "family_id":    "uuid-del-hogar"
 * }
 *
 * 💡 PARA EL FRONTEND:
 *   Usa el valor "invite_token" para generar el código QR.
 *   El otro usuario escaneará el QR y enviará ese token a POST /familia/join.
 *
 * ❌ ERRORES:
 *   400 — El usuario no tiene family_id (no pertenece a ningún hogar)
 *   401 — Token JWT inválido/expirado
 *   403 — El usuario no es Jefe de Familia (rol 'admin')
 *   500 — Error interno
 */
export const getInviteToken = async (req: Request, res: Response): Promise<void> => {
  const familyId = await resolveFamilyId(req);

  if (!familyId) {
    res.status(400).json({
      message: 'No perteneces a ningún grupo familiar. Crea uno primero.',
      hint: 'El family_id en tu token JWT es null. Registra un hogar.'
    });
    return;
  }

  try {
    const qrToken = await familyService.generateInviteToken(familyId);
    res.status(201).json({
      message: 'Token de invitación generado. Válido por 10 minutos.',
      invite_token: qrToken.token,
      expires_at: qrToken.expires_at,
      family_id: qrToken.family_id
    });
  } catch (error) {
    console.error('[familyController.getInviteToken]', error);
    res.status(500).json({ message: 'Error interno al generar el token de invitación.' });
  }
};

/**
 * POST /familia/join
 *
 * ✅ Permite a un usuario autenticado unirse a un hogar existente mediante un token QR.
 *
 * 🔐 REQUIERE: JWT válido (cualquier usuario registrado)
 *
 * 📥 BODY:
 * {
 *   "invite_token": "550e8400-e29b-41d4-a716-446655440000"
 * }
 */
export const joinFamily = async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth?.user_id;

  if (!userId) {
    res.status(401).json({ message: 'No autenticado. Token JWT requerido.' });
    return;
  }

  const { invite_token } = req.body;

  if (!invite_token || typeof invite_token !== 'string' || invite_token.trim().length === 0) {
    res.status(400).json({
      message: 'El campo invite_token es requerido.',
      hint: 'Escanea el código QR para obtener el token de invitación.'
    });
    return;
  }

  try {
    const family = await familyService.joinFamily(invite_token.trim(), userId);
    res.status(200).json({
      message: `¡Te has unido exitosamente al hogar "${family?.nombre || 'Familia'}"!`,
      family
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'TOKEN_EXPIRED_OR_USED') {
      res.status(410).json({
        message: 'El token de invitación ha expirado o ya fue utilizado.',
        hint: 'Pídele al Jefe de Familia que genere un nuevo código QR.'
      });
      return;
    }

    console.error('[familyController.joinFamily]', error);
    res.status(500).json({ message: 'Error interno al unirse a la familia.' });
  }
};

/**
 * PATCH /familia/nombre
 *
 * ✅ Permite al Jefe de Familia actualizar el nombre de su hogar.
 *
 * 🔐 REQUIERE: JWT válido + rol 'admin' (solo Jefes)
 */
export const updateFamilyName = async (req: Request, res: Response): Promise<void> => {
  const familyId = await resolveFamilyId(req);
  const { nombre } = req.body;

  if (!familyId) {
    res.status(400).json({ message: 'No perteneces a ningún grupo familiar.' });
    return;
  }

  if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0) {
    res.status(400).json({ message: 'El nuevo nombre del hogar es requerido.' });
    return;
  }

  try {
    const updatedFamily = await familyService.updateFamilyName(familyId, nombre.trim());
    res.json({
      message: 'Nombre del hogar actualizado exitosamente.',
      family: updatedFamily
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'FAMILY_NAME_LOCKED') {
      res.status(403).json({
        message: 'No puedes cambiar el nombre del hogar aún. Debe pasar al menos 60 días desde su creación.',
        dias_requeridos: 60
      });
      return;
    }
    if (error instanceof Error && error.message === 'FAMILY_NOT_FOUND') {
      res.status(404).json({ message: 'El hogar familiar no existe.' });
      return;
    }
    console.error('[familyController.updateFamilyName]', error);
    res.status(500).json({ message: 'Error interno al actualizar el nombre del hogar.' });
  }
};

/**
 * GET /familia/miembros
 *
 * ✅ Obtiene la lista de perfiles de todos los miembros del hogar familiar (Ranking por XP).
 *
 * 🔐 REQUIERE: JWT válido (cualquier miembro de la familia autenticado)
 */
export const getFamilyMembers = async (req: Request, res: Response): Promise<void> => {
  const familyId = await resolveFamilyId(req);

  if (!familyId) {
    res.status(400).json({
      message: 'No perteneces a ningún grupo familiar. Únete o crea uno primero.'
    });
    return;
  }

  try {
    const members = await familyService.getFamilyMembers(familyId);
    res.status(200).json(members);
  } catch (error) {
    console.error('[familyController.getFamilyMembers]', error);
    res.status(500).json({ message: 'Error interno al obtener los miembros de la familia.' });
  }
};
