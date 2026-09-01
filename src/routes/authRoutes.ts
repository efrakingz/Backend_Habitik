import { Router } from 'express';
import { register, login, getPerfil } from '../controllers/authController';
import { verifyToken } from '../middleware/auth';

/**
 * ============================================================
 * RUTAS DE AUTENTICACIÓN Y PERFIL DE USUARIO — /auth
 * ============================================================
 * Maneja el acceso público (login/registro) y la consulta
 * protegida de métricas y nivel del usuario.
 */

const router = Router();

/**
 * @route   POST /auth/register
 * @desc    Registra un nuevo usuario en la base de datos.
 * @access  Público
 */
router.post('/register', register);

/**
 * @route   POST /auth/login
 * @desc    Autentica credenciales y emite un Token JWT firmado.
 * @access  Público
 */
router.post('/login', login);

/**
 * @route   GET /auth/perfil/:user_id
 * @desc    Obtiene métricas gamificadas (XP, nivel, monedas, progreso %) del usuario.
 * @access  Protegido — Requiere Header 'Authorization: Bearer <token>'
 * @note    Interceptado por verifyToken: Si el token está vencido, aborta con 401.
 */
router.get('/perfil/:user_id', verifyToken, getPerfil);

export default router;