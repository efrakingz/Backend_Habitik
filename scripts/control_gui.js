const http = require('http');
const { spawn, execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const PORT = 3333;
const BACKEND_PORT = 3000;
const DB_PORT = 5433;

let backendProcess = null;
let backendLogs = [];
const MAX_LOGS = 150;

function addLog(msg) {
  const time = new Date().toLocaleTimeString();
  const entry = `[${time}] ${msg}`;
  backendLogs.push(entry);
  if (backendLogs.length > MAX_LOGS) backendLogs.shift();
  console.log(entry);
}

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

function checkPortOpen(port, host = '127.0.0.1', timeout = 1000) {
  return new Promise((resolve) => {
    const client = require('net').createConnection({ port, host, timeout }, () => {
      client.destroy();
      resolve(true);
    });
    client.on('error', () => resolve(false));
    client.on('timeout', () => {
      client.destroy();
      resolve(false);
    });
  });
}

async function isBackendRunning() {
  return await checkPortOpen(BACKEND_PORT);
}

async function isDbRunning() {
  return await checkPortOpen(DB_PORT);
}

function startBackend() {
  if (backendProcess) return;
  addLog('Iniciando backend Node.js en puerto 3000...');
  
  const env = {
    ...process.env,
    PORT: '3000',
    NODE_ENV: 'development',
    DATABASE_URL: `postgresql://postgres:postgrespassword123@127.0.0.1:${DB_PORT}/habitik_local`,
    JWT_SECRET: 'super_secret_jwt_key_12345',
    HOST: '0.0.0.0'
  };

  const projectRoot = path.resolve(__dirname, '..');
  backendProcess = spawn('npx', ['ts-node', 'src/server.ts'], {
    cwd: projectRoot,
    env,
    shell: true
  });

  backendProcess.stdout.on('data', (data) => {
    const text = data.toString().trim();
    if (text) addLog(text);
  });

  backendProcess.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) addLog(`[ERROR] ${text}`);
  });

  backendProcess.on('close', (code) => {
    addLog(`Backend detenido con código: ${code}`);
    backendProcess = null;
  });
}

function stopBackend() {
  if (backendProcess) {
    addLog('Deteniendo proceso backend...');
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${backendProcess.pid} /T /F`);
      } else {
        backendProcess.kill('SIGTERM');
      }
    } catch (_) {
      try { backendProcess.kill('SIGKILL'); } catch (_) {}
    }
    backendProcess = null;
  } else {
    // Si corre por fuera, intentar matar proceso en puerto 3000
    try {
      if (process.platform === 'win32') {
        const out = execSync('netstat -ano | findstr :3000 | findstr LISTENING', { encoding: 'utf-8' });
        const lines = out.trim().split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            execSync(`taskkill /pid ${pid} /F`);
            addLog(`Proceso externo en puerto 3000 detenido (PID: ${pid})`);
          }
        }
      }
    } catch (_) {}
  }
}

function startDatabase() {
  addLog('Iniciando contenedor Docker PostgreSQL en Ubuntu WSL...');
  try {
    const cmd = `wsl -d Ubuntu -- bash -c "cd '/mnt/c/Users/efrak/OneDrive/Documentos/Proyectos/proyecto Habitik/backend' && docker compose up -d"`;
    execSync(cmd, { stdio: 'pipe' });
    addLog('Base de datos Docker levantada exitosamente en puerto 5433.');
  } catch (err) {
    addLog(`Error iniciando Docker DB: ${err.message}`);
  }
}

function stopDatabase() {
  addLog('Deteniendo contenedor Docker PostgreSQL...');
  try {
    const cmd = `wsl -d Ubuntu -- bash -c "cd '/mnt/c/Users/efrak/OneDrive/Documentos/Proyectos/proyecto Habitik/backend' && docker compose stop"`;
    execSync(cmd, { stdio: 'pipe' });
    addLog('Base de datos detenida.');
  } catch (err) {
    addLog(`Error deteniendo Docker DB: ${err.message}`);
  }
}

const HTML_DASHBOARD = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Habitik — Panel de Servidor Local</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b1320;
      --card-bg: rgba(22, 33, 54, 0.75);
      --card-border: rgba(46, 125, 50, 0.25);
      --primary: #2E7D32;
      --primary-light: #4CAF50;
      --primary-glow: rgba(76, 175, 80, 0.35);
      --accent: #00ACC1;
      --danger: #E53935;
      --danger-glow: rgba(229, 57, 53, 0.35);
      --text: #F1F5F9;
      --text-muted: #94A3B8;
      --terminal-bg: #060b13;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: radial-gradient(circle at 15% 15%, #13271f 0%, #0b1320 50%, #060a12 100%);
      color: var(--text);
      min-height: 100vh;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .container {
      width: 100%;
      max-width: 1050px;
    }

    /* Header */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .logo-badge {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #2E7D32, #43A047);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      box-shadow: 0 8px 24px var(--primary-glow);
    }

    h1 {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(120deg, #FFFFFF, #C8E6C9);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .status-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.05);
      padding: 8px 16px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 13px;
      font-weight: 600;
    }

    .pulse-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #94A3B8;
    }

    .pulse-dot.online {
      background: #4CAF50;
      box-shadow: 0 0 12px #4CAF50;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(0.95); opacity: 0.8; }
    }

    /* Grid Layout */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 20px;
      margin-bottom: 24px;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 24px;
      backdrop-filter: blur(16px);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: transform 0.2s, border-color 0.2s;
    }

    .card:hover {
      border-color: rgba(76, 175, 80, 0.45);
      transform: translateY(-2px);
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .card-title {
      font-size: 16px;
      font-weight: 700;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .badge {
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .badge-on { background: rgba(76, 175, 80, 0.2); color: #81C784; border: 1px solid rgba(76, 175, 80, 0.4); }
    .badge-off { background: rgba(229, 57, 53, 0.2); color: #EF9A9A; border: 1px solid rgba(229, 57, 53, 0.4); }

    .card-body {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 20px;
    }

    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .stat-row:last-child { border-bottom: none; }
    .stat-val { font-weight: 600; color: #E2E8F0; }

    /* Action Buttons */
    .btn {
      width: 100%;
      padding: 13px;
      border-radius: 12px;
      border: none;
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .btn:active { transform: scale(0.98); }

    .btn-start {
      background: linear-gradient(135deg, #2E7D32, #43A047);
      color: #FFFFFF;
      box-shadow: 0 4px 16px var(--primary-glow);
    }

    .btn-start:hover {
      background: linear-gradient(135deg, #388E3C, #4CAF50);
      box-shadow: 0 6px 20px var(--primary-glow);
    }

    .btn-stop {
      background: linear-gradient(135deg, #C62828, #E53935);
      color: #FFFFFF;
      box-shadow: 0 4px 16px var(--danger-glow);
    }

    .btn-stop:hover {
      background: linear-gradient(135deg, #D32F2F, #EF5350);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text);
      border: 1px solid rgba(255, 255, 255, 0.15);
      margin-top: 8px;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.12);
    }

    /* IP Box */
    .ip-box {
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(76, 175, 80, 0.3);
      padding: 14px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 12px 0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      color: #81C784;
    }

    .btn-copy {
      background: rgba(76, 175, 80, 0.15);
      border: 1px solid rgba(76, 175, 80, 0.4);
      color: #A5D6A7;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      cursor: pointer;
      font-weight: 600;
    }

    .btn-copy:hover { background: rgba(76, 175, 80, 0.25); }

    /* Terminal Console */
    .console-card {
      background: var(--terminal-bg);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 20px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
    }

    .console-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .console-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .log-window {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      line-height: 1.6;
      color: #E2E8F0;
      max-height: 220px;
      overflow-y: auto;
      padding-right: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .log-entry {
      word-break: break-all;
    }

    .log-entry.error { color: #F87171; }
    .log-entry.success { color: #4ADE80; }

    /* Custom Scrollbar */
    .log-window::-webkit-scrollbar { width: 6px; }
    .log-window::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 3px; }

    /* Instructions Modal Banner */
    .guide-banner {
      background: linear-gradient(135deg, rgba(0, 172, 193, 0.12), rgba(46, 125, 50, 0.15));
      border: 1px solid rgba(0, 172, 193, 0.35);
      border-radius: 16px;
      padding: 16px 20px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .guide-text { font-size: 13px; color: #E0F2FE; line-height: 1.5; }
    .guide-text strong { color: #38BDF8; }
  </style>
</head>
<body>

  <div class="container">
    <!-- Header -->
    <header>
      <div class="brand">
        <div class="logo-badge">🌿</div>
        <div>
          <h1>Habitik Control Panel</h1>
          <div class="subtitle">Servidor Local de Contingencia — Feria de Software 2026</div>
        </div>
      </div>
      <div class="status-pill">
        <div id="global-dot" class="pulse-dot"></div>
        <span id="global-status">Verificando...</span>
      </div>
    </header>

    <!-- Guide Banner -->
    <div class="guide-banner">
      <div class="guide-text">
        📱 <strong>Conectar Celular o Tablet:</strong> Abre Habitik en el dispositivo, toca el botón de engranaje en el Login, selecciona <strong>"Servidor Local"</strong> e ingresa la IP <strong><span id="guide-ip">192.168.1.10</span></strong> (puerto 3000).
      </div>
      <button class="btn-copy" onclick="copyUrl()">Copiar URL</button>
    </div>

    <!-- Cards Grid -->
    <div class="grid">
      <!-- Card 1: Backend Server -->
      <div class="card">
        <div>
          <div class="card-top">
            <div class="card-title">🚀 Servidor Backend</div>
            <div id="backend-badge" class="badge badge-off">OFFLINE</div>
          </div>
          <div class="card-body">
            <div class="stat-row"><span>Puerto HTTP:</span><span class="stat-val">3000</span></div>
            <div class="stat-row"><span>WebSockets:</span><span class="stat-val">Habilitado</span></div>
            <div class="stat-row"><span>Modo:</span><span class="stat-val">Modular Stateless</span></div>
          </div>
        </div>
        <div>
          <button id="btn-backend" class="btn btn-start" onclick="toggleBackend()">
            <span>⚡ Encender Backend</span>
          </button>
        </div>
      </div>

      <!-- Card 2: Database Container -->
      <div class="card">
        <div>
          <div class="card-top">
            <div class="card-title">🐘 PostgreSQL en Docker</div>
            <div id="db-badge" class="badge badge-off">OFFLINE</div>
          </div>
          <div class="card-body">
            <div class="stat-row"><span>Puerto Host:</span><span class="stat-val">5433</span></div>
            <div class="stat-row"><span>Contenedor:</span><span class="stat-val">habitik_postgres_local</span></div>
            <div class="stat-row"><span>Tablas Sincronizadas:</span><span class="stat-val">24 Tablas (Feria)</span></div>
          </div>
        </div>
        <div>
          <button id="btn-db" class="btn btn-start" onclick="toggleDb()">
            <span>🐘 Iniciar Base de Datos</span>
          </button>
        </div>
      </div>

      <!-- Card 3: Wi-Fi Network & App URL -->
      <div class="card">
        <div>
          <div class="card-top">
            <div class="card-title">📡 Red Wi-Fi Local</div>
            <div class="badge badge-on">CONECTADO</div>
          </div>
          <div class="card-body">
            <div>IP de este Notebook en tu Red:</div>
            <div class="ip-box">
              <span id="ip-address">192.168.1.10</span>
              <button class="btn-copy" onclick="copyIp()">Copiar IP</button>
            </div>
            <div class="stat-row"><span>URL Completa:</span><span id="full-url" class="stat-val">http://192.168.1.10:3000</span></div>
          </div>
        </div>
        <div>
          <button class="btn btn-secondary" onclick="pingServer()">
            <span>🔍 Probar Conexión (Ping)</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Live Console -->
    <div class="console-card">
      <div class="console-header">
        <div class="console-title">
          <span>💻 Consola de Eventos y Logs en Vivo</span>
        </div>
        <button class="btn-copy" onclick="refreshStatus()">🔄 Actualizar</button>
      </div>
      <div id="log-window" class="log-window">
        <div class="log-entry">Cargando consola...</div>
      </div>
    </div>
  </div>

  <script>
    let isBackendOn = false;
    let isDbOn = false;

    async function fetchStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();

        isBackendOn = data.backendRunning;
        isDbOn = data.dbRunning;

        // Actualizar Backend Card
        const bBadge = document.getElementById('backend-badge');
        const bBtn = document.getElementById('btn-backend');
        if (isBackendOn) {
          bBadge.textContent = 'ONLINE';
          bBadge.className = 'badge badge-on';
          bBtn.className = 'btn btn-stop';
          bBtn.innerHTML = '<span>🛑 Apagar Backend</span>';
        } else {
          bBadge.textContent = 'OFFLINE';
          bBadge.className = 'badge badge-off';
          bBtn.className = 'btn btn-start';
          bBtn.innerHTML = '<span>⚡ Encender Backend</span>';
        }

        // Actualizar DB Card
        const dbBadge = document.getElementById('db-badge');
        const dbBtn = document.getElementById('btn-db');
        if (isDbOn) {
          dbBadge.textContent = 'CONECTADA';
          dbBadge.className = 'badge badge-on';
          dbBtn.className = 'btn btn-stop';
          dbBtn.innerHTML = '<span>🛑 Detener BD</span>';
        } else {
          dbBadge.textContent = 'DETENIDA';
          dbBadge.className = 'badge badge-off';
          dbBtn.className = 'btn btn-start';
          dbBtn.innerHTML = '<span>🐘 Iniciar Base de Datos</span>';
        }

        // Header Pill
        const gDot = document.getElementById('global-dot');
        const gStatus = document.getElementById('global-status');
        if (isBackendOn && isDbOn) {
          gDot.className = 'pulse-dot online';
          gStatus.textContent = 'Servidor y BD Activos (Listo)';
        } else if (isDbOn) {
          gDot.className = 'pulse-dot';
          gStatus.textContent = 'Solo BD Activa';
        } else {
          gDot.className = 'pulse-dot';
          gStatus.textContent = 'Servicios Apagados';
        }

        // Network Info
        document.getElementById('ip-address').textContent = data.localIp;
        document.getElementById('guide-ip').textContent = data.localIp;
        document.getElementById('full-url').textContent = 'http://' + data.localIp + ':3000';

        // Logs
        renderLogs(data.logs);
      } catch (err) {
        console.error(err);
      }
    }

    function renderLogs(logs) {
      const win = document.getElementById('log-window');
      win.innerHTML = '';
      if (!logs || logs.length === 0) {
        win.innerHTML = '<div class="log-entry" style="color: #64748B;">Sin logs recientes.</div>';
        return;
      }
      logs.forEach(l => {
        const div = document.createElement('div');
        div.className = 'log-entry';
        if (l.includes('ERROR') || l.includes('Error')) div.classList.add('error');
        if (l.includes('✅') || l.includes('Iniciando')) div.classList.add('success');
        div.textContent = l;
        win.appendChild(div);
      });
      win.scrollTop = win.scrollHeight;
    }

    async function toggleBackend() {
      const endpoint = isBackendOn ? '/api/backend/stop' : '/api/backend/start';
      await fetch(endpoint, { method: 'POST' });
      setTimeout(fetchStatus, 800);
    }

    async function toggleDb() {
      const endpoint = isDbOn ? '/api/db/stop' : '/api/db/start';
      await fetch(endpoint, { method: 'POST' });
      setTimeout(fetchStatus, 1200);
    }

    function copyIp() {
      const ip = document.getElementById('ip-address').textContent;
      navigator.clipboard.writeText(ip);
      alert('IP copiada al portapapeles: ' + ip);
    }

    function copyUrl() {
      const url = document.getElementById('full-url').textContent;
      navigator.clipboard.writeText(url);
      alert('URL copiada al portapapeles: ' + url);
    }

    async function pingServer() {
      try {
        const start = performance.now();
        const res = await fetch('http://' + document.getElementById('ip-address').textContent + ':3000/');
        const ms = Math.round(performance.now() - start);
        if (res.ok) {
          alert('✅ Ping exitoso en ' + ms + ' ms. El servidor local responde correctamente.');
        } else {
          alert('⚠️ El servidor respondió con estado: ' + res.status);
        }
      } catch (e) {
        alert('❌ Error al conectar. Asegúrate de encender el backend primero.');
      }
    }

    function refreshStatus() {
      fetchStatus();
    }

    setInterval(fetchStatus, 2500);
    fetchStatus();
  </script>
</body>
</html>
`;

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url.split('?')[0];

  if (url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML_DASHBOARD);
    return;
  }

  if (url === '/api/status' && req.method === 'GET') {
    const backendRunning = await isBackendRunning();
    const dbRunning = await isDbRunning();
    const localIp = getLocalIp();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      backendRunning,
      dbRunning,
      localIp,
      port: BACKEND_PORT,
      dbPort: DB_PORT,
      logs: backendLogs
    }));
    return;
  }

  if (url === '/api/backend/start' && req.method === 'POST') {
    startBackend();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Iniciando backend...' }));
    return;
  }

  if (url === '/api/backend/stop' && req.method === 'POST') {
    stopBackend();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Deteniendo backend...' }));
    return;
  }

  if (url === '/api/db/start' && req.method === 'POST') {
    startDatabase();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Iniciando base de datos...' }));
    return;
  }

  if (url === '/api/db/stop' && req.method === 'POST') {
    stopDatabase();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Deteniendo base de datos...' }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
});

server.listen(PORT, '0.0.0.0', () => {
  addLog(`Panel de Control Web de Habitik iniciado en: http://localhost:${PORT}`);
  addLog(`Accesible también en red local: http://${getLocalIp()}:${PORT}`);
});
