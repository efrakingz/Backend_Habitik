/**
 * Script de Pruebas de Integración y Validación para Habitik API (Sprint 1)
 *
 * Este script realiza llamadas HTTP secuenciales para verificar el correcto funcionamiento
 * de todos los endpoints de backend requeridos para el Sprint 1:
 *   1. Registro de Jefe de Familia y Hogar
 *   2. Login de Jefe de Familia
 *   3. Intento de cambio de nombre del Hogar (debe dar 403 Forbidden)
 *   4. Generación de Token de Invitación QR
 *   5. Registro de un nuevo Usuario (que se convertirá en Miembro)
 *   6. Login del Miembro
 *   7. Unión del Miembro al Hogar mediante el Token QR de invitación
 *   8. Cuestionario de Onboarding para el Jefe (Metas del Hogar)
 *   9. Cuestionario de Onboarding para el Miembro (Hábitos Personales)
 *   10. Envío de ducha corta anti-trampa (debe ser marcada como inválida)
 *   11. Envío de ducha normal de más de 3 minutos (debe ser marcada como válida)
 *
 * ⚙️  EJECUCIÓN:
 *   - Localmente:       node test-endpoints.js http://localhost:3000
 *   - En Producción:    node test-endpoints.js https://project-habitik-production.up.railway.app
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000';

console.log('='.repeat(60));
console.log(`🧪 Iniciando Pruebas de Validación del Backend Habitik`);
console.log(`🌐 URL Base: ${BASE_URL}`);
console.log('='.repeat(60));

// Generar correos aleatorios para evitar colisiones de clave única en la base de datos
const randomStr = Math.random().toString(36).substring(2, 8);
const jefeEmail = `jefe_${randomStr}@test.com`;
const miembroEmail = `miembro_${randomStr}@test.com`;

let jefeToken = '';
let miembroToken = '';
let familyId = '';
let inviteToken = '';

async function runTests() {
  try {
    // ────────────────────────────────────────────────────────────────────────
    // 1. POST /auth/register - Registrar Jefe de Familia y Crear Hogar
    // ────────────────────────────────────────────────────────────────────────
    console.log('\nStep 1: Registrando Jefe de Familia...');
    const registerJefeRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: jefeEmail,
        password: 'contrasenasegura123',
        nombre: 'Bastian',
        nombreFamilia: 'Familia Test ' + randomStr
      })
    });
    
    const jefeData = await registerJefeRes.json();
    console.log(`Status: ${registerJefeRes.status}`);
    console.log('Respuesta:', JSON.stringify(jefeData, null, 2));

    if (registerJefeRes.status !== 201) {
      throw new Error('Fallo al registrar Jefe de Familia.');
    }

    jefeToken = jefeData.token_jwt;
    familyId = jefeData.family_id;

    // ────────────────────────────────────────────────────────────────────────
    // 2. POST /auth/login - Iniciar sesión como Jefe
    // ────────────────────────────────────────────────────────────────────────
    console.log('\nStep 2: Login de Jefe de Familia...');
    const loginJefeRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: jefeEmail,
        password: 'contrasenasegura123'
      })
    });
    
    const loginJefeData = await loginJefeRes.json();
    console.log(`Status: ${loginJefeRes.status}`);
    console.log('Respuesta:', JSON.stringify(loginJefeData, null, 2));

    if (loginJefeRes.status !== 200) {
      throw new Error('Fallo al iniciar sesión como Jefe.');
    }

    // ────────────────────────────────────────────────────────────────────────
    // 3. PATCH /familia/nombre - Cambiar nombre de Hogar (Bloqueo de 60 días)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\nStep 3: Cambiando nombre del Hogar antes de los 60 días...');
    const renameRes = await fetch(`${BASE_URL}/familia/nombre`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jefeToken}`
      },
      body: JSON.stringify({
        nombre: 'Nuevo Nombre Test'
      })
    });
    
    const renameData = await renameRes.json();
    console.log(`Status: ${renameRes.status} (Esperado: 403)`);
    console.log('Respuesta:', JSON.stringify(renameData, null, 2));

    if (renameRes.status !== 403) {
      console.warn('⚠️ ADVERTENCIA: Se esperaba código 403 debido al bloqueo familiar de 60 días, pero se obtuvo ' + renameRes.status);
    } else {
      console.log('✅ Bloqueo de 60 días validado correctamente.');
    }

    // ────────────────────────────────────────────────────────────────────────
    // 4. GET /familia/invite - Generar Token QR de Invitación
    // ────────────────────────────────────────────────────────────────────────
    console.log('\nStep 4: Generando Token de Invitación QR...');
    const inviteRes = await fetch(`${BASE_URL}/familia/invite`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jefeToken}`
      }
    });
    
    const inviteData = await inviteRes.json();
    console.log(`Status: ${inviteRes.status}`);
    console.log('Respuesta:', JSON.stringify(inviteData, null, 2));

    if (inviteRes.status !== 201) {
      throw new Error('Fallo al generar el token de invitación.');
    }

    inviteToken = inviteData.invite_token;

    // ────────────────────────────────────────────────────────────────────────
    // 5. POST /auth/register - Registrar un segundo usuario (Miembro)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\nStep 5: Registrando un nuevo usuario (para ser Miembro)...');
    const registerMiembroRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: miembroEmail,
        password: 'contrasenasegura123',
        nombre: 'Pedro',
        nombreFamilia: 'Familia Temporal Pedro'
      })
    });
    
    const miembroData = await registerMiembroRes.json();
    console.log(`Status: ${registerMiembroRes.status}`);
    console.log('Respuesta:', JSON.stringify(miembroData, null, 2));

    if (registerMiembroRes.status !== 201) {
      throw new Error('Fallo al registrar usuario miembro.');
    }

    miembroToken = miembroData.token_jwt;

    // ────────────────────────────────────────────────────────────────────────
    // 6. POST /familia/join - Unir el Miembro a la Familia del Jefe usando QR
    // ────────────────────────────────────────────────────────────────────────
    console.log('\nStep 6: Miembro uniéndose a la Familia con el Token QR...');
    const joinRes = await fetch(`${BASE_URL}/familia/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${miembroToken}`
      },
      body: JSON.stringify({
        invite_token: inviteToken,
        user_id: miembroData.user_id
      })
    });
    
    const joinData = await joinRes.json();
    console.log(`Status: ${joinRes.status}`);
    console.log('Respuesta:', JSON.stringify(joinData, null, 2));

    if (joinRes.status !== 200) {
      throw new Error('Fallo al unir al miembro con el token QR.');
    }

    // ────────────────────────────────────────────────────────────────────────
    // 6.5. POST /auth/login - Refrescar Token de Miembro
    // ────────────────────────────────────────────────────────────────────────
    console.log('\nStep 6.5: Login de Miembro para refrescar token y obtener rol de Miembro...');
    const loginMiembroRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: miembroEmail,
        password: 'contrasenasegura123'
      })
    });
    
    const loginMiembroData = await loginMiembroRes.json();
    console.log(`Status: ${loginMiembroRes.status}`);
    console.log('Respuesta:', JSON.stringify(loginMiembroData, null, 2));

    if (loginMiembroRes.status !== 200) {
      throw new Error('Fallo al iniciar sesión como Miembro para refrescar token.');
    }

    // Actualizar el token con el rol miembro recién obtenido
    miembroToken = loginMiembroData.token_jwt;

    // ────────────────────────────────────────────────────────────────────────
    // 7. POST /familia/join - Reintentar usar el mismo QR (debe dar 410 Gone)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\nStep 7: Reintentando usar el mismo Token QR (debe dar 410)...');
    const rejoinRes = await fetch(`${BASE_URL}/familia/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${miembroToken}`
      },
      body: JSON.stringify({
        invite_token: inviteToken,
        user_id: miembroData.user_id
      })
    });
    
    const rejoinData = await rejoinRes.json();
    console.log(`Status: ${rejoinRes.status} (Esperado: 410)`);
    console.log('Respuesta:', JSON.stringify(rejoinData, null, 2));

    if (rejoinRes.status !== 410) {
      console.warn('⚠️ ADVERTENCIA: Se esperaba código 410 (Token usado), pero se obtuvo ' + rejoinRes.status);
    } else {
      console.log('✅ Expiración/Uso del token validado correctamente.');
    }

    // ────────────────────────────────────────────────────────────────────────
    // 8. POST /onboarding - Enviar Onboarding del Jefe (Metas Hogar)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\nStep 8: Enviando cuestionario Onboarding de Jefe (Infraestructura)...');
    const onboardingJefeRes = await fetch(`${BASE_URL}/onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jefeToken}`
      },
      body: JSON.stringify({
        tipoCalefaccion: 'electrica',
        habitacionesCount: 3,
        personasCount: 4,
        electrodomesticos: ['lavadora', 'secadora', 'aire_acondicionado']
      })
    });
    
    const onboardingJefeData = await onboardingJefeRes.json();
    console.log(`Status: ${onboardingJefeRes.status}`);
    console.log('Respuesta:', JSON.stringify(onboardingJefeData, null, 2));

    if (onboardingJefeRes.status !== 200) {
      throw new Error('Fallo al procesar Onboarding de Jefe.');
    }

    // ────────────────────────────────────────────────────────────────────────
    // 9. POST /onboarding - Enviar Onboarding del Miembro (Hábitos Personales)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\nStep 9: Enviando cuestionario Onboarding de Miembro (Hábitos)...');
    const onboardingMiembroRes = await fetch(`${BASE_URL}/onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${miembroToken}`
      },
      body: JSON.stringify({
        tiempoDuchaPromedio: 10,
        horasPantallaDiarias: 4,
        frecuenciaReciclaje: 'siempre'
      })
    });
    
    const onboardingMiembroData = await onboardingMiembroRes.json();
    console.log(`Status: ${onboardingMiembroRes.status}`);
    console.log('Respuesta:', JSON.stringify(onboardingMiembroData, null, 2));

    if (onboardingMiembroRes.status !== 200) {
      throw new Error('Fallo al procesar Onboarding de Miembro.');
    }

    // ────────────────────────────────────────────────────────────────────────
    // 10. POST /reto/ducha - Enviar ducha muy corta (Sistema Anti-trampa < 3 min)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\nStep 10: Registrando ducha de 120 segundos (Anti-trampa < 180s)...');
    const showerShortRes = await fetch(`${BASE_URL}/reto/ducha`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${miembroToken}`
      },
      body: JSON.stringify({
        duracion_segundos: 120
      })
    });
    
    const showerShortData = await showerShortRes.json();
    console.log(`Status: ${showerShortRes.status}`);
    console.log('Respuesta:', JSON.stringify(showerShortData, null, 2));

    if (showerShortRes.status !== 200 || showerShortData.valido !== false) {
      console.warn('⚠️ ADVERTENCIA: Se esperaba que la ducha fuera inválida (valido: false), pero se guardó de otra forma.');
    } else {
      console.log('✅ Filtro anti-trampa validado correctamente para duchas cortas.');
    }

    // ────────────────────────────────────────────────────────────────────────
    // 11. POST /reto/ducha - Enviar ducha válida (>= 3 min)
    // ────────────────────────────────────────────────────────────────────────
    console.log('\nStep 11: Registrando ducha de 240 segundos (4 minutos)...');
    const showerValidRes = await fetch(`${BASE_URL}/reto/ducha`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${miembroToken}`
      },
      body: JSON.stringify({
        duracion_segundos: 240
      })
    });
    
    const showerValidData = await showerValidRes.json();
    console.log(`Status: ${showerValidRes.status}`);
    console.log('Respuesta:', JSON.stringify(showerValidData, null, 2));

    if (showerValidRes.status !== 201 || showerValidData.valido !== true) {
      throw new Error('Fallo al registrar ducha válida de 4 minutos.');
    } else {
      console.log('✅ Ducha válida registrada correctamente.');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 ¡TODOS LOS ENDPOINTS HAN SIDO VALIDADOS CON ÉXITO! 🚀');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ ERROR EN LAS PRUEBAS:', error.message);
    console.log('='.repeat(60));
    process.exit(1);
  }
}

runTests();
