require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const q = async (label, sql) => {
    const r = await client.query(sql);
    console.log(`\n=== ${label} ===`);
    console.table(r.rows);
  };
  try {
    await q('Roles distintos', `SELECT rol, COUNT(*) FROM profiles GROUP BY rol`);
    await q('Miembros por familia', `SELECT family_id, COUNT(*) AS miembros FROM profiles WHERE family_id IS NOT NULL GROUP BY family_id`);
    await q('family_rewards', `SELECT id, family_id, titulo, costo, es_familiar, disponible, creador_id, metadata, last_redeemed_at FROM family_rewards ORDER BY created_at DESC`);
    await q('canjes', `SELECT id, reward_id, user_id, costo_pagado, estado, created_at FROM canjes ORDER BY created_at DESC`);
    await q('Monedas por origen', `SELECT origen_actividad, COUNT(*) AS veces, ROUND(AVG(monedas_otorgadas),1) AS avg_monedas, SUM(monedas_otorgadas) AS total, ROUND(AVG(xp_otorgada),1) AS avg_xp FROM historial_gamificacion GROUP BY origen_actividad ORDER BY total DESC`);
    await q('Monedas duchas', `SELECT ROUND(AVG(monedas_otorgadas),1) AS avg, MAX(monedas_otorgadas) AS max FROM shower_logs WHERE es_valido`);
    await q('Saldos perfiles', `SELECT nombre, rol, monedas, xp, nivel FROM profiles ORDER BY monedas DESC`);
    await q('Constraints canjes/family_rewards', `
      SELECT conrelid::regclass AS tabla, conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint WHERE conrelid IN ('public.canjes'::regclass, 'public.family_rewards'::regclass)`);
    await q('Tipos de notificaciones', `SELECT type, COUNT(*) FROM notifications GROUP BY type`);
  } finally {
    await client.end();
  }
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
