import { pool } from '../src/config/db';
import { FeedService } from '../src/services/FeedService';

async function verify() {
  console.log('--- 🧪 INICIANDO VERIFICACIÓN DE VISIBILIDAD CRUZADA DEL FEED ---');

  // 1. Buscar una familia con más de un miembro
  const famQuery = `
    SELECT p.family_id, f.nombre as familia_nombre, COUNT(*) as total_miembros
    FROM public.profiles p
    JOIN public.families f ON p.family_id = f.id
    GROUP BY p.family_id, f.nombre
    HAVING COUNT(*) >= 1
    ORDER BY total_miembros DESC
    LIMIT 1;
  `;
  const famRes = await pool.query(famQuery);

  if (famRes.rows.length === 0) {
    console.log('No se encontraron familias en la base de datos.');
    await pool.end();
    return;
  }

  const family = famRes.rows[0];
  console.log(`🏠 Familia evaluada: "${family.familia_nombre}" (ID: ${family.family_id})`);
  console.log(`👨‍👩‍👦 Total miembros en esta familia: ${family.total_miembros}`);

  // 2. Obtener los miembros de esa familia
  const membersRes = await pool.query(
    `SELECT id, nombre, email FROM public.profiles WHERE family_id = $1 ORDER BY created_at ASC LIMIT 5;`,
    [family.family_id]
  );
  console.log('👥 Miembros registrados:');
  membersRes.rows.forEach((m, idx) => {
    console.log(`   ${idx + 1}. ${m.nombre} (${m.email}) - ID: ${m.id}`);
  });

  // 3. Consultar el Feed general de la familia
  const feed = await FeedService.obtenerFeedFamiliar(family.family_id, 10);
  console.log(`\n📋 Actividades encontradas en el Feed Familiar: ${feed.length}`);

  if (feed.length === 0) {
    console.log('⚠️ No hay actividades registradas en esta familia aún.');
  } else {
    // Autores únicos en las publicaciones
    const autoresUnicos = [...new Set(feed.map(f => f.nombre))];
    console.log(`✨ Autores que tienen publicaciones en este muro:`, autoresUnicos);

    console.log('\n🔍 Detalle de las 5 actividades más recientes en el muro:');
    feed.slice(0, 5).forEach((item, index) => {
      console.log(`   ${index + 1}. [${item.tipo}] Realizado por: "${item.nombre}"`);
      console.log(`      Mensaje: "${item.mensaje}"`);
      console.log(`      Fecha: ${item.fecha}`);
      console.log(`      Recompensas: ${item.recompensas.xp} XP / ${item.recompensas.monedas} monedas`);
      console.log(`      Avatar: ${JSON.stringify(item.avatar)}`);
      console.log(`      Reacciones: ${item.total_reacciones} (Desglose: ${JSON.stringify(item.reacciones_conteo)})`);
    });

    // 4. Prueba de interacción entre integrantes
    if (membersRes.rows.length >= 2) {
      const miembroA = membersRes.rows[0];
      const miembroB = membersRes.rows[1];
      const primeraActividad = feed[0];

      console.log(`\n💬 Prueba de interacción cruzada:`);
      console.log(`   - Actividad elegida: "${primeraActividad.mensaje}" (realizada por ${primeraActividad.nombre})`);
      console.log(`   - ${miembroB.nombre} va a reaccionar con "🔥" a la actividad de ${primeraActividad.nombre}...`);

      const reactRes = await FeedService.reaccionar(primeraActividad.id, family.family_id, miembroB.id, 'fuego');
      console.log(`   ✅ Respuesta de reacción:`, reactRes);

      // Ver cómo ve el feed el miembro B (debe ver mi_reaccion = 'fuego')
      const feedVistaB = await FeedService.obtenerFeedFamiliar(family.family_id, 5, undefined, miembroB.id);
      const actVistaB = feedVistaB.find(a => a.id === primeraActividad.id);
      console.log(`   👀 Vista de ${miembroB.nombre} sobre la actividad:`);
      console.log(`      - Total reacciones: ${actVistaB?.total_reacciones}`);
      console.log(`      - mi_reaccion: "${actVistaB?.mi_reaccion}" (marcado como activo en su app)`);

      // Ver cómo ve el feed el miembro A (debe ver la reacción de B pero mi_reaccion = null)
      const feedVistaA = await FeedService.obtenerFeedFamiliar(family.family_id, 5, undefined, miembroA.id);
      const actVistaA = feedVistaA.find(a => a.id === primeraActividad.id);
      console.log(`   👀 Vista de ${miembroA.nombre} sobre la misma actividad:`);
      console.log(`      - Total reacciones: ${actVistaA?.total_reacciones}`);
      console.log(`      - mi_reaccion: "${actVistaA?.mi_reaccion}" (no ha reaccionado él)`);
      console.log(`      - Detalle reacción visible: Realizada por "${actVistaA?.reacciones[0]?.usuario_nombre}"`);

      // Limpiar la reacción de prueba (toggle off)
      await FeedService.reaccionar(primeraActividad.id, family.family_id, miembroB.id, 'fuego');
      console.log(`   🧹 Reacción de prueba retirada (toggle off ejecutado exitosamente).`);
    }
  }

  await pool.end();
  console.log('\n--- ✅ VERIFICACIÓN FINALIZADA CON ÉXITO ---');
}

verify().catch(e => {
  console.error('Error durante la verificación:', e);
  process.exit(1);
});
