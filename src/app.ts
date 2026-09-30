import cors from 'cors';
import express from 'express';
import { getPerfil } from './controllers/authController';
import { verifyToken } from './middleware/auth';
import authRoutes from './routes/authRoutes';
import ecoRoutes from './routes/ecoRoutes';
import familyRoutes from './routes/familyRoutes';
import logrosRoutes from './routes/logrosRoutes';
import notificationRoutes from './routes/notificationRoutes';
import onboardingRoutes from './routes/onboardingRoutes';
import rewardRoutes from './routes/rewardRoutes';
import showerRoutes from './routes/showerRoutes';
import triviaRoutes from './routes/triviaRoutes';
import wordleRoutes from './routes/wordleRoutes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/auth', authRoutes);
app.get('/perfil/:user_id', verifyToken, getPerfil);
app.use('/familia', familyRoutes);
app.use('/onboarding', onboardingRoutes);
app.use('/reto', showerRoutes);
app.use('/eco', ecoRoutes);
app.use('/rewards', rewardRoutes);
app.use('/logros', logrosRoutes);
app.use('/trivia', triviaRoutes);
app.use('/wordle', wordleRoutes);
app.use('/notifications', notificationRoutes);
app.use('/api', notificationRoutes);

app.get('/', (_req, res) => {
  res.json({
    status: 'online',
    app: 'Habitik Backend API con Realtime WebSockets',
    version: '2.0.0',
    endpoints: {
      public: {
        register: 'POST /auth/register',
        login: 'POST /auth/login',
      },
      authenticated: {
        perfil: 'GET /auth/perfil/:user_id',
        shower: 'POST /reto/ducha',
        ecoPuzzle: 'POST /eco/completar',
        trivia: 'POST /trivia/iniciar',
        triviaQuestion: 'GET /trivia/pregunta?sesion_id=<uuid>',
        wordle: 'GET/POST /wordle',
        rewards: 'GET/POST /rewards',
        redeem: 'POST /rewards/:id/canjear',
      },
    },
    timestamp: new Date().toISOString(),
  });
});

app.use((_req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada.' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Unhandled Error]', err.stack);
  res.status(500).json({
    message: 'Error interno del servidor.',
    error: process.env.NODE_ENV === 'production' ? undefined : err.message,
  });
});

export default app;
