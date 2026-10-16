const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const sql = fs.readFileSync('sql/2026-10-16_trivia_dato_curioso.sql', 'utf8');
  console.log('🔄 Ejecutando migración dato_curioso...');
  await pool.query(sql);
  console.log('✅ Migración aplicada exitosamente!');

  const check = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'trivia_questions' AND column_name = 'dato_curioso'"
  );
  console.log('📊 Verificación columna dato_curioso:', check.rows);
  await pool.end();
}

migrate().catch(err => {
  console.error('❌ Error en migración:', err);
  process.exit(1);
});
