require('dotenv').config();
const { RewardService } = require('../dist/services/rewardService'); // or test directly with pg

// Let's test the database queries and logic directly
const { Client } = require('pg');

async function test() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Conectado a DB para test de integración');

    // Obtener un usuario y familia de prueba
    const userRes = await client.query("SELECT id, nombre, family_id, rol, monedas FROM profiles WHERE family_id IS NOT NULL LIMIT 2");
    if (userRes.rows.length === 0) {
      console.log('No users found');
      return;
    }
    const member = userRes.rows[0];
    const familyId = member.family_id;
    console.log(`👤 Usuario de prueba: ${member.nombre} (${member.rol}) en familia ${familyId}`);

    // Verificar listar recompensas
    const rewardsRes = await client.query(
      "SELECT id, titulo, costo, es_familiar, estado FROM family_rewards WHERE family_id = $1 AND estado = 'activo'",
      [familyId]
    );
    console.log(`📦 Recompensas activas: ${rewardsRes.rows.length}`);

    // Verificar colectas
    const colRes = await client.query(
      "SELECT c.id, c.reward_id, c.total_requerido, c.total_recaudado, c.estado FROM canjes c WHERE c.family_id = $1 AND c.es_colecta = true",
      [familyId]
    );
    console.log(`🤝 Colectas encontradas: ${colRes.rows.length}`);

    console.log('🎉 Test de queries OK!');
  } catch (e) {
    console.error('❌ Error en test:', e.message);
  } finally {
    await client.end();
  }
}

test();
