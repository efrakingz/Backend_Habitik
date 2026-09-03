import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { Client as PgClient } from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './config/db';

// ── Importación de Enrutadores Modulares (Sin Duplicación) ─────────────
import authRoutes from './routes/authRoutes';
import familyRoutes from './routes/familyRoutes';
import onboardingRoutes from './routes/onboardingRoutes';
import showerRoutes from './routes/showerRoutes';
import ecoRoutes from './routes/ecoRoutes';
import notificationRoutes from './routes/notificationRoutes';
import rewardRoutes from './routes/rewardRoutes';
import { getPerfil } from './controllers/authController';
import { verifyToken } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ── Servidor HTTP y Configuración de Socket.io ───────────────────────
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
});

// Exponer 'io' en la app Express para ser usado dentro de controladores si se requiere
app.set('io', io);

// ── Middlewares Globales ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Gestión de Salas Socket.io (Familia en Tiempo Real) ───────────────
io.on('connection', (socket) => {
  console.log(`⚡ [Socket.io] Cliente conectado: ${socket.id}`);

  // Suscribir dispositivo a la sala de su hogar
  socket.on('unirse_familia', (familyId: string | number) => {
    if (familyId) {
      const room = `familia_${familyId}`;
      socket.join(room);
      console.log(`🏠 [Socket.io] Socket ${socket.id} se unió a sala: ${room}`);
    }
  });

  // Retirar dispositivo de la sala
  socket.on('salir_familia', (familyId: string | number) => {
    if (familyId) {
      const room = `familia_${familyId}`;
      socket.leave(room);
      console.log(`🚪 [Socket.io] Socket ${socket.id} salió de sala: ${room}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 [Socket.io] Cliente desconectado: ${socket.id}`);
  });
});

// ── PostgreSQL LISTEN / NOTIFY (Eventos Realtime en DB) ──────────────
if (process.env.DATABASE_URL) {
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.DATABASE_URL.includes('railway') ||
    process.env.DATABASE_URL.includes('render');

  const pgListener = new PgClient({
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  });

  pgListener
    .connect()
    .then(() => {
      pgListener.query('LISTEN canal_eventos_familia');
      console.log('📡 [PostgreSQL] Escuchando activamente canal_eventos_familia');
    })
    .catch((err) => {
      console.error('⚠️ [PostgreSQL] Error conectando pgListener:', err.message);
    });

  const recentEmittedEvents = new Map<string, number>();

  pgListener.on('notification', (msg) => {
    try {
      if (msg.payload) {
        const data = JSON.parse(msg.payload);
        if (data.family_id) {
          const now = Date.now();
          const emitKey = `${data.id || data.titulo}_${data.family_id}`;
          
          // Anti-debounce: Previene emisión duplicada de notificaciones en un lapso de 3 segundos
          if (recentEmittedEvents.has(emitKey) && (now - (recentEmittedEvents.get(emitKey) || 0) < 3000)) {
            return;
          }
          recentEmittedEvents.set(emitKey, now);

          io.to(`familia_${data.family_id}`).emit('evento_en_vivo', data);
          console.log(`🔔 [Trigger Event] Retransmitido a sala familia_${data.family_id}:`, data.titulo);
        }
      }
    } catch (e) {
      console.error('⚠️ Error parseando payload de notificación PostgreSQL:', e);
    }
  });
}

// ── Mapeo de Rutas (Prefijo Único por Dominio) ────────────────────────
app.use('/auth', authRoutes);             // Autenticación y consulta de perfil (/auth/perfil/:user_id)
app.get('/perfil/:user_id', verifyToken, getPerfil); // Alias para clientes que consultan /perfil/:user_id directamente
app.use('/familia', familyRoutes);         // Gestión de grupo familiar
app.use('/onboarding', onboardingRoutes);   // Configuración inicial de usuario
app.use('/reto', showerRoutes);           // Speedrun de ducha cronometrada
app.use('/eco', ecoRoutes);               // Mini-juego Eco-Puzzle
app.use('/rewards', rewardRoutes);         // Catálogo y canje de recompensas

// Notificaciones y alertas
app.use('/notifications', notificationRoutes);
app.use('/api', notificationRoutes);

// ── Endpoint Health Check & Documentación de API ───────────────────────
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
        rewards: 'GET/POST /rewards',
        redeem: 'POST /rewards/:id/canjear',
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// ── Middleware de Manejo de Rutas Inexistentes (404) ───────────────────
app.use((_req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada.' });
});

// ── Middleware Global Manejador de Errores (500) ──────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Unhandled Error]', err.stack);
  res.status(500).json({
    message: 'Error interno del servidor.',
    error: process.env.NODE_ENV === 'production' ? undefined : err.message,
  });
});

// ── Inicio del Servidor HTTP ──────────────────────────────────────────
server.listen(PORT, async () => {
  console.log('='.repeat(55));
  console.log('  🌱 Habitik Backend API & Realtime WebSockets');
  console.log(`  🚀 Servidor: http://localhost:${PORT}`);
  console.log('='.repeat(55));

  try {
    const res = await pool.query('SELECT NOW()');
    console.log(`  ✅ DB PostgreSQL conectada: ${res.rows[0].now}`);
  } catch (err) {
    console.error('  ❌ [CRÍTICO] No se pudo conectar a la base de datos.');
    if (err instanceof Error) console.error(' ', err.message);
  }

  console.log('='.repeat(55));
});
