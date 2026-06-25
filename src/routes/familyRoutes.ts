import { Router } from 'express';
import { getInviteToken, joinFamily, updateFamilyName } from '../controllers/familyController';
import { verifyToken, requireAdmin } from '../middleware/auth';

const router = Router();

// HU 1.2 CA-1.2-1: Generar token de invitación (solo admin/Jefe)
router.get('/invite', verifyToken, requireAdmin, getInviteToken);

// HU 1.2 CA-1.2-2: Unirse a un hogar con invite_token
router.post('/join', verifyToken, joinFamily);

// HU 1.1 CA-1.1-2: Editar nombre del hogar (bloqueado 60 días, solo admin)
router.patch('/nombre', verifyToken, requireAdmin, updateFamilyName);

export default router;
