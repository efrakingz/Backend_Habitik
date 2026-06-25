import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * ============================================================
 * CONFIGURACIÓN DE LA BASE DE DATOS — PostgreSQL (Railway)
 * ============================================================
 *
 * Este archivo crea y exporta el "pool" de conexiones a PostgreSQL.
 * Un pool mantiene múltiples conexiones abiertas y las reutiliza,
 * evitando abrir y cerrar una conexión en cada petición HTTP.
 *
 * 📦 BASE DE DATOS: PostgreSQL alojado en Railway
 * 🔗 VARIABLE DE ENTORNO: DATABASE_URL en el archivo .env
 *    Formato: postgresql://usuario:contraseña@host.railway.app:5432/nombre_db
 *
 * 🔒 SSL:
 *   - En producción (Railway), la conexión usa SSL con rejectUnauthorized: false
 *     porque Railway usa certificados auto-firmados.
 *   - En desarrollo local, SSL se desactiva automáticamente.
 *
 * 📋 TABLAS USADAS POR EL SPRINT 1:
 *   - public.users          → Credenciales de login (email + hash de contraseña)
 *   - public.profiles       → Datos del perfil del usuario (nombre, rol, family_id, XP, etc.)
 *   - public.families       → Información del hogar familiar (nombre, código de acceso)
 *   - public.qr_tokens      → Tokens temporales de invitación (TTL 10 min)
 *   - public.shower_logs    → Historial de duchas registradas (duración + validez)
 *
 * 💡 USO DESDE OTROS ARCHIVOS:
 *   import { query, pool } from '../config/db';
 *   const result = await query('SELECT * FROM public.users WHERE email = $1', [email]);
 */

// Detectar si estamos en entorno de producción (Railway) para activar SSL
const isProduction = process.env.NODE_ENV === 'production' ||
  (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway'));

// Crear el pool de conexiones con la URL de Railway
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Evento que se dispara cada vez que el pool establece una nueva conexión
pool.on('connect', () => {
  console.log('✅ PostgreSQL database pool connected successfully');
});

// Evento de error en conexiones inactivas (importante para producción)
pool.on('error', (err: Error) => {
  console.error('❌ Unexpected error on idle database client', err);
});

/**
 * Función helper para ejecutar queries SQL de forma sencilla.
 * Usa un cliente del pool automáticamente y lo libera al terminar.
 *
 * @param text   - Consulta SQL con placeholders ($1, $2, ...)
 * @param params - Valores para reemplazar los placeholders (previene SQL Injection)
 *
 * @example
 * const res = await query('SELECT * FROM public.profiles WHERE id = $1', [userId]);
 * const profile = res.rows[0];
 */
export const query = (text: string, params?: any[]) => pool.query(text, params);
