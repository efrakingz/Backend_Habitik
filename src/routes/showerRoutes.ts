import { Router } from 'express';
import { iniciarDucha, finalizarDucha, getRachaSemanal } from '../controllers/showerController';
import { verifyToken } from '../middleware/auth';

/**
 * ============================================================
 * RUTAS DEL SPEEDRUN DE DUCHA Y RACHAS — /reto
 * ============================================================
 * Procesa el inicio y finalización del cronómetro de ducha medido
 * de forma autoritaria en el backend, aplica filtros anti-trampa,
 * asigna recompensas y consulta rachas.
 */

const router = Router();

/**
 * @route   POST /reto/ducha/iniciar
 * @desc    Registra la marca de tiempo inicial (NOW()) en el servidor al aceptar el reto.
 * @access  Protegido — Requiere Header 'Authorization: Bearer <token>'
 */
router.post('/ducha/iniciar', verifyToken, iniciarDucha);

/**
 * @route   POST /reto/ducha/finalizar
 * @desc    Calcula el tiempo real transcurrido en el servidor, valida la duración (>=180s), 
 *          otorga XP/monedas y actualiza profiles.
 * @access  Protegido — Requiere Header 'Authorization: Bearer <token>'
 */
router.post('/ducha/finalizar', verifyToken, finalizarDucha);

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