import cors from 'cors';
import express from 'express';
import path from 'path';
import { registerRoutes } from './routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

registerRoutes(app);

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
        bills: 'GET/POST/DELETE /bills',
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
