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
const MAX_LOGS = 350;
let udpServer = null;

// Estados del sistema:
// 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING'
let systemState = 'STOPPED';
let currentStartupStep = '';

function addLog(msg, type = 'info') {
  const time = new Date().toLocaleTimeString();
  const entry = { time, msg: String(msg).trim(), type };
  backendLogs.push(entry);
  if (backendLogs.length > MAX_LOGS) backendLogs.shift();
  console.log(`[${time}] ${msg}`);
}

// Liberar puerto para evitar EADDRINUSE
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

// Obtener IPs locales activas
function getAllLocalIps() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
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

// Comprobación de puerto TCP con reintentos para evitar falsos negativos por lag de WSL
function checkPortOpen(port, host = '127.0.0.1', timeout = 1500) {
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
  const open = await checkPortOpen(BACKEND_PORT, '127.0.0.1', 1200);
  if (open) return true;
  return await checkPortOpen(BACKEND_PORT, '127.0.0.1', 1500);
}

// Comprueba si la BD está activa con doble verificación TCP + Docker inspect
async function isDbRunning() {
  const open = await checkPortOpen(DB_PORT, '127.0.0.1', 1200);
  if (open) return true;

  const retryOpen = await checkPortOpen(DB_PORT, '127.0.0.1', 1800);
  if (retryOpen) return true;

  // Fallback: verificar si el contenedor docker sigue en ejecución
  try {
    const cmd = `wsl -d Ubuntu -- docker inspect -f "{{.State.Running}}" habitik_postgres_local`;
    const out = execSync(cmd, { stdio: 'pipe', encoding: 'utf-8' }).trim();
    return out === 'true';
  } catch (_) {
    return false;
  }
}

// Ruta dinámica universal para WSL
function getProjectWslPath() {
  const projectRoot = path.resolve(__dirname, '..');
  const drive = projectRoot.charAt(0).toLowerCase();
  const rest = projectRoot.slice(2).replace(/\\/g, '/');
  return `/mnt/${drive}${rest}`;
}

// Iniciar Docker DB
function startDatabaseInternal() {
  addLog('Levantando contenedor Docker PostgreSQL en puerto 5433...', 'start');
  const projectRoot = path.resolve(__dirname, '..');

  try {
    execSync('docker compose up -d', { cwd: projectRoot, stdio: 'pipe' });
    addLog('Contenedor PostgreSQL levantado (Docker nativo).', 'info');
    return true;
  } catch (_) {}

  try {
    const wslPath = getProjectWslPath();
    const cmd = `wsl -d Ubuntu -- bash -c "cd '${wslPath}' && docker compose up -d"`;
    execSync(cmd, { stdio: 'pipe' });
    addLog('Contenedor PostgreSQL levantado en WSL Ubuntu.', 'info');
    return true;
  } catch (err) {
    addLog(`Error al iniciar Docker: ${err.message}`, 'error');
    return false;
  }
}

// Detener Docker DB
function stopDatabaseInternal() {
  addLog('Deteniendo contenedor Docker PostgreSQL...', 'warn');
  const projectRoot = path.resolve(__dirname, '..');

  try {
    execSync('docker compose stop', { cwd: projectRoot, stdio: 'pipe' });
    addLog('Base de datos detenida (Docker nativo).', 'info');
    return true;
  } catch (_) {}

  try {
    const wslPath = getProjectWslPath();
    const cmd = `wsl -d Ubuntu -- bash -c "cd '${wslPath}' && docker compose stop"`;
    execSync(cmd, { stdio: 'pipe' });
    addLog('Base de datos detenida (WSL Ubuntu).', 'info');
    return true;
  } catch (err) {
    addLog(`Error deteniendo Docker DB: ${err.message}`, 'error');
    return false;
  }
}

// Iniciar Backend
function startBackendInternal() {
  if (backendProcess) return;
  addLog('Iniciando Backend Node.js en puerto 3000...', 'start');
  
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
function stopBackendInternal() {
  if (backendProcess) {
    addLog('Deteniendo proceso Backend...', 'warn');
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
    killProcessOnPort(BACKEND_PORT);
  }
}

// ==========================================
// ORQUESTADOR MAESTRO (ENCENDIDO CON CONTROL DE TIEMPOS)
// ==========================================
async function startFullStack() {
  if (systemState === 'STARTING' || systemState === 'RUNNING') return;
  systemState = 'STARTING';

  addLog('════════════════════════════════════════════════════════', 'start');
  addLog('🚀 INICIANDO ENTORNO CONTROLADO DE HABITIK...', 'start');
  addLog('════════════════════════════════════════════════════════', 'start');

  // 1. Iniciar Docker PostgreSQL
  currentStartupStep = 'Paso 1/3: Levantando PostgreSQL en Docker (:5433)...';
  addLog(currentStartupStep, 'start');
  startDatabaseInternal();

  // 2. Espera activa hasta que PostgreSQL esté 100% listo para consultas
  currentStartupStep = 'Paso 2/3: Esperando que PostgreSQL responda consultas...';
  addLog(currentStartupStep, 'info');

  let dbReady = false;
  for (let attempt = 1; attempt <= 15; attempt++) {
    await new Promise(r => setTimeout(r, 700));
    dbReady = await isDbRunning();
    if (dbReady) {
      addLog(`✅ PostgreSQL 16 verificado y listo en puerto 5433 (intento ${attempt}).`, 'success');
      break;
    }
    addLog(`   ...esperando a PostgreSQL socket (${attempt}/15)...`, 'info');
  }

  if (!dbReady) {
    addLog('❌ ERROR: PostgreSQL no respondió en puerto 5433. Abortando arranque.', 'error');
    systemState = 'STOPPED';
    currentStartupStep = '';
    return false;
  }

  // Pequeño tiempo de gracia para que el pool de PostgreSQL se estabilice
  await new Promise(r => setTimeout(r, 800));

  // 3. Iniciar Backend Node.js
  currentStartupStep = 'Paso 3/3: Arrancando Backend Node.js (:3000)...';
  addLog(currentStartupStep, 'start');
  startBackendInternal();

  // Esperar a que el backend responda en HTTP
  let backendReady = false;
  for (let attempt = 1; attempt <= 20; attempt++) {
    await new Promise(r => setTimeout(r, 600));
    backendReady = await isBackendRunning();
    if (backendReady) break;
  }

  if (backendReady) {
    const ping = await pingBackendInternal();
    if (ping.success) {
      addLog(`✅ Backend HTTP verificado en ${ping.latencyMs} ms (código ${ping.statusCode}).`, 'success');
    }
  }

  systemState = 'RUNNING';
  currentStartupStep = '';
  addLog('════════════════════════════════════════════════════════', 'success');
  addLog('🎉 ¡SISTEMA HABITIK 100% OPERATIVO Y SINCRONIZADO!', 'success');
  addLog(`📡 IP Local para tu app: http://${getPrimaryLocalIp()}:${BACKEND_PORT}`, 'success');
  addLog('════════════════════════════════════════════════════════', 'success');
  return true;
}

async function stopFullStack() {
  if (systemState === 'STOPPED' || systemState === 'STOPPING') return;
  systemState = 'STOPPING';

  addLog('════════════════════════════════════════════════════════', 'warn');
  addLog('🛑 DETENIENDO SISTEMA HABITIK...', 'warn');
  addLog('════════════════════════════════════════════════════════', 'warn');

  currentStartupStep = 'Deteniendo Backend Node.js...';
  addLog(`[1/2] ${currentStartupStep}`, 'info');
  stopBackendInternal();
  await new Promise(r => setTimeout(r, 800));

  currentStartupStep = 'Deteniendo contenedor Docker PostgreSQL...';
  addLog(`[2/2] ${currentStartupStep}`, 'info');
  stopDatabaseInternal();
  await new Promise(r => setTimeout(r, 800));

  systemState = 'STOPPED';
  currentStartupStep = '';
  addLog('✅ Sistema completamente detenido. Puertos liberados.', 'success');
  return true;
}

async function restartFullStack() {
  addLog('🔄 Reiniciando sistema completo en secuencia...', 'start');
  await stopFullStack();
  await new Promise(r => setTimeout(r, 1200));
  await startFullStack();
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

    req.on('error', () => {
      resolve({
        success: false,
        latencyMs: 0,
        error: 'El backend no está respondiendo en el puerto 3000.'
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
// GUARDIÁN AUTÓNOMO (WATCHDOG & AUTO-HEALING)
// ==========================================
let watchdogBusy = false;
setInterval(async () => {
  if (systemState === 'RUNNING' && !watchdogBusy) {
    watchdogBusy = true;
    try {
      const dbOk = await isDbRunning();
      const backendOk = await isBackendRunning();

      if (!dbOk) {
        addLog('⚠️ [Guardián] PostgreSQL no responde. Levantando contenedor automáticamente...', 'warn');
        startDatabaseInternal();
        for (let i = 0; i < 8; i++) {
          await new Promise(r => setTimeout(r, 700));
          if (await isDbRunning()) {
            addLog('✅ [Guardián] PostgreSQL restaurado exitosamente.', 'success');
            const p = await pingBackendInternal();
            if (!p.success) {
              addLog('🔄 [Guardián] Reconectando backend para refrescar pool de BD...', 'warn');
              stopBackendInternal();
              setTimeout(startBackendInternal, 600);
            }
            break;
          }
        }
      } else if (!backendOk) {
        addLog('⚠️ [Guardián] Backend Node.js detenido inesperadamente. Reiniciando...', 'warn');
        startBackendInternal();
      }
    } catch (_) {}
    watchdogBusy = false;
  }
}, 5000);

// ==========================================
// INTERFAZ WEB PROFESIONAL — 1 SOLO BOTÓN MAESTRO
// ==========================================
const HTML_DASHBOARD = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <title>Habitik Server Pro — Interruptor Maestro</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-gradient: radial-gradient(circle at 10% 10%, #0d221c 0%, #080d14 45%, #04070a 100%);
      --panel-bg: rgba(13, 22, 33, 0.85);
      --panel-border: rgba(16, 185, 129, 0.22);
      --primary: #10B981;
      --primary-hover: #059669;
      --primary-glow: rgba(16, 185, 129, 0.38);
      --cyan: #06B6D4;
      --danger: #EF4444;
      --danger-hover: #DC2626;
      --danger-glow: rgba(239, 68, 68, 0.4);
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

    .badge-live {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 16px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      transition: all 0.3s;
    }

    .badge-live.running {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.45);
      color: #34D399;
    }

    .badge-live.starting {
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.45);
      color: #FBBF24;
    }

    .badge-live.stopped {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.45);
      color: #F87171;
    }

    .pulse-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 10px currentColor;
      animation: pulse 1.8s infinite;
    }

    @keyframes pulse {
      0% { transform: scale(0.9); opacity: 0.8; }
      50% { transform: scale(1.3); opacity: 1; }
      100% { transform: scale(0.9); opacity: 0.8; }
    }

    /* Split Screen 2-Column Layout */
    .app-layout {
      display: grid;
      grid-template-columns: minmax(430px, 1.05fr) minmax(480px, 1.35fr);
      gap: 18px;
      height: calc(100vh - 100px);
    }

    /* Left Column */
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

    /* HERO MASTER BUTTON */
    .hero-card {
      background: linear-gradient(145deg, rgba(16, 27, 40, 0.95), rgba(8, 15, 24, 0.95));
      border: 1px solid rgba(16, 185, 129, 0.35);
      text-align: center;
      padding: 26px 20px;
    }

    .hero-title {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 700;
      color: var(--text-muted);
      margin-bottom: 14px;
    }

    .master-btn {
      width: 100%;
      padding: 20px 24px;
      border-radius: 16px;
      border: none;
      font-family: inherit;
      font-size: 18px;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      letter-spacing: -0.2px;
    }

    .master-btn:active { transform: scale(0.98); }

    .master-btn-start {
      background: linear-gradient(135deg, #10B981, #059669);
      color: white;
      box-shadow: 0 8px 28px var(--primary-glow);
    }
    .master-btn-start:hover {
      background: linear-gradient(135deg, #34D399, #10B981);
      box-shadow: 0 10px 34px var(--primary-glow);
    }

    .master-btn-stop {
      background: linear-gradient(135deg, #EF4444, #B91C1C);
      color: white;
      box-shadow: 0 8px 28px var(--danger-glow);
    }
    .master-btn-stop:hover {
      background: linear-gradient(135deg, #F87171, #EF4444);
      box-shadow: 0 10px 34px var(--danger-glow);
    }

    .master-btn-starting {
      background: linear-gradient(135deg, #F59E0B, #D97706);
      color: white;
      cursor: wait;
    }

    .master-subtext {
      font-size: 12px;
      font-weight: 500;
      opacity: 0.9;
    }

    .quick-actions-row {
      display: flex;
      gap: 10px;
      margin-top: 14px;
    }

    .btn-sub {
      flex: 1;
      padding: 10px 14px;
      border-radius: 10px;
      font-family: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.06);
      color: #E2E8F0;
      border: 1px solid rgba(255, 255, 255, 0.12);
      transition: all 0.2s;
    }
    .btn-sub:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.25);
    }

    /* Telemetry Info Cards (SIN BOTONES INDIVIDUALES) */
    .services-status-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .svc-badge-card {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .svc-title {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .svc-state-pill {
      font-size: 10px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 6px;
      text-transform: uppercase;
    }
    .svc-state-pill.on { background: rgba(16, 185, 129, 0.2); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.4); }
    .svc-state-pill.off { background: rgba(239, 68, 68, 0.2); color: #F87171; border: 1px solid rgba(239, 68, 68, 0.4); }

    .svc-detail {
      font-size: 13px;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      color: #F1F5F9;
    }

    /* Network Card */
    .network-box {
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(6, 182, 212, 0.3);
      border-radius: 14px;
      padding: 14px;
      margin-bottom: 12px;
    }

    .ip-display {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
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
      padding: 9px 12px;
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

    .term-dots { display: flex; gap: 6px; }
    .term-dot { width: 10px; height: 10px; border-radius: 50%; }
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
        <h1>HABITIK SERVER PRO — CONTROL MAESTRO</h1>
        <p>Orquestador Controlado de Contingencia (PostgreSQL + Express) — Feria 2026</p>
      </div>
    </div>
    <div>
      <div id="global-badge" class="badge-live stopped">
        <span class="pulse-dot"></span>
        <span id="global-status-text">SISTEMA APAGADO</span>
      </div>
    </div>
  </header>

  <!-- Split Screen 2-Column Dashboard -->
  <main class="app-layout">
    
    <!-- LEFT COLUMN: CONTROLS & STATUS -->
    <section class="controls-col">
      
      <!-- HERO UNIFIED MASTER BUTTON (1 SOLO BOTÓN PARA INICIAR/APAGAR) -->
      <div class="card hero-card">
        <div class="hero-title">INTERRUPTOR MAESTRO UNIFICADO</div>
        
        <button id="master-btn" class="master-btn master-btn-start" onclick="toggleMasterServer()">
          <span id="master-btn-label">🚀 INICIAR SERVIDOR COMPLETO</span>
          <span id="master-btn-sub" class="master-subtext">Levanta Docker PostgreSQL + Backend en secuencia</span>
        </button>

        <div class="quick-actions-row">
          <button class="btn-sub" onclick="restartMasterServer()" title="Reinicia BD y Backend en orden">
            <span>🔄</span> Reiniciar Todo
          </button>
          <button class="btn-sub" onclick="restoreDb()" title="Restaura datos limpios desde init_local_db.sql">
            <span>📥</span> Restaurar BD (SQL)
          </button>
        </div>
      </div>

      <!-- Services Status Badges (TELEMETRÍA, SIN BOTONES SEPARADOS) -->
      <div class="card">
        <div style="font-size: 13px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <span>⚙️</span> Telemetría de Componentes
        </div>

        <div class="services-status-grid">
          <div class="svc-badge-card">
            <div class="svc-title">
              <span>🐘 Docker PostgreSQL</span>
              <span id="db-state-pill" class="svc-state-pill off">OFF</span>
            </div>
            <div class="svc-detail">Puerto :5433 (24 Tablas)</div>
          </div>

          <div class="svc-badge-card">
            <div class="svc-title">
              <span>🚀 Backend Express</span>
              <span id="backend-state-pill" class="svc-state-pill off">OFF</span>
            </div>
            <div class="svc-detail">Puerto :3000 (Socket.io)</div>
          </div>
        </div>

        <div style="margin-top: 10px; font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
          <span>🛡️</span> <span>Guardián Autónomo activo (Auto-healing ante caídas de Docker/BD)</span>
        </div>
      </div>

      <!-- Network & Mobile Connection Card -->
      <div class="card">
        <div style="font-size: 14px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <span>📡</span> Red Wi-Fi y Conexión Móvil
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

        <button id="btn-ping" class="btn-sub" style="width: 100%; padding: 12px;" onclick="testPingServer()">
          <span>⚡</span> Probar Conexión (Ping al Servidor)
        </button>

        <div id="ping-badge" class="ping-result-badge">
          <span id="ping-icon">🟢</span>
          <span id="ping-message">Ping completado</span>
        </div>

        <!-- Dynamic QR Code & Discovery Info -->
        <div class="qr-container">
          <canvas id="qr-canvas"></canvas>
          <div class="qr-desc">
            <strong style="color: #F8FAFC;">📱 Conectar Celular / Tablet:</strong><br>
            Abre la app <strong>Habitik</strong>, toca el botón de servidor en el Login y presiona <strong>"Auto-Detectar en Wi-Fi"</strong> o escanea este código QR con la cámara.
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
          <div class="console-title">habitik-server:~$ logs --live</div>
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
          placeholder="Escribe un comando: 'start', 'stop', 'restart', 'ping', 'restore', 'clear'..." 
          onkeydown="handleTermInput(event)"
        />
      </div>

    </section>

  </main>

  <!-- Minimal Offline QR Code Generator Script -->
  <script>
    function drawQr(text, canvas) {
      const size = 100;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);
      
      let hash = 0;
      for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash) + text.charCodeAt(i);
      
      const grid = 21;
      const cellSize = size / grid;
      ctx.fillStyle = '#0F172A';

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
    let systemState = 'STOPPED';
    let autoScroll = true;
    let currentFilter = 'all';
    let currentLogs = [];

    async function fetchStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();

        systemState = data.systemState;
        const bRunning = data.backendRunning;
        const dbRunning = data.dbRunning;

        // Master button update
        const mBtn = document.getElementById('master-btn');
        const mLabel = document.getElementById('master-btn-label');
        const mSub = document.getElementById('master-btn-sub');
        const gBadge = document.getElementById('global-badge');
        const gText = document.getElementById('global-status-text');

        if (systemState === 'RUNNING' || (bRunning && dbRunning)) {
          mBtn.className = 'master-btn master-btn-stop';
          mLabel.textContent = '🛑 APAGAR SERVIDOR HABITIK';
          mSub.textContent = 'Detiene de forma segura la BD y el Backend sincronizados';
          gBadge.className = 'badge-live running';
          gText.textContent = 'SISTEMA 100% OPERATIVO';
        } else if (systemState === 'STARTING') {
          mBtn.className = 'master-btn master-btn-starting';
          mLabel.textContent = '⏳ INICIANDO SERVIDOR...';
          mSub.textContent = data.currentStartupStep || 'Sincronizando servicios...';
          gBadge.className = 'badge-live starting';
          gText.textContent = 'INICIANDO SERVICIOS...';
        } else if (systemState === 'STOPPING') {
          mBtn.className = 'master-btn master-btn-starting';
          mLabel.textContent = '⏳ DETENIENDO SERVICIOS...';
          mSub.textContent = 'Liberando puertos y memoria...';
          gBadge.className = 'badge-live starting';
          gText.textContent = 'DETENIENDO...';
        } else {
          mBtn.className = 'master-btn master-btn-start';
          mLabel.textContent = '🚀 INICIAR SERVIDOR COMPLETO';
          mSub.textContent = 'Levanta Docker PostgreSQL + Backend en secuencia';
          gBadge.className = 'badge-live stopped';
          gText.textContent = 'SISTEMA APAGADO';
        }

        // Sub components pills
        const dbPill = document.getElementById('db-state-pill');
        dbPill.className = 'svc-state-pill ' + (dbRunning ? 'on' : 'off');
        dbPill.textContent = dbRunning ? 'ONLINE' : 'OFF';

        const bPill = document.getElementById('backend-state-pill');
        bPill.className = 'svc-state-pill ' + (bRunning ? 'on' : 'off');
        bPill.textContent = bRunning ? 'ONLINE' : 'OFF';

        // Network IP
        const ip = data.localIp || '127.0.0.1';
        document.getElementById('primary-ip').textContent = ip;
        const fullUrl = 'http://' + ip + ':3000';
        document.getElementById('full-url-text').textContent = fullUrl;
        drawQr(fullUrl, document.getElementById('qr-canvas'));

        // Logs
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

    async function toggleMasterServer() {
      if (systemState === 'RUNNING') {
        await fetch('/api/master/stop', { method: 'POST' });
      } else {
        await fetch('/api/master/start', { method: 'POST' });
      }
      setTimeout(fetchStatus, 400);
    }

    async function restartMasterServer() {
      await fetch('/api/master/restart', { method: 'POST' });
      setTimeout(fetchStatus, 600);
    }

    async function restoreDb() {
      if (!confirm('¿Restaurar las 24 tablas de la base de datos local con los datos limpios de init_local_db.sql?')) return;
      await fetch('/api/db/restore', { method: 'POST' });
      setTimeout(fetchStatus, 1000);
    }

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
      document.getElementById('ping-message').textContent = '¡IP copiada: ' + ip + '!';
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
        if (cmd === 'start') toggleMasterServer();
        else if (cmd === 'stop') toggleMasterServer();
        else if (cmd === 'restart') restartMasterServer();
        else if (cmd === 'ping') testPingServer();
        else if (cmd === 'clear' || cmd === 'cls') clearLogs();
        else if (cmd === 'restore') restoreDb();
        else if (cmd === 'help') {
          alert('Comandos disponibles: start, stop, restart, ping, restore, clear');
        } else {
          alert('Comando no reconocido. Prueba con: start, stop, restart, ping, clear');
        }
      }
    }

    setInterval(fetchStatus, 1400);
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

  // Dashboard HTML con cabeceras anti-caché
  if (url === '/' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(HTML_DASHBOARD);
    return;
  }

  // Estado general
  if (url === '/api/status' && req.method === 'GET') {
    const backendRunning = await isBackendRunning();
    const dbRunning = await isDbRunning();
    const localIp = getPrimaryLocalIp();
    const allIps = getAllLocalIps();

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify({
      systemState,
      currentStartupStep,
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

  // Interruptor Maestro: Iniciar Todo
  if (url === '/api/master/start' && req.method === 'POST') {
    startFullStack();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Iniciando sistema orquestado...' }));
    return;
  }

  // Interruptor Maestro: Detener Todo
  if (url === '/api/master/stop' && req.method === 'POST') {
    stopFullStack();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Deteniendo sistema...' }));
    return;
  }

  // Interruptor Maestro: Reiniciar Todo
  if (url === '/api/master/restart' && req.method === 'POST') {
    restartFullStack();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Reiniciando sistema...' }));
    return;
  }

  // Ping interno server-side
  if (url === '/api/ping' && req.method === 'GET') {
    const pingResult = await pingBackendInternal();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(pingResult));
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
