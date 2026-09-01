import { Router } from 'express';
import { EcoController } from '../controllers/ecoController';
import { authenticateToken } from '../middleware/auth';

/**
 * ============================================================
 * RUTAS DEL ECO-PUZZLE TEMÁTICO — /eco
 * ============================================================
 * Procesa las partidas del mini-juego de rompecabezas,
 * persiste el intento en reto_validations y calcula la experiencia.
 */

const router = Router();

/**
 * @route   POST /eco/completar
 * @desc    Registra tiempo y errores del puzzle, guardando la columna 'usuario' en BD.
 * @access  Protegido — Requiere Header 'Authorization: Bearer <token>'
 * @note    Usa authenticateToken (alias de verifyToken) para validar la sesión activa.
 */
router.post('/completar', authenticateToken, EcoController.completarEcoPuzzle);

export default router;