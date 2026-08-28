import { Router } from 'express';
// Importamos el controlador encargado de recibir las peticiones de este módulo
import { EcoController } from '../controllers/ecoController';
// Importamos el middleware que valida que la petición traiga un Token JWT válido
import { authenticateToken } from '../middleware/auth';

// Inicializamos el enrutador de Express
const router = Router();

/**
 * RUTA: POST /eco/completar
 * DESCRIPCIÓN: Endpoint para enviar los resultados de una partida de Eco-Puzzle.
 * MIDDLEWARE: 'authenticateToken' protege la ruta requiriendo sesión activa.
 */
router.post('/completar', authenticateToken, EcoController.completarEcoPuzzle);

// Exportamos el router configurado para ser importado en app.ts
export default router;