const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const tables = [
    'users', 'families', 'profiles', 'family_rewards', 'canjes',
    'canje_aportes', 'shower_logs', 'evidences', 'inspeccion_evidencias',
    'reto_validations', 'ecological_words', 'wordle_attempts',
    'trivia_questions', 'trivia_sessions', 'logros', 'usuario_logros',
    'feed_reacciones', 'bills', 'notifications', 'password_reset_codes', 'qr_tokens'
  ];

  console.log('=== CONTEO DE TABLAS EN BASE DE DATOS LIVE POSTGRESQL ===');
  for (const t of tables) {
    try {
      const res = await pool.query('SELECT count(*) as c FROM ' + t);
      console.log(`${t.padEnd(24)}: ${res.rows[0].c}`);
    } catch (e) {
      console.log(`${t.padEnd(24)}: Error (${e.message})`);
    }
  }
  await pool.end();
}

main().catch(console.error);

