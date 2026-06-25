import { Request, Response } from 'express';
import { FamilyService } from '../services/familyService';

const familyService = new FamilyService();

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
  // family_id viene del payload del JWT decodificado
  const familyId = req.auth?.family_id;

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
      invite_token: qrToken.token,   // ← Este UUID es el que va en el QR
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
 * ✅ Une al usuario autenticado al hogar representado por el invite_token.
 *    El usuario recibirá el rol 'Miembro'.
 *    El token QR queda marcado como "usado" y ya no puede reutilizarse.
 *
 * 🔐 REQUIERE: JWT válido (cualquier usuario autenticado)
 *
 * 📥 BODY ESPERADO (JSON):
 * {
 *   "invite_token": "550e8400-e29b-41d4-a716-446655440000", // UUID del QR escaneado
 *   "user_id":      "uuid-del-usuario-que-se-une"           // ID del usuario que se une
 * }
 *
 * 📤 RESPUESTA EXITOSA 200:
 * {
 *   "message": "Te has unido al hogar familiar exitosamente.",
 *   "family": {
 *     "id":          "uuid-del-hogar",
 *     "nombre":      "Familia López",
 *     "family_code": "AB12CD",
 *     ...
 *   },
 *   "role": "Miembro"
 * }
 *
 * ❌ ERRORES:
 *   400 — Faltan invite_token o user_id
 *   401 — Token JWT inválido/expirado
 *   410 — Token de invitación expirado (pasaron >10 min) o ya fue usado
 *   500 — Error interno
 *
 * 💡 NOTA: El 410 Gone es intencional según CA-1.2-3.
 *    Si recibes 410, el Jefe debe generar un nuevo token QR.
 */
export const joinFamily = async (req: Request, res: Response): Promise<void> => {
  const { invite_token, user_id } = req.body;

  if (!invite_token || !user_id) {
    res.status(400).json({ message: 'invite_token y user_id son requeridos.' });
    return;
  }

  try {
    const family = await familyService.joinFamily(invite_token, user_id);
    res.json({
      message: 'Te has unido al hogar familiar exitosamente.',
      family,
      role: 'Miembro' // El rol asignado al unirse por invitación
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'TOKEN_EXPIRED_OR_USED') {
      // CA-1.2-3: Token expirado o ya usado → 410 Gone
      res.status(410).json({
        message: 'El token de invitación ha expirado o ya fue utilizado.',
        hint: 'Pide al Jefe de Familia que genere un nuevo código QR en GET /familia/invite'
      });
      return;
    }
    console.error('[familyController.joinFamily]', error);
    res.status(500).json({ message: 'Error interno al unirse al grupo familiar.' });
  }
};

/**
 * PATCH /familia/nombre
 *
 * ✅ Actualiza el nombre del hogar familiar.
 *    ⚠️  BLOQUEADO durante los primeros 60 días desde la creación del hogar (CA-1.1-2).
 *
 * 🔐 REQUIERE: JWT válido + rol 'admin' (solo Jefe de Familia)
 *
 * 📥 BODY ESPERADO (JSON):
 * {
 *   "nombre": "Nuevo Nombre del Hogar"
 * }
 *
 * 📤 RESPUESTA EXITOSA 200:
 * {
 *   "message": "Nombre del hogar actualizado exitosamente.",
 *   "family": {
 *     "id":     "uuid-del-hogar",
 *     "nombre": "Nuevo Nombre del Hogar",
 *     ...
 *   }
 * }
 *
 * ❌ ERRORES:
 *   400 — Nombre vacío o no proporcionado
 *   401 — Token JWT inválido/expirado
 *   403 — No es Jefe de Familia O el hogar tiene menos de 60 días
 *   404 — El hogar no existe en la BD
 *   500 — Error interno
 */
export const updateFamilyName = async (req: Request, res: Response): Promise<void> => {
  // El family_id viene del payload del JWT (no hace falta enviarlo en el body)
  const familyId = req.auth?.family_id;
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
      // El hogar tiene menos de 60 días desde su creación
      res.status(403).json({
        message: 'El nombre del hogar no puede modificarse durante los primeros 60 días desde su creación.'
      });
      return;
    }
    if (error instanceof Error && error.message === 'FAMILY_NOT_FOUND') {
      res.status(404).json({ message: 'Hogar familiar no encontrado.' });
      return;
    }
    console.error('[familyController.updateFamilyName]', error);
    res.status(500).json({ message: 'Error interno al actualizar el nombre del hogar.' });
  }
};
