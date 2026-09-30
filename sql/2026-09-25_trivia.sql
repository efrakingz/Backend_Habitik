CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

CREATE TABLE IF NOT EXISTS public.trivia_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pregunta TEXT NOT NULL,
    alternativas JSONB NOT NULL,
    correct_index SMALLINT NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
    explicacion TEXT NOT NULL,
    categoria VARCHAR(40) NOT NULL,
    dificultad VARCHAR(20) NOT NULL CHECK (dificultad IN ('facil', 'media', 'dificil')),
    fuente VARCHAR(20) NOT NULL CHECK (fuente IN ('curada', 'gemini')),
    fingerprint CHAR(64) NOT NULL UNIQUE,
    veces_usada INTEGER NOT NULL DEFAULT 0,
    ultima_vez_usada TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT trivia_questions_four_options CHECK (jsonb_typeof(alternativas) = 'array' AND jsonb_array_length(alternativas) = 4)
);

CREATE TABLE IF NOT EXISTS public.trivia_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
    vidas_restantes SMALLINT NOT NULL DEFAULT 3 CHECK (vidas_restantes BETWEEN 0 AND 3),
    vida_extra_comprada BOOLEAN NOT NULL DEFAULT false,
    correctas INTEGER NOT NULL DEFAULT 0,
    incorrectas INTEGER NOT NULL DEFAULT 0,
    xp_acumulada INTEGER NOT NULL DEFAULT 0,
    monedas_ganadas INTEGER NOT NULL DEFAULT 0,
    current_question_id UUID REFERENCES public.trivia_questions(id) ON DELETE RESTRICT,
    current_question_started_at TIMESTAMPTZ,
    estado VARCHAR(20) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'finalizada')),
    recompensa_acreditada BOOLEAN NOT NULL DEFAULT false,
    xp_total_resultado INTEGER,
    saldo_monedas_resultado INTEGER,
    nivel_resultado INTEGER,
    level_up_resultado BOOLEAN,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.trivia_answers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.trivia_sessions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.trivia_questions(id) ON DELETE SET NULL,
    pregunta_snapshot TEXT NOT NULL,
    alternativas_snapshot JSONB NOT NULL,
    explicacion_snapshot TEXT NOT NULL,
    selected_index SMALLINT CHECK (selected_index BETWEEN 0 AND 3),
    correct_index SMALLINT NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
    correcta BOOLEAN NOT NULL,
    tiempo_segundos INTEGER NOT NULL CHECK (tiempo_segundos >= 0),
    xp_otorgada INTEGER NOT NULL DEFAULT 0,
    vidas_restantes_resultado SMALLINT NOT NULL,
    correctas_resultado INTEGER NOT NULL,
    xp_acumulada_resultado INTEGER NOT NULL,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, question_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trivia_one_active_session ON public.trivia_sessions(user_id) WHERE estado = 'activa';
CREATE INDEX IF NOT EXISTS idx_trivia_answers_session ON public.trivia_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_trivia_answers_user_history ON public.trivia_answers(question_id, answered_at DESC);
CREATE INDEX IF NOT EXISTS idx_trivia_questions_rotation ON public.trivia_questions(fuente, ultima_vez_usada NULLS FIRST, created_at);

INSERT INTO public.trivia_questions (
    pregunta, alternativas, correct_index, explicacion, categoria, dificultad, fuente, fingerprint
)
VALUES
    ('¿Qué acción reduce el consumo eléctrico de los aparatos en espera?', '["Desenchufarlos","Subir el brillo","Abrir las ventanas","Usar agua caliente"]'::jsonb, 0, 'Los aparatos en espera siguen consumiendo energía si permanecen conectados.', 'energia', 'facil', 'curada', '0db37d4d144527b09af26c2cd74350b2515c590f13196af117e9fed1cebf011c'),
    ('¿Qué ampolleta consume menos energía para entregar una iluminación similar?', '["Incandescente","Halógena","LED","De filamento decorativo"]'::jsonb, 2, 'Las ampolletas LED usan menos electricidad y duran más que las incandescentes.', 'energia', 'facil', 'curada', 'f2afb4d8ba6d254e6133c4234d9936ae6263b124f847c2eada503423f78e3bd5'),
    ('¿Qué indica una etiqueta de eficiencia energética con clasificación A?', '["Mayor ruido","Menor eficiencia","Mayor tamaño","Alta eficiencia"]'::jsonb, 3, 'La clasificación A identifica equipos que aprovechan mejor la energía.', 'energia', 'facil', 'curada', '3e292bf0e51f72183fb7d28b4a326f098132595cb1e1dac5647276c93f5dfaee'),
    ('¿Cuál es una fuente de energía renovable disponible en el norte de Chile?', '["Carbón","Energía solar","Diésel","Gasolina"]'::jsonb, 1, 'La alta radiación solar del norte de Chile favorece la generación fotovoltaica.', 'energia', 'facil', 'curada', 'fcae6a1f53b70f0b27c5812a1e2aa0d07c1c985d73acf756644a5439321a0d9a'),
    ('¿Qué hábito ayuda a gastar menos energía al hervir agua?', '["Hervir solo la cantidad necesaria","Llenar siempre el hervidor","Destaparlo mientras hierve","Repetir el hervido"]'::jsonb, 0, 'Calentar únicamente el agua necesaria reduce electricidad y tiempo.', 'energia', 'facil', 'curada', 'a9f8bcb7ed5cf8f8a8d28dd5ab73716c488e1ca1713f6d0461d3a5ad039d7c59'),
    ('¿Cómo se evita perder calor al cocinar en una olla?', '["Usando fuego máximo siempre","Agregando agua fría","Cocinando con tapa","Abriendo el horno"]'::jsonb, 2, 'La tapa conserva el calor y permite cocinar usando menos energía.', 'energia', 'facil', 'curada', 'f8eb9aea3278b68c10d98967f1abcedbf9ce822b2f7b0e3165fba71ba7cd94f9'),
    ('¿Qué medida mejora la eficiencia de un refrigerador?', '["Ponerlo junto al horno","Revisar el sello de la puerta","Dejar la puerta abierta","Guardar alimentos calientes"]'::jsonb, 1, 'Un sello en buen estado evita fugas de aire frío y trabajo extra del motor.', 'energia', 'media', 'curada', 'a3634f383b27e78c64037f84b8ecb41d05abaca10382deec3888a5d465f0c17f'),
    ('¿Qué transporte usa energía humana directamente?', '["Automóvil","Motocicleta","Avión","Bicicleta"]'::jsonb, 3, 'La bicicleta se mueve con energía humana y no emite gases durante su uso.', 'energia', 'facil', 'curada', '5f68ba4cd9465fbcebd9ca29804601396d06db74b9e6e86c212cfcd101eb4797'),
    ('¿Qué conviene hacer con la calefacción al ventilar una habitación?', '["Apagarla durante la ventilación","Subirla al máximo","Abrir todas las puertas","Cubrir el calefactor"]'::jsonb, 0, 'Apagarla evita desperdiciar energía mientras entra aire frío.', 'energia', 'media', 'curada', 'c6081a9eddaa2a51946ed5e484bab93c974d2a26590f2f4b2253809ecd3a2dbd'),
    ('¿Para qué sirve aislar puertas y ventanas en invierno?', '["Para aumentar la humedad","Para oscurecer la casa","Para conservar el calor","Para enfriar los muros"]'::jsonb, 2, 'El aislamiento reduce la pérdida de calor y la necesidad de calefacción.', 'energia', 'media', 'curada', 'bf835b0b53de9bbb752ff86ebe13db7748c027e6961d0525a8ef61506efe0105'),
    ('¿Qué hábito ahorra agua al cepillarse los dientes?', '["Usar agua caliente","Cerrar la llave","Abrir dos llaves","Dejar correr el agua"]'::jsonb, 1, 'Cerrar la llave evita perder varios litros de agua durante el cepillado.', 'agua', 'facil', 'curada', '1730b70d8db548199bc4df002c69b5484b1670902324ce051f6f9861454c621e'),
    ('¿Cuál ducha suele consumir menos agua?', '["Una ducha corta","Una ducha de una hora","Una tina llena","Una ducha con la llave abierta antes de entrar"]'::jsonb, 0, 'Reducir el tiempo de ducha disminuye el consumo de agua y energía.', 'agua', 'facil', 'curada', '8b34758c224f482c0a0c91d1e048d9d173115470920eaec990b5b70e7bd44cd6'),
    ('¿Qué se debe hacer al detectar una llave que gotea?', '["Ignorarla","Abrirla más","Cubrirla con un paño","Repararla pronto"]'::jsonb, 3, 'Un goteo continuo puede desperdiciar mucha agua con el paso de los días.', 'agua', 'facil', 'curada', '03dc582bb0b712cd420b27f222af43dca1310b3499218a4bd0b429a8169b4c36'),
    ('¿Cuándo es mejor regar el jardín para reducir la evaporación?', '["Al mediodía","Durante el mayor calor","Temprano o al atardecer","Solo cuando hay viento"]'::jsonb, 2, 'A menor temperatura se evapora menos agua antes de llegar a las raíces.', 'agua', 'media', 'curada', '8572459fd70f4244776b78d96086ce5f3efd24a51ce6a5d98079146a1f5e2831'),
    ('¿Qué opción aprovecha agua sin usar agua potable nueva?', '["Recolectar agua lluvia para riego","Lavar la vereda con manguera","Vaciar una piscina","Dejar correr la ducha"]'::jsonb, 0, 'El agua lluvia almacenada puede emplearse en tareas como el riego.', 'agua', 'media', 'curada', '7e08e71e436ca8b1940d57586fbaf11b890586095bff9eb5088f9756fea7c2f0'),
    ('¿Cómo conviene lavar una carga de ropa?', '["Con una prenda","Con carga completa","Repitiendo el ciclo","Sin centrifugado nunca"]'::jsonb, 1, 'Una carga completa aprovecha mejor el agua y la energía de cada ciclo.', 'agua', 'facil', 'curada', '0bbad2aaecb315529739302eaff7a163bf159cc1e4efff860fd410b9a65bdcda'),
    ('¿Qué artefacto permite reducir el caudal sin cortar el agua?', '["Una estufa","Un alargador","Un aireador de grifo","Una ampolleta"]'::jsonb, 2, 'El aireador mezcla aire con agua y mantiene una sensación de buen caudal.', 'agua', 'media', 'curada', '3d4564d6c024d6578f208a7e4d377842809b49383cb880b053aceb32dd4e0bce'),
    ('¿Qué acción desperdicia más agua al lavar un automóvil?', '["Usar un balde","Usar un paño húmedo","Reutilizar agua apta","Dejar la manguera abierta"]'::jsonb, 3, 'Una manguera abierta entrega agua continuamente aunque no se esté enjuagando.', 'agua', 'facil', 'curada', '4abd3b6e23eb1f134e77a1ed0f362f89ead9a3fdef7276faa864defa8367f632'),
    ('¿Qué ayuda a saber si existe una fuga oculta en el hogar?', '["Revisar el medidor sin consumo","Cambiar las cortinas","Encender las luces","Abrir el refrigerador"]'::jsonb, 0, 'Si el medidor avanza con todas las llaves cerradas, puede existir una fuga.', 'agua', 'media', 'curada', '4b9614f64e6649c9edd470e88edd606a4057cd47b050a677d047b1cca0b3d320'),
    ('¿Por qué no se debe botar aceite de cocina por el lavaplatos?', '["Porque enfría el agua","Porque contamina y tapa tuberías","Porque cambia el color del metal","Porque produce electricidad"]'::jsonb, 1, 'El aceite puede obstruir tuberías y contaminar grandes cantidades de agua.', 'agua', 'media', 'curada', '66a91e7f7198e5e9a0949634c28590f49d8883c06cf305fbac52b6d599898468'),
    ('¿Qué residuo suele aceptarse limpio y seco en reciclaje de papel?', '["Servilleta usada","Papel higiénico","Cartón limpio","Papel con aceite"]'::jsonb, 2, 'El cartón limpio y seco puede incorporarse a procesos de reciclaje.', 'reciclaje', 'facil', 'curada', '5d535a857afee351bfb5d7230e357adbc9e57e2f83d5fee641846c75a3ab02cf'),
    ('¿Qué se debe hacer con una botella plástica antes de reciclarla?', '["Llenarla con comida","Enjuagarla y compactarla","Quemarla","Enterrarla"]'::jsonb, 1, 'Limpiarla evita contaminación y compactarla reduce el espacio de transporte.', 'reciclaje', 'facil', 'curada', 'ad6eb953db1c26a33622da321e41863e1d7e865e2b0a6659c2c51b62ae79f04d'),
    ('¿Dónde deben llevarse las pilas usadas?', '["A un punto de recepción autorizado","Al compost","Al inodoro","A una fogata"]'::jsonb, 0, 'Las pilas requieren manejo especial por los materiales que contienen.', 'reciclaje', 'facil', 'curada', 'ba28e1a451674e4b9a5ed4894e7fd7edd3de931ef14ba199c0e4d366900db7cd'),
    ('¿Cuál de estos residuos es apropiado para compostar?', '["Vidrio","Metal","Plástico","Cáscaras de frutas"]'::jsonb, 3, 'Las cáscaras son materia orgánica que puede transformarse en compost.', 'reciclaje', 'facil', 'curada', 'c8ea4d5c3360181b752db736e97660ebc5d906e6edf60532e1e249f7c5cde1bf'),
    ('¿Qué significa reutilizar un objeto?', '["Botarlo antes","Usarlo nuevamente","Mezclarlo con basura","Quemarlo"]'::jsonb, 1, 'Reutilizar extiende la vida del objeto y evita generar un residuo nuevo.', 'reciclaje', 'facil', 'curada', '857efc380bedcc01c77900f70d61d117d9cc49e8b534f34e0cf13a4e5ce3fbbd'),
    ('¿Por qué los envases reciclables deben ir sin restos de comida?', '["Para que pesen más","Para cambiar su color","Para no contaminar otros materiales","Para que ocupen más espacio"]'::jsonb, 2, 'Los restos pueden ensuciar un lote y dificultar su aprovechamiento.', 'reciclaje', 'media', 'curada', '12654b970c0d4b654dbe0a5aae67af9791558ff9a78012252783c7035ad32458'),
    ('¿Qué residuo debe gestionarse como aparato eléctrico o electrónico?', '["Un teléfono dañado","Una cáscara de plátano","Una caja de cartón","Una botella de vidrio"]'::jsonb, 0, 'Los teléfonos contienen componentes que requieren tratamiento especializado.', 'reciclaje', 'media', 'curada', '4cd46d6224f80979faf1cc5eead870f7770e3c008cd77a05e22a74744e6ed320'),
    ('¿Cuál es el orden preferible para manejar residuos?', '["Botar, comprar y quemar","Quemar, mezclar y enterrar","Reciclar, comprar y desechar","Reducir, reutilizar y reciclar"]'::jsonb, 3, 'Primero se evita el residuo, luego se reutiliza y finalmente se recicla.', 'reciclaje', 'media', 'curada', '3e644fbca6a8daa259b1a7f1ca01cf871219d2fa015dba5c62f1aee904b694fb'),
    ('¿Qué material no debe mezclarse con vidrio de botellas en un punto limpio?', '["Botellas transparentes","Ampolletas","Frascos","Botellas verdes"]'::jsonb, 1, 'Las ampolletas tienen una composición distinta y requieren otra gestión.', 'reciclaje', 'media', 'curada', '57376b84804fc7973e307ac63b26c6eed5c8e72a7caa881c6b5d1d2b0cbf26cc'),
    ('¿Qué beneficio tiene separar residuos en el hogar?', '["Facilita recuperar materiales","Aumenta la basura mezclada","Impide reutilizar","Elimina la necesidad de puntos limpios"]'::jsonb, 0, 'La separación permite entregar cada material a su cadena de valorización.', 'reciclaje', 'facil', 'curada', '40c23f3a5343bc80bad80389f8c0f5daa2371071a1077379257bf672c80e37e1'),
    ('¿Qué animal nativo chileno es el ciervo más pequeño del mundo?', '["Huemul","Pudú","Guanaco","Puma"]'::jsonb, 1, 'El pudú es un pequeño ciervo nativo de los bosques templados de Chile.', 'biodiversidad', 'media', 'curada', 'fb39fec3ebe69fbabbad442f9d078dd8e26ea425f0a5a89f24d25d31374842e4'),
    ('¿Qué árbol es característico de los bosques del sur de Chile?', '["Baobab","Secuoya gigante","Alerce","Cocotero"]'::jsonb, 2, 'El alerce es una especie nativa emblemática de los bosques australes.', 'biodiversidad', 'facil', 'curada', '1daa1e6701fe969f35e41edf14d08c5422eba2824afd84c6a3af80018a751421'),
    ('¿Qué práctica ayuda a proteger a los animales silvestres?', '["Observarlos a distancia","Alimentarlos siempre","Llevarlos a casa","Perseguirlos para fotografiarlos"]'::jsonb, 0, 'Mantener distancia evita estrés, accidentes y cambios en su conducta.', 'biodiversidad', 'facil', 'curada', '2670d9d1ab4f5669f10c78fb76fcdf9abf69fe61551c9a1cf3df97978559b2dd'),
    ('¿Por qué son importantes los humedales urbanos?', '["Porque reemplazan todas las plazas","Porque almacenan basura","Porque eliminan toda inundación","Porque albergan especies y regulan agua"]'::jsonb, 3, 'Los humedales entregan hábitat y ayudan a retener y filtrar agua.', 'biodiversidad', 'media', 'curada', 'f9173237cf2ec3630ee05c6f2c33fb1211da7f587f346c0611c5380559a45e66'),
    ('¿Qué acción favorece a los polinizadores en un jardín?', '["Usar pesticidas sin control","Plantar flores nativas","Cortar todas las flores","Reemplazar plantas por cemento"]'::jsonb, 1, 'Las flores nativas entregan alimento y refugio adecuados a polinizadores locales.', 'biodiversidad', 'media', 'curada', '59398971c9be1a6e92dc73e4a9aabf979fd1a532258d9514f01c1568710e566b'),
    ('¿Cuál es una especie emblemática de la cordillera de los Andes en Chile?', '["Cóndor","Pingüino emperador","Canguro","Oso polar"]'::jsonb, 0, 'El cóndor andino habita zonas montañosas y forma parte del escudo nacional.', 'biodiversidad', 'facil', 'curada', 'aa860fbbd955b43b93c70a908e9f613a4742febb09d9ef65604e36f8b9b5a4ea'),
    ('¿Qué efecto puede tener una especie invasora?', '["Crear agua potable","Aumentar siempre la diversidad","Desplazar especies nativas","Detener el viento"]'::jsonb, 2, 'Una especie invasora puede competir por alimento y espacio con especies nativas.', 'biodiversidad', 'media', 'curada', '724cd3d1a943c37a87475db1c7c24d6607bf194a9e8966280331e4246200a154'),
    ('¿Qué conducta protege la vegetación de un parque nacional?', '["Salirse de los senderos","Extraer flores","Encender fuego libremente","Caminar por senderos habilitados"]'::jsonb, 3, 'Usar senderos reduce el daño sobre plantas y suelos frágiles.', 'biodiversidad', 'facil', 'curada', '24e81740bef864df0f4276c66c13b3986f006c9b27a5cad4f62a9caf712f1989'),
    ('¿Por qué no se deben liberar mascotas exóticas en la naturaleza?', '["Porque pueden volverse invasoras","Porque aprenden a reciclar","Porque limpian los ríos","Porque reducen el ruido"]'::jsonb, 0, 'Pueden reproducirse, transmitir enfermedades o afectar a especies nativas.', 'biodiversidad', 'media', 'curada', '6617092b8a5f05b940b71d0b0153e735aeeccf8e07e46dba20b4ad352b6bca69'),
    ('¿Qué ecosistema chileno destaca por su adaptación a la escasez de lluvia?', '["Selva amazónica","Desierto de Atacama","Tundra ártica","Sabana africana"]'::jsonb, 1, 'Las especies del desierto de Atacama poseen adaptaciones a condiciones extremadamente secas.', 'biodiversidad', 'facil', 'curada', '06763e2b7a5227bdcd6139b5f2d32203826e0d1df3ae375339d35510e41a8b4e'),
    ('¿Qué compra genera menos residuos?', '["Un producto con doble envoltorio","Un envase desechable","Un producto a granel en recipiente reutilizable","Una porción individual envuelta"]'::jsonb, 2, 'Comprar a granel con un recipiente reutilizable evita envases de un solo uso.', 'consumo_responsable', 'facil', 'curada', '1e63f30cd4558db889300afe6513313edc97650328b709a536e4590c46edafbc'),
    ('¿Qué conviene hacer antes de comprar algo nuevo?', '["Preguntarse si realmente se necesita","Botar un objeto útil","Elegir el mayor envase","Comprar sin comparar"]'::jsonb, 0, 'Evaluar la necesidad evita compras impulsivas y el uso innecesario de recursos.', 'consumo_responsable', 'facil', 'curada', '15273f4990641619d1080491e216882d67ee1bf07b2435643a4ee2f1cda81006'),
    ('¿Cómo se reduce el desperdicio de alimentos en el hogar?', '["Comprando sin lista","Planificando las comidas","Botando las sobras","Ignorando las fechas"]'::jsonb, 1, 'Planificar ayuda a comprar cantidades adecuadas y aprovechar lo disponible.', 'consumo_responsable', 'facil', 'curada', '176ef38d1b18f06ebe606f7a552d0679fdb735cb2d5732ed600f894d580f482b'),
    ('¿Qué opción extiende la vida útil de una prenda?', '["Desecharla por un botón","Lavarlo todo a diario","Quemarla","Repararla"]'::jsonb, 3, 'Reparar evita una compra nueva y aprovecha los materiales ya producidos.', 'consumo_responsable', 'facil', 'curada', '2ac730e6869bd6d1b21c99ec6fb89aedfc551b3a1fba499333c89d4f8173ae92'),
    ('¿Qué característica es preferible en una botella de uso diario?', '["Que sea reutilizable","Que sea de un solo uso","Que venga con varios envoltorios","Que no pueda lavarse"]'::jsonb, 0, 'Una botella reutilizable reemplaza muchos envases desechables.', 'consumo_responsable', 'facil', 'curada', '57d326d31c30a6a7e4a0e79da82db8ca7699f1d99a95fd4d202d0e64e15da89b'),
    ('¿Qué ventaja puede tener comprar productos locales?', '["Siempre usan más envases","Pueden requerir menos transporte","Nunca tienen temporada","Eliminan todo impacto ambiental"]'::jsonb, 1, 'Una menor distancia de transporte puede reducir consumo de combustible y emisiones.', 'consumo_responsable', 'media', 'curada', 'a4a601c12d5c2dd52ca235710007558dd3259312770d2c878cbee535ae6bdb75'),
    ('¿Qué elección ayuda a disminuir bolsas desechables?', '["Pedir varias bolsas","Usar una bolsa por artículo","Llevar una bolsa reutilizable","Botar la bolsa después de una compra"]'::jsonb, 2, 'Una bolsa resistente puede usarse muchas veces y reemplazar bolsas de un solo uso.', 'consumo_responsable', 'facil', 'curada', '91a2854c5bea54b616aa268f2d5946b3f2fcd9c348ca2d4e3ba4b0e4a3b079dd'),
    ('¿Qué significa preferir un producto durable?', '["Elegir el que dura más y puede repararse","Elegir el más desechable","Comprar varios iguales","Cambiarlo aunque funcione"]'::jsonb, 0, 'Un producto durable necesita menos reemplazos y reduce el uso de materiales.', 'consumo_responsable', 'media', 'curada', '4ee9add7a7ad4f1e77dc62ee40def386e40871b4be2e4f0b1ba72555b3ecefcf'),
    ('¿Qué acción permite aprovechar mejor los alimentos antes de que venzan?', '["Esconderlos al fondo","Comprar duplicados","Desecharlos de inmediato","Ordenarlos por fecha"]'::jsonb, 3, 'Dejar adelante los productos que vencen primero facilita consumirlos a tiempo.', 'consumo_responsable', 'media', 'curada', '592f1e8c162afa7c981a849fb5b1fd61b255a50ed592eefeeda53674b0a23380'),
    ('¿Cuál es una alternativa responsable para un objeto que aún funciona y ya no se usa?', '["Romperlo","Donarlo o venderlo","Enterrarlo","Mezclarlo con residuos orgánicos"]'::jsonb, 1, 'Entregarlo a otra persona prolonga su uso y evita que se transforme en residuo.', 'consumo_responsable', 'facil', 'curada', '53ee32967df50dac0d2bb67b458dce22809b8e5a737dd776177e4651eb086a39')
ON CONFLICT (fingerprint) DO UPDATE SET
    pregunta = EXCLUDED.pregunta,
    alternativas = EXCLUDED.alternativas,
    correct_index = EXCLUDED.correct_index,
    explicacion = EXCLUDED.explicacion,
    categoria = EXCLUDED.categoria,
    dificultad = EXCLUDED.dificultad,
    fuente = 'curada';
