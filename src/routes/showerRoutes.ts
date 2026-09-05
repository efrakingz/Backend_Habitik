import { Router } from 'express';
import { registerShower, getRachaSemanal } from '../controllers/showerController';
import { verifyToken } from '../middleware/auth';

/**
 * ============================================================
 * RUTAS DEL SPEEDRUN DE DUCHA Y RACHAS — /reto
 * ============================================================
 * Procesa el registro de tiempo en el cronómetro de ducha,
 * aplica el filtro anti-trampa, asigna recompensas y consulta rachas.
 */

const router = Router();

/**
 * @route   POST /reto/ducha
 * @desc    Valida la duración de la ducha (>180s), otorga XP/monedas y actualiza profiles.
 * @access  Protegido — Requiere Header 'Authorization: Bearer <token>'
 * @note    Extrae user_id automáticamente del payload JWT inyectado en req.auth.
 */
router.post('/ducha', verifyToken, registerShower);

/**
 * @route   GET /reto/racha-semanal
 * @desc    Calcula y retorna la racha semanal del usuario autenticado vía JWT.
 * @access  Protegido
 */
router.get('/racha-semanal', verifyToken, getRachaSemanal);

/**
 * @route   GET /reto/racha-semanal/:user_id
 * @desc    Calcula y retorna la racha semanal para un user_id específico.
 * @access  Público / Interno
 */
router.get('/racha-semanal/:user_id', getRachaSemanal);

export default router;