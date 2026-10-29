import { Router } from 'express';
import { register, login, getPerfil } from '../controllers/authController';
import { forgotPassword, verifyResetCode, resetPassword } from '../controllers/passwordResetController';
import { verifyToken } from '../middleware/auth';

/**
 * ============================================================
 * RUTAS DE AUTENTICACIÓN Y PERFIL DE USUARIO — /auth
 * ============================================================
 * Maneja el acceso público (login/registro), recuperación de
 * contraseña con código verificador y la consulta protegida
 * de métricas y nivel del usuario.
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
 * @route   POST /auth/forgot-password
 * @desc    Genera y envía un código de 6 dígitos por correo para restablecer contraseña.
 * @access  Público
 */
router.post('/forgot-password', forgotPassword);

/**
 * @route   POST /auth/verify-reset-code
 * @desc    Verifica si un código de recuperación es válido antes de cambiar la contraseña.
 * @access  Público
 */
router.post('/verify-reset-code', verifyResetCode);

/**
 * @route   POST /auth/reset-password
 * @desc    Aplica la nueva contraseña del usuario usando el código verificado.
 * @access  Público
 */
router.post('/reset-password', resetPassword);

/**
 * @route   GET /auth/perfil/:user_id
 * @desc    Obtiene métricas gamificadas (XP, nivel, monedas, progreso %) del usuario.
 * @access  Protegido — Requiere Header 'Authorization: Bearer <token>'
 * @note    Interceptado por verifyToken: Si el token está vencido, aborta con 401.
 */
router.get('/perfil/:user_id', verifyToken, getPerfil);

export default router;