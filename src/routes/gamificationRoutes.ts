import { Router } from 'express';
import { otorgarRecompensaController } from '../controllers/gamificationController';

const router = Router();

/**
 * Ruta: POST /gamification/recompensa-actividad
 * Descripción: Endpoint para que el frontend acredite monedas y XP tras finalizar 
 * partidas en 'eco_puzzle' o 'speedrun_ducha'.
 */
router.post('/recompensa-actividad', otorgarRecompensaController);

export default router;