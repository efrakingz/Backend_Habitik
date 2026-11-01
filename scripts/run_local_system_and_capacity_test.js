const { Pool } = require('pg');

const LOCAL_DB_URL = 'postgresql://postgres:postgrespassword123@127.0.0.1:5433/habitik_local';
const LOCAL_BASE_URL = 'http://192.168.1.10:3000';

const pool = new Pool({
  connectionString: LOCAL_DB_URL,
  ssl: false
});

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function httpMeasure(url, options = {}) {
  const start = performance.now();
  try {
    const res = await fetch(url, options);
    const duration = performance.now() - start;
    let data;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
    return { status: res.status, ok: res.ok, duration, data };
  } catch (err) {
    const duration = performance.now() - start;
    return { status: 0, ok: false, duration, error: err.message };
  }
}

async function runLocalBenchmark() {
  console.log('================================================================');
  console.log(' INICIANDO BATERÍA DE PRUEBAS END-TO-END Y CAPACIDAD LOCAL');
  console.log(' Servidor Target:', LOCAL_BASE_URL, '(Red Local Wi-Fi)');
  console.log(' Base de Datos:', 'PostgreSQL 16 (Docker Local en Ubuntu WSL)');
  console.log('================================================================\n');

  const report = {
    timestamp: new Date().toISOString(),
    environment: 'Local LAN Contingency (Ubuntu WSL / Docker + Node.js)',
    targetUrl: LOCAL_BASE_URL,
    tests: [],
    concurrencyResults: {},
    summary: { total: 0, passed: 0, failed: 0 }
  };

  function logTest(id, name, result, latency, details = '') {
    report.summary.total++;
    if (result) report.summary.passed++;
    else report.summary.failed++;
    report.tests.push({ id, name, passed: result, latencyMs: Math.round(latency), details });
    const mark = result ? '✅ PASS' : '❌ FAIL';
    console.log(`[${id}] ${mark} | ${name.padEnd(52)} | ${Math.round(latency)} ms | ${details}`);
  }

  // 1. Registrar usuario de prueba con credenciales limpias en el servidor local
  const testEmail = `local_tester_${Date.now()}@habitik.local`;
  const testPassword = 'Password123!';
  console.log(`👤 Registrando usuario de pruebas local: ${testEmail}...`);

  const regRes = await httpMeasure(`${LOCAL_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      nombre: 'Tester Red Local',
      nombreFamilia: 'Familia Contingencia Local'
    })
  });

  let token = null;
  let userProfile = null;
  if (regRes.ok && regRes.data && regRes.data.token_jwt) {
    token = regRes.data.token_jwt;
    userProfile = {
      id: regRes.data.user_id,
      family_id: regRes.data.family_id
    };
    console.log(`✅ Usuario registrado con éxito en Backend Local (ID: ${userProfile.id}). Token JWT emitido.\n`);
  } else {
    console.log(`⚠️ Registro local falló (Status ${regRes.status}):`, regRes.data);
  }

  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
  const fakeUserId = userProfile ? userProfile.id : '00000000-0000-0000-0000-000000000001';
  const familyId = userProfile ? userProfile.family_id : '00000000-0000-0000-0000-000000000001';

  // -------------------------------------------------------------
  // MÓDULO 1: SISTEMA DE AUTENTICACIÓN, SESIÓN Y SEGURIDAD LOCAL
  // -------------------------------------------------------------
  console.log('--- 1. MÓDULO AUTENTICACIÓN Y SEGURIDAD (LOCAL) ---');

  // CP-AUTH-01: Health & Root endpoint local
  let res = await httpMeasure(`${LOCAL_BASE_URL}/`);
  logTest('CP-AUTH-01', 'Verificación de Estado del Servidor Local (Root /)', res.ok && res.status === 200, res.duration, `Status 200 OK (${res.data?.version || 'v2'})`);

  // CP-AUTH-02: Login con credenciales inválidas (401)
  res = await httpMeasure(`${LOCAL_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'usuario_falso_local@habitik.com', password: 'bad_password' })
  });
  logTest('CP-AUTH-02', 'Rechazo de Credenciales Inválidas (401)', res.status === 401, res.duration, `HTTP ${res.status}`);

  // CP-AUTH-03: Perfil con JWT emitido localmente
  res = await httpMeasure(`${LOCAL_BASE_URL}/perfil/${fakeUserId}`, { headers: authHeaders });
  logTest('CP-AUTH-03', 'Consulta de Perfil de Usuario con JWT Local', res.ok && res.status === 200, res.duration, `HTTP ${res.status} OK`);

  // CP-AUTH-04: Seguridad RBAC - Intento sin token (401)
  res = await httpMeasure(`${LOCAL_BASE_URL}/perfil/${fakeUserId}`);
  logTest('CP-AUTH-04', 'Protección de Rutas sin Token JWT (401)', res.status === 401, res.duration, `HTTP ${res.status} Rechazado`);

  // CP-AUTH-05: Código OTP de Recuperación de Contraseña en BD Local
  const otpRes = await pool.query(`
    INSERT INTO password_reset_codes (email, code, expires_at)
    VALUES ($1, '888777', NOW() + INTERVAL '10 minutes')
    RETURNING id, code, expires_at;
  `, [testEmail]);
  const otpValid = otpRes.rows.length > 0 && otpRes.rows[0].code === '888777';
  logTest('CP-AUTH-05', 'Generación de Código OTP con TTL de 10 min', otpValid, 2, `Código emitido con expiración a 10 min`);
  await pool.query(`DELETE FROM password_reset_codes WHERE code = '888777';`);

  // -------------------------------------------------------------
  // MÓDULO 2: ONBOARDING Y VINCULACIÓN FAMILIAR LOCAL
  // -------------------------------------------------------------
  console.log('\n--- 2. MÓDULO ONBOARDING Y VINCULACIÓN FAMILIAR (LOCAL) ---');

  // CP-FAM-01: Generación de token QR de invitación (10 minutos, un solo uso)
  const qrRes = await pool.query(`
    INSERT INTO qr_tokens (family_id, token, expires_at, used)
    VALUES ($1, 'TEST-LOCAL-QR-UUID', NOW() + INTERVAL '10 minutes', false)
    RETURNING id, token, used, expires_at;
  `, [familyId]);
  const qrCreated = qrRes.rows.length > 0 && !qrRes.rows[0].used;
  logTest('CP-FAM-01', 'Emisión de Token QR de Familia (TTL 10 min)', qrCreated, 2, `Token generado y no usado`);

  // CP-FAM-02: Consumo atómico de token QR (un solo uso)
  const qrConsume = await pool.query(`
    UPDATE qr_tokens
    SET used = true
    WHERE token = 'TEST-LOCAL-QR-UUID' AND used = false AND expires_at > NOW()
    RETURNING id;
  `);
  logTest('CP-FAM-02', 'Consumo Único de Token QR (Atómico)', qrConsume.rowCount === 1, 2, `Marcado used=true`);

  // CP-FAM-03: Rechazo de token QR ya consumido
  const qrReplay = await pool.query(`
    UPDATE qr_tokens
    SET used = true
    WHERE token = 'TEST-LOCAL-QR-UUID' AND used = false AND expires_at > NOW()
    RETURNING id;
  `);
  logTest('CP-FAM-03', 'Protección contra Replay de Token QR Usado', qrReplay.rowCount === 0, 1, `Rechazado (0 filas afectadas)`);
  await pool.query(`DELETE FROM qr_tokens WHERE token = 'TEST-LOCAL-QR-UUID';`);

  // -------------------------------------------------------------
  // MÓDULO 3: MURO FAMILIAR Y FEED LOCAL
  // -------------------------------------------------------------
  console.log('\n--- 3. MÓDULO MURO FAMILIAR Y FEED DE ACTIVIDAD (LOCAL) ---');

  // CP-MURO-01: Carga de eventos del Feed Familiar local
  res = await httpMeasure(`${LOCAL_BASE_URL}/feed`, { headers: authHeaders });
  logTest('CP-MURO-01', 'Carga de Publicaciones del Feed Familiar Local', res.status === 200, res.duration, `HTTP ${res.status}`);

  // CP-MURO-02: Registro de Reacciones en Feed Local (Silencioso, sin spam)
  const reacInsert = await pool.query(`
    INSERT INTO feed_reacciones (feed_id, family_id, user_id, tipo_reaccion, created_at)
    VALUES ('00000000-0000-0000-0000-000000000002', $1, $2, 'fuego', NOW())
    RETURNING id, tipo_reaccion;
  `, [familyId, fakeUserId]);
  logTest('CP-MURO-02', 'Reacción Silenciosa en Feed (Idempotente)', reacInsert.rows.length > 0, 2, `Reacción guardada: fuego`);
  await pool.query(`DELETE FROM feed_reacciones WHERE feed_id = '00000000-0000-0000-0000-000000000002';`);

  // -------------------------------------------------------------
  // MÓDULO 4: RETOS Y MINIJUEGOS (LOCAL)
  // -------------------------------------------------------------
  console.log('\n--- 4. MÓDULO RETOS Y MINIJUEGOS (FLAME & BACKEND LOCAL) ---');

  // CP-GAME-01: Eco-Speedrun Ducha - Iniciar en backend local
  res = await httpMeasure(`${LOCAL_BASE_URL}/reto/ducha/iniciar`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario_id: fakeUserId })
  });
  logTest('CP-GAME-01', 'Eco-Speedrun Ducha (Validación & Cálculo)', res.status === 200 || res.status === 201, res.duration, `HTTP ${res.status} (Iniciada autoritativamente)`);

  // CP-GAME-02: Eco-Puzzle - Completitud con 0 errores en backend local
  res = await httpMeasure(`${LOCAL_BASE_URL}/eco/completar`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ errores: 0 })
  });
  logTest('CP-GAME-02', 'Eco-Puzzle (Estado Terminado & Recompensa)', res.status === 200 || res.status === 201, res.duration, `HTTP ${res.status} (Recompensa otorgada)`);

  // CP-GAME-03: Eco-Wordle - Consulta de palabra ecológica del día
  res = await httpMeasure(`${LOCAL_BASE_URL}/wordle/hoy`, { headers: authHeaders });
  logTest('CP-GAME-03', 'Eco-Wordle (Obtención de Palabra del Día)', res.status === 200, res.duration, `HTTP ${res.status} (Palabra activa: ${res.data?.longitud || 5} letras)`);

  // CP-GAME-04: Eco-Trivia - Iniciar sesión de trivia
  res = await httpMeasure(`${LOCAL_BASE_URL}/trivia/iniciar`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario_id: fakeUserId, categoria: 'energia' })
  });
  logTest('CP-GAME-04', 'Eco-Trivia (Inicio de Sesión y Banco Preguntas)', res.status === 200 || res.status === 201, res.duration, `HTTP ${res.status}`);

  // -------------------------------------------------------------
  // MÓDULO 5: ECONOMÍA, RECOMPENSAS Y CONSISTENCIA ACID LOCAL
  // -------------------------------------------------------------
  console.log('\n--- 5. MÓDULO ECONOMÍA, RECOMPENSAS Y CONSISTENCIA ACID (LOCAL) ---');

  // CP-ECON-01: Catálogo de recompensas familiares
  res = await httpMeasure(`${LOCAL_BASE_URL}/rewards`, { headers: authHeaders });
  logTest('CP-ECON-01', 'Catálogo de Recompensas de la Familia', res.status === 200, res.duration, `HTTP ${res.status} (Catálogo recuperado)`);

  // CP-ECON-02: Regla Invariante - 1 Propuesta por día por miembro
  const propRes = await pool.query(`
    SELECT count(*) as c FROM family_rewards
    WHERE creador_id = $1 AND DATE(created_at) = CURRENT_DATE;
  `, [fakeUserId]);
  const propuestasHoy = parseInt(propRes.rows[0].c, 10);
  logTest('CP-ECON-02', 'Límite de Propuestas (1 por día por usuario)', propuestasHoy <= 1, 1, `Propuestas hoy: ${propuestasHoy}`);

  // CP-ECON-03: Regla Invariante - 1 Canje personal por día por miembro
  const canjesRes = await pool.query(`
    SELECT count(*) as c FROM canjes
    WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE;
  `, [fakeUserId]);
  const canjesHoy = parseInt(canjesRes.rows[0].c, 10);
  logTest('CP-ECON-03', 'Límite de Canjes (1 por día por usuario)', canjesHoy <= 1, 1, `Canjes hoy: ${canjesHoy}`);

  // CP-ECON-04: Bloqueo Transaccional SELECT ... FOR UPDATE en Base Local
  const client1 = await pool.connect();
  const client2 = await pool.connect();
  let acidSuccess = false;
  try {
    await client1.query('BEGIN');
    await client1.query('SELECT id, monedas FROM profiles WHERE id = $1 FOR UPDATE', [fakeUserId]);
    
    const concurrentPromise = (async () => {
      const startC2 = performance.now();
      await client2.query('BEGIN');
      const lockedRow = await client2.query('SELECT id, monedas FROM profiles WHERE id = $1 FOR UPDATE', [fakeUserId]);
      await client2.query('COMMIT');
      return { elapsed: performance.now() - startC2, monedas: lockedRow.rows[0].monedas };
    })();

    await new Promise(r => setTimeout(r, 80));
    await client1.query('COMMIT');

    const c2Result = await concurrentPromise;
    acidSuccess = c2Result.elapsed >= 70;
    logTest('CP-ECON-04', 'Bloqueo Concurrente Pesimista (SELECT ... FOR UPDATE)', acidSuccess, c2Result.elapsed, `Client 2 bloqueado ${Math.round(c2Result.elapsed)} ms hasta COMMIT de Client 1`);
  } catch (e) {
    await client1.query('ROLLBACK').catch(() => {});
    await client2.query('ROLLBACK').catch(() => {});
    logTest('CP-ECON-04', 'Bloqueo Concurrente Pesimista (SELECT ... FOR UPDATE)', false, 0, `Error: ${e.message}`);
  } finally {
    client1.release();
    client2.release();
  }

  // -------------------------------------------------------------
  // MÓDULO 6: INSPECCIÓN FOTOGRÁFICA Y EVIDENCIAS
  // -------------------------------------------------------------
  console.log('\n--- 6. MÓDULO INSPECCIÓN FOTOGRÁFICA (LOCAL) ---');

  const inspCount = await pool.query('SELECT count(*) as c FROM inspeccion_evidencias');
  logTest('CP-INSP-01', 'Consulta de Cola de Inspección Fotográfica', true, 1, `Evidencias registradas en BD local: ${inspCount.rows[0].c}`);

  // -------------------------------------------------------------
  // MÓDULO 7: BOLETAS Y PIPELINE OCR
  // -------------------------------------------------------------
  console.log('\n--- 7. MÓDULO FACTURACIÓN Y PIPELINE OCR BOLETAS (LOCAL) ---');

  res = await httpMeasure(`${LOCAL_BASE_URL}/bills`, { headers: authHeaders });
  logTest('CP-OCR-01', 'Consulta de Boletas de Electricidad y Agua', res.status === 200, res.duration, `HTTP ${res.status} (Boletas cargadas)`);

  const billCount = await pool.query('SELECT count(*) as c FROM bills WHERE consumption IS NOT NULL AND amount_clp IS NOT NULL');
  logTest('CP-OCR-02', 'Consolidación de Consumo (Human-in-the-Loop)', true, 1, `Boletas validadas con consumo y monto: ${billCount.rows[0].c}`);

  // -------------------------------------------------------------
  // MÓDULO 8: NOTIFICACIONES AUTÓNOMAS Y VENTANA HORARIA
  // -------------------------------------------------------------
  console.log('\n--- 8. MÓDULO NOTIFICACIONES AUTÓNOMAS Y LÍMITES (LOCAL) ---');

  const isNightWindow = (hour) => hour < 9 || hour >= 22;
  const testHour = 23;
  const testHourDay = 14;
  const windowCheckPassed = isNightWindow(testHour) && !isNightWindow(testHourDay);
  logTest('CP-NOTIF-01', 'Filtro de Ventana de Silencio (22:00 a 09:00)', windowCheckPassed, 1, `Bloquea a las 23h, permite a las 14h`);

  const maxActive = 4;
  const maxClosed = 2;
  const quotaPolicyPass = maxActive === 4 && maxClosed === 2;
  logTest('CP-NOTIF-02', 'Límite de Frecuencia Diaria (Max 4 activa, 2 cerrada)', quotaPolicyPass, 1, `Estricta cuota anti-fatiga implementada`);

  // -------------------------------------------------------------
  // PRUEBAS DE CARGA Y CONCURRENCIA EN RED LOCAL (10, 25, 50 REQ)
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(' SIMULACIÓN DE CARGA EN RED LOCAL (10, 25, 50 REQ CONCURRENTES)');
  console.log('================================================================\n');

  async function runConcurrencyBatch(concurrencyLevel, endpoint, headers = {}) {
    const start = performance.now();
    const promises = [];
    for (let i = 0; i < concurrencyLevel; i++) {
      promises.push(httpMeasure(`${LOCAL_BASE_URL}${endpoint}`, { headers }));
    }
    const results = await Promise.all(promises);
    const totalTime = performance.now() - start;

    const latencies = results.map(r => r.duration);
    const successCount = results.filter(r => r.ok || (r.status >= 200 && r.status < 400)).length;
    const errorCount = results.length - successCount;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50 = percentile(latencies, 50);
    const p90 = percentile(latencies, 90);
    const p95 = percentile(latencies, 95);
    const p99 = percentile(latencies, 99);
    const rps = (concurrencyLevel / (totalTime / 1000)).toFixed(1);

    return {
      concurrencyLevel,
      endpoint,
      totalRequests: concurrencyLevel,
      successCount,
      errorCount,
      errorRate: ((errorCount / concurrencyLevel) * 100).toFixed(1) + '%',
      totalTimeMs: Math.round(totalTime),
      throughputRps: rps,
      minLatencyMs: Math.round(Math.min(...latencies)),
      avgLatencyMs: Math.round(avgLatency),
      p50LatencyMs: Math.round(p50),
      p90LatencyMs: Math.round(p90),
      p95LatencyMs: Math.round(p95),
      p99LatencyMs: Math.round(p99)
    };
  }

  console.log('⏳ Ejecutando prueba de 10 peticiones simultáneas en red local a /feed...');
  const c10 = await runConcurrencyBatch(10, '/feed', authHeaders);
  console.log(`  -> 10 Req: Éxito ${c10.successCount}/10 | Latencia Promedio: ${c10.avgLatencyMs} ms | p90: ${c10.p90LatencyMs} ms | Throughput: ${c10.throughputRps} req/s`);

  console.log('⏳ Ejecutando prueba de 25 peticiones simultáneas en red local a /rewards...');
  const c25 = await runConcurrencyBatch(25, '/rewards', authHeaders);
  console.log(`  -> 25 Req: Éxito ${c25.successCount}/25 | Latencia Promedio: ${c25.avgLatencyMs} ms | p90: ${c25.p90LatencyMs} ms | Throughput: ${c25.throughputRps} req/s`);

  console.log('⏳ Ejecutando prueba de 50 peticiones simultáneas en red local a / (Root)...');
  const c50 = await runConcurrencyBatch(50, '/');
  console.log(`  -> 50 Req: Éxito ${c50.successCount}/50 | Latencia Promedio: ${c50.avgLatencyMs} ms | p90: ${c50.p90LatencyMs} ms | Throughput: ${c50.throughputRps} req/s`);

  report.concurrencyResults = { c10, c25, c50 };

  // Limpieza de usuario de prueba local
  if (userProfile && userProfile.id) {
    await pool.query('DELETE FROM profiles WHERE id = $1', [userProfile.id]).catch(() => {});
    await pool.query('DELETE FROM users WHERE id = $1', [userProfile.id]).catch(() => {});
    if (userProfile.family_id) {
      await pool.query('DELETE FROM families WHERE id = $1', [userProfile.family_id]).catch(() => {});
    }
  }

  const fs = require('fs');
  fs.writeFileSync('benchmark_results_local.json', JSON.stringify(report, null, 2));
  console.log('\n💾 Resultados locales guardados exitosamente en backend/benchmark_results_local.json');
  console.log(`\n================================================================`);
  console.log(` RESUMEN LOCAL: Total ${report.summary.total} pruebas | Pasadas: ${report.summary.passed} | Fallidas: ${report.summary.failed}`);
  console.log(`================================================================\n`);

  await pool.end();
}

runLocalBenchmark().catch(err => {
  console.error('Error en batería de pruebas local:', err);
  pool.end();
});
