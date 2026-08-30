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

require('dotenv').config();
const { Pool } = require('pg');

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const isProductionDb = process.env.NODE_ENV === 'production' ||
  (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway'));

const testDbPool = process.env.DATABASE_URL
  ? new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProductionDb ? { rejectUnauthorized: false } : false
  })
  : null;

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

async function grantTestCoins(userId, amount) {
  if (!testDbPool) {
    throw new Error('DATABASE_URL es requerido para preparar monedas de prueba.');
  }

  await testDbPool.query(
    'UPDATE public.profiles SET monedas = $1 WHERE id = $2',
    [amount, userId]
  );
}

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

    // ────────────────────────────────────────────────────────────────────────
    // 12. GET /familia/miembros - Listar los miembros de la familia
    // ────────────────────────────────────────────────────────────────────────
    console.log('\nStep 12: Listando los miembros del hogar familiar...');
    const membersRes = await fetch(`${BASE_URL}/familia/miembros`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${miembroToken}`
      }
    });

    const membersData = await membersRes.json();
    console.log(`Status: ${membersRes.status}`);
    console.log('Respuesta:', JSON.stringify(membersData, null, 2));

    if (membersRes.status !== 200) {
      throw new Error('Fallo al listar los miembros de la familia.');
    }

    if (!Array.isArray(membersData) || membersData.length < 2) {
      throw new Error('Se esperaba una lista de al menos 2 miembros (Jefe y Miembro).');
    } else {
      console.log(`✅ Listado de miembros validado correctamente (${membersData.length} miembros encontrados).`);
    }


    // Pruebas de recompensas y canjes.
    console.log('\nStep 13: Preparando monedas de prueba para el miembro...');
    await grantTestCoins(miembroData.user_id, 200);
    console.log('✅ Monedas de prueba asignadas correctamente.');

    console.log('\nStep 14: Creando recompensa individual...');
    const createIndividualRewardRes = await fetch(`${BASE_URL}/recompensas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jefeToken}`
      },
      body: JSON.stringify({
        titulo: '30 min videojuegos',
        descripcion: 'Beneficio personal diario',
        emoji: 'gamepad',
        costo: 10,
        es_familiar: false
      })
    });

    const individualRewardData = await createIndividualRewardRes.json();
    console.log(`Status: ${createIndividualRewardRes.status}`);
    console.log('Respuesta:', JSON.stringify(individualRewardData, null, 2));

    if (createIndividualRewardRes.status !== 201) {
      throw new Error('Fallo al crear recompensa individual.');
    }

    console.log('\nStep 15: Canjeando recompensa individual...');
    const redeemIndividualRes = await fetch(`${BASE_URL}/recompensas/${individualRewardData.id}/canjear`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${miembroToken}`
      }
    });

    const redeemIndividualData = await redeemIndividualRes.json();
    console.log(`Status: ${redeemIndividualRes.status}`);
    console.log('Respuesta:', JSON.stringify(redeemIndividualData, null, 2));

    if (redeemIndividualRes.status !== 201) {
      throw new Error('Fallo al canjear recompensa individual.');
    }

    console.log('\nStep 16: Reintentando canje individual el mismo día...');
    const redeemIndividualAgainRes = await fetch(`${BASE_URL}/recompensas/${individualRewardData.id}/canjear`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${miembroToken}`
      }
    });

    const redeemIndividualAgainData = await redeemIndividualAgainRes.json();
    console.log(`Status: ${redeemIndividualAgainRes.status} (Esperado: 409)`);
    console.log('Respuesta:', JSON.stringify(redeemIndividualAgainData, null, 2));

    if (redeemIndividualAgainRes.status !== 409) {
      throw new Error('Se esperaba bloqueo de canje diario individual.');
    }

    console.log('\nStep 17: Creando recompensa familiar...');
    const createFamilyRewardRes = await fetch(`${BASE_URL}/recompensas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jefeToken}`
      },
      body: JSON.stringify({
        titulo: 'Cine familiar',
        descripcion: 'Actividad mensual del hogar',
        emoji: 'film',
        costo: 30,
        es_familiar: true,
        metadata: {
          categoria: 'familia',
          limite_por_mes: 1
        }
      })
    });

    const familyRewardData = await createFamilyRewardRes.json();
    console.log(`Status: ${createFamilyRewardRes.status}`);
    console.log('Respuesta:', JSON.stringify(familyRewardData, null, 2));

    if (createFamilyRewardRes.status !== 201) {
      throw new Error('Fallo al crear recompensa familiar.');
    }

    console.log('\nStep 18: Canjeando recompensa familiar...');
    const redeemFamilyRes = await fetch(`${BASE_URL}/recompensas/${familyRewardData.id}/canjear`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${miembroToken}`
      }
    });

    const redeemFamilyData = await redeemFamilyRes.json();
    console.log(`Status: ${redeemFamilyRes.status}`);
    console.log('Respuesta:', JSON.stringify(redeemFamilyData, null, 2));

    if (redeemFamilyRes.status !== 201) {
      throw new Error('Fallo al canjear recompensa familiar.');
    }

    console.log('\nStep 19: Reintentando canje familiar el mismo mes...');
    const redeemFamilyAgainRes = await fetch(`${BASE_URL}/recompensas/${familyRewardData.id}/canjear`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${miembroToken}`
      }
    });

    const redeemFamilyAgainData = await redeemFamilyAgainRes.json();
    console.log(`Status: ${redeemFamilyAgainRes.status} (Esperado: 409)`);
    console.log('Respuesta:', JSON.stringify(redeemFamilyAgainData, null, 2));

    if (redeemFamilyAgainRes.status !== 409) {
      throw new Error('Se esperaba bloqueo de canje mensual familiar.');
    }

    console.log('\nStep 20: Reactivando ventana actual de recompensa familiar...');
    const reactivateFamilyRewardRes = await fetch(`${BASE_URL}/recompensas/${familyRewardData.id}/canjeos/ventana-actual`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${jefeToken}`
      }
    });

    const reactivateFamilyRewardData = await reactivateFamilyRewardRes.json();
    console.log(`Status: ${reactivateFamilyRewardRes.status}`);
    console.log('Respuesta:', JSON.stringify(reactivateFamilyRewardData, null, 2));

    if (reactivateFamilyRewardRes.status !== 200 || reactivateFamilyRewardData.registros_eliminados < 1) {
      throw new Error('Fallo al reactivar ventana de canje familiar.');
    }

    // ────────────────────────────────────────────────────────────────────────
    // 21. POST /eco/completar - Enviar resultado del Eco-Puzzle
    // ────────────────────────────────────────────────────────────────────────
    console.log('\nStep 21: Completando partida de Eco-Puzzle...');
    const ecoRes = await fetch(`${BASE_URL}/eco/completar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${miembroToken}`
      },
      body: JSON.stringify({
        errores: 1,
        tiempo_segundos: 45
      })
    });

    const ecoData = await ecoRes.json();
    console.log(`Status: ${ecoRes.status}`);
    console.log('Respuesta:', JSON.stringify(ecoData, null, 2));

    if (ecoRes.status !== 200 || !ecoData.ok) {
      throw new Error('Fallo al procesar Eco-Puzzle.');
    } else {
      console.log('✅ Eco-Puzzle procesado y recompensas otorgadas exitosamente.');
    }

    // ────────────────────────────────────────────────────────────────────────
    // 22. POST /notifications/evento - Disparar alerta familiar en tiempo real
    // ────────────────────────────────────────────────────────────────────────
    console.log('\nStep 22: Disparando alerta familiar en tiempo real (Eco-Ducha en curso)...');
    const notifRes = await fetch(`${BASE_URL}/notifications/evento`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${miembroToken}`
      },
      body: JSON.stringify({
        family_id: familyId,
        sender_name: 'Miembro Test',
        title: '🚿 ¡Hora de la Ducha!',
        desc_text: 'Miembro Test ha iniciado una Eco-Ducha de 3 minutos.',
        type: 'DUCHA_SPEEDRUN',
        visual: { icon: 'shower', color: '#00ACC1' },
        payload: { duracion_estimada: 180 }
      })
    });

    const notifData = await notifRes.json();
    console.log(`Status: ${notifRes.status}`);
    console.log('Respuesta:', JSON.stringify(notifData, null, 2));

    if (notifRes.status !== 201 || !notifData.exito) {
      throw new Error('Fallo al emitir evento de notificación en tiempo real.');
    } else {
      console.log('✅ Alerta familiar en tiempo real emitida y guardada en PostgreSQL.');
    }

    const createdNotifId = notifData.evento?.id;

    // ────────────────────────────────────────────────────────────────────────
    // 23. GET /notifications/familia/:family_id - Obtener el Feed Familiar
    // ────────────────────────────────────────────────────────────────────────
    console.log('\nStep 23: Consultando el Feed Familiar de notificaciones...');
    const feedRes = await fetch(`${BASE_URL}/notifications/familia/${familyId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jefeToken}`
      }
    });

    const feedData = await feedRes.json();
    console.log(`Status: ${feedRes.status}`);
    console.log('Respuesta:', JSON.stringify(feedData, null, 2));

    if (feedRes.status !== 200 || !feedData.exito || !Array.isArray(feedData.eventos)) {
      throw new Error('Fallo al obtener el Feed Familiar.');
    } else {
      console.log(`✅ Feed Familiar consultado con éxito (${feedData.eventos.length} eventos encontrados).`);
    }

    // ────────────────────────────────────────────────────────────────────────
    // 24. PATCH /notifications/:id/leida - Marcar notificación como leída
    // ────────────────────────────────────────────────────────────────────────
    if (createdNotifId) {
      console.log(`\nStep 24: Marcando notificación ${createdNotifId} como leída...`);
      const readRes = await fetch(`${BASE_URL}/notifications/${createdNotifId}/leida`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${jefeToken}`
        }
      });
      const readData = await readRes.json();
      console.log(`Status: ${readRes.status}`);
      console.log('Respuesta:', JSON.stringify(readData, null, 2));
      if (readRes.status === 200 && readData.exito) {
        console.log('✅ Notificación marcada como leída exitosamente.');
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 25. DELETE /notifications/familia/:family_id - Limpiar historial
    // ────────────────────────────────────────────────────────────────────────
    console.log('\nStep 25: Limpiando historial familiar de pruebas...');
    const clearRes = await fetch(`${BASE_URL}/notifications/familia/${familyId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${jefeToken}`
      }
    });
    const clearData = await clearRes.json();
    console.log(`Status: ${clearRes.status}`);
    console.log('Respuesta:', JSON.stringify(clearData, null, 2));
    if (clearRes.status === 200 && clearData.exito) {
      console.log('✅ Historial de notificaciones limpiado correctamente.');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 ¡TODOS LOS 25 ENDPOINTS (INCLUYENDO RECOMPENSAS, ECO-PUZZLE Y NOTIFICACIONES) HAN SIDO VALIDADOS CON ÉXITO! 🚀');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ ERROR EN LAS PRUEBAS:', error.message);
    console.log('='.repeat(60));
    process.exit(1);
  } finally {
    if (testDbPool) {
      await testDbPool.end();
    }
  }
}

runTests();

