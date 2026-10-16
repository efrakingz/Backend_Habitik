const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Mapa de id -> dato_curioso personalizado y verificado (<= 180 caracteres)
const datosCuriososMap = {
  // [1] Eficiencia clase A
  '0850d7df-08be-42a1-bfbc-2785849c7cc6': '💡 ¿Sabías que? Un refrigerador clase A consume hasta un 60% menos electricidad que uno convencional.',
  
  // [2] Vidrio y cerámica
  '0e637a7b-f7f4-4e7d-b0b4-4bd813bf3e5b': '🌱 Eco-Tip: La cerámica se funde a mayor temperatura que el vidrio y arruina lotes de reciclaje completos.',
  
  // [3] Lavar ropa carga completa
  '0f691a17-009b-4d30-ab4e-bd84d49d7145': '💡 ¿Sabías que? Usar la lavadora con carga completa ahorra más de 3.000 litros de agua limpia al año.',
  
  // [4] Comprar productos locales
  '19527ec9-1e24-4f59-b112-0385ce52285c': '🌱 Eco-Tip: Los alimentos locales reducen la huella de carbono de transporte hasta en un 80%.',
  
  // [5] Consumo fantasma / standby
  '1d0fe7a9-7157-41a0-b950-843dbe9819df': '💡 ¿Sabías que? El consumo fantasma de aparatos en espera representa hasta el 10% de tu boleta de luz.',
  
  // [6] Botella reutilizable
  '1e5da6e8-c7c1-4946-a9a7-2fa02a68dd51': '🌱 Eco-Tip: Una botella reutilizable evita que más de 160 botellas plásticas terminen en vertederos al año.',
  
  // [7] Orden de manejo de residuos
  '1f8e42dc-7a15-46be-a2b3-197c50629f0b': '💡 ¿Sabías que? El mejor residuo es el que no se genera: reducir siempre es más eficaz que reciclar.',
  
  // [8] Reutilizar objetos
  '23f54a63-9c12-4609-9d12-63b826919a02': '🌱 Eco-Tip: Reutilizar frascos de vidrio para guardar alimentos ahorra dinero y evita plásticos en casa.',
  
  // [9] Reparar prendas
  '259aed0d-16bb-4053-9a88-0f270a08d807': '💡 ¿Sabías que? Extender la vida de tu ropa solo 9 meses reduce su huella hídrica y de carbono en un 30%.',
  
  // [10] Consumir antes de vencer
  '2cf08b56-1142-4fd3-9a7d-e5074bab835a': '🌱 Eco-Tip: Dejar adelante lo que vence primero en el refrigerador evita botar comida en buen estado.',
  
  // [11] Mascotas exóticas
  '33a8c132-76be-4ba4-bb61-eecbc44adcef': '💡 ¿Sabías que? Especies invasoras como el visón o el castor causan graves daños a la fauna nativa del sur.',
  
  // [12] Flores para polinizadores
  '35cfb3f4-f3ad-43d0-8dfd-c32305d263c2': '🌱 Eco-Tip: Plantar lavanda o romero en maceteros crea refugios vitales para abejas nativas en la ciudad.',
  
  // [13] Aislar puertas y ventanas
  '3b07f061-7920-43c2-a2e7-7cd5cccd79ec': '💡 ¿Sabías que? Sellar rendijas en puertas y ventanas evita hasta un 25% de pérdida de calor en invierno.',
  
  // [14] Residuos electrónicos RAEE
  '3e503f56-efaa-46f1-885e-f6bf84009ba6': '🌱 Eco-Tip: Los celulares viejos contienen oro y cobre reciclables; llévalos siempre a un punto limpio.',
  
  // [15] Eficiencia del refrigerador
  '49a80e73-7fbd-4b3a-b8bd-40b2657dc535': '💡 ¿Sabías que? Una goma rota en la puerta del refrigerador duplica su consumo eléctrico de inmediato.',
  
  // [16] Productos durables
  '4a7e10d1-a2f1-46d2-9e7d-b60a9ccdb32a': '🌱 Eco-Tip: Elegir productos durables y reparables combate la obsolescencia y cuida el presupuesto familiar.',
  
  // [17] Cocinar con olla tapada
  '50f7c672-2778-4e0c-8015-8cfff6a46879': '💡 ¿Sabías que? Cocinar con la olla tapada reduce el consumo de gas o electricidad hasta en un 25%.',
  
  // [18] Especies invasoras
  '594d9f65-d770-4c0d-be4c-8faf91619076': '🌱 Eco-Tip: La avispa chaqueta amarilla compite agresivamente con los polinizadores nativos chilenos.',
  
  // [19] Desierto de Atacama
  '665219e2-7444-4948-b706-3ef1f2d41fe3': '💡 ¿Sabías que? En Atacama existen plantas que viven absorbiendo agua únicamente de la camanchaca marina.',
  
  // [20] Envases reciclables limpios
  '69676b8f-d44a-4d31-916b-c4a3c4bf3282': '🌱 Eco-Tip: Enjuagar envases con agua de enjuague evita malos olores y que se rechace un lote de reciclaje.',
  
  // [21] Regar al atardecer o temprano
  '6a6b63ad-d932-4416-9148-e4ce21d27b92': '💡 ¿Sabías que? Regar al atardecer ahorra hasta un 30% de agua al evitar la evaporación por el sol.',
  
  // [22] Ampolletas LED
  '6db6cd0a-294d-4955-b012-ce44a98a9f25': '🌱 Eco-Tip: Las ampolletas LED gastan hasta un 85% menos energía y duran 15 veces más que las comunes.',
  
  // [23] Lavar auto con balde
  '706b3ce0-1536-4564-a0ee-2befad485461': '💡 ¿Sabías que? Lavar el auto con manguera gasta 500 litros de agua; usando un balde gastas menos de 50.',
  
  // [24] Compostaje orgánico
  '74521154-5e76-42a5-b6d9-5e7ed11b4775': '🌱 Eco-Tip: El 50% de la basura familiar son restos orgánicos que pueden convertirse en abono nutritivo.',
  
  // [25] Humedales urbanos
  '84ca73b4-f398-4646-a0f8-556253dcbb9e': '💡 ¿Sabías que? Los humedales urbanos filtran contaminantes del agua y previenen inundaciones en ciudades.',
  
  // [26] Fugas ocultas
  '8d0a7f50-40d9-4fcc-ae9c-618dbd9d17e0': '🌱 Eco-Tip: Una fuga de inodoro que corre sin parar puede desperdiciar más de 200.000 litros al año.',
  
  // [27] Ducha corta
  'a4fc7df4-4b96-4910-99ee-472948a6b873': '💡 ¿Sabías que? Bajar la ducha a 5 minutos ahorra más de 60 litros de agua y 40% de gas en cada baño.',
  
  // [28] Energía solar en Chile
  'a5d13914-f0b3-4be1-8583-19cb10822637': '🌱 Eco-Tip: El norte de Chile tiene la radiación solar más alta del planeta, impulsando la energía limpia.',
  
  // [29] Pilas usadas
  'b35fc50b-eb86-4b11-9547-31bf80a83e3f': '💡 ¿Sabías que? Una sola pila de botón arrojada al suelo puede llegar a contaminar 600.000 litros de agua.',
  
  // [30] Calefacción al ventilar
  'b464be63-f863-4b77-b9ab-1d42342869ed': '🌱 Eco-Tip: Basta abrir ventanas 10 minutos para renovar el aire sin que se enfríen los muros del hogar.',
  
  // [31] Alerce milenario
  'b61b66bf-437d-472c-9382-01ea59902efd': '💡 ¿Sabías que? El Alerce Milenario del sur de Chile tiene más de 3.600 años y es de los más viejos del mundo.',
  
  // [32] Compras a granel
  'b919b3e1-908c-4155-8261-5ba427356f6a': '🌱 Eco-Tip: Comprar legumbres a granel con tus propios envases elimina bolsas plásticas innecesarias.',
  
  // [33] Pudú ciervo nativo
  'bcc3b08f-ff13-4923-b080-47d50f3b57a0': '💡 ¿Sabías que? El pudú chileno es el ciervo más pequeño del mundo y mide menos de 40 cm de estatura.',
  
  // [34] Hervir agua necesaria
  'c27073d2-d367-49a1-b287-325fa2b8242f': '🌱 Eco-Tip: Hervir solo las tazas que vas a consumir ahorra tiempo y cuida la potencia eléctrica de tu hogar.',
  
  // [35] Bolsas reutilizables
  'c53f83a5-a363-481a-83e2-3c7a523a767b': '💡 ¿Sabías que? Una sola bolsa de tela reutilizable evita usar más de 500 bolsas plásticas desechables.',
  
  // [36] No botar aceite al lavaplatos
  'c60ed76d-a670-4426-ba1b-f3c58bbc3901': '🌱 Eco-Tip: 1 litro de aceite usado contamina 1.000 litros de agua; junta tu aceite en una botella plástica.',
  
  // [37] Senderos en parques
  'c7d26c49-fc0f-4957-bb92-1402228de5cf': '💡 ¿Sabías que? Mantenerse en senderos marcados evita pisar líquenes y plantas que tardan décadas en crecer.',
  
  // [38] Llave que gotea
  'cbe7410b-e687-41af-8e09-9bb0beb75438': '🌱 Eco-Tip: Una llave que gotea lentamente pierde hasta 30 litros de agua potable cada 24 horas.',
  
  // [39] Evaluar antes de comprar
  'd10006f1-c93a-48ef-8a9f-a1260a564c5f': '💡 ¿Sabías que? Esperar un día antes de comprar por impulso evita acumular objetos que terminan en desuso.',
  
  // [40] Aireadores de grifo
  'da1eb88b-dfce-49f1-ae39-d80044fa02ec': '🌱 Eco-Tip: Instalar aireadores en las llaves reduce hasta un 50% el caudal de agua sin perder presión.',
  
  // [41] Cepillarse los dientes sin correr la llave
  'da4bf614-9e4e-4cae-a96d-2769764a3cf8': '💡 ¿Sabías que? Cerrar la llave mientras te cepillas los dientes ahorra hasta 12 litros de agua por minuto.',
  
  // [42] Cóndor andino
  'daf5ff8a-acfc-4aa8-9fea-a9165b23896c': '🌱 Eco-Tip: El cóndor andino puede volar cientos de kilómetros planeando sin batir sus alas.',
  
  // [43] Reutilizar agua de lavado de verduras
  'dce0a8ae-8ee1-4a98-8e90-b85f4cf9916f': '💡 ¿Sabías que? Usar el agua de lavar frutas y verduras para regar tus maceteros nutre la tierra sin gastar de más.',
  
  // [44] Aplastar botellas antes de reciclar
  'e0470fbe-4175-4abe-a3ab-2c2cc9dee1c9': '🌱 Eco-Tip: Aplastar botellas plásticas reduce su volumen un 75%, optimizando el espacio en el punto limpio.',
  
  // [45] Separar residuos en origen
  'e2aceaa4-51c7-470a-8599-963df811d600': '💡 ¿Sabías que? Separar residuos en casa evita que cartones y plásticos limpios se contaminen con basura.',
  
  // [46] Proteger animales silvestres
  'eced2e7f-72e2-4e8c-9a5e-bf40626a0146': '🌱 Eco-Tip: Mantener mascotas supervisadas o con cascabel protege anualmente a miles de aves nativas.',
  
  // [47] Transporte en bicicleta
  'efbab23d-e0ab-47b6-a50b-077177402a50': '💡 ¿Sabías que? Andar en bicicleta 5 km al día evita emitir más de 1 kg de CO2 respecto a viajar en auto.',
  
  // [48] Reciclaje de papel
  'f157a2e7-d70e-40e6-8979-94d37c7e7811': '🌱 Eco-Tip: Reciclar una tonelada de papel salva 17 árboles maduros y ahorra más de 25.000 litros de agua.',
  
  // [49] Donar o vender lo que funciona
  'f3fef784-9edf-46a0-b8ca-74158e5a3cd5': '💡 ¿Sabías que? Donar ropa o artefactos en buen estado da una segunda vida a los productos y apoya a tu comunidad.',
  
  // [50] Reducir desperdicio de comida
  'f9c08c3e-fdf2-4f22-a94a-7eef32566d75': '🌱 Eco-Tip: Planificar los almuerzos de la semana antes de comprar reduce el desecho de alimentos en un 40%.'
};

async function main() {
  console.log('🔄 Iniciando repoblación de datos curiosos en Railway PostgreSQL...');

  // 1. Validar longitudes
  for (const [id, texto] of Object.entries(datosCuriososMap)) {
    if (texto.length > 180) {
      throw new Error(`Texto para ${id} supera 180 caracteres: (${texto.length}) "${texto}"`);
    }
  }
  console.log(`✅ Los ${Object.keys(datosCuriososMap).length} datos curiosos cumplen con la restricción de <= 180 caracteres.`);

  // 2. Actualizar en la base de datos
  let updatedCount = 0;
  for (const [id, datoCurioso] of Object.entries(datosCuriososMap)) {
    const res = await pool.query(
      'UPDATE public.trivia_questions SET dato_curioso = $1 WHERE id = $2 RETURNING id',
      [datoCurioso, id]
    );
    if (res.rowCount > 0) {
      updatedCount++;
    }
  }

  console.log(`\n🎉 Se actualizaron exitosamente ${updatedCount} preguntas en la base de datos!`);

  // 3. Verificación final de NULLs restantes
  const nullCheck = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE dato_curioso IS NULL) as pendientes_null,
      COUNT(*) FILTER (WHERE dato_curioso IS NOT NULL) as poblados
    FROM public.trivia_questions;
  `);

  console.log('📊 Estado actual de la tabla trivia_questions:', nullCheck.rows[0]);

  // 4. Mostrar muestra de preguntas actualizadas
  const sample = await pool.query(`
    SELECT id, categoria, dato_curioso, pregunta
    FROM public.trivia_questions
    ORDER BY created_at ASC, id ASC
    LIMIT 5;
  `);

  console.log('\n🌟 Muestra de registros actualizados:');
  sample.rows.forEach(r => {
    console.log(` • [${r.categoria}] ${r.dato_curioso}`);
  });

  await pool.end();
}

main().catch(err => {
  console.error('❌ Error repoblando datos curiosos:', err);
  process.exit(1);
});
