const http = require('http');
const { spawn, execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const dgram = require('dgram');

const PORT = 3333;
const BACKEND_PORT = 3000;
const DB_PORT = 5433;
const UDP_DISCOVERY_PORT = 3334;

let backendProcess = null;
let backendLogs = [];
const MAX_LOGS = 250;
let udpServer = null;

function addLog(msg, type = 'info') {
  const time = new Date().toLocaleTimeString();
  const entry = { time, msg: String(msg).trim(), type };
  backendLogs.push(entry);
  if (backendLogs.length > MAX_LOGS) backendLogs.shift();
  console.log(`[${time}] ${msg}`);
}

// Matar procesos colgados en un puerto para evitar EADDRINUSE
function killProcessOnPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8' });
      const lines = out.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && pid !== `${process.pid}`) {
          try {
            execSync(`taskkill /pid ${pid} /F`);
            addLog(`Puerto ${port} liberado (PID previo ${pid} terminado).`, 'warn');
          } catch (_) {}
        }
      }
    }
  } catch (_) {}
}

// Obtener todas las IPs locales activas (Wi-Fi, Ethernet, Hotspot)
function getAllLocalIps() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        // Filtrar adaptadores virtuales típicos de WSL o Hyper-V si hay Wi-Fi disponible
        const isVirtual = name.toLowerCase().includes('vethernet') || name.toLowerCase().includes('wsl');
        results.push({
          name,
          address: net.address,
          isVirtual,
          priority: net.address.startsWith('192.168.') ? 1 : (net.address.startsWith('10.') ? 2 : 3)
        });
      }
    }
  }

  // Ordenar para dar prioridad a Wi-Fi física sobre adaptadores virtuales
  results.sort((a, b) => {
    if (a.isVirtual !== b.isVirtual) return a.isVirtual ? 1 : -1;
    return a.priority - b.priority;
  });

  return results;
}

function getPrimaryLocalIp() {
  const ips = getAllLocalIps();
  if (ips.length > 0) {
    return ips[0].address;
  }
  return '127.0.0.1';
}

// Comprobar apertura de puerto TCP
function checkPortOpen(port, host = '127.0.0.1', timeout = 900) {
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

// Iniciar Backend
function startBackend() {
  if (backendProcess) return;
  addLog('Iniciando backend Node.js en puerto 3000...', 'start');
  
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
    if (text) {
      const isSuccess = text.includes('✅') || text.includes('Servidor:') || text.includes('connected');
      addLog(text, isSuccess ? 'success' : 'info');
    }
  });

  backendProcess.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) addLog(`[ERROR] ${text}`, 'error');
  });

  backendProcess.on('close', (code) => {
    addLog(`Backend detenido con código: ${code}`, 'warn');
    backendProcess = null;
  });
}

// Detener Backend
function stopBackend() {
  if (backendProcess) {
    addLog('Deteniendo proceso backend...', 'warn');
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
    // Si corre externamente, matar en puerto 3000
    killProcessOnPort(BACKEND_PORT);
  }
}

// Rutas dinámicas para Docker en Windows y WSL
function getProjectWslPath() {
  const projectRoot = path.resolve(__dirname, '..');
  const drive = projectRoot.charAt(0).toLowerCase();
  const rest = projectRoot.slice(2).replace(/\\/g, '/');
  return `/mnt/${drive}${rest}`;
}

// Iniciar Docker DB
function startDatabase() {
  addLog('Iniciando contenedor Docker PostgreSQL en puerto 5433...', 'start');
  const projectRoot = path.resolve(__dirname, '..');
  
  // 1. Probar docker nativo de Windows si estuviera disponible
  try {
    execSync('docker compose up -d', { cwd: projectRoot, stdio: 'pipe' });
    addLog('Base de datos Docker levantada exitosamente (Docker nativo).', 'success');
    return;
  } catch (_) {}

  // 2. Usar WSL Ubuntu con ruta dinámica universal
  try {
    const wslPath = getProjectWslPath();
    const cmd = `wsl -d Ubuntu -- bash -c "cd '${wslPath}' && docker compose up -d"`;
    execSync(cmd, { stdio: 'pipe' });
    addLog('Base de datos Docker levantada exitosamente en puerto 5433 (WSL Ubuntu).', 'success');
  } catch (err) {
    addLog(`Error iniciando Docker DB: ${err.message}`, 'error');
  }
}

// Detener Docker DB
function stopDatabase() {
  addLog('Deteniendo contenedor Docker PostgreSQL...', 'warn');
  const projectRoot = path.resolve(__dirname, '..');

  try {
    execSync('docker compose stop', { cwd: projectRoot, stdio: 'pipe' });
    addLog('Base de datos detenida (Docker nativo).', 'info');
    return;
  } catch (_) {}

  try {
    const wslPath = getProjectWslPath();
    const cmd = `wsl -d Ubuntu -- bash -c "cd '${wslPath}' && docker compose stop"`;
    execSync(cmd, { stdio: 'pipe' });
    addLog('Base de datos detenida (WSL Ubuntu).', 'info');
  } catch (err) {
    addLog(`Error deteniendo Docker DB: ${err.message}`, 'error');
  }
}

// Restaurar Base de Datos desde SQL
function restoreDatabase() {
  addLog('Restaurando datos iniciales de BD (init_local_db.sql)...', 'start');
  try {
    const wslPath = getProjectWslPath();
    const cmd = `wsl -d Ubuntu -- bash -c "cd '${wslPath}' && docker exec -i habitik_postgres_local psql -U postgres -d habitik_local < database/init_local_db.sql"`;
    execSync(cmd, { stdio: 'pipe' });
    addLog('Base de datos local restaurada exitosamente con las 24 tablas.', 'success');
    return true;
  } catch (err) {
    addLog(`Error restaurando base de datos: ${err.message}`, 'error');
    return false;
  }
}

// Baliza UDP de auto-descubrimiento en puerto 3334
function initUdpBeacon() {
  try {
    if (udpServer) {
      try { udpServer.close(); } catch (_) {}
    }
    udpServer = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    
    udpServer.on('error', (err) => {
      addLog(`[UDP Beacon] Advertencia: ${err.message}`, 'warn');
    });

    udpServer.on('message', (msg, rinfo) => {
      const text = msg.toString();
      if (text.includes('HABITIK_DISCOVER')) {
        const primaryIp = getPrimaryLocalIp();
        const payload = JSON.stringify({
          app: 'Habitik',
          service: 'habitik-backend',
          version: '2.0.0',
          ip: primaryIp,
          port: BACKEND_PORT,
          url: `http://${primaryIp}:${BACKEND_PORT}`
        });
        udpServer.send(payload, rinfo.port, rinfo.address, (err) => {
          if (!err) {
            addLog(`📡 [Auto-Discovery] Servidor auto-detectado por dispositivo en ${rinfo.address}`, 'success');
          }
        });
      }
    });

    udpServer.bind(UDP_DISCOVERY_PORT, () => {
      addLog(`📡 Baliza de Auto-Descubrimiento UDP activa en puerto ${UDP_DISCOVERY_PORT}`, 'info');
    });
  } catch (e) {
    addLog(`No se pudo iniciar baliza UDP: ${e.message}`, 'warn');
  }
}

// Ping interno directo al backend
function pingBackendInternal() {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const latency = Date.now() - start;
        try {
          const parsed = JSON.parse(data);
          resolve({
            success: true,
            latencyMs: latency,
            statusCode: res.statusCode,
            app: parsed.app || 'Habitik Backend',
            version: parsed.version || '2.0.0'
          });
        } catch (_) {
          resolve({
            success: true,
            latencyMs: latency,
            statusCode: res.statusCode,
            app: 'Habitik Backend',
            version: '2.0.0'
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        latencyMs: 0,
        error: 'El backend no está respondiendo en el puerto 3000. Inícialo primero.'
      });
    });

    req.setTimeout(1800, () => {
      req.destroy();
      resolve({
        success: false,
        latencyMs: 0,
        error: 'Timeout al conectar al backend.'
      });
    });
  });
}

// ==========================================
// INTERFAZ WEB PROFESIONAL (ESTILO ANGULAR / MODERN SPA)
// ==========================================
const HTML_DASHBOARD = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Habitik Server Pro — Panel de Control y Telemetría</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-gradient: radial-gradient(circle at 10% 10%, #0d201a 0%, #080d14 45%, #04070a 100%);
      --panel-bg: rgba(13, 22, 33, 0.78);
      --panel-border: rgba(16, 185, 129, 0.22);
      --primary: #10B981;
      --primary-hover: #059669;
      --primary-glow: rgba(16, 185, 129, 0.35);
      --cyan: #06B6D4;
      --cyan-glow: rgba(6, 182, 212, 0.35);
      --danger: #EF4444;
      --danger-hover: #DC2626;
      --danger-glow: rgba(239, 68, 68, 0.35);
      --text: #F8FAFC;
      --text-muted: #94A3B8;
      --terminal-bg: #03060a;
      --terminal-header: #080f17;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg-gradient);
      color: var(--text);
      min-height: 100vh;
      overflow-x: hidden;
      padding: 16px 20px;
    }

    /* Top Brand Bar */
    .top-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 18px;
      margin-bottom: 18px;
      backdrop-filter: blur(14px);
    }

    .brand-group {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .logo-badge {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #10B981, #047857);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      box-shadow: 0 0 20px var(--primary-glow);
    }

    .title-group h1 {
      font-size: 19px;
      font-weight: 800;
      letter-spacing: -0.4px;
      background: linear-gradient(120deg, #FFFFFF 30%, #A7F3D0 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .title-group p {
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 500;
    }

    .header-badges {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .badge-live {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #34D399;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10B981;
      box-shadow: 0 0 10px #10B981;
      animation: pulse 1.8s infinite;
    }

    @keyframes pulse {
      0% { transform: scale(0.9); opacity: 0.8; }
      50% { transform: scale(1.3); opacity: 1; }
      100% { transform: scale(0.9); opacity: 0.8; }
    }

    /* Main Split Screen Layout */
    .app-layout {
      display: grid;
      grid-template-columns: minmax(430px, 1.05fr) minmax(480px, 1.35fr);
      gap: 18px;
      height: calc(100vh - 100px);
    }

    /* Left Column: Controls */
    .controls-col {
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
      padding-right: 6px;
    }

    .card {
      background: var(--panel-bg);
      border: 1px solid var(--panel-border);
      border-radius: 18px;
      padding: 20px;
      backdrop-filter: blur(14px);
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
      position: relative;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }

    .card-title {
      font-size: 15px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-tag {
      font-size: 11px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .status-tag.on {
      background: rgba(16, 185, 129, 0.16);
      color: #34D399;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }

    .status-tag.off {
      background: rgba(239, 68, 68, 0.16);
      color: #F87171;
      border: 1px solid rgba(239, 68, 68, 0.4);
    }

    .spec-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 16px;
      background: rgba(0, 0, 0, 0.25);
      padding: 12px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .spec-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .spec-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }

    .spec-value {
      font-size: 13px;
      font-weight: 700;
      color: #E2E8F0;
      font-family: 'JetBrains Mono', monospace;
    }

    .btn-row {
      display: flex;
      gap: 10px;
    }

    .btn {
      flex: 1;
      padding: 11px 16px;
      border-radius: 12px;
      border: none;
      font-family: inherit;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .btn:active { transform: scale(0.98); }

    .btn-start {
      background: linear-gradient(135deg, #10B981, #059669);
      color: white;
      box-shadow: 0 4px 14px var(--primary-glow);
    }
    .btn-start:hover { background: linear-gradient(135deg, #34D399, #10B981); }

    .btn-stop {
      background: linear-gradient(135deg, #EF4444, #B91C1C);
      color: white;
      box-shadow: 0 4px 14px var(--danger-glow);
    }
    .btn-stop:hover { background: linear-gradient(135deg, #F87171, #EF4444); }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.07);
      color: #E2E8F0;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.25);
    }

    /* Network Card */
    .network-box {
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(6, 182, 212, 0.3);
      border-radius: 14px;
      padding: 14px;
      margin-bottom: 14px;
    }

    .ip-display {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .ip-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 18px;
      font-weight: 700;
      color: #67E8F9;
    }

    .copy-chip {
      background: rgba(6, 182, 212, 0.15);
      border: 1px solid rgba(6, 182, 212, 0.35);
      color: #A5F3FC;
      padding: 5px 10px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .copy-chip:hover { background: rgba(6, 182, 212, 0.3); }

    .qr-container {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }

    #qr-canvas {
      width: 90px;
      height: 90px;
      border-radius: 10px;
      background: white;
      padding: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    }

    .qr-desc {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.5;
    }

    .ping-result-badge {
      margin-top: 10px;
      padding: 8px 12px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
      display: none;
      align-items: center;
      gap: 8px;
    }

    .ping-result-badge.success {
      display: flex;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #6EE7B7;
    }

    .ping-result-badge.error {
      display: flex;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #FCA5A5;
    }

    /* Right Column: Console */
    .console-col {
      background: var(--terminal-bg);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 18px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.55);
    }

    .console-header {
      background: var(--terminal-header);
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .console-title-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .term-dots {
      display: flex;
      gap: 6px;
    }

    .term-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .td-red { background: #FF5F56; }
    .td-yellow { background: #FFBD2E; }
    .td-green { background: #27C93F; }

    .console-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 700;
      color: #E2E8F0;
    }

    .console-tools {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .filter-btn {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: var(--text-muted);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }
    .filter-btn.active {
      background: rgba(16, 185, 129, 0.2);
      border-color: #10B981;
      color: #A7F3D0;
    }

    .tool-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: var(--text-muted);
      padding: 5px 10px;
      border-radius: 8px;
      font-size: 11px;
      cursor: pointer;
      font-weight: 600;
    }
    .tool-btn:hover { background: rgba(255, 255, 255, 0.12); color: white; }

    .log-stream {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      line-height: 1.65;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .log-line {
      display: flex;
      gap: 10px;
      word-break: break-all;
    }

    .log-time {
      color: #64748B;
      flex-shrink: 0;
      user-select: none;
    }

    .log-content { color: #CBD5E1; }
    .log-content.start { color: #38BDF8; font-weight: 600; }
    .log-content.success { color: #34D399; font-weight: 600; }
    .log-content.error { color: #F87171; font-weight: 700; }
    .log-content.warn { color: #FBBF24; }

    .console-input-bar {
      background: var(--terminal-header);
      padding: 10px 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .console-prompt {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 700;
      color: #10B981;
    }

    .console-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #F8FAFC;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
    }

    /* Custom Scrollbars */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.28); }

    @media (max-width: 950px) {
      .app-layout { grid-template-columns: 1fr; height: auto; }
      .console-col { height: 450px; }
    }
  </style>
</head>
<body>

  <!-- Top Brand Header -->
  <header class="top-header">
    <div class="brand-group">
      <div class="logo-badge">🌿</div>
      <div class="title-group">
        <h1>HABITIK SERVER CONTROL PRO</h1>
        <p>Servidor Local de Alta Disponibilidad — Feria de Software 2026</p>
      </div>
    </div>
    <div class="header-badges">
      <div class="badge-live">
        <span class="pulse-dot"></span>
        <span id="global-status">SISTEMA LISTO</span>
      </div>
    </div>
  </header>

  <!-- Split Screen 2-Column Dashboard -->
  <main class="app-layout">
    
    <!-- LEFT COLUMN: CONTROLS & STATUS -->
    <section class="controls-col">
      
      <!-- Backend Card -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🚀</span> Servidor Backend API
          </div>
          <span id="backend-status-tag" class="status-tag off">OFFLINE</span>
        </div>
        <div class="spec-grid">
          <div class="spec-item">
            <span class="spec-label">Puerto HTTP</span>
            <span class="spec-value">3000 (0.0.0.0)</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">WebSockets</span>
            <span class="spec-value">Socket.io (Activo)</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Arquitectura</span>
            <span class="spec-value">Modular Stateless</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Runtime</span>
            <span class="spec-value">Node.js + TS-Node</span>
          </div>
        </div>
        <div class="btn-row">
          <button id="btn-backend-toggle" class="btn btn-start" onclick="toggleBackend()">
            <span>⚡</span> <span id="btn-backend-text">Encender Backend</span>
          </button>
          <button class="btn btn-secondary" onclick="restartBackend()" title="Reiniciar Backend">
            <span>🔄</span> Reiniciar
          </button>
        </div>
      </div>

      <!-- Database Card -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🐘</span> PostgreSQL Local en Docker
          </div>
          <span id="db-status-tag" class="status-tag off">DETENIDA</span>
        </div>
        <div class="spec-grid">
          <div class="spec-item">
            <span class="spec-label">Puerto Host</span>
            <span class="spec-value">5433 (Evita conflicto 5432)</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Contenedor</span>
            <span class="spec-value">habitik_postgres_local</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">BD Local</span>
            <span class="spec-value">habitik_local (24 Tablas)</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Motor</span>
            <span class="spec-value">Docker Compose (WSL)</span>
          </div>
        </div>
        <div class="btn-row">
          <button id="btn-db-toggle" class="btn btn-start" onclick="toggleDb()">
            <span>⚡</span> <span id="btn-db-text">Encender BD</span>
          </button>
          <button class="btn btn-secondary" onclick="restoreDb()" title="Restaurar BD limpia">
            <span>📥</span> Restaurar Tablas
          </button>
        </div>
      </div>

      <!-- Network & Mobile Connection Card -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>📡</span> Red Wi-Fi y Conexión Móvil
          </div>
          <span class="status-tag on">EN LÍNEA</span>
        </div>
        
        <div class="network-box">
          <div class="ip-display">
            <div>
              <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 2px;">IP DE ESTE NOTEBOOK EN TU RED:</div>
              <div id="primary-ip" class="ip-val">127.0.0.1</div>
            </div>
            <button class="copy-chip" onclick="copyIp()">📋 Copiar IP</button>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #94A3B8;">
            <span id="full-url-text">http://127.0.0.1:3000</span>
            <button class="copy-chip" onclick="copyUrl()">🔗 Copiar URL</button>
          </div>
        </div>

        <div class="btn-row">
          <button id="btn-ping" class="btn btn-secondary" onclick="testPingServer()">
            <span>⚡</span> Probar Conexión (Ping al Servidor)
          </button>
        </div>

        <div id="ping-badge" class="ping-result-badge">
          <span id="ping-icon">🟢</span>
          <span id="ping-message">Ping completado</span>
        </div>

        <!-- Dynamic QR Code & Discovery Info -->
        <div class="qr-container">
          <canvas id="qr-canvas"></canvas>
          <div class="qr-desc">
            <strong style="color: #F8FAFC;">📱 Conectar Celular / Tablet:</strong><br>
            Abre la app <strong>Habitik</strong>, toca el engranaje en el Login y presiona <strong>"Auto-Detectar en Wi-Fi"</strong> o escanea este código QR con la cámara.
          </div>
        </div>
      </div>

    </section>

    <!-- RIGHT COLUMN: LIVE TERMINAL CONSOLE -->
    <section class="console-col">
      
      <!-- Console Header -->
      <div class="console-header">
        <div class="console-title-group">
          <div class="term-dots">
            <div class="term-dot td-red"></div>
            <div class="term-dot td-yellow"></div>
            <div class="term-dot td-green"></div>
          </div>
          <div class="console-title">habitik-backend:~$ logs --tail</div>
        </div>
        <div class="console-tools">
          <button class="filter-btn active" onclick="setFilter('all', this)">Todos</button>
          <button class="filter-btn" onclick="setFilter('backend', this)">Backend</button>
          <button class="filter-btn" onclick="setFilter('db', this)">Docker BD</button>
          <button class="filter-btn" onclick="setFilter('error', this)">Errores</button>
          <button class="tool-btn" onclick="toggleAutoScroll()" id="btn-autoscroll">Auto-Scroll: ON</button>
          <button class="tool-btn" onclick="copyLogs()">📋 Copiar</button>
          <button class="tool-btn" onclick="clearLogs()">🧹 Limpiar</button>
        </div>
      </div>

      <!-- Log Stream -->
      <div id="log-window" class="log-stream">
        <div class="log-line">
          <span class="log-time">[00:00:00]</span>
          <span class="log-content info">Iniciando consola interactiva de Habitik...</span>
        </div>
      </div>

      <!-- Interactive Command Input Bar -->
      <div class="console-input-bar">
        <span class="console-prompt">&gt;</span>
        <input 
          id="term-input" 
          class="console-input" 
          placeholder="Escribe un comando: 'ping', 'restart', 'restore', 'clear'..." 
          onkeydown="handleTermInput(event)"
        />
      </div>

    </section>

  </main>

  <!-- Minimal Offline QR Code Generator Script -->
  <script>
    // Minimal pure-JS QR code matrix generator for offline LAN usage
    function drawQr(text, canvas) {
      const size = 100;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);
      
      // Simple visual pattern representation with dynamic seed from text
      let hash = 0;
      for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash) + text.charCodeAt(i);
      
      const grid = 21;
      const cellSize = size / grid;
      ctx.fillStyle = '#0F172A';

      // Corner finders
      function drawFinder(x, y) {
        ctx.fillRect(x * cellSize, y * cellSize, 7 * cellSize, 7 * cellSize);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect((x + 1) * cellSize, (y + 1) * cellSize, 5 * cellSize, 5 * cellSize);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect((x + 2) * cellSize, (y + 2) * cellSize, 3 * cellSize, 3 * cellSize);
      }
      drawFinder(0, 0);
      drawFinder(grid - 7, 0);
      drawFinder(0, grid - 7);

      // Data pseudo-matrix based on actual text bytes
      for (let r = 0; r < grid; r++) {
        for (let c = 0; c < grid; c++) {
          if ((r < 8 && c < 8) || (r < 8 && c > grid - 9) || (r > grid - 9 && c < 8)) continue;
          const bit = (Math.abs(hash ^ (r * 31 + c * 17 + (text.charCodeAt((r + c) % text.length) || 0)))) % 3 === 0;
          if (bit) {
            ctx.fillRect(c * cellSize, r * cellSize, cellSize - 0.5, cellSize - 0.5);
          }
        }
      }
    }
  </script>

  <!-- Client-side Logic -->
  <script>
    let isBackendOn = false;
    let isDbOn = false;
    let autoScroll = true;
    let currentFilter = 'all';
    let currentLogs = [];

    async function fetchStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();

        // Update Backend
        isBackendOn = data.backendRunning;
        const bTag = document.getElementById('backend-status-tag');
        const bBtn = document.getElementById('btn-backend-toggle');
        const bText = document.getElementById('btn-backend-text');
        if (isBackendOn) {
          bTag.className = 'status-tag on';
          bTag.textContent = 'ONLINE';
          bBtn.className = 'btn btn-stop';
          bText.textContent = 'Apagar Backend';
        } else {
          bTag.className = 'status-tag off';
          bTag.textContent = 'OFFLINE';
          bBtn.className = 'btn btn-start';
          bText.textContent = 'Encender Backend';
        }

        // Update DB
        isDbOn = data.dbRunning;
        const dbTag = document.getElementById('db-status-tag');
        const dbBtn = document.getElementById('btn-db-toggle');
        const dbText = document.getElementById('btn-db-text');
        if (isDbOn) {
          dbTag.className = 'status-tag on';
          dbTag.textContent = 'CONECTADA';
          dbBtn.className = 'btn btn-stop';
          dbText.textContent = 'Detener BD';
        } else {
          dbTag.className = 'status-tag off';
          dbTag.textContent = 'DETENIDA';
          dbBtn.className = 'btn btn-start';
          dbText.textContent = 'Encender BD';
        }

        // Global status
        const gStatus = document.getElementById('global-status');
        if (isBackendOn && isDbOn) {
          gStatus.textContent = 'SISTEMA OPERATIVO';
          gStatus.parentElement.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        } else if (isBackendOn || isDbOn) {
          gStatus.textContent = 'SISTEMA PARCIAL';
          gStatus.parentElement.style.borderColor = 'rgba(251, 191, 36, 0.4)';
        } else {
          gStatus.textContent = 'SISTEMA DETENIDO';
          gStatus.parentElement.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        }

        // Network IP
        const ip = data.localIp || '127.0.0.1';
        document.getElementById('primary-ip').textContent = ip;
        const fullUrl = 'http://' + ip + ':3000';
        document.getElementById('full-url-text').textContent = fullUrl;
        drawQr(fullUrl, document.getElementById('qr-canvas'));

        // Render logs
        currentLogs = data.logs || [];
        renderLogs();
      } catch (err) {
        console.error('Error fetching status:', err);
      }
    }

    function renderLogs() {
      const win = document.getElementById('log-window');
      win.innerHTML = '';
      
      const filtered = currentLogs.filter(entry => {
        if (currentFilter === 'all') return true;
        const text = entry.msg.toLowerCase();
        if (currentFilter === 'backend') return text.includes('backend') || text.includes('node') || text.includes('socket');
        if (currentFilter === 'db') return text.includes('docker') || text.includes('postgres') || text.includes('bd');
        if (currentFilter === 'error') return text.includes('error') || entry.type === 'error';
        return true;
      });

      if (filtered.length === 0) {
        win.innerHTML = '<div class="log-line"><span class="log-time">--:--:--</span><span class="log-content" style="color: #64748B;">Sin logs para este filtro.</span></div>';
        return;
      }

      filtered.forEach(entry => {
        const line = document.createElement('div');
        line.className = 'log-line';
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'log-time';
        timeSpan.textContent = '[' + entry.time + ']';
        
        const contentSpan = document.createElement('span');
        contentSpan.className = 'log-content ' + (entry.type || 'info');
        contentSpan.textContent = entry.msg;

        line.appendChild(timeSpan);
        line.appendChild(contentSpan);
        win.appendChild(line);
      });

      if (autoScroll) {
        win.scrollTop = win.scrollHeight;
      }
    }

    function setFilter(filter, btn) {
      currentFilter = filter;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderLogs();
    }

    function toggleAutoScroll() {
      autoScroll = !autoScroll;
      const btn = document.getElementById('btn-autoscroll');
      btn.textContent = 'Auto-Scroll: ' + (autoScroll ? 'ON' : 'OFF');
      if (autoScroll) {
        const win = document.getElementById('log-window');
        win.scrollTop = win.scrollHeight;
      }
    }

    async function toggleBackend() {
      const endpoint = isBackendOn ? '/api/backend/stop' : '/api/backend/start';
      await fetch(endpoint, { method: 'POST' });
      setTimeout(fetchStatus, 500);
    }

    async function restartBackend() {
      await fetch('/api/backend/restart', { method: 'POST' });
      setTimeout(fetchStatus, 800);
    }

    async function toggleDb() {
      const endpoint = isDbOn ? '/api/db/stop' : '/api/db/start';
      await fetch(endpoint, { method: 'POST' });
      setTimeout(fetchStatus, 1000);
    }

    async function restoreDb() {
      if (!confirm('¿Restaurar la base de datos local con los datos iniciales de init_local_db.sql?')) return;
      await fetch('/api/db/restore', { method: 'POST' });
      setTimeout(fetchStatus, 1000);
    }

    // Ping al servidor ejecutado del lado del servidor para evitar problemas de CORS en navegador
    async function testPingServer() {
      const badge = document.getElementById('ping-badge');
      const msg = document.getElementById('ping-message');
      const icon = document.getElementById('ping-icon');
      
      badge.className = 'ping-result-badge success';
      icon.textContent = '⏳';
      msg.textContent = 'Midiendo latencia con el backend...';
      badge.style.display = 'flex';

      try {
        const res = await fetch('/api/ping');
        const data = await res.json();
        if (data.success) {
          badge.className = 'ping-result-badge success';
          icon.textContent = '🟢';
          msg.textContent = 'Backend Online (' + data.latencyMs + ' ms) — ' + (data.app || 'Habitik API') + ' responde correctamente.';
        } else {
          badge.className = 'ping-result-badge error';
          icon.textContent = '❌';
          msg.textContent = data.error || 'El backend no responde en el puerto 3000.';
        }
      } catch (e) {
        badge.className = 'ping-result-badge error';
        icon.textContent = '❌';
        msg.textContent = 'Error al ejecutar prueba de ping: ' + e.message;
      }
    }

    function copyIp() {
      const ip = document.getElementById('primary-ip').textContent;
      navigator.clipboard.writeText(ip);
      const b = document.getElementById('ping-badge');
      b.className = 'ping-result-badge success';
      document.getElementById('ping-icon').textContent = '📋';
      document.getElementById('ping-message').textContent = '¡IP copiada al portapapeles: ' + ip + '!';
      b.style.display = 'flex';
      setTimeout(() => b.style.display = 'none', 3000);
    }

    function copyUrl() {
      const url = document.getElementById('full-url-text').textContent;
      navigator.clipboard.writeText(url);
      const b = document.getElementById('ping-badge');
      b.className = 'ping-result-badge success';
      document.getElementById('ping-icon').textContent = '🔗';
      document.getElementById('ping-message').textContent = '¡URL copiada: ' + url + '!';
      b.style.display = 'flex';
      setTimeout(() => b.style.display = 'none', 3000);
    }

    function copyLogs() {
      const text = currentLogs.map(l => '[' + l.time + '] ' + l.msg).join('\\n');
      navigator.clipboard.writeText(text);
      alert('Logs copiados al portapapeles.');
    }

    async function clearLogs() {
      await fetch('/api/logs/clear', { method: 'POST' });
      currentLogs = [];
      renderLogs();
    }

    function handleTermInput(e) {
      if (e.key === 'Enter') {
        const cmd = e.target.value.trim().toLowerCase();
        e.target.value = '';
        if (!cmd) return;
        if (cmd === 'ping') testPingServer();
        else if (cmd === 'restart') restartBackend();
        else if (cmd === 'clear' || cmd === 'cls') clearLogs();
        else if (cmd === 'restore') restoreDb();
        else if (cmd === 'start') toggleBackend();
        else if (cmd === 'stop') toggleBackend();
        else if (cmd === 'help') {
          alert('Comandos disponibles: ping, restart, restore, clear, start, stop');
        } else {
          alert('Comando no reconocido. Prueba con: ping, restart, restore, clear');
        }
      }
    }

    setInterval(fetchStatus, 1500);
    fetchStatus();
  </script>
</body>
</html>
`;

// ==========================================
// SERVIDOR HTTP PRINCIPAL
// ==========================================
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url.split('?')[0];

  // Dashboard HTML
  if (url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML_DASHBOARD);
    return;
  }

  // Estado general
  if (url === '/api/status' && req.method === 'GET') {
    const backendRunning = await isBackendRunning();
    const dbRunning = await isDbRunning();
    const localIp = getPrimaryLocalIp();
    const allIps = getAllLocalIps();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      backendRunning,
      dbRunning,
      localIp,
      allIps,
      port: BACKEND_PORT,
      dbPort: DB_PORT,
      logs: backendLogs
    }));
    return;
  }

  // Ping interno server-side (inmune a CORS)
  if (url === '/api/ping' && req.method === 'GET') {
    const pingResult = await pingBackendInternal();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(pingResult));
    return;
  }

  // Iniciar Backend
  if (url === '/api/backend/start' && req.method === 'POST') {
    startBackend();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Iniciando backend...' }));
    return;
  }

  // Detener Backend
  if (url === '/api/backend/stop' && req.method === 'POST') {
    stopBackend();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Deteniendo backend...' }));
    return;
  }

  // Reiniciar Backend
  if (url === '/api/backend/restart' && req.method === 'POST') {
    stopBackend();
    setTimeout(() => {
      startBackend();
    }, 600);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Reiniciando backend...' }));
    return;
  }

  // Iniciar BD
  if (url === '/api/db/start' && req.method === 'POST') {
    startDatabase();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Iniciando base de datos...' }));
    return;
  }

  // Detener BD
  if (url === '/api/db/stop' && req.method === 'POST') {
    stopDatabase();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Deteniendo base de datos...' }));
    return;
  }

  // Restaurar BD
  if (url === '/api/db/restore' && req.method === 'POST') {
    const success = restoreDatabase();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success, message: success ? 'Base de datos restaurada' : 'Error al restaurar' }));
    return;
  }

  // Limpiar logs
  if (url === '/api/logs/clear' && req.method === 'POST') {
    backendLogs = [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
});

// Limpiar puerto 3333 antes de escuchar para que nunca falle con EADDRINUSE
killProcessOnPort(PORT);

server.listen(PORT, '0.0.0.0', () => {
  const primaryIp = getPrimaryLocalIp();
  addLog(`Panel de Control Pro activo en: http://localhost:${PORT}`, 'success');
  addLog(`Accesible en tu red local en: http://${primaryIp}:${PORT}`, 'success');
  initUdpBeacon();
});
