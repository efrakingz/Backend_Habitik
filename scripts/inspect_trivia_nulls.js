const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const nullCheck = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE pregunta IS NULL) as null_pregunta,
      COUNT(*) FILTER (WHERE alternativas IS NULL) as null_alternativas,
      COUNT(*) FILTER (WHERE correct_index IS NULL) as null_correct_index,
      COUNT(*) FILTER (WHERE explicacion IS NULL) as null_explicacion,
      COUNT(*) FILTER (WHERE categoria IS NULL) as null_categoria,
      COUNT(*) FILTER (WHERE dificultad IS NULL) as null_dificultad,
      COUNT(*) FILTER (WHERE fuente IS NULL) as null_fuente,
      COUNT(*) FILTER (WHERE dato_curioso IS NULL) as null_dato_curioso
    FROM public.trivia_questions;
  `);
  console.log('📊 Conteo de valores NULL por columna:', nullCheck.rows[0]);

  const questionsRes = await pool.query(`
    SELECT id, pregunta, explicacion, categoria, dificultad, alternativas, correct_index, dato_curioso
    FROM public.trivia_questions
    ORDER BY created_at ASC, id ASC
    LIMIT 40;
  `);

  console.log(`\n📋 Primeras ${questionsRes.rows.length} preguntas registradas:`);
  questionsRes.rows.forEach((q, i) => {
    console.log(`--- [${i + 1}] ID: ${q.id} (${q.categoria}) ---`);
    console.log(`Pregunta: ${q.pregunta}`);
    console.log(`Explicación: ${q.explicacion}`);
  });

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
