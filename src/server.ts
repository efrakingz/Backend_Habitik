import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './config/db';

// Importar todas las rutas del Sprint 1
import authRoutes from './routes/authRoutes';
import familyRoutes from './routes/familyRoutes';
import onboardingRoutes from './routes/onboardingRoutes';
import showerRoutes from './routes/showerRoutes';

dotenv.config();

/**
 * ============================================================
 * SERVIDOR PRINCIPAL — Habitik Backend API (Sprint 1)
 * ============================================================
 *
 * Este es el punto de entrada de toda la aplicación Express.
 * Se encarga de:
 *   1. Configurar middlewares globales (CORS, parseo JSON)
 *   2. Registrar las rutas de la API
 *   3. Levantar el servidor HTTP en el puerto configurado
 *   4. Validar la conexión con PostgreSQL (Railway)
 *
 * 🌐 URL BASE LOCAL:    http://localhost:3000
 * 🌐 URL PRODUCCIÓN:    https://<tu-app>.up.railway.app
 *
 * ============================================================
 * MAPA COMPLETO DE ENDPOINTS — Sprint 1
 * ============================================================
 *
 * [PÚBLICO — Sin autenticación]
 *   POST  /auth/register       → Registrar Jefe de Familia + crear Hogar
 *   POST  /auth/login          → Iniciar sesión (retorna JWT)
 *
 * [AUTENTICADO — Requiere header: Authorization: Bearer <token>]
 *   GET   /familia/invite      → Generar token de invitación QR (solo admin/Jefe)
 *   POST  /familia/join        → Unirse al hogar con un token de invitación
 *   PATCH /familia/nombre      → Cambiar nombre del hogar (solo admin, bloqueado 60 días)
 *   POST  /onboarding          → Enviar cuestionario inicial (diferente por rol)
 *   POST  /reto/ducha          → Registrar duración de ducha (anti-trampa < 3 min)
 *
 * ============================================================
 * CONFIGURACIÓN DE ENTORNO (.env)
 * ============================================================
 *
 * PORT          → Puerto donde corre el servidor (default: 3000)
 * DATABASE_URL  → URL de conexión a PostgreSQL de Railway
 *                 Formato: postgresql://user:pass@host.railway.app:5432/db
 * JWT_SECRET    → Clave secreta para firmar y verificar los tokens JWT
 * NODE_ENV      → 'development' (local) | 'production' (Railway)
 *
 * ============================================================
 * TABLAS EN POSTGRESQL (Railway) — Sprint 1
 * ============================================================
 *
 * public.users          → Credenciales (email, password_hash)
 * public.profiles       → Perfil del usuario (nombre, rol, xp, family_id, etc.)
 * public.families       → Hogares (nombre, family_code, metas de consumo)
 * public.qr_tokens      → Tokens de invitación temporales (TTL 10 min)
 * public.shower_logs    → Historial de duchas (⚠️ debe crearse manualmente)
 *
 * SQL para crear shower_logs:
 *   CREATE TABLE public.shower_logs (
 *     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 *     duracion_segundos INTEGER NOT NULL,
 *     estado VARCHAR(50) NOT NULL,
 *     created_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 */

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares Globales ──────────────────────────────────────────────────────

// CORS: permite que el frontend (Flutter/web) consuma la API desde cualquier origen.
// En producción se puede restringir a dominios específicos.
app.use(cors());

// Parsear body de peticiones JSON: convierte el body de la petición en req.body
app.use(express.json());

// Parsear body de formularios HTML (por si se necesita)
app.use(express.urlencoded({ extended: true }));

// ── Registro de Rutas ─────────────────────────────────────────────────────────

// HU 5.1 + HU 1.1: Autenticación (registro y login)
app.use('/auth', authRoutes);

// HU 1.1 + HU 1.2: Gestión del Hogar Familiar (invitación QR, unirse, editar nombre)
app.use('/familia', familyRoutes);

// HU 1.3: Onboarding (cuestionario inicial diferenciado por rol)
app.use('/onboarding', onboardingRoutes);

// HU 2.1: Retos (cronómetro de ducha con validación anti-trampa)
app.use('/reto', showerRoutes);

// ── Health Check ──────────────────────────────────────────────────────────────
// Endpoint raíz para verificar que la API esté activa (útil para Railway y monitores)
app.get('/', (_req, res) => {
  res.json({
    status: 'online',
    app: 'Habitik Backend API — Sprint 1',
    version: '1.0.0',
    endpoints: {
      public: {
        register: 'POST /auth/register',
        login:    'POST /auth/login'
      },
      authenticated: {
        invite:     'GET /familia/invite    [admin]',
        join:       'POST /familia/join',
        rename:     'PATCH /familia/nombre  [admin]',
        onboarding: 'POST /onboarding',
        shower:     'POST /reto/ducha'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// ── Manejo de rutas no encontradas ───────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada.' });
});

// ── Manejo Global de Errores No Controlados ───────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Unhandled Error]', err.stack);
  res.status(500).json({
    message: 'Error interno del servidor.',
    // Solo mostrar el detalle del error en desarrollo, no en producción
    error: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

// ── Arrancar Servidor ─────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log('='.repeat(55));
  console.log('  🏠 Habitik Backend API — Sprint 1');
  console.log(`  🚀 Servidor: http://localhost:${PORT}`);
  console.log('='.repeat(55));

  // Verificar la conexión con PostgreSQL al arrancar
  try {
    const res = await pool.query('SELECT NOW()');
    console.log(`  ✅ DB PostgreSQL conectada: ${res.rows[0].now}`);
  } catch (err) {
    console.error('  ❌ [CRÍTICO] No se pudo conectar a la base de datos.');
    console.error('     Verifica la variable DATABASE_URL en el archivo .env');
    if (err instanceof Error) console.error(' ', err.message);
  }

  console.log('='.repeat(55));
});
