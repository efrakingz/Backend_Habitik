const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const candidates = [
  'postgresql://postgres@localhost:5432/postgres',
  'postgresql://postgres:postgres@localhost:5432/postgres',
  'postgresql://postgres:admin@localhost:5432/postgres',
  'postgresql://postgres:root@localhost:5432/postgres',
  'postgresql://postgres:1234@localhost:5432/postgres',
  'postgresql://postgres:123456@localhost:5432/postgres',
];

async function main() {
  console.log('🔍 Intentando conectar a PostgreSQL local...');
  let client;
  let successfulUrl = null;

  for (const url of candidates) {
    try {
      client = new Client({ connectionString: url });
      await client.connect();
      successfulUrl = url;
      console.log(`✅ Conexión exitosa con: ${url.replace(/:([^:@]+)@/, ':****@')}`);
      break;
    } catch (e) {
      // Ignorar e intentar el siguiente
    }
  }

  if (!successfulUrl) {
    console.error('\n❌ No se pudo conectar a PostgreSQL con credenciales por defecto.');
    console.error('Por favor, edita o crea el archivo "backend/.env" manualmente con tu DATABASE_URL.');
    console.error('Ejemplo: DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/nombre_db\n');
    process.exit(1);
  }

  // Crear la base de datos habitik si no existe
  try {
    const dbCheck = await client.query("SELECT 1 FROM pg_database WHERE datname = 'habitik'");
    if (dbCheck.rows.length === 0) {
      console.log('🔨 Creando la base de datos "habitik"...');
      // No se pueden parametrizar nombres de bases de datos
      await client.query('CREATE DATABASE habitik');
      console.log('✅ Base de datos "habitik" creada con éxito.');
    } else {
      console.log('ℹ️ La base de datos "habitik" ya existe.');
    }
  } catch (err) {
    console.error('❌ Error al verificar/crear la base de datos habitik:', err.message);
  } finally {
    await client.end();
  }

  // Conectar a la nueva base de datos habitik y ejecutar el esquema
  const habitikUrl = successfulUrl.replace(/\/postgres$/, '/habitik');
  console.log('🔗 Conectando a la base de datos "habitik" para aplicar el esquema...');
  const habitikClient = new Client({ connectionString: habitikUrl });
  
  try {
    await habitikClient.connect();
    const sqlPath = path.join(__dirname, 'database.sql');
    if (fs.existsSync(sqlPath)) {
      console.log('📄 Leyendo archivo database.sql...');
      const sql = fs.readFileSync(sqlPath, 'utf8');
      
      console.log('⚡ Aplicando esquema SQL...');
      await habitikClient.query(sql);
      console.log('✅ Tablas y esquema de base de datos creados/verificados con éxito.');
    } else {
      console.warn('⚠️ No se encontró el archivo database.sql.');
    }
  } catch (err) {
    console.error('❌ Error al aplicar el esquema SQL:', err.message);
  } finally {
    await habitikClient.end();
  }

  // Generar el archivo .env
  const envPath = path.join(__dirname, '.env');
  const envContent = `PORT=3000
DATABASE_URL=${habitikUrl}
JWT_SECRET=habitik_desarrollo_secreto_key_sprint_1
NODE_ENV=development
`;

  try {
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('📝 Archivo "backend/.env" creado exitosamente con la configuración local.');
    console.log('\n🚀 ¡Todo está listo para correr el backend!');
  } catch (err) {
    console.error('❌ Error al escribir el archivo .env:', err.message);
  }
}

main();
