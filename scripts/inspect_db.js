require('dotenv').config();
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔄 Conectando a PostgreSQL Railway (proxy externo)...');
    await client.connect();
    console.log('✅ ¡Conexión exitosa a Railway PostgreSQL!');

    // Listar tablas públicas
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log(`\n📊 Tablas encontradas (${tableNames.length}):`, tableNames);

    if (tableNames.length === 0) {
      console.log('⚠️ La base de datos está vacía (no contiene tablas en schema public).');
    } else {
      console.log('\n--- DETALLE DE REGISTROS POR TABLA ---');
      for (const table of tableNames) {
        try {
          const countRes = await client.query(`SELECT COUNT(*) as count FROM "${table}"`);
          console.log(` • ${table}: ${countRes.rows[0].count} filas`);
        } catch (err) {
          console.log(` • ${table}: Error al contar (${err.message})`);
        }
      }

      console.log('\n--- DETALLE DE COLUMNAS POR TABLA ---');
      for (const table of tableNames) {
        const colRes = await client.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position;
        `, [table]);
        console.log(`\n[${table}]`);
        colRes.rows.forEach(c => {
          console.log(`   - ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable}, default: ${c.column_default})`);
        });
      }
    }
  } catch (err) {
    console.error('❌ Error conectando o consultando la base de datos:', err);
  } finally {
    await client.end();
    console.log('\n🔌 Conexión cerrada.');
  }
}

main();
