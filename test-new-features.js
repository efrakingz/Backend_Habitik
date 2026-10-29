const express = require('express');
const http = require('http');
require('dotenv').config();

const app = require('./dist/app').default;
const server = http.createServer(app);

server.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`🚀 Servidor de pruebas iniciado en ${baseUrl}`);

  try {
    const randomStr = Math.random().toString(36).substring(2, 8);
    const emailJefe = `test_jefe_${randomStr}@test.com`;
    const emailMiembro = `test_miembro_${randomStr}@test.com`;

    // 1. Registro Jefe
    console.log('\n--- 1. Registro de Jefe ---');
    const rRegJefe = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailJefe,
        password: 'password123',
        nombre: 'Jefe Test',
        nombreFamilia: 'Familia Solar'
      })
    });
    const dataRegJefe = await rRegJefe.json();
    console.log('Reg Jefe status:', rRegJefe.status, 'user_id:', dataRegJefe.user_id);
    if (rRegJefe.status !== 201) throw new Error('Fallo al registrar jefe');

    // 2. Onboarding Jefe (Infraestructura)
    console.log('\n--- 2. Onboarding Jefe (Infraestructura) ---');
    const rObJefe = await fetch(`${baseUrl}/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dataRegJefe.token_jwt}` },
      body: JSON.stringify({
        personasCount: 4,
        habitacionesCount: 3,
        tipoCalefaccion: 'electrica',
        electrodomesticos: ['lavadora', 'secadora']
      })
    });
    const dataObJefe = await rObJefe.json();
    console.log('Onboarding Jefe status:', rObJefe.status, 'Gasto estimado:', dataObJefe.mapa_gasto_estimado?.gasto_total_estimado);
    if (rObJefe.status !== 200) throw new Error('Fallo onboarding jefe');

    // 3. Generar Token Invitación
    console.log('\n--- 3. Generar Token Invitación QR ---');
    const rInv = await fetch(`${baseUrl}/familia/invite`, {
      headers: { 'Authorization': `Bearer ${dataRegJefe.token_jwt}` }
    });
    const dataInv = await rInv.json();
    console.log('Invite token status:', rInv.status, 'token:', dataInv.invite_token);
    if (rInv.status !== 201) throw new Error('Fallo generar invitacion');

    // 4. Registro de Miembro
    console.log('\n--- 4. Registro de Miembro ---');
    const rRegM = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailMiembro,
        password: 'password123',
        nombre: 'Miembro Test',
        nombreFamilia: 'Hogar Temporal'
      })
    });
    const dataRegM = await rRegM.json();
    console.log('Reg Miembro status:', rRegM.status, 'user_id:', dataRegM.user_id);
    if (rRegM.status !== 201) throw new Error('Fallo registrar miembro');

    // 5. Miembro se une a la Familia (Debe retornar nuevo token_jwt con rol miembro)
    console.log('\n--- 5. Miembro Join con QR ---');
    const rJoin = await fetch(`${baseUrl}/familia/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dataRegM.token_jwt}` },
      body: JSON.stringify({
        invite_token: dataInv.invite_token,
        user_id: dataRegM.user_id
      })
    });
    const dataJoin = await rJoin.json();
    console.log('Join status:', rJoin.status, 'message:', dataJoin.message);
    console.log('¿Retorna nuevo token_jwt?:', !!dataJoin.token_jwt);
    if (rJoin.status !== 200 || !dataJoin.token_jwt) throw new Error('Fallo al unirse o falta nuevo token');

    // 6. Onboarding de Miembro (Hábitos) usando el nuevo token
    console.log('\n--- 6. Onboarding de Miembro (Hábitos) ---');
    const rObM = await fetch(`${baseUrl}/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dataJoin.token_jwt}` },
      body: JSON.stringify({
        tiempoDuchaPromedio: 7,
        horasPantallaDiarias: 3,
        frecuenciaReciclaje: 'siempre'
      })
    });
    const dataObM = await rObM.json();
    console.log('Onboarding Miembro status:', rObM.status, 'Mensaje:', dataObM.message);
    console.log('Gasto individual estimado:', dataObM.mapa_gasto_estimado?.gasto_total_estimado);
    if (rObM.status !== 200) throw new Error('Fallo onboarding miembro con nuevo token');

    // 7. Onboarding de Miembro de forma defensiva INCLUSO con el token viejo de admin
    console.log('\n--- 7. Test de Resiliencia: Onboarding Miembro con token antiguo ---');
    const rObMOld = await fetch(`${baseUrl}/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dataRegM.token_jwt}` },
      body: JSON.stringify({
        tiempoDuchaPromedio: 9,
        horasPantallaDiarias: 5,
        frecuenciaReciclaje: 'ocasional'
      })
    });
    const dataObMOld = await rObMOld.json();
    console.log('Onboarding con token desactualizado status:', rObMOld.status, '(Esperado: 200)');
    if (rObMOld.status !== 200) throw new Error('Fallo resiliencia onboarding');

    // 8. Recuperación de Contraseña: Paso 1 - Solicitar código
    console.log('\n--- 8. Recuperación de Contraseña: Solicitar Código ---');
    const rForgot = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailMiembro })
    });
    const dataForgot = await rForgot.json();
    console.log('Forgot Password status:', rForgot.status, 'message:', dataForgot.message);
    if (rForgot.status !== 200) throw new Error('Fallo al solicitar código');

    // Obtener el código guardado en la BD
    const { pool } = require('./dist/config/db');
    const dbCodeRes = await pool.query(
      'SELECT code FROM public.password_reset_codes WHERE email = $1 AND used = FALSE ORDER BY created_at DESC LIMIT 1',
      [emailMiembro]
    );
    const code = dbCodeRes.rows[0]?.code;
    console.log('Código recuperado de la BD:', code);
    if (!code) throw new Error('No se guardó el código en la base de datos');

    // 9. Recuperación de Contraseña: Paso 2 - Verificar código inválido y válido
    console.log('\n--- 9. Recuperación de Contraseña: Verificar Código ---');
    const rVerifyBad = await fetch(`${baseUrl}/auth/verify-reset-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailMiembro, code: '000000' })
    });
    console.log('Código inválido status:', rVerifyBad.status, '(Esperado: 400)');
    if (rVerifyBad.status !== 400) throw new Error('Debió fallar con código inválido');

    const rVerifyOk = await fetch(`${baseUrl}/auth/verify-reset-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailMiembro, code })
    });
    console.log('Código válido status:', rVerifyOk.status, '(Esperado: 200)');
    if (rVerifyOk.status !== 200) throw new Error('Fallo al verificar código válido');

    // 10. Recuperación de Contraseña: Paso 3 - Restablecer Contraseña
    console.log('\n--- 10. Recuperación de Contraseña: Cambiar Contraseña ---');
    const nuevaClave = 'nuevaClaveSegura2026';
    const rReset = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailMiembro, code, newPassword: nuevaClave })
    });
    const dataReset = await rReset.json();
    console.log('Reset Password status:', rReset.status, 'Mensaje:', dataReset.message);
    if (rReset.status !== 200) throw new Error('Fallo al cambiar contraseña');

    // 11. Intentar login con la clave anterior (debe fallar 401)
    console.log('\n--- 11. Login con Contraseña Antigua (debe fallar) ---');
    const rOldLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailMiembro, password: 'password123' })
    });
    console.log('Login antiguo status:', rOldLogin.status, '(Esperado: 401)');
    if (rOldLogin.status !== 401) throw new Error('El login antiguo no debió permitirse');

    // 12. Login con la nueva contraseña (debe ser 200 OK)
    console.log('\n--- 12. Login con Nueva Contraseña (debe ser exitoso) ---');
    const rNewLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailMiembro, password: nuevaClave })
    });
    const dataNewLogin = await rNewLogin.json();
    console.log('Login nuevo status:', rNewLogin.status, 'Usuario:', dataNewLogin.profile?.nombre, 'Rol:', dataNewLogin.profile?.rol);
    if (rNewLogin.status !== 200 || !dataNewLogin.token_jwt) throw new Error('Fallo al iniciar sesión con nueva contraseña');

    console.log('\n======================================================');
    console.log('🎉 ¡TODAS LAS PRUEBAS DE BACKEND PASARON CON ÉXITO (100%)!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ ERROR EN PRUEBAS:', err.message);
    process.exit(1);
  } finally {
    server.close();
    process.exit(0);
  }
});
