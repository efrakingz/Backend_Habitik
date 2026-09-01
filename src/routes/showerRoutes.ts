import { Router } from 'express';
import { registerShower } from '../controllers/showerController';
import { verifyToken } from '../middleware/auth';

/**
 * ============================================================
 * RUTAS DEL SPEEDRUN DE DUCHA (RETO ECOLÓGICO) — /reto
 * ============================================================
 * Procesa el registro de tiempo en el cronómetro de ducha,
 * aplica el filtro anti-trampa y asigna recompensas en BD.
 */

const router = Router();

/**
 * @route   POST /reto/ducha
 * @desc    Valida la duración de la ducha (>180s), otorga XP/monedas y actualiza profiles.
 * @access  Protegido — Requiere Header 'Authorization: Bearer <token>'
 * @note    Extrae user_id automáticamente del payload JWT inyectado en req.auth.
 */
router.post('/ducha', verifyToken, registerShower);

export default router;