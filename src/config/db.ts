import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * ============================================================
 * CONFIGURACIÓN DE LA BASE DE DATOS — PostgreSQL (Railway)
 * ============================================================
 * Pool optimizado con keepAlive, timeouts defensivos y control
 * de concurrencia para conexiones remotas sobre TLS.
 */

const isProduction =
  process.env.NODE_ENV === 'production' ||
  Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway'));

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  max: Number(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

let poolConnectedLogged = false;
pool.on('connect', () => {
  if (!poolConnectedLogged) {
    poolConnectedLogged = true;
    console.log('✅ PostgreSQL database pool connected successfully');
  }
});

pool.on('error', (err: Error) => {
  console.error('❌ Unexpected error on idle database client', err.message);
});

/**
 * Función helper para ejecutar queries SQL directamente sobre el pool.
 */
export const query = (text: string, params?: any[]) => pool.query(text, params);
