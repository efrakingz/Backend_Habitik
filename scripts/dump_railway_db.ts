import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Orden estricto de tablas respetando llaves foráneas
const TABLES_ORDER = [
  'families',
  'users',
  'profiles',
  'family_rewards',
  'canjes',
  'canje_aportes',
  'shower_logs',
  'tasks',
  'evidences',
  'inspeccion_evidencias',
  'reto_validations',
  'ecological_words',
  'wordle_attempts',
  'trivia_questions',
  'trivia_sessions',
  'trivia_answers',
  'logros',
  'usuario_logros',
  'historial_gamificacion',
  'feed_reacciones',
  'bills',
  'bill_ocr_tokens',
  'password_reset_codes',
  'qr_tokens',
  'notifications',
];

function escapeLiteral(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  const str = String(val);
  return `'${str.replace(/'/g, "''")}'`;
}

async function dumpDatabase() {
  console.log('🔄 Conectando a PostgreSQL en Railway...');
  const client = await pool.connect();

  try {
    const outputDir = path.join(__dirname, '../database');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputFile = path.join(outputDir, 'init_local_db.sql');
    const stream = fs.createWriteStream(outputFile, { encoding: 'utf8' });

    stream.write(`-- ========================================================\n`);
    stream.write(`-- HABITIK LOCAL DATABASE DUMP (CON CONTINGENCIA FERIA)\n`);
    stream.write(`-- Generado automáticamente desde Railway: ${new Date().toISOString()}\n`);
    stream.write(`-- ========================================================\n\n`);
    stream.write(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n`);
    stream.write(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";\n\n`);

    // 1. Obtener DDL de creación de tablas
    console.log('📦 Extrayendo esquemas de tablas...');
    for (const table of TABLES_ORDER) {
      // Verificar si la tabla existe en railway
      const checkRes = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        );
      `, [table]);

      if (!checkRes.rows[0].exists) {
        console.log(`  ⚠️ Tabla ${table} no existe en Railway, omitiendo.`);
        continue;
      }

      // Obtener columnas y tipos
      const colRes = await client.query(`
        SELECT column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);

      stream.write(`-- Tabla: public.${table}\n`);
      stream.write(`CREATE TABLE IF NOT EXISTS public.${table} (\n`);
      const colDefs = colRes.rows.map((c: any) => {
        let type = c.udt_name.toLowerCase();
        if (type === 'uuid') type = 'UUID';
        else if (type === 'varchar') type = 'VARCHAR';
        else if (type === 'text') type = 'TEXT';
        else if (type === 'int4') type = 'INTEGER';
        else if (type === 'int8') type = 'BIGINT';
        else if (type === 'int2') type = 'SMALLINT';
        else if (type === 'bool') type = 'BOOLEAN';
        else if (type === 'timestamptz') type = 'TIMESTAMPTZ';
        else if (type === 'timestamp') type = 'TIMESTAMP';
        else if (type === 'date') type = 'DATE';
        else if (type === 'jsonb') type = 'JSONB';
        else if (type === 'json') type = 'JSON';
        else if (type === 'float8') type = 'DOUBLE PRECISION';
        else if (type === 'numeric') type = 'NUMERIC';

        let def = `  ${c.column_name} ${type}`;
        if (c.column_default) {
          def += ` DEFAULT ${c.column_default}`;
        }
        if (c.is_nullable === 'NO') {
          def += ` NOT NULL`;
        }
        return def;
      });

      stream.write(colDefs.join(',\n'));
      stream.write(`\n);\n\n`);
    }

    // 2. Extraer datos reales tabla por tabla
    console.log('📥 Extrayendo registros de datos reales...');
    for (const table of TABLES_ORDER) {
      const checkRes = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        );
      `, [table]);

      if (!checkRes.rows[0].exists) continue;

      const dataRes = await client.query(`SELECT * FROM public.${table};`);
      const rows = dataRes.rows;

      if (rows.length === 0) {
        console.log(`  ℹ️ Tabla ${table}: 0 registros.`);
        continue;
      }

      console.log(`  ✅ Tabla ${table}: ${rows.length} registros volcados.`);
      stream.write(`-- Datos para public.${table} (${rows.length} filas)\n`);

      const columns = Object.keys(rows[0]);
      const colList = columns.join(', ');

      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        stream.write(`INSERT INTO public.${table} (${colList}) VALUES\n`);
        const valueLines = batch.map((row: any) => {
          const values = columns.map(c => escapeLiteral(row[c]));
          return `  (${values.join(', ')})`;
        });
        stream.write(valueLines.join(',\n'));
        stream.write(`\nON CONFLICT DO NOTHING;\n\n`);
      }
    }

    // 3. Crear llaves primarias e índices
    stream.write(`-- ========================================================\n`);
    stream.write(`-- ÍNDICES DE ALTO RENDIMIENTO\n`);
    stream.write(`-- ========================================================\n`);
    stream.write(`
CREATE INDEX IF NOT EXISTS idx_profiles_family_id ON public.profiles (family_id);
CREATE INDEX IF NOT EXISTS idx_shower_logs_user_valid ON public.shower_logs (user_id, es_valido);
CREATE INDEX IF NOT EXISTS idx_historial_user_created ON public.historial_gamificacion (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_rewards_active ON public.family_rewards (family_id, estado);
CREATE INDEX IF NOT EXISTS idx_canjes_colecta_estado ON public.canjes (family_id, es_colecta, estado);
CREATE INDEX IF NOT EXISTS idx_canje_aportes_canje ON public.canje_aportes (canje_id, user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_family_created ON public.notifications (family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspeccion_family_estado ON public.inspeccion_evidencias (family_id, estado);
CREATE INDEX IF NOT EXISTS idx_reto_validations_family_estado ON public.reto_validations (family_id, estado);
CREATE INDEX IF NOT EXISTS idx_tasks_family_hecho ON public.tasks (family_id, hecho);
CREATE INDEX IF NOT EXISTS idx_usuario_logros_user ON public.usuario_logros (user_id);
CREATE INDEX IF NOT EXISTS idx_feed_reacciones_feed_id ON public.feed_reacciones (feed_id);
CREATE INDEX IF NOT EXISTS idx_feed_reacciones_family_id ON public.feed_reacciones (family_id);
CREATE INDEX IF NOT EXISTS idx_feed_reacciones_user_id ON public.feed_reacciones (user_id);
    \n`);

    stream.end();
    console.log(`\n🎉 Volcado completado exitosamente: ${outputFile}`);
  } finally {
    client.release();
    await pool.end();
  }
}

dumpDatabase().catch((err) => {
  console.error('❌ Error volcando la base de datos:', err);
  process.exit(1);
});
