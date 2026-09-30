import dotenv from 'dotenv';
import http from 'http';
import { Client as PgClient } from 'pg';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { pool } from './config/db';

dotenv.config();

const PORT = process.env.PORT || 3000;
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

app.set('io', io);

io.on('connection', (socket) => {
  console.log(`⚡ [Socket.io] Cliente conectado: ${socket.id}`);

  socket.on('unirse_familia', (familyId: string | number) => {
    if (familyId) {
      const room = `familia_${familyId}`;
      socket.join(room);
      console.log(`🏠 [Socket.io] Socket ${socket.id} se unió a sala: ${room}`);
    }
  });

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

          if (recentEmittedEvents.has(emitKey) && now - (recentEmittedEvents.get(emitKey) || 0) < 3000) {
            return;
          }
          recentEmittedEvents.set(emitKey, now);

          io.to(`familia_${data.family_id}`).emit('evento_en_vivo', data);
          console.log(`🔔 [Trigger Event] Retransmitido a sala familia_${data.family_id}:`, data.titulo);
        }
      }
    } catch (error) {
      console.error('⚠️ Error parseando payload de notificación PostgreSQL:', error);
    }
  });
}

server.listen(PORT, async () => {
  console.log('='.repeat(55));
  console.log('  🌱 Habitik Backend API & Realtime WebSockets');
  console.log(`  🚀 Servidor: http://localhost:${PORT}`);
  console.log('='.repeat(55));

  try {
    const result = await pool.query('SELECT NOW()');
    console.log(`  ✅ DB PostgreSQL conectada: ${result.rows[0].now}`);
  } catch (error) {
    console.error('  ❌ [CRÍTICO] No se pudo conectar a la base de datos.');
    if (error instanceof Error) console.error(' ', error.message);
  }

  console.log('='.repeat(55));
});
