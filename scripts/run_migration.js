require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ ERROR: DATABASE_URL no definida en .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔄 Conectando a Railway PostgreSQL...');
    await client.connect();
    console.log('✅ Conexión establecida.');

    const sqlPath = path.join(__dirname, '..', 'sql', '2026-10-16_canjes_colaborativos.sql');
    console.log(`📄 Leyendo migración desde: ${sqlPath}`);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('⚡ Ejecutando migración SQL...');
    await client.query(sql);
    console.log('🎉 ¡Migración ejecutada con éxito!');

    // Verificación
    const notifCount = await client.query('SELECT COUNT(*) FROM public.notifications');
    const canjesCount = await client.query("SELECT COUNT(*) FROM public.canjes WHERE estado = 'pendiente'");
    const colsRewards = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'family_rewards' AND column_name IN ('estado', 'propuesto_por', 'fecha_propuesta')");
    const colsCanjes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'canjes' AND column_name IN ('es_colecta', 'total_requerido', 'total_recaudado')");
    const tableAportes = await client.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'canje_aportes'");

    console.log('\n--- VERIFICACIÓN POST-MIGRACIÓN ---');
    console.log(` • Notificaciones restantes: ${notifCount.rows[0].count}`);
    console.log(` • Canjes pendientes restantes: ${canjesCount.rows[0].count}`);
    console.log(` • Columnas nuevas en family_rewards: ${colsRewards.rows.map(r => r.column_name).join(', ')}`);
    console.log(` • Columnas nuevas en canjes: ${colsCanjes.rows.map(r => r.column_name).join(', ')}`);
    console.log(` • Tabla canje_aportes existe: ${tableAportes.rows.length > 0 ? 'SÍ' : 'NO'}`);

  } catch (err) {
    console.error('❌ Error ejecutando migración:', err);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Conexión cerrada.');
  }
}

run();
