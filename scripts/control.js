const { execSync, spawn } = require('child_process');
const os = require('os');
const readline = require('readline');
const http = require('http');

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

function checkBackendOnline() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:3000/', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  const ip = getLocalIp();
  const isOnline = await checkBackendOnline();

  console.clear();
  console.log('\x1b[32m╔══════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[32m║       🌿 HABITIK - PANEL DE SERVIDOR LOCAL           ║\x1b[0m');
  console.log('\x1b[32m║           (Servidor de Contingencia Feria)           ║\x1b[0m');
  console.log('\x1b[32m╚══════════════════════════════════════════════════════╝\x1b[0m');
  console.log(`\n  📡 Tu IP Local (Wi-Fi): \x1b[33m${ip}\x1b[0m`);
  console.log(`  📱 URL para la App:     \x1b[33mhttp://${ip}:3000\x1b[0m`);
  console.log(`  ⚡ Estado Backend:      ${isOnline ? '\x1b[32m🟢 ONLINE (Listo para recibir peticiones)\x1b[0m' : '\x1b[31m🔴 OFFLINE\x1b[0m'}\n`);

  console.log('  \x1b[36m[1]\x1b[0m 🟢 Iniciar Base de Datos Local (Docker Compose)');
  console.log('  \x1b[36m[2]\x1b[0m 🚀 Iniciar Backend Habitik en Red Local');
  console.log('  \x1b[36m[3]\x1b[0m 🔴 Detener Servicios');
  console.log('  \x1b[36m[4]\x1b[0m 🔄 Volcar Base de Datos Fresca de Railway a SQL');
  console.log('  \x1b[36m[5]\x1b[0m 🚪 Salir\n');

  rl.question('  Selecciona una opción [1-5]: ', async (opt) => {
    switch (opt.trim()) {
      case '1':
        console.log('\n⏳ Levantando contenedor Docker de PostgreSQL local...');
        try {
          execSync('docker compose up -d postgres_local', { stdio: 'inherit' });
          console.log('\x1b[32m✅ Base de datos iniciada en puerto 5432.\x1b[0m');
        } catch (e) {
          console.log('\x1b[31m⚠️ No se pudo iniciar con Docker. Asegúrate de tener Docker o PostgreSQL activo.\x1b[0m');
        }
        break;
      case '2':
        console.log(`\n🚀 Arrancando backend conectado a la base de datos local...`);
        console.log(`\x1b[33mIngresa en la app móvil: http://${ip}:3000\x1b[0m\n`);
        const proc = spawn('npm', ['run', 'start:local'], { stdio: 'inherit', shell: true });
        proc.on('close', () => main());
        return;
      case '3':
        console.log('\n🛑 Deteniendo contenedores Docker...');
        try {
          execSync('docker compose stop postgres_local', { stdio: 'inherit' });
          console.log('\x1b[32m✅ Servicios detenidos.\x1b[0m');
        } catch (_) {}
        break;
      case '4':
        console.log('\n📥 Conectando con Railway para extraer dump fresco...');
        try {
          execSync('npx ts-node scripts/dump_railway_db.ts', { stdio: 'inherit' });
        } catch (_) {}
        break;
      case '5':
        console.log('\n👋 ¡Listo! Mucho éxito en la feria.');
        rl.close();
        process.exit(0);
        return;
      default:
        console.log('\nOpción no válida.');
    }

    setTimeout(() => main(), 1500);
  });
}

main();
