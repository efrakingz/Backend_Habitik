import { Express } from 'express';
import { getPerfil } from '../controllers/authController';
import { verifyToken } from '../middleware/auth';
import authRoutes from './authRoutes';
import billsRoutes from './billsRoutes';
import ecoRoutes from './ecoRoutes';
import familyRoutes from './familyRoutes';
import feedRoutes from './feedRoutes';
import inspeccionRoutes from './inspeccionRoutes';
import logrosRoutes from './logrosRoutes';
import notificationRoutes from './notificationRoutes';
import onboardingRoutes from './onboardingRoutes';
import profileRoutes from './profileRoutes';
import rewardRoutes from './rewardRoutes';
import showerRoutes from './showerRoutes';
import triviaRoutes from './triviaRoutes';
import wordleRoutes from './wordleRoutes';

/**
 * Monta de forma modular todos los enrutadores del dominio Habitik sobre la instancia Express,
 * preservando el 100% de compatibilidad de rutas con el frontend Flutter.
 */
export function registerRoutes(app: Express): void {
  // Autenticación y Perfil
  app.use('/auth', authRoutes);
  app.get('/perfil/:user_id', verifyToken, getPerfil);
  app.use('/perfil', profileRoutes);

  // Hogar Familiar y Onboarding
  app.use('/familia', familyRoutes);
  app.use('/onboarding', onboardingRoutes);

  // Retos y Minijuegos Ecológicos
  app.use('/reto', showerRoutes);
  app.use('/reto/inspeccion', inspeccionRoutes);
  app.use('/eco', ecoRoutes);
  app.use('/trivia', triviaRoutes);
  app.use('/wordle', wordleRoutes);

  // Gamificación, Logros y Tienda de Recompensas
  app.use('/rewards', rewardRoutes);
  app.use('/logros', logrosRoutes);

  // Boletas de Servicios (Luz / Agua / Gas)
  app.use('/bills', billsRoutes);

  // Notificaciones y Feed Familiar
  app.use('/notifications', notificationRoutes);
  app.use('/api', notificationRoutes);
  app.use('/feed', feedRoutes);
  app.use('/api/feed', feedRoutes);
  app.use('/api/familia/feed', feedRoutes);
}
