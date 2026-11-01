const { Pool } = require('pg');

async function test(host, port) {
  const pool = new Pool({
    connectionString: `postgresql://postgres:postgrespassword123@${host}:${port}/habitik_local`,
    ssl: false,
    connectionTimeoutMillis: 2000
  });
  try {
    const r = await pool.query('SELECT 1');
    console.log(`SUCCESS on ${host}:${port}`);
  } catch (e) {
    console.log(`FAIL on ${host}:${port}: ${e.message}`);
  } finally {
    await pool.end();
  }
}

async function run() {
  await test('127.0.0.1', 5433);
  await test('localhost', 5433);
  await test('172.23.101.94', 5433);
}

run();

