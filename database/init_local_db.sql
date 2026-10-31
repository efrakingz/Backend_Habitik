-- ========================================================
-- HABITIK LOCAL DATABASE DUMP (CON CONTINGENCIA FERIA)
-- Generado automáticamente desde Railway: 2026-10-31T01:43:20.123Z
-- ========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla: public.families
CREATE TABLE IF NOT EXISTS public.families (
  id UUID DEFAULT public.gen_random_uuid() NOT NULL,
  nombre VARCHAR NOT NULL,
  family_code VARCHAR,
  meta_luz INTEGER DEFAULT 0,
  meta_agua INTEGER DEFAULT 0,
  avatar JSONB DEFAULT '{"url": null, "color": "#2e7d32", "emoji": "home"}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: public.users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID DEFAULT public.gen_random_uuid() NOT NULL,
  email VARCHAR NOT NULL,
  password_hash VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: public.profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL,
  email VARCHAR NOT NULL,
  nombre VARCHAR NOT NULL,
  avatar JSONB DEFAULT '{"url": null, "color": "#2e7d32", "letra": "U"}'::jsonb,
  rol VARCHAR DEFAULT 'miembro'::character varying,
  family_id UUID,
  xp INTEGER DEFAULT 0,
  nivel INTEGER DEFAULT 1,
  monedas INTEGER DEFAULT 0,
  trivia_correct_count INTEGER DEFAULT 0,
  trivia_last_updated VARCHAR,
  daily_bonus_claimed_at VARCHAR,
  onboarding_answers JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  ultima_actividad DATE,
  racha_dias INTEGER DEFAULT 0,
  ultimo_nivel_reclamado INTEGER DEFAULT 1,
  telefono VARCHAR
);

-- Tabla: public.family_rewards
CREATE TABLE IF NOT EXISTS public.family_rewards (
  id BIGINT DEFAULT nextval('family_rewards_id_seq'::regclass) NOT NULL,
  family_id UUID NOT NULL,
  titulo VARCHAR NOT NULL,
  descripcion TEXT,
  emoji VARCHAR DEFAULT 'gift'::character varying,
  costo INTEGER DEFAULT 100,
  disponible BOOLEAN DEFAULT true,
  creador_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  last_redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  es_familiar BOOLEAN DEFAULT false,
  estado VARCHAR DEFAULT 'activo'::character varying NOT NULL,
  propuesto_por UUID,
  fecha_propuesta DATE
);

-- Tabla: public.canjes
CREATE TABLE IF NOT EXISTS public.canjes (
  id UUID DEFAULT public.gen_random_uuid() NOT NULL,
  reward_id BIGINT NOT NULL,
  user_id UUID NOT NULL,
  family_id UUID NOT NULL,
  costo_pagado INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  estado VARCHAR DEFAULT 'pendiente'::character varying,
  es_colecta BOOLEAN DEFAULT false NOT NULL,
  total_requerido INTEGER DEFAULT 0,
  total_recaudado INTEGER DEFAULT 0
);

-- Tabla: public.canje_aportes
CREATE TABLE IF NOT EXISTS public.canje_aportes (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  canje_id UUID NOT NULL,
  user_id UUID NOT NULL,
  monto_asignado INTEGER NOT NULL,
  monto_pagado INTEGER DEFAULT 0 NOT NULL,
  pagado BOOLEAN DEFAULT false NOT NULL,
  pagado_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: public.shower_logs
CREATE TABLE IF NOT EXISTS public.shower_logs (
  id UUID DEFAULT public.gen_random_uuid() NOT NULL,
  user_id UUID NOT NULL,
  duracion_segundos INTEGER NOT NULL,
  estado VARCHAR NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  family_id UUID,
  xp_otorgada INTEGER DEFAULT 0,
  monedas_otorgadas INTEGER DEFAULT 0,
  es_valido BOOLEAN DEFAULT true,
  iniciado_en TIMESTAMPTZ,
  finalizado_en TIMESTAMPTZ
);

-- Tabla: public.tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT public.gen_random_uuid() NOT NULL,
  family_id UUID NOT NULL,
  tarea VARCHAR NOT NULL,
  asignado_id UUID,
  hecho BOOLEAN DEFAULT false,
  xp INTEGER DEFAULT 0,
  tipo VARCHAR DEFAULT 'general'::character varying,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: public.evidences
CREATE TABLE IF NOT EXISTS public.evidences (
  id UUID DEFAULT public.gen_random_uuid() NOT NULL,
  user_id UUID NOT NULL,
  family_id UUID NOT NULL,
  accion VARCHAR NOT NULL,
  descripcion TEXT,
  likes INTEGER DEFAULT 0,
  xp INTEGER DEFAULT 0,
  emoji VARCHAR DEFAULT 'star'::character varying,
  snapshot_usuario JSONB DEFAULT '{}'::jsonb,
  media JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: public.inspeccion_evidencias
CREATE TABLE IF NOT EXISTS public.inspeccion_evidencias (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  family_id UUID NOT NULL,
  user_id UUID NOT NULL,
  titulo_mision VARCHAR NOT NULL,
  foto_url TEXT NOT NULL,
  estado VARCHAR DEFAULT 'pendiente'::character varying,
  motivo_rechazo TEXT,
  xp_otorgada INTEGER DEFAULT 80,
  monedas_otorgadas INTEGER DEFAULT 4,
  created_at TIMESTAMPTZ DEFAULT now(),
  validated_at TIMESTAMPTZ
);

-- Tabla: public.reto_validations
CREATE TABLE IF NOT EXISTS public.reto_validations (
  id BIGINT NOT NULL,
  family_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reto VARCHAR NOT NULL,
  hora VARCHAR DEFAULT 'Recien'::character varying,
  xp INTEGER DEFAULT 0,
  monedas INTEGER DEFAULT 0,
  evidencias JSONB DEFAULT '[]'::jsonb,
  snapshot_usuario JSONB DEFAULT '{}'::jsonb,
  requiere_evidencia BOOLEAN DEFAULT false,
  estado VARCHAR DEFAULT 'pendiente'::character varying,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: public.ecological_words
CREATE TABLE IF NOT EXISTS public.ecological_words (
  id INTEGER DEFAULT nextval('ecological_words_id_seq'::regclass) NOT NULL,
  palabra VARCHAR NOT NULL,
  pista TEXT NOT NULL
);

-- Tabla: public.wordle_attempts
CREATE TABLE IF NOT EXISTS public.wordle_attempts (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  user_id UUID NOT NULL,
  fecha DATE DEFAULT (CURRENT_DATE AT TIME ZONE 'America/Santiago'::text) NOT NULL,
  intentos JSONB DEFAULT '[]'::jsonb,
  estado VARCHAR DEFAULT 'en_proceso'::character varying,
  pista_revelada BOOLEAN DEFAULT false
);

-- Tabla: public.trivia_questions
CREATE TABLE IF NOT EXISTS public.trivia_questions (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  pregunta TEXT NOT NULL,
  alternativas JSONB NOT NULL,
  correct_index SMALLINT NOT NULL,
  explicacion TEXT NOT NULL,
  categoria VARCHAR NOT NULL,
  dificultad VARCHAR NOT NULL,
  fuente VARCHAR NOT NULL,
  fingerprint bpchar NOT NULL,
  veces_usada INTEGER DEFAULT 0 NOT NULL,
  ultima_vez_usada TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  dato_curioso VARCHAR
);

-- Tabla: public.trivia_sessions
CREATE TABLE IF NOT EXISTS public.trivia_sessions (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  user_id UUID NOT NULL,
  family_id UUID,
  vidas_restantes SMALLINT DEFAULT 3 NOT NULL,
  vida_extra_comprada BOOLEAN DEFAULT false NOT NULL,
  correctas INTEGER DEFAULT 0 NOT NULL,
  incorrectas INTEGER DEFAULT 0 NOT NULL,
  xp_acumulada INTEGER DEFAULT 0 NOT NULL,
  monedas_ganadas INTEGER DEFAULT 0 NOT NULL,
  current_question_id UUID,
  current_question_started_at TIMESTAMPTZ,
  estado VARCHAR DEFAULT 'activa'::character varying NOT NULL,
  recompensa_acreditada BOOLEAN DEFAULT false NOT NULL,
  xp_total_resultado INTEGER,
  saldo_monedas_resultado INTEGER,
  nivel_resultado INTEGER,
  level_up_resultado BOOLEAN,
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  finished_at TIMESTAMPTZ
);

-- Tabla: public.trivia_answers
CREATE TABLE IF NOT EXISTS public.trivia_answers (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  session_id UUID NOT NULL,
  question_id UUID,
  pregunta_snapshot TEXT NOT NULL,
  alternativas_snapshot JSONB NOT NULL,
  explicacion_snapshot TEXT NOT NULL,
  selected_index SMALLINT,
  correct_index SMALLINT NOT NULL,
  correcta BOOLEAN NOT NULL,
  tiempo_segundos INTEGER NOT NULL,
  xp_otorgada INTEGER DEFAULT 0 NOT NULL,
  vidas_restantes_resultado SMALLINT NOT NULL,
  correctas_resultado INTEGER NOT NULL,
  xp_acumulada_resultado INTEGER NOT NULL,
  answered_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabla: public.logros
CREATE TABLE IF NOT EXISTS public.logros (
  id UUID DEFAULT public.gen_random_uuid() NOT NULL,
  codigo VARCHAR NOT NULL,
  titulo VARCHAR NOT NULL,
  descripcion TEXT NOT NULL,
  monedas_recompensa INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: public.usuario_logros
CREATE TABLE IF NOT EXISTS public.usuario_logros (
  id UUID DEFAULT public.gen_random_uuid() NOT NULL,
  user_id UUID NOT NULL,
  logro_id UUID NOT NULL,
  reclamado BOOLEAN DEFAULT false,
  fecha_desbloqueo TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: public.historial_gamificacion
CREATE TABLE IF NOT EXISTS public.historial_gamificacion (
  id INTEGER DEFAULT nextval('historial_gamificacion_id_seq'::regclass) NOT NULL,
  user_id UUID NOT NULL,
  origen_actividad VARCHAR NOT NULL,
  monedas_otorgadas INTEGER DEFAULT 0,
  xp_otorgada INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: public.feed_reacciones
CREATE TABLE IF NOT EXISTS public.feed_reacciones (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  feed_id VARCHAR NOT NULL,
  family_id UUID NOT NULL,
  user_id UUID NOT NULL,
  tipo_reaccion VARCHAR DEFAULT 'like'::character varying NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabla: public.bills
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID DEFAULT public.gen_random_uuid() NOT NULL,
  family_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  service_type VARCHAR,
  provider_code VARCHAR,
  period_start DATE,
  period_end DATE,
  consumption NUMERIC,
  consumption_unit VARCHAR,
  amount_clp INTEGER,
  due_date DATE,
  entry_source VARCHAR,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabla: public.password_reset_codes
CREATE TABLE IF NOT EXISTS public.password_reset_codes (
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  email VARCHAR NOT NULL,
  code VARCHAR NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  phone VARCHAR
);

-- Tabla: public.qr_tokens
CREATE TABLE IF NOT EXISTS public.qr_tokens (
  id UUID DEFAULT public.gen_random_uuid() NOT NULL,
  family_id UUID NOT NULL,
  token VARCHAR NOT NULL,
  used BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: public.notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT public.gen_random_uuid() NOT NULL,
  user_id UUID,
  title VARCHAR NOT NULL,
  desc_text TEXT NOT NULL,
  visual JSONB DEFAULT '{"icon": "notifications", "color": "#388E3C"}'::jsonb,
  payload JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  family_id UUID,
  sender_id UUID,
  sender_name VARCHAR,
  type VARCHAR DEFAULT 'ALERTA_GENERAL'::character varying
);

-- Datos para public.families (37 filas)
INSERT INTO public.families (id, nombre, family_code, meta_luz, meta_agua, avatar, created_at) VALUES
  ('03cf9667-b2f0-4b8e-bc0d-836451a302b3', 'Hogar Bastian', 'ANN6UL', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-09-22T13:36:27.784Z'),
  ('3882354f-bfe6-47a2-a4c6-1a3e6162c9cb', 'Hogar temporal Cristobal', 'TP8DQG', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-09-22T13:36:28.140Z'),
  ('1eec3da2-d030-457b-9c72-85e0b386c70d', 'Mi Hogar', 'VON1NI', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-09-23T23:57:27.450Z'),
  ('ddc58f46-2379-405b-b85f-4f44850e777f', 'Mi Hogar', 'LAYE1J', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-09-23T23:58:06.213Z'),
  ('066a0a09-5b2d-4fea-8be3-e6d7bb00baa6', 'Hogar de carolina', '1USFVD', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-09-24T15:12:48.843Z'),
  ('f1d61666-5f00-4260-bfc1-aac7475e53fb', 'Hogar de cristobalin', '9CU0GN', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-09-28T01:05:26.320Z'),
  ('1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 'Hollows', 'DWE5AJ', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-09-29T23:34:38.441Z'),
  ('53ffc42f-cc07-47d6-8412-ab395fc4d71c', 'Hogar de Mati', 'K9AHA2', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-09-30T21:55:38.385Z'),
  ('ab092b3a-1e4a-49b5-ad16-1dbe61cf1d1d', 'Mi Hogar', 'O7DKRX', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-09-30T22:16:34.603Z'),
  ('05491a07-7fa9-4f38-bbd7-f49d423a80bc', 'Hogar de Cris', 'TSNNJY', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-09-30T22:37:11.238Z'),
  ('7423ead5-4bcd-4155-af09-086b9cf0cb92', 'Hogar de Efra', 'O84XQJ', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-09-30T23:03:15.817Z'),
  ('159f1c18-591a-4445-b277-0fa293152328', 'Hogar de Carlos', 'Y6CM7H', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-09-30T23:26:28.179Z'),
  ('2228e641-973f-4955-ac27-0b96ea526559', 'Mi Hogar', 'NRRKOI', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-01T20:40:52.639Z'),
  ('721d4989-ffcd-4a3d-ba8a-778a84fc4e83', 'Hogar de cristobalon', 'WAQRJO', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-01T20:41:47.626Z'),
  ('d09236f3-331c-4cd1-8c73-9efb9b1988d8', 'Hogar de cristobalon', '8495UN', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-28T23:52:41.729Z'),
  ('1bedfc88-505c-4998-a7fb-0f3b3848635c', 'Mi Hogar', 'IR0UTN', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-28T23:52:33.248Z'),
  ('a8d78a96-c4dd-462e-8040-7b734081dee4', 'Nuevo Nombre Test', 'XQ4362', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-29T02:01:23.653Z'),
  ('bcaca7b0-1532-4966-aac7-b1ef0414f852', 'Familia Temporal Pedro', '5PL218', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-29T02:01:25.140Z'),
  ('b84c42e5-fce1-40c8-a7d7-9a03765cb58a', 'Hogar Bug', 'JQEPVR', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-29T02:01:43.074Z'),
  ('c5276279-04bd-404b-b202-276064565ff4', 'Hogar Miembro', 'VTXCLU', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-29T02:01:43.901Z'),
  ('804bc88c-2e29-4c19-9f2d-4ce1b2a36881', 'Familia Solar', '4CV7RL', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-29T02:09:19.330Z'),
  ('34db73e8-d456-4023-bcc5-a5befb000d84', 'Hogar Temporal', 'YB8FFL', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-29T02:09:21.578Z'),
  ('c269dd1e-45a8-47d3-b43a-e3bfd5c97d56', 'Familia Solar', '85ALD5', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-29T02:09:46.244Z'),
  ('eb00e1f3-8f03-437d-99d6-de3c3dea3ba3', 'Hogar Temporal', '5XLIYB', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-29T02:09:48.552Z'),
  ('ca9a5e5e-0ca5-465a-8943-fd149d7ac51d', 'Familia Solar', 'CCC78L', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-29T02:17:30.211Z'),
  ('0fc89472-30f1-4c98-a835-b252351a4f1b', 'Hogar Temporal', 'ZEUVIV', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-29T02:17:32.424Z'),
  ('ca401ad9-93d7-44ce-962c-5bd49df843ed', 'Mi cachita', 'GGRPAB', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-29T02:21:19.435Z'),
  ('a7fa6fcb-6959-4191-b3a4-0f4c7925b717', 'Familia Test', 'EPYGTO', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-29T16:00:54.198Z'),
  ('bb09a8f6-04fc-4736-8c13-a7373308f7dc', 'Familia Test', 'Z3OFF2', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-29T16:01:21.869Z'),
  ('87f4dd7f-eb1f-4d97-ab96-4fc25392724a', 'Familia Test', 'FTWRL2', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-29T16:26:14.386Z'),
  ('699b7be0-4e4f-49c7-83c0-9c204838b5cf', 'Hogar de BenjaOCR', 'Z2THXB', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-29T19:35:11.083Z'),
  ('b2950da5-3e3f-4dc5-938f-c242ca575fac', 'Familia Solar', 'BWZQPN', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-29T21:38:24.628Z'),
  ('c9e0cdb1-2d9b-4aaf-b3cd-4d7769b4c44c', 'Hogar Temporal', 'ACC1C6', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-29T21:38:26.968Z'),
  ('19d6af61-55d7-483a-8905-5110622ba043', 'Familia Solar', '2RHZSQ', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-29T21:46:53.618Z'),
  ('a2bf1ffb-0366-40d1-8f3e-03dbc09d93b7', 'Hogar Temporal', 'KUSL1P', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-29T21:46:55.816Z'),
  ('eebd2f7d-156a-44da-8efb-e0c913e0bd8f', 'Mi Hogar', 'CRIZDG', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-29T23:35:25.390Z'),
  ('6a127351-6385-439b-832a-98301d281f8a', 'Mi Hogar', 'CXFS6B', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-10-30T01:54:05.901Z')
ON CONFLICT DO NOTHING;

-- Datos para public.users (37 filas)
INSERT INTO public.users (id, email, password_hash, created_at) VALUES
  ('b1c2e021-e2ae-4f88-a983-ec89916bf767', 'bastian@habitik.com', '$2a$10$n4.jQg1uU9YWUTnMiCMIWOpFRbRlVVlw8n9Ziql2CvxBu0omohDHG', '2026-09-22T13:36:27.784Z'),
  ('5f0813c3-216e-4158-b1b9-af2abbb845d0', 'cristobal@habitik.com', '$2a$10$njvZv6I5Gf9VsufvtPkpfeF.hDXV.1vOdKh/py/J8rBvwkYb.zl5a', '2026-09-22T13:36:28.140Z'),
  ('ce4b9004-6723-46be-9096-0d3b261f76dd', 'bastian1@gmail.com', '$2a$10$UaS8w.De/qsa7tI3Csc4DeoChmcPLPFkap4jE.oqLGTn85OuDHIRK', '2026-09-23T23:57:27.450Z'),
  ('e22ba49c-5fca-4b29-b56a-4d66264904a0', 'efra@gmail.com', '$2a$10$R7RdhKbzoP1CAfn9uh3N3.iLUOAOi5/aYr9v2v8vHedkddbanGEK6', '2026-09-23T23:58:06.213Z'),
  ('502636de-20d6-4644-aae5-ac70bec5db7a', 'caro@gmail.com', '$2a$10$MUOTKdRZDYQP/UfwlsxmR.rYqoyudMYL1gwxLR2CaSelSJqcFVQM.', '2026-09-24T15:12:48.843Z'),
  ('a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'cris@gmail.com', '$2a$10$Ahgss73r1D2GkoVzl9feFu.91xsNGRza0yFiS4T/lcVeccYonHE1C', '2026-09-28T01:05:26.320Z'),
  ('fbfe8f40-f773-4484-800a-9d64dd464e88', 'benja@habitik.com', '$2a$10$J6ZO28CDisHxKMy1ucyQLO0iMZEdH3hgpz2VVl.YQ60p1ggZP6HAS', '2026-09-29T23:34:38.441Z'),
  ('87f66d69-5697-4dd4-bb84-42150e1db851', 'mati@habitik.com', '$2a$10$WkPG3hPtl92.PwXX6ARs9Ostl.55/p893Q6qHnmGK1V5Fp8lF2S.m', '2026-09-30T21:55:38.385Z'),
  ('ee5ae37b-9d73-4bad-be43-df67b724d535', 'cris1@gmail.com', '$2a$10$2T5nVGWHmxROTumVj4YI2eae.5t7mBIA4vjaMYPxzlsNEtp4.nyyi', '2026-09-30T22:16:34.603Z'),
  ('94779849-d3cf-473b-878d-593f1aa65f7f', 'cris@habitik.com', '$2a$10$gGsKJHVuNNNv8kEDUFY7..RWa.nWayfRradlfcVtiUpVr.83x7aN2', '2026-09-30T22:37:11.238Z'),
  ('2dcf27ff-1597-4b93-b732-5e7a91273784', 'efra@habitik.com', '$2a$10$iwoAeN2N/iUM4eP0x4dTCu4Ohb.RCXFyGiFzjvCSjrjRageBX9EL.', '2026-09-30T23:03:15.817Z'),
  ('b833590c-94e6-4b82-af62-85fedb37584f', 'carlos@habitik.com', '$2a$10$4rVfkXspK7uv/xLLNvselO9TaNiJq65Ylt.GnjjXthHilFgv4Zkmq', '2026-09-30T23:26:28.179Z'),
  ('ad6baf06-89f8-4392-9f39-80b09900d270', 'christian', '$2a$10$TVFlrWy2g0NjHyEwSTPRY.35JVCP042hRA09pNl1OIpf35W5pDJve', '2026-10-01T20:40:52.639Z'),
  ('b67e8b2b-f88f-41fe-99ec-d550c970f817', 'cris2@gmail.com', '$2a$10$OhixbkB7FJXhYEHY.jLTw.YOByjTOZxeeCYRP3B3rwAqC45Z0ItWS', '2026-10-01T20:41:47.626Z'),
  ('c60ca6e9-04b3-47c6-856e-b2bd142d582c', 'carlo1@gmail.com', '$2a$10$qOFVLa60ASYMVLayuiwEJO3zivT7uQfcmXBxT4oweMKc9bgQIwin2', '2026-10-28T23:52:33.248Z'),
  ('e4420111-2be4-4355-a6ae-26ac667d21eb', 'cris3@gmail.com', '$2a$10$1H1ISn3VqHlF.WKAJvRX6uWG/WDzfNAH6sQzCGapENh2JGoPnG8HK', '2026-10-28T23:52:41.729Z'),
  ('c4d28a9a-77e8-463b-82f2-a8524a75c130', 'jefe_ehkf5o@test.com', '$2a$10$k1.HvVLqcJgx9qgMixBRZuA22DQdkzgmHCEcw94KD1QtzLFmbFic.', '2026-10-29T02:01:23.653Z'),
  ('80b84901-1a0a-474f-ac88-b21d42a70134', 'miembro_ehkf5o@test.com', '$2a$10$vweKmv6VXuD4dwTNkWuqf.nDqMVOXZdKOdOU6n7zdSy6fD6CK5vMG', '2026-10-29T02:01:25.140Z'),
  ('5cec490e-79e3-44f4-838a-cd408f580a72', 'jefe_ijde9e@test.com', '$2a$10$ZNqrBSxai.EDuQQB9Z.3we5D1bN2I4KH2ThwloB.vxGxITgIbnItW', '2026-10-29T02:01:43.074Z'),
  ('39b1e150-c19e-43b6-b2b6-1134d78ddc8d', 'miembro_ijde9e@test.com', '$2a$10$0L6YKjrvFSjgaKSM0bbCeOzYFsihFQYjQhpl3kYnCr26DC0dQC316', '2026-10-29T02:01:43.901Z'),
  ('3a79f383-4779-4acf-93e6-ecce2dcf718f', 'test_jefe_d9iom5@test.com', '$2a$10$dw5.CV0dzgcJ3veP3/W2he5XDN7VmmcNTRqWlvJ3LkgzOo9GYXXYa', '2026-10-29T02:09:19.330Z'),
  ('f232a23b-b9d4-4b43-b6ac-5514d271b344', 'test_miembro_d9iom5@test.com', '$2a$10$MA9mLtvov/C7TSFGblRBG.ZHqT317.0WjSyrYuZcGLsL/HHvn3lYu', '2026-10-29T02:09:21.578Z'),
  ('c81e63d7-1442-4fed-ae01-1242390af16a', 'test_jefe_mfvtga@test.com', '$2a$10$OO9lpaq9ptQ9d6rcyd/uuOg8KyzX0Ltx3Ioik1HT6fOK3k1KztlWK', '2026-10-29T02:09:46.244Z'),
  ('bcb3b9d4-eeaf-4bde-9f7b-9ad7ce00e5b8', 'test_miembro_mfvtga@test.com', '$2a$10$odPFOut6PAGSU4fhCnufNe4trR23wZ4P9vPvzSWIDvuT4NF41IigK', '2026-10-29T02:09:48.552Z'),
  ('45a8520f-c7e9-49dd-8660-e5522706c06a', 'test_jefe_3t04s8@test.com', '$2a$10$BycHGDGkPIFWIsIj/UFFs.LTf82kupcni6faJXsQJSiqJAH3v/pdi', '2026-10-29T02:17:30.211Z'),
  ('ccf1d0c4-a226-41b5-a288-d68a910316f6', 'test_miembro_3t04s8@test.com', '$2a$10$1FCMhUb1yfFUbhu2Szc35.nCe9NBdIBzylslXqdvdofWMCtJhfc8W', '2026-10-29T02:17:32.424Z'),
  ('a5851bf5-3a39-44dc-acf4-c8faefbbaa72', 'carolinailabaca2@gmail.com', '$2a$10$qmxKe28Ec0QMAG7JNmn93emASNhsPmIsFlqh69iRMslgj3Mc7DBPG', '2026-10-29T02:21:19.435Z'),
  ('7424f4d9-cabf-4f11-83a3-31671b69d2f0', 'test_debug_1793289676@test.com', '$2a$10$uK1glM0CEuF0mwMHrvjdsOWuUfkV7iQp0PZlgjNEvpFyvCWPVqrhK', '2026-10-29T16:00:54.198Z'),
  ('3e0693df-ca0a-4aa6-a2b0-7b418a948203', 'test_insp_1793289704@test.com', '$2a$10$Z6RTBKwuyhfk/OJpDnIvsegkFsUnxtp/BOPiMIj24AIwoI.1qOroq', '2026-10-29T16:01:21.869Z'),
  ('c247d02e-0723-42b7-8a44-880b65c6e05d', 'test_jefe_1793291196@test.com', '$2a$10$v7fIQe3FrNDsj49xUTTDduN4oGnt/g5jGA91dbiwdbC9Qli30EMem', '2026-10-29T16:26:14.386Z'),
  ('65727b15-1a16-4f3b-8d4a-3f245d62f5f2', 'benja2@habitik.com', '$2a$10$sxfTIB0HZWmE/PSNz/Lpd.T.BltZSgtNPiicXNvC2pliUCZrj1WNq', '2026-10-29T19:35:11.083Z'),
  ('60859a06-842d-4fc1-bfa7-266c6a3c4cd7', 'test_jefe_nw31fr@test.com', '$2a$10$EUUg3mL9zgeHYe991KJJA.DoRFVaFbwUWK3NkTnMUAxZw2qfMJHSm', '2026-10-29T21:38:24.628Z'),
  ('223d56df-f813-4abf-9934-1a98999c1668', 'test_miembro_nw31fr@test.com', '$2a$10$xa1QDFNtrz5rX5Mmp88LueeGyo9cXaNThRMY2ikH9ARZEVE1nUkyy', '2026-10-29T21:38:26.968Z'),
  ('33720f82-bb77-4c8e-9de3-6a982aa5083e', 'test_jefe_ip0z1r@test.com', '$2a$10$Hiwj4h1Gj1gv6YE8J/653O3Q/OBEJG93BLB8UASHU2GKsLtkEc/pO', '2026-10-29T21:46:53.618Z'),
  ('2472afd4-a922-4531-abae-51f06f627561', 'test_miembro_ip0z1r@test.com', '$2a$10$610dUiu3H1kzeJ09/ysAtuHw3ZUk8tiUaiwfyByO78eQK1nKTPPWy', '2026-10-29T21:46:55.816Z'),
  ('7e945795-f8f2-49bc-b46c-d76f2fe7c28c', 'cristobalzamoralazo2@gmail.com', '$2a$10$kYotXewZlbivfFW7653.9.rOQ16nIuL/cnn/FaG2QFpgMRwDCh9RO', '2026-10-29T23:35:25.390Z'),
  ('bd5856d5-6054-4847-b519-c1a024e6bfd7', 'bastianback@gmail.com', '$2a$10$jMDQJxkezXz5fs3yDOhIvet8XjTFio.PuHRQkuB81SWwIvfm/GX5W', '2026-10-30T01:54:05.901Z')
ON CONFLICT DO NOTHING;

-- Datos para public.profiles (20 filas)
INSERT INTO public.profiles (id, email, nombre, avatar, rol, family_id, xp, nivel, monedas, trivia_correct_count, trivia_last_updated, daily_bonus_claimed_at, onboarding_answers, created_at, ultima_actividad, racha_dias, ultimo_nivel_reclamado, telefono) VALUES
  ('ee5ae37b-9d73-4bad-be43-df67b724d535', 'cris1@gmail.com', 'Criszamora1', '{"url":null,"color":"#1E88E5","letra":"C"}'::jsonb, 'Jefe', 'ab092b3a-1e4a-49b5-ad16-1dbe61cf1d1d', 900, 2, 165, 0, NULL, NULL, '{"personasCount":4,"daily_tracking":{"2026-10-26":["speedrun_ducha"]},"tipoCalefaccion":"electrica","electrodomesticos":["lavadora","secadora"],"habitacionesCount":3}'::jsonb, '2026-09-30T22:16:34.603Z', '2026-10-26T03:00:00.000Z', 0, 1, NULL),
  ('e22ba49c-5fca-4b29-b56a-4d66264904a0', 'efra@gmail.com', 'efra', '{"url":null,"color":"#2e7d32","letra":"E"}'::jsonb, 'Jefe', 'ddc58f46-2379-405b-b85f-4f44850e777f', 4547, 10, 31, 55, '2026-10-27 15:02:57.774061+00', NULL, '{"personasCount":4,"tipoCalefaccion":"electrica","electrodomesticos":["lavadora","secadora"],"habitacionesCount":3}'::jsonb, '2026-09-23T23:58:06.213Z', '2026-10-30T03:00:00.000Z', 0, 1, NULL),
  ('ad6baf06-89f8-4392-9f39-80b09900d270', 'christian', 'Christian', '{"url":null,"color":"#2e7d32","letra":"C"}'::jsonb, 'Jefe', '2228e641-973f-4955-ac27-0b96ea526559', 460, 1, 200, 7, '2026-10-01 20:48:01.399791+00', NULL, '{"personasCount":4,"tipoCalefaccion":"electrica","electrodomesticos":["lavadora","secadora"],"habitacionesCount":3}'::jsonb, '2026-10-01T20:40:52.639Z', '2026-10-01T03:00:00.000Z', 0, 1, NULL),
  ('fbfe8f40-f773-4484-800a-9d64dd464e88', 'benja@habitik.com', 'Benja', '{"url":null,"color":"#1E88E5","letra":"B"}'::jsonb, 'Jefe', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 2910, 6, 65, 30, '2026-10-01 20:02:29.277658+00', NULL, '{"personasCount":4,"tipoCalefaccion":"electrica","electrodomesticos":["lavadora","secadora"],"habitacionesCount":3}'::jsonb, '2026-09-29T23:34:38.441Z', '2026-10-28T03:00:00.000Z', 0, 1, NULL),
  ('502636de-20d6-4644-aae5-ac70bec5db7a', 'caro@gmail.com', 'carolina', '{"url":null,"color":"#D81B60","letra":"C"}'::jsonb, 'Miembro', 'ddc58f46-2379-405b-b85f-4f44850e777f', 2450, 5, 73, 17, '2026-10-13 18:36:58.884175+00', NULL, '{"daily_tracking":{"2026-10-14":["speedrun_ducha"]},"frecuenciaReciclaje":"ocasional","tiempoDuchaPromedio":8,"horasPantallaDiarias":4}'::jsonb, '2026-09-24T15:12:48.843Z', '2026-10-28T03:00:00.000Z', 0, 1, NULL),
  ('ce4b9004-6723-46be-9096-0d3b261f76dd', 'bastian1@gmail.com', 'Bastian', '{"url":null,"color":"#2e7d32","letra":"B"}'::jsonb, 'Jefe', '1eec3da2-d030-457b-9c72-85e0b386c70d', 210, 1, 2, 1, '2026-10-23 23:06:08.817391+00', NULL, '{"personasCount":4,"tipoCalefaccion":"electrica","electrodomesticos":["lavadora","secadora"],"habitacionesCount":3}'::jsonb, '2026-09-23T23:57:27.450Z', '2026-10-23T03:00:00.000Z', 1, 1, NULL),
  ('2dcf27ff-1597-4b93-b732-5e7a91273784', 'efra@habitik.com', 'Efra', '{"url":null,"color":"#2e7d32","letra":"E"}'::jsonb, 'Miembro', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 100, 1, 4, 0, NULL, NULL, '{"frecuenciaReciclaje":"ocasional","tiempoDuchaPromedio":8,"horasPantallaDiarias":4}'::jsonb, '2026-09-30T23:03:15.817Z', '2026-09-30T03:00:00.000Z', 0, 1, NULL),
  ('5f0813c3-216e-4158-b1b9-af2abbb845d0', 'cristobal@habitik.com', 'Cristobal', '{"url":null,"color":"#2e7d32","letra":"C"}'::jsonb, 'Miembro', '03cf9667-b2f0-4b8e-bc0d-836451a302b3', 250, 1, 23, 0, NULL, NULL, '{"frecuenciaReciclaje":"siempre","tiempoDuchaPromedio":7,"horasPantallaDiarias":3}'::jsonb, '2026-09-22T13:36:28.140Z', '2026-09-22T03:00:00.000Z', 1, 1, NULL),
  ('b1c2e021-e2ae-4f88-a983-ec89916bf767', 'bastian@habitik.com', 'Bastian', '{"url":null,"color":"#2e7d32","letra":"B"}'::jsonb, 'Jefe', '03cf9667-b2f0-4b8e-bc0d-836451a302b3', 350, 1, 29, 0, NULL, NULL, '{"personasCount":4,"tipoCalefaccion":"electrica","electrodomesticos":["lavadora","refrigerador"],"habitacionesCount":3}'::jsonb, '2026-09-22T13:36:27.784Z', '2026-09-22T03:00:00.000Z', 1, 1, NULL),
  ('e4420111-2be4-4355-a6ae-26ac667d21eb', 'cris3@gmail.com', 'cristobalon', '{"url":null,"color":"#2e7d32","letra":"C"}'::jsonb, 'Miembro', '1bedfc88-505c-4998-a7fb-0f3b3848635c', 0, 1, 0, 0, NULL, NULL, '{}'::jsonb, '2026-10-28T23:52:41.729Z', NULL, 0, 1, NULL),
  ('b833590c-94e6-4b82-af62-85fedb37584f', 'carlos@habitik.com', 'Carlos', '{"url":null,"color":"#2e7d32","letra":"C"}'::jsonb, 'Miembro', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 540, 2, 86, 1, '2026-09-30 23:32:41.399956+00', NULL, '{"frecuenciaReciclaje":"ocasional","tiempoDuchaPromedio":8,"horasPantallaDiarias":4}'::jsonb, '2026-09-30T23:26:28.179Z', '2026-10-01T03:00:00.000Z', 0, 1, NULL),
  ('b67e8b2b-f88f-41fe-99ec-d550c970f817', 'cris2@gmail.com', 'cristobalon', '{"url":null,"color":"#2e7d32","letra":"C"}'::jsonb, 'Miembro', '2228e641-973f-4955-ac27-0b96ea526559', 840, 2, 7, 12, '2026-10-04 20:13:40.319944+00', NULL, '{"frecuenciaReciclaje":"ocasional","tiempoDuchaPromedio":8,"horasPantallaDiarias":4}'::jsonb, '2026-10-01T20:41:47.626Z', '2026-10-04T03:00:00.000Z', 0, 1, NULL),
  ('c60ca6e9-04b3-47c6-856e-b2bd142d582c', 'carlo1@gmail.com', 'carlo', '{"url":null,"color":"#2e7d32","letra":"C"}'::jsonb, 'Jefe', '1bedfc88-505c-4998-a7fb-0f3b3848635c', 0, 1, 0, 0, NULL, NULL, '{"personasCount":4,"tipoCalefaccion":"electrica","electrodomesticos":["lavadora","secadora"],"habitacionesCount":3}'::jsonb, '2026-10-28T23:52:33.248Z', NULL, 0, 1, NULL),
  ('a5851bf5-3a39-44dc-acf4-c8faefbbaa72', 'carolinailabaca2@gmail.com', 'carolina', '{"url":null,"color":"#2e7d32","letra":"C"}'::jsonb, 'Jefe', 'ca401ad9-93d7-44ce-962c-5bd49df843ed', 0, 1, 0, 0, NULL, NULL, '{"personasCount":4,"tipoCalefaccion":"electrica","electrodomesticos":["lavadora","secadora"],"habitacionesCount":3}'::jsonb, '2026-10-29T02:21:19.435Z', NULL, 0, 1, NULL),
  ('94779849-d3cf-473b-878d-593f1aa65f7f', 'cris@habitik.com', 'Cris', '{"url":null,"color":"#2e7d32","letra":"C"}'::jsonb, 'Miembro', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 350, 1, 45, 0, NULL, NULL, '{"frecuenciaReciclaje":"ocasional","tiempoDuchaPromedio":8,"horasPantallaDiarias":4}'::jsonb, '2026-09-30T22:37:11.238Z', '2026-10-27T03:00:00.000Z', 0, 1, NULL),
  ('87f66d69-5697-4dd4-bb84-42150e1db851', 'mati@habitik.com', 'Mati', '{"url":null,"color":"#2e7d32","letra":"M"}'::jsonb, 'Miembro', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 730, 2, 12, 5, '2026-10-23 01:06:23.691365+00', NULL, '{"frecuenciaReciclaje":"ocasional","tiempoDuchaPromedio":8,"horasPantallaDiarias":4}'::jsonb, '2026-09-30T21:55:38.385Z', '2026-10-27T03:00:00.000Z', 0, 1, NULL),
  ('65727b15-1a16-4f3b-8d4a-3f245d62f5f2', 'benja2@habitik.com', 'BenjaOCR', '{"url":null,"color":"#2e7d32","letra":"B"}'::jsonb, 'Jefe', '699b7be0-4e4f-49c7-83c0-9c204838b5cf', 0, 1, 0, 0, NULL, NULL, '{}'::jsonb, '2026-10-29T19:35:11.083Z', NULL, 0, 1, NULL),
  ('7e945795-f8f2-49bc-b46c-d76f2fe7c28c', 'cristobalzamoralazo2@gmail.com', 'Cristóbal Zamora', '{"url":null,"color":"#2e7d32","letra":"C"}'::jsonb, 'Jefe', 'eebd2f7d-156a-44da-8efb-e0c913e0bd8f', 0, 1, 0, 0, NULL, NULL, '{"personasCount":4,"tipoCalefaccion":"electrica","electrodomesticos":["lavadora","secadora"],"habitacionesCount":3}'::jsonb, '2026-10-29T23:35:25.390Z', NULL, 0, 1, NULL),
  ('bd5856d5-6054-4847-b519-c1a024e6bfd7', 'bastianback@gmail.com', 'BastianBack', '{"url":null,"color":"#2e7d32","letra":"B"}'::jsonb, 'Jefe', '6a127351-6385-439b-832a-98301d281f8a', 0, 1, 0, 0, NULL, NULL, '{"personasCount":4,"tipoCalefaccion":"electrica","electrodomesticos":["lavadora","secadora"],"habitacionesCount":3}'::jsonb, '2026-10-30T01:54:05.901Z', NULL, 0, 1, NULL),
  ('a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'cris@gmail.com', 'Criszamora13', '{"url":null,"color":"#546E7A","letra":"P"}'::jsonb, 'Miembro', 'ddc58f46-2379-405b-b85f-4f44850e777f', 1640, 4, 19, 4, '2026-10-01 20:29:11.199647+00', NULL, '{"daily_tracking":{"2026-09-29":["speedrun_ducha"]},"frecuenciaReciclaje":"ocasional","tiempoDuchaPromedio":12,"horasPantallaDiarias":4}'::jsonb, '2026-09-28T01:05:26.320Z', '2026-10-30T03:00:00.000Z', 0, 1, NULL)
ON CONFLICT DO NOTHING;

-- Datos para public.family_rewards (20 filas)
INSERT INTO public.family_rewards (id, family_id, titulo, descripcion, emoji, costo, disponible, creador_id, metadata, last_redeemed_at, created_at, es_familiar, estado, propuesto_por, fecha_propuesta) VALUES
  ('1', '03cf9667-b2f0-4b8e-bc0d-836451a302b3', 'Elegir la película', 'Recompensa de prueba individual', 'gift', 5, TRUE, 'b1c2e021-e2ae-4f88-a983-ec89916bf767', '{}'::jsonb, '2026-09-22T13:36:36.333Z', '2026-09-22T13:36:35.290Z', FALSE, 'activo', NULL, NULL),
  ('2', '03cf9667-b2f0-4b8e-bc0d-836451a302b3', 'Panorama familiar', 'Recompensa familiar de prueba', 'gift', 5, FALSE, 'b1c2e021-e2ae-4f88-a983-ec89916bf767', '{}'::jsonb, '2026-09-22T13:36:36.866Z', '2026-09-22T13:36:36.610Z', TRUE, 'activo', NULL, NULL),
  ('3', 'ab092b3a-1e4a-49b5-ad16-1dbe61cf1d1d', 'Elegir película', 'Derecho a elegir la película del fin de semana', '🍿', 30, TRUE, 'ee5ae37b-9d73-4bad-be43-df67b724d535', '{}'::jsonb, NULL, '2026-09-30T22:37:54.047Z', TRUE, 'activo', NULL, NULL),
  ('4', 'ab092b3a-1e4a-49b5-ad16-1dbe61cf1d1d', '1 hora de videojuegos', 'Tiempo libre para jugar en la PC o consola.', '🎮', 20, TRUE, 'ee5ae37b-9d73-4bad-be43-df67b724d535', '{"frecuencia":"semanal"}'::jsonb, '2026-09-30T23:14:21.285Z', '2026-09-30T23:06:55.500Z', FALSE, 'activo', NULL, NULL),
  ('6', 'ab092b3a-1e4a-49b5-ad16-1dbe61cf1d1d', '3 hora de videojuegos', 'Tiempo libre para jugar en la PC o consola.', '🎮', 20, TRUE, 'ee5ae37b-9d73-4bad-be43-df67b724d535', '{"frecuencia":"semanal"}'::jsonb, NULL, '2026-09-30T23:28:34.269Z', FALSE, 'activo', NULL, NULL),
  ('7', 'ab092b3a-1e4a-49b5-ad16-1dbe61cf1d1d', '3 hora de videojuegos', 'Tiempo libre para jugar en la PC o consola.', '🎮', 20, TRUE, 'ee5ae37b-9d73-4bad-be43-df67b724d535', '{"frecuencia":"semanal"}'::jsonb, '2026-09-30T23:35:03.847Z', '2026-09-30T23:34:58.569Z', FALSE, 'activo', NULL, NULL),
  ('8', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 'Pedir Pizza', 'Pizza familiar.', '🍕', 5, TRUE, 'fbfe8f40-f773-4484-800a-9d64dd464e88', '{"frecuencia":"semanal"}'::jsonb, '2026-10-01T05:44:52.384Z', '2026-10-01T02:46:12.760Z', TRUE, 'activo', NULL, NULL),
  ('10', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 'Ir al Cine', 'Salida al Cine', '🎁', 50, TRUE, 'fbfe8f40-f773-4484-800a-9d64dd464e88', '{"frecuencia":"mensual"}'::jsonb, NULL, '2026-10-01T06:01:54.173Z', TRUE, 'activo', NULL, NULL),
  ('5', 'ab092b3a-1e4a-49b5-ad16-1dbe61cf1d1d', '2 hora de videojuegos', 'Tiempo libre para jugar en la PC o consola.', '🎮', 20, TRUE, 'ee5ae37b-9d73-4bad-be43-df67b724d535', '{"frecuencia":"semanal"}'::jsonb, '2026-10-01T13:18:47.011Z', '2026-09-30T23:19:04.544Z', FALSE, 'activo', NULL, NULL),
  ('11', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 'Jardin Botanico', 'Salida al Jardin Botanico', '🎁', 10, TRUE, 'fbfe8f40-f773-4484-800a-9d64dd464e88', '{"frecuencia":"mensual"}'::jsonb, '2026-10-01T14:54:14.964Z', '2026-10-01T14:53:31.785Z', TRUE, 'activo', NULL, NULL),
  ('9', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 'Jugar sin tiempo limite,', 'Puedes jugar hasta la hora que quieras', '🛍️', 10, TRUE, 'fbfe8f40-f773-4484-800a-9d64dd464e88', '{}'::jsonb, '2026-10-01T15:13:55.766Z', '2026-10-01T05:44:23.761Z', FALSE, 'activo', NULL, NULL),
  ('14', '2228e641-973f-4955-ac27-0b96ea526559', 'ir al cine', '', '🎁', 200, TRUE, 'ad6baf06-89f8-4392-9f39-80b09900d270', '{"frecuencia":"mensual"}'::jsonb, NULL, '2026-10-01T20:51:23.267Z', TRUE, 'activo', NULL, NULL),
  ('15', '2228e641-973f-4955-ac27-0b96ea526559', '1 hora de juego', '', '🎁', 30, TRUE, 'ad6baf06-89f8-4392-9f39-80b09900d270', '{}'::jsonb, NULL, '2026-10-01T20:51:47.578Z', FALSE, 'activo', NULL, NULL),
  ('13', '2228e641-973f-4955-ac27-0b96ea526559', 'comer pizza', '', '🎁', 90, TRUE, 'ad6baf06-89f8-4392-9f39-80b09900d270', '{"frecuencia":"semanal"}'::jsonb, '2026-10-01T21:06:16.807Z', '2026-10-01T20:49:43.897Z', TRUE, 'activo', NULL, NULL),
  ('16', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'prueba', '', '🎁', 10, TRUE, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', '{}'::jsonb, '2026-10-15T23:37:02.392Z', '2026-10-15T23:36:55.598Z', FALSE, 'activo', NULL, NULL),
  ('17', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'prueba 2', 'adasd', '🎁', 30, TRUE, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', '{}'::jsonb, '2026-10-16T00:46:34.752Z', '2026-10-16T00:46:30.200Z', FALSE, 'activo', NULL, NULL),
  ('18', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'noche de pizza', 'noche de pizza con la familia', '🍕', 45, TRUE, 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', '{}'::jsonb, NULL, '2026-10-16T01:14:04.171Z', FALSE, 'activo', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', '2026-10-16T03:00:00.000Z'),
  ('19', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 'Noche de Peliculas', 'Ver peliculas en familia comiendo algo rico.', '🛋️', 110, TRUE, 'fbfe8f40-f773-4484-800a-9d64dd464e88', '{"frecuencia":"mensual"}'::jsonb, NULL, '2026-10-21T03:20:41.796Z', TRUE, 'activo', NULL, NULL),
  ('20', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 'Ir a un partido.', '', '⚽', 15, TRUE, '87f66d69-5697-4dd4-bb84-42150e1db851', '{}'::jsonb, NULL, '2026-10-21T04:13:44.677Z', FALSE, 'activo', '87f66d69-5697-4dd4-bb84-42150e1db851', '2026-10-21T03:00:00.000Z'),
  ('12', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'salida al cine', '', '🎁', 55, TRUE, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', '{"frecuencia":"unico"}'::jsonb, '2026-10-29T02:00:29.000Z', '2026-10-01T16:14:18.347Z', TRUE, 'activo', NULL, NULL)
ON CONFLICT DO NOTHING;

-- Datos para public.canjes (10 filas)
INSERT INTO public.canjes (id, reward_id, user_id, family_id, costo_pagado, created_at, estado, es_colecta, total_requerido, total_recaudado) VALUES
  ('66237c25-f4a7-47c6-b462-54e658539a76', '5', 'ee5ae37b-9d73-4bad-be43-df67b724d535', 'ab092b3a-1e4a-49b5-ad16-1dbe61cf1d1d', 20, '2026-10-01T13:18:47.011Z', 'aprobado', FALSE, 0, 0),
  ('fbb2d226-1ee8-40e8-ba96-653e9450e971', '8', 'b833590c-94e6-4b82-af62-85fedb37584f', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 5, '2026-10-01T05:44:52.384Z', 'aprobado', FALSE, 0, 0),
  ('5ed424be-2c38-49df-a66a-ae2d5c0ded0a', '11', 'b833590c-94e6-4b82-af62-85fedb37584f', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 10, '2026-10-01T14:54:14.964Z', 'rechazado', FALSE, 0, 0),
  ('bc863143-b4ea-434a-9304-4c3f0376fbfc', '9', 'b833590c-94e6-4b82-af62-85fedb37584f', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 10, '2026-10-01T15:13:55.766Z', 'aprobado', FALSE, 0, 0),
  ('170388f8-267c-4f6c-8765-3322c7cf5cb0', '17', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'ddc58f46-2379-405b-b85f-4f44850e777f', 30, '2026-10-16T00:46:34.752Z', 'rechazado', FALSE, 0, 0),
  ('0a5f136a-43b6-4ee5-b5d0-f8db36e01719', '8', 'fbfe8f40-f773-4484-800a-9d64dd464e88', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 1, '2026-10-21T04:08:04.186Z', 'recaudando', TRUE, 5, 1),
  ('78c257f6-eb82-4fb2-a8ee-d00119d409a4', '18', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'ddc58f46-2379-405b-b85f-4f44850e777f', 45, '2026-10-20T17:09:03.845Z', 'aprobado', FALSE, 0, 0),
  ('6ddf8190-c9df-4513-acc2-05f98cc59968', '17', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'ddc58f46-2379-405b-b85f-4f44850e777f', 30, '2026-10-20T17:09:28.077Z', 'aprobado', FALSE, 0, 0),
  ('3a6f88c4-a6fa-4e4b-a0b8-4ec208bc5330', '16', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'ddc58f46-2379-405b-b85f-4f44850e777f', 10, '2026-10-20T17:09:34.648Z', 'aprobado', FALSE, 0, 0),
  ('edeb9b77-fe27-4f14-b56b-1f2a9ef45f51', '12', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'ddc58f46-2379-405b-b85f-4f44850e777f', 55, '2026-10-16T01:39:56.933Z', 'completado', TRUE, 55, 55)
ON CONFLICT DO NOTHING;

-- Datos para public.canje_aportes (8 filas)
INSERT INTO public.canje_aportes (id, canje_id, user_id, monto_asignado, monto_pagado, pagado, pagado_en, created_at) VALUES
  ('8d908a05-2d1b-4d75-8f5b-513e4a45b26a', 'edeb9b77-fe27-4f14-b56b-1f2a9ef45f51', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 18, 18, TRUE, '2026-10-16T01:39:56.933Z', '2026-10-16T01:39:56.933Z'),
  ('4ff8f957-53b0-4e10-a070-211eb35934fa', '0a5f136a-43b6-4ee5-b5d0-f8db36e01719', '87f66d69-5697-4dd4-bb84-42150e1db851', 1, 0, FALSE, NULL, '2026-10-21T04:08:04.186Z'),
  ('74ec2a33-31d9-4358-a9d0-fb96b1b8443e', '0a5f136a-43b6-4ee5-b5d0-f8db36e01719', '94779849-d3cf-473b-878d-593f1aa65f7f', 1, 0, FALSE, NULL, '2026-10-21T04:08:04.186Z'),
  ('a3668d32-8c1e-46de-a8ed-733f25b422e6', '0a5f136a-43b6-4ee5-b5d0-f8db36e01719', '2dcf27ff-1597-4b93-b732-5e7a91273784', 1, 0, FALSE, NULL, '2026-10-21T04:08:04.186Z'),
  ('014f1442-8a17-4098-8100-84123a2554a2', '0a5f136a-43b6-4ee5-b5d0-f8db36e01719', 'b833590c-94e6-4b82-af62-85fedb37584f', 1, 0, FALSE, NULL, '2026-10-21T04:08:04.186Z'),
  ('51fc1b70-bef8-4e55-9841-bab59302d5fd', '0a5f136a-43b6-4ee5-b5d0-f8db36e01719', 'fbfe8f40-f773-4484-800a-9d64dd464e88', 1, 1, TRUE, '2026-10-21T04:08:04.186Z', '2026-10-21T04:08:04.186Z'),
  ('95471a31-747f-46ac-9f78-a1e165ad0209', 'edeb9b77-fe27-4f14-b56b-1f2a9ef45f51', '502636de-20d6-4644-aae5-ac70bec5db7a', 18, 18, TRUE, '2026-10-28T15:46:27.342Z', '2026-10-16T01:39:56.933Z'),
  ('a3eb8c27-9ce7-4dc9-92f5-24fd35c86de6', 'edeb9b77-fe27-4f14-b56b-1f2a9ef45f51', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 19, 19, TRUE, '2026-10-29T02:00:29.000Z', '2026-10-16T01:39:56.933Z')
ON CONFLICT DO NOTHING;

-- Datos para public.shower_logs (33 filas)
INSERT INTO public.shower_logs (id, user_id, duracion_segundos, estado, metadata, created_at, family_id, xp_otorgada, monedas_otorgadas, es_valido, iniciado_en, finalizado_en) VALUES
  ('351fbf9c-b80a-4537-b5a6-80b786541369', 'b1c2e021-e2ae-4f88-a983-ec89916bf767', 240, 'valido', '{}'::jsonb, '2026-09-22T13:36:31.777Z', '03cf9667-b2f0-4b8e-bc0d-836451a302b3', 200, 2, TRUE, NULL, NULL),
  ('90d4884c-6fca-4931-aa90-b300defbef3e', '5f0813c3-216e-4158-b1b9-af2abbb845d0', 400, 'valido', '{}'::jsonb, '2026-09-22T13:36:32.053Z', '03cf9667-b2f0-4b8e-bc0d-836451a302b3', 100, 1, TRUE, NULL, NULL),
  ('33c80d17-1d99-493c-896e-f6859bc9e701', '502636de-20d6-4644-aae5-ac70bec5db7a', 334, 'valido', '{}'::jsonb, '2026-09-24T15:40:44.907Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 100, 1, TRUE, NULL, NULL),
  ('b6ffe127-1e9d-41ec-af95-3ab6bd53a27b', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 180, 'valido', '{}'::jsonb, '2026-09-28T01:07:05.520Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 200, 2, TRUE, NULL, NULL),
  ('a6b05f17-d07f-4f64-985f-7382f36f9a17', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 180, 'valido', '{}'::jsonb, '2026-09-28T01:08:40.838Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 200, 2, TRUE, NULL, NULL),
  ('bab18053-410b-45ae-9874-b63d5b241e4a', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 180, 'valido', '{}'::jsonb, '2026-09-28T18:32:02.142Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 200, 2, TRUE, NULL, NULL),
  ('f67d0fcf-3b70-4300-a876-10dda9ae7d2f', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 180, 'valido', '{}'::jsonb, '2026-09-28T18:39:13.140Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 200, 2, TRUE, NULL, NULL),
  ('cf02d0aa-0527-49b4-85e8-43bdea5b91ed', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 180, 'valido', '{}'::jsonb, '2026-09-28T18:42:30.723Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 200, 2, TRUE, NULL, NULL),
  ('3934d809-fe6c-4375-a303-2d989a89b4b6', '502636de-20d6-4644-aae5-ac70bec5db7a', 281, 'valido', '{}'::jsonb, '2026-09-29T17:28:23.629Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 200, 2, TRUE, NULL, NULL),
  ('4782ce2d-108c-4c06-b333-b7e4444b5776', '502636de-20d6-4644-aae5-ac70bec5db7a', 180, 'valido', '{}'::jsonb, '2026-09-29T18:04:04.681Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 200, 2, TRUE, NULL, NULL),
  ('665d6c78-82b9-4680-8dd5-ddadcb74ea5b', '502636de-20d6-4644-aae5-ac70bec5db7a', 180, 'valido', '{}'::jsonb, '2026-09-29T18:04:18.249Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 200, 2, TRUE, NULL, NULL),
  ('d3574f13-5e26-4fe7-9673-eed62dfffb89', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 31, 'invalido', '{}'::jsonb, '2026-09-29T20:01:56.768Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 0, 0, TRUE, '2026-09-29T20:01:56.768Z', '2026-09-29T20:02:27.442Z'),
  ('246d96eb-efbc-4295-b35b-e9bf99f6d8b0', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 320, 'valido', '{}'::jsonb, '2026-09-29T20:08:40.982Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 0, 0, TRUE, '2026-09-29T20:08:40.982Z', '2026-09-29T20:14:00.725Z'),
  ('a4911197-6024-48e0-a80d-a60d2b1a0af9', '502636de-20d6-4644-aae5-ac70bec5db7a', 4, 'invalido', '{}'::jsonb, '2026-10-01T13:36:49.375Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 0, 0, TRUE, '2026-10-01T13:36:49.375Z', '2026-10-01T13:36:53.080Z'),
  ('2a679865-f809-409f-8501-a5566d588f0c', '502636de-20d6-4644-aae5-ac70bec5db7a', 15, 'invalido', '{}'::jsonb, '2026-10-01T17:32:01.420Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 0, 0, TRUE, '2026-10-01T17:32:01.420Z', '2026-10-01T17:32:15.932Z'),
  ('4f70f87e-81db-4b25-92b5-4ffbe3f54863', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 9, 'invalido', '{}'::jsonb, '2026-10-01T19:40:19.068Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 0, 0, TRUE, '2026-10-01T19:40:19.068Z', '2026-10-01T19:40:27.904Z'),
  ('3886abb2-2220-4ab7-9c7e-ee560294db26', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 7, 'invalido', '{}'::jsonb, '2026-10-01T19:41:47.715Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 0, 0, TRUE, '2026-10-01T19:41:47.715Z', '2026-10-01T19:41:54.357Z'),
  ('ed677846-2c2d-487e-a96f-c420a220b2f1', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 8, 'invalido', '{}'::jsonb, '2026-10-01T19:45:53.076Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 0, 0, TRUE, '2026-10-01T19:45:53.076Z', '2026-10-01T19:46:01.281Z'),
  ('01aef294-490e-4899-8ec3-8540be1fcffa', 'b67e8b2b-f88f-41fe-99ec-d550c970f817', 0, 'en_proceso', '{}'::jsonb, '2026-10-02T01:01:29.245Z', '2228e641-973f-4955-ac27-0b96ea526559', 0, 0, TRUE, '2026-10-02T01:01:29.245Z', NULL),
  ('9b357df1-e2a9-4dc8-9f9e-4359227b9e32', 'b67e8b2b-f88f-41fe-99ec-d550c970f817', 4, 'invalido', '{}'::jsonb, '2026-10-02T01:01:29.668Z', '2228e641-973f-4955-ac27-0b96ea526559', 0, 0, TRUE, '2026-10-02T01:01:29.668Z', '2026-10-02T01:01:34.007Z'),
  ('6eaadee0-b456-4a75-af26-c598bfd59113', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 42, 'invalido', '{}'::jsonb, '2026-10-07T16:31:41.246Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 0, 0, TRUE, '2026-10-07T16:31:41.246Z', '2026-10-07T16:32:23.085Z'),
  ('c772495b-6114-4af8-b0b6-83b4eb729691', '502636de-20d6-4644-aae5-ac70bec5db7a', 631, 'valido', '{}'::jsonb, '2026-10-14T14:49:59.802Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 0, 0, TRUE, '2026-10-14T14:49:59.802Z', '2026-10-14T15:00:30.884Z'),
  ('f219f38b-9835-4608-ba2f-c3cdc9d51d64', '502636de-20d6-4644-aae5-ac70bec5db7a', 5, 'invalido', '{}'::jsonb, '2026-10-14T15:06:47.306Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 0, 0, TRUE, '2026-10-14T15:06:47.306Z', '2026-10-14T15:06:51.857Z'),
  ('4d868e33-db97-46c6-a58a-2574ad01590a', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 9, 'invalido', '{}'::jsonb, '2026-10-19T21:08:57.940Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 0, 0, TRUE, '2026-10-19T21:08:57.940Z', '2026-10-19T21:09:06.514Z'),
  ('8af822cf-2bf4-4ffb-8633-dc0b4f41fb7a', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 10, 'invalido', '{}'::jsonb, '2026-10-20T17:10:10.139Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 0, 0, TRUE, '2026-10-20T17:10:10.139Z', '2026-10-20T17:10:20.513Z'),
  ('5dd1d601-c7e3-41d8-aebe-625bd2381740', 'ee5ae37b-9d73-4bad-be43-df67b724d535', 219, 'valido', '{}'::jsonb, '2026-10-26T19:13:55.208Z', 'ab092b3a-1e4a-49b5-ad16-1dbe61cf1d1d', 0, 0, TRUE, '2026-10-26T19:13:55.208Z', '2026-10-26T19:17:34.501Z'),
  ('e94a7243-1570-4142-8401-a48c62639ee1', 'ee5ae37b-9d73-4bad-be43-df67b724d535', 291, 'valido', '{}'::jsonb, '2026-10-26T19:18:05.065Z', 'ab092b3a-1e4a-49b5-ad16-1dbe61cf1d1d', 0, 0, TRUE, '2026-10-26T19:18:05.065Z', '2026-10-26T19:22:56.510Z'),
  ('3a2e49c5-0c72-43f9-945d-551c704c1a3f', 'ee5ae37b-9d73-4bad-be43-df67b724d535', 193, 'invalido', '{}'::jsonb, '2026-10-26T20:26:07.290Z', 'ab092b3a-1e4a-49b5-ad16-1dbe61cf1d1d', 0, 0, FALSE, '2026-10-26T20:26:07.290Z', '2026-10-26T20:29:20.720Z'),
  ('9f32c127-75e1-4007-ae1a-039c2ea8c7c8', 'ee5ae37b-9d73-4bad-be43-df67b724d535', 265, 'valido', '{}'::jsonb, '2026-10-26T20:29:31.120Z', 'ab092b3a-1e4a-49b5-ad16-1dbe61cf1d1d', 200, 2, TRUE, '2026-10-26T20:29:31.120Z', '2026-10-26T20:33:56.692Z'),
  ('8b8fb9a0-a7d0-44cc-91cd-7a44ca54ded9', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 207, 'invalido', '{}'::jsonb, '2026-10-27T15:03:33.417Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 0, 0, FALSE, '2026-10-27T15:03:33.417Z', '2026-10-27T15:07:00.918Z'),
  ('3e2c27f7-e227-4f57-9dfe-23731f7c26bf', 'fbfe8f40-f773-4484-800a-9d64dd464e88', 187, 'invalido', '{}'::jsonb, '2026-10-27T16:44:44.677Z', NULL, 0, 0, FALSE, '2026-10-27T16:44:44.677Z', '2026-10-27T16:47:52.472Z'),
  ('885b0d06-682a-4f44-9563-f303437f00d0', 'fbfe8f40-f773-4484-800a-9d64dd464e88', 250, 'valido', '{}'::jsonb, '2026-10-27T16:48:24.012Z', NULL, 200, 2, TRUE, '2026-10-27T16:48:24.012Z', '2026-10-27T16:52:34.124Z'),
  ('ea0eb7e1-d548-4280-a336-d0a616da12bc', 'ad6baf06-89f8-4392-9f39-80b09900d270', 214, 'invalido', '{}'::jsonb, '2026-10-27T23:17:51.967Z', NULL, 0, 0, FALSE, '2026-10-27T23:17:51.967Z', '2026-10-27T23:21:26.225Z')
ON CONFLICT DO NOTHING;

-- Datos para public.inspeccion_evidencias (11 filas)
INSERT INTO public.inspeccion_evidencias (id, family_id, user_id, titulo_mision, foto_url, estado, motivo_rechazo, xp_otorgada, monedas_otorgadas, created_at, validated_at) VALUES
  ('0d560eb5-da4f-487e-86ff-cceb3b5c321a', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'Inspección de luces y enchufes', 'https://backendhabitik-production-dd43.up.railway.app/uploads/inspecciones/inspeccion_a0d856d8-8e83-4ea0-a08b-c1d87ecd3838_1793302468099.jpg', 'rechazado', 'no se ve', 80, 4, '2026-10-29T19:34:28.151Z', '2026-10-29T19:36:14.233Z'),
  ('82baa052-d1ce-4efb-b021-55849ca4e4f5', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'Inspección de luces y enchufes', 'http://backendhabitik-production-dd43.up.railway.app/uploads/inspecciones/inspeccion_a0d856d8-8e83-4ea0-a08b-c1d87ecd3838_1793292994163.jpg', 'rechazado', 'la mando nuevamente', 80, 4, '2026-10-29T16:56:34.256Z', '2026-10-29T19:36:20.932Z'),
  ('48bff546-1b37-40e1-a2bb-3932eb1ae8a8', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'Inspección de luces y enchufes', 'http://backendhabitik-production-dd43.up.railway.app/uploads/inspecciones/inspeccion_a0d856d8-8e83-4ea0-a08b-c1d87ecd3838_1793290961711.jpg', 'rechazado', 's', 80, 4, '2026-10-29T16:22:41.791Z', '2026-10-29T19:36:28.250Z'),
  ('9782e009-4a3f-487e-9cfc-96e7563d512a', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'Inspección de luces y enchufes', 'http://backendhabitik-production-dd43.up.railway.app/uploads/inspecciones/inspeccion_a0d856d8-8e83-4ea0-a08b-c1d87ecd3838_1793291052259.jpg', 'aprobado', NULL, 80, 4, '2026-10-29T16:24:12.364Z', '2026-10-29T19:36:30.232Z'),
  ('04e6cbd9-6ac6-411f-857d-f1bfd831074f', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'Inspección de luces y enchufes', 'http://backendhabitik-production-dd43.up.railway.app/uploads/inspecciones/inspeccion_a0d856d8-8e83-4ea0-a08b-c1d87ecd3838_1793292866379.jpg', 'rechazado', 'Evidencia no cumple con los requisitos', 80, 4, '2026-10-29T16:54:26.477Z', '2026-10-29T19:36:33.684Z'),
  ('fd9dd3cb-71fe-4cd4-b5fb-9039169e3c9e', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'Inspección de luces y enchufes', 'https://backendhabitik-production-dd43.up.railway.app/uploads/inspecciones/inspeccion_fbfe8f40-f773-4484-800a-9d64dd464e88_1793308971899.jpg', 'rechazado', 'Evidencia no cumple con los requisitos', 80, 4, '2026-10-29T21:22:52.006Z', '2026-10-29T22:26:46.673Z'),
  ('7d524231-2509-47da-8290-25612eb02ec1', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'Inspección de luces y enchufes', 'https://backendhabitik-production-dd43.up.railway.app/uploads/inspecciones/inspeccion_fbfe8f40-f773-4484-800a-9d64dd464e88_1793322810687.jpg', 'aprobado', NULL, 80, 4, '2026-10-30T01:13:30.828Z', '2026-10-30T01:14:55.410Z'),
  ('36bf38d1-594f-432e-801e-3fbfdb2d2994', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'Inspección de luces y enchufes', 'https://backendhabitik-production-dd43.up.railway.app/uploads/inspecciones/inspeccion_e22ba49c-5fca-4b29-b56a-4d66264904a0_1793325602726.jpg', 'aprobado', NULL, 80, 4, '2026-10-30T02:00:02.783Z', '2026-10-30T02:00:17.987Z'),
  ('f8e9eba4-f0ae-43c5-b6b7-0e84bd54ca5b', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'Inspección de luces y enchufes', 'https://backendhabitik-production-dd43.up.railway.app/uploads/inspecciones/inspeccion_a0d856d8-8e83-4ea0-a08b-c1d87ecd3838_1793329306280.jpg', 'aprobado', NULL, 80, 4, '2026-10-30T03:01:46.483Z', '2026-10-30T03:03:25.562Z'),
  ('ef792cb4-a0d5-4394-9142-27c3e6bc6936', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'Inspección de luces y enchufes', 'https://backendhabitik-production-dd43.up.railway.app/uploads/inspecciones/inspeccion_a0d856d8-8e83-4ea0-a08b-c1d87ecd3838_1793307747249.jpg', 'rechazado', 'no se ve', 80, 4, '2026-10-29T21:02:27.349Z', '2026-10-30T03:09:23.577Z'),
  ('13431f22-b859-4685-a2d6-cb4928ac2159', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'Inspección de luces y enchufes', 'https://backendhabitik-production-dd43.up.railway.app/uploads/inspecciones/inspeccion_a0d856d8-8e83-4ea0-a08b-c1d87ecd3838_1793330126801.jpg', 'aprobado', NULL, 80, 4, '2026-10-30T03:15:27.026Z', '2026-10-30T03:16:48.095Z')
ON CONFLICT DO NOTHING;

-- Datos para public.ecological_words (57 filas)
INSERT INTO public.ecological_words (id, palabra, pista) VALUES
  (1, 'RECICLA', 'Someter un material usado a un proceso para poder recuperarlo y reutilizarlo.'),
  (2, 'COMPOST', 'Abono orgánico natural obtenido de la descomposición controlada de residuos.'),
  (3, 'HUMEDAL', 'Zona de tierras inundadas que actúa como filtro natural y refugio de vida.'),
  (4, 'PLANETA', 'Cuerpo celeste que habitamos y debemos proteger de la contaminación global.'),
  (5, 'ENERGIA', 'Capacidad de generar trabajo o luz, idealmente obtenida de fuentes limpias.'),
  (6, 'RESIDUO', 'Material que queda como desecho pero que puede ser valorizado o reciclado.'),
  (7, 'BATERIA', 'Dispositivo acumulador de energía que requiere manejo especial de residuos.'),
  (8, 'ESPECIE', 'Conjunto de organismos semejantes capaces de reproducirse entre sí.'),
  (9, 'HABITAT', 'Espacio que reúne las condiciones adecuadas para que una especie viva.'),
  (10, 'ECOLOGO', 'Profesional o persona dedicada al estudio y protección del medio ambiente.'),
  (11, 'PLANTAS', 'Seres vivos vegetales que producen oxígeno y sustentan los ecosistemas.'),
  (12, 'ANIMAL', 'Ser vivo sintiente que forma parte fundamental de la biodiversidad.'),
  (13, 'BOSQUE', 'Ecosistema poblado de árboles que purifica el aire y regula el clima.'),
  (14, 'BASURA', 'Desperdicios generados por la actividad humana que deben separarse.'),
  (15, 'TIERRA', 'Suelo fértil y planeta que nos sustenta, el cual debemos cuidar.'),
  (16, 'VIENTO', 'Corriente de aire natural aprovechada para generar energía renovable.'),
  (17, 'LLUVIA', 'Precipitación pluvial vital para reponer los recursos hídricos dulces.'),
  (18, 'OCEANO', 'Inmensa masa de agua salada que cubre la mayor parte del planeta.'),
  (19, 'HUERTO', 'Espacio cultivado con vegetales y hortalizas de forma orgánica y local.'),
  (20, 'HIERBA', 'Vegetación baja que forma parte de la cobertura natural de los suelos.'),
  (21, 'MADERA', 'Material forestal renovable cuyo aprovechamiento debe ser responsable.'),
  (22, 'VIDRIO', 'Material 100% reciclable que se funde infinitas veces sin perder calidad.'),
  (23, 'FRUTOS', 'Alimentos naturales producidos por las plantas silvestres y cultivadas.'),
  (24, 'AHORRO', 'Acción consciente de no desperdiciar recursos vitales como agua y luz.'),
  (25, 'FAUNA', 'Conjunto de animales propios de una región o ecosistema natural.'),
  (26, 'FLORA', 'Conjunto de plantas nativas que pueblan un territorio determinado.'),
  (27, 'CLIMA', 'Patrón atmosférico a largo plazo que debemos proteger del calentamiento.'),
  (28, 'OZONO', 'Gas estratosférico que bloquea la dañina radiación ultravioleta del sol.'),
  (29, 'SOLAR', 'Energía limpia capturada directamente a partir de la radiación del sol.'),
  (30, 'RIEGO', 'Sistema para aportar agua de manera eficiente a los cultivos locales.'),
  (31, 'ABONO', 'Sustancia natural o compuesta que enriquece los nutrientes del suelo.'),
  (32, 'METAL', 'Material resistente y altamente reciclable recuperable en puntos limpios.'),
  (33, 'PAPEL', 'Derivado de celulosa cuyo reciclaje previene la tala de árboles.'),
  (34, 'PILAS', 'Elementos contaminantes peligrosos que exigen un reciclaje diferenciado.'),
  (35, 'VERDE', 'Tono emblemático que identifica la sustentabilidad y la naturaleza.'),
  (36, 'BIOMA', 'Gran comunidad ecológica adaptada a las condiciones de su región.'),
  (37, 'AGUAS', 'Caudales y fuentes líquidas indispensables que exigen pureza y cuidado.'),
  (38, 'HONGO', 'Organismo descomponedor fundamental para la salud y fertilidad de los suelos naturales.'),
  (39, 'FRUTAL', 'Árbol que produce frutos comestibles y protege el entorno natural local.'),
  (40, 'PARQUE', 'Área verde protegida destinada a la conservación ambiental y la recreación.'),
  (41, 'CONSUMO', 'Utilización de bienes y energía que debe ser consciente y responsable.'),
  (42, 'TERMICO', 'Aislamiento que optimiza la temperatura y reduce el gasto energético en casa.'),
  (43, 'NATURAL', 'Que procede de la naturaleza sin alteraciones artificiales dañinas.'),
  (44, 'VALLES', 'Llanuras entre montañas recorridas por ríos y con rica biodiversidad.'),
  (45, 'PLUVIAL', 'Relativo a las precipitaciones y la gestión eficiente del agua de lluvia.'),
  (46, 'TUNDRA', 'Bioma frío de vegetación baja caracterizado por su suelo congelado.'),
  (47, 'ESTEPA', 'Bioma de llanuras herbáceas con clima seco y vegetación resistente.'),
  (48, 'MANGLAR', 'Ecosistema costero de árboles tolerantes al agua salada que protege las costas.'),
  (49, 'BIOTICO', 'Factor o elemento vivo que integra y da dinamismo a un ecosistema.'),
  (50, 'LATAS', 'Envases metálicos ligeros que se pueden reciclar infinitas veces.')
ON CONFLICT DO NOTHING;

INSERT INTO public.ecological_words (id, palabra, pista) VALUES
  (51, 'CARTON', 'Material celulósico reciclable que evita la tala excesiva de árboles.'),
  (52, 'ENVASE', 'Recipiente comercial que debe ser segregado correctamente para reciclar.'),
  (53, 'BOTELLA', 'Recipiente de vidrio o plástico apto para procesos de recuperación limpia.'),
  (54, 'CUIDAR', 'Proteger y mantener los recursos ambientales en óptimas condiciones.'),
  (55, 'SALVAR', 'Acción de rescatar y preservar la biodiversidad y los hábitats en peligro.'),
  (56, 'DIQUE', 'Barrera natural o artificial para gestionar y contener flujos hídricos.'),
  (57, 'FAUNA', 'Conjunto de animales silvestres que habitan en una región ecológica.')
ON CONFLICT DO NOTHING;

-- Datos para public.wordle_attempts (53 filas)
INSERT INTO public.wordle_attempts (id, user_id, fecha, intentos, estado, pista_revelada) VALUES
  ('bdc67aaf-939a-4881-9117-e8fe4ca650df', '94779849-d3cf-473b-878d-593f1aa65f7f', '2026-10-26T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('5b40617e-ca2e-4bcc-ac0d-62955267f72e', 'fbfe8f40-f773-4484-800a-9d64dd464e88', '2026-10-26T03:00:00.000Z', '["ARBOLES","SURCOPI","RISTGOR","RESIDUO"]'::jsonb, 'ganado', FALSE),
  ('14bfd4ff-2aa7-4a59-8fc5-d56e5603d346', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', '2026-09-28T03:00:00.000Z', '["RECICLAJE"]'::jsonb, 'ganado', TRUE),
  ('a5c7088d-b97b-47c6-ad52-fd99183672d1', 'fbfe8f40-f773-4484-800a-9d64dd464e88', '2026-10-19T03:00:00.000Z', '["ARBOL","VERDE","DIUGI","DITHJ","FCPSF","DIQUE"]'::jsonb, 'ganado', FALSE),
  ('3b401df9-6a2f-43dc-96d8-4863714ff301', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', '2026-10-25T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('20203fc6-66df-49c7-b83e-2a1cfb04767d', 'b67e8b2b-f88f-41fe-99ec-d550c970f817', '2026-10-01T03:00:00.000Z', '["HONGA","HONGO"]'::jsonb, 'ganado', FALSE),
  ('dce91933-e0e1-4121-b80f-1002d317ab6d', '502636de-20d6-4644-aae5-ac70bec5db7a', '2026-10-20T03:00:00.000Z', '["AEIOU","FUNAR","FAUNA"]'::jsonb, 'ganado', FALSE),
  ('c0bb3acf-e128-4b7b-8185-95b426fe0f61', '502636de-20d6-4644-aae5-ac70bec5db7a', '2026-09-30T03:00:00.000Z', '["AGUAS"]'::jsonb, 'ganado', FALSE),
  ('c28bc90a-e084-45d3-a933-cfc3e714fbd1', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', '2026-10-01T03:00:00.000Z', '["AGUAS","HONGO"]'::jsonb, 'ganado', TRUE),
  ('c5973b79-9b3b-4349-9be2-4d1a6ddec912', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', '2026-10-29T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('b01bf67b-753f-4dbc-844c-ddf87cf4535f', 'fbfe8f40-f773-4484-800a-9d64dd464e88', '2026-10-25T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('6103c996-c648-4659-b56b-41afeaa2d3b3', '94779849-d3cf-473b-878d-593f1aa65f7f', '2026-09-29T03:00:00.000Z', '["ARBOL","BOLSA","BALON","BIOMA"]'::jsonb, 'ganado', FALSE),
  ('99c628ee-98f7-4d21-95c1-81042490f491', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', '2026-09-29T03:00:00.000Z', '["RECICLAJEDFXQ"]'::jsonb, 'en_proceso', TRUE),
  ('87d2967d-ac7b-41d9-8394-4c25bd3317ed', 'fbfe8f40-f773-4484-800a-9d64dd464e88', '2026-10-27T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('048fceae-f25e-4a60-8185-0a9a2a01d879', 'b67e8b2b-f88f-41fe-99ec-d550c970f817', '2026-10-03T03:00:00.000Z', '["CAMILO","PARQUE"]'::jsonb, 'ganado', TRUE),
  ('ba50d0e2-9c3d-4497-ad2d-c092d48e1cbf', 'ad6baf06-89f8-4392-9f39-80b09900d270', '2026-10-26T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('9114042f-cdb1-4598-a249-476a0f10b8a3', '87f66d69-5697-4dd4-bb84-42150e1db851', '2026-10-19T03:00:00.000Z', '["ARBOL","VERDE","FUEGO","DUQUE","DIQUE"]'::jsonb, 'ganado', FALSE),
  ('024a6702-081a-4dd8-a35e-0889e0f14dae', 'a5851bf5-3a39-44dc-acf4-c8faefbbaa72', '2026-10-28T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('cf561054-be9c-4bf4-979c-ff76f22b5399', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', '2026-10-20T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('6facc28e-8fdb-4ded-9759-ab730329ffb9', 'b833590c-94e6-4b82-af62-85fedb37584f', '2026-09-30T03:00:00.000Z', '["BIOMA","AGUAS"]'::jsonb, 'ganado', TRUE),
  ('f7446b0c-89c6-4649-88dc-7725b9150ce3', '2dcf27ff-1597-4b93-b732-5e7a91273784', '2026-09-29T03:00:00.000Z', '["BALON","VOLAR","BIOMA"]'::jsonb, 'ganado', FALSE),
  ('20d5ab30-e28f-4cb0-ad96-879d4da8b9c5', 'fbfe8f40-f773-4484-800a-9d64dd464e88', '2026-09-29T03:00:00.000Z', '["RECICLOOOOOOO","RECICLADORAAA","JUGAR","VITAL","REINO","GERIA"]'::jsonb, 'perdido', FALSE),
  ('4e7e3dec-f615-4755-948d-30ae12e405e3', '502636de-20d6-4644-aae5-ac70bec5db7a', '2026-10-27T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('6d1876b0-9b33-4286-84ce-33268c105fd5', 'b833590c-94e6-4b82-af62-85fedb37584f', '2026-09-29T03:00:00.000Z', '["BALON","BIOMA"]'::jsonb, 'ganado', TRUE),
  ('fed01c0a-87d8-40f7-9bb5-85577aec6cab', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', '2026-10-06T03:00:00.000Z', '["TRAMAST","FRUTASO","AAAAAAA","UUUUUUU","TAGULSH","NATURAL"]'::jsonb, 'ganado', TRUE),
  ('a0780288-cd90-4225-a1a2-1f5e8c2aaa84', 'fbfe8f40-f773-4484-800a-9d64dd464e88', '2026-09-30T03:00:00.000Z', '["BIOMA","AGUAS"]'::jsonb, 'ganado', FALSE),
  ('b662293d-1462-47cb-b299-8408cd82fc91', '87f66d69-5697-4dd4-bb84-42150e1db851', '2026-09-29T03:00:00.000Z', '["ARBOL","BANCO","BOMBA","BIOMA"]'::jsonb, 'ganado', FALSE),
  ('dd9e4bdc-1a2a-4d70-b037-d4ab2ed20826', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', '2026-10-08T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('95a4911c-8cab-43b5-94f9-6be9c2d50be0', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', '2026-10-28T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('6130f660-4246-4f67-b00c-ca95198ee4b1', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', '2026-09-30T03:00:00.000Z', '["CHILE","AGUAS"]'::jsonb, 'ganado', FALSE),
  ('0f1fcff9-b9f3-46e2-b850-070f59896b24', '87f66d69-5697-4dd4-bb84-42150e1db851', '2026-10-26T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('30cf8d23-74bf-4cca-8148-950f32dad112', 'ad6baf06-89f8-4392-9f39-80b09900d270', '2026-09-30T03:00:00.000Z', '["ARBOL","AGUAS"]'::jsonb, 'ganado', FALSE),
  ('02569c52-e35e-4c57-b01a-b1993e606e36', '502636de-20d6-4644-aae5-ac70bec5db7a', '2026-10-12T03:00:00.000Z', '["AMARILO","CUSDFGH","QWETYPJ","KZXVBNÑ"]'::jsonb, 'en_proceso', FALSE),
  ('d767b574-7816-44dd-be8d-84d767f963d2', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', '2026-09-30T03:00:00.000Z', '["VIVIR","ALTOS","AUTOS","AGUAS"]'::jsonb, 'ganado', TRUE),
  ('7b300990-55ac-406e-8066-7c60aaeb02b8', '502636de-20d6-4644-aae5-ac70bec5db7a', '2026-10-13T03:00:00.000Z', '["AGUAS"]'::jsonb, 'en_proceso', FALSE),
  ('a449c1eb-011d-4abd-af16-42deeb2b02ae', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', '2026-10-13T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('7e631514-9963-4718-b044-63237f2d3fb8', 'bd5856d5-6054-4847-b519-c1a024e6bfd7', '2026-10-29T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('d629294a-9d11-47fd-8905-8202896d3ea8', '87f66d69-5697-4dd4-bb84-42150e1db851', '2026-10-22T03:00:00.000Z', '["ARBOLES","SDGKHJÑ","FXCVXTY","UIOPMNE","QWSXKLP","COMPOST"]'::jsonb, 'ganado', TRUE),
  ('7e03e4e2-cc1c-4750-b522-f8cad4474e5d', '502636de-20d6-4644-aae5-ac70bec5db7a', '2026-10-29T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('946c363e-2eb8-4e89-9d22-9a12a3842bb8', 'fbfe8f40-f773-4484-800a-9d64dd464e88', '2026-10-22T03:00:00.000Z', '["ARBOLES","POSFUTI","SOTOPOC","COSTOPO","COSTOPO","COPSONS"]'::jsonb, 'perdido', FALSE),
  ('c0f38187-62c1-472d-bd01-bd68eea1427e', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', '2026-10-26T03:00:00.000Z', '["PALABRA","RENOVAN","REUTILA","RESIDUO"]'::jsonb, 'ganado', TRUE),
  ('3dacc83d-6a94-4ab7-a4de-63a4a48f8c0b', '94779849-d3cf-473b-878d-593f1aa65f7f', '2026-10-22T03:00:00.000Z', '["COLHDJD","COMPOST"]'::jsonb, 'ganado', FALSE),
  ('4d9a83ae-fcc3-4899-881e-3ac820d27616', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', '2026-10-29T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('c0db9c30-39c5-48fd-9ea5-6e77b6614234', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', '2026-10-27T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('eaf8903f-cc16-466a-8440-c19f691a595e', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', '2026-10-27T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('eaf2e857-e46d-427a-87b8-8c409ecdfe22', '2dcf27ff-1597-4b93-b732-5e7a91273784', '2026-10-27T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('a4f1435d-6ac5-42f2-bde0-e723c3358214', '94779849-d3cf-473b-878d-593f1aa65f7f', '2026-10-27T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('db75dff0-229b-4454-8d35-0d7b89b501fb', '87f66d69-5697-4dd4-bb84-42150e1db851', '2026-10-27T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('f3b850d1-eeb7-4b7a-99b7-4623bd7b90a4', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', '2026-10-28T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('5c4271af-4873-457b-b4b6-f1e57b73144d', 'fbfe8f40-f773-4484-800a-9d64dd464e88', '2026-10-28T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE)
ON CONFLICT DO NOTHING;

INSERT INTO public.wordle_attempts (id, user_id, fecha, intentos, estado, pista_revelada) VALUES
  ('3c0794f8-28c5-476e-a58d-85a36dbfd8ed', 'fbfe8f40-f773-4484-800a-9d64dd464e88', '2026-10-29T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('0c3a4cd6-4ab6-490e-a714-7526e809dae0', '7e945795-f8f2-49bc-b46c-d76f2fe7c28c', '2026-10-28T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE),
  ('f559d0e8-86e0-4707-bbea-093d10d6e775', '7e945795-f8f2-49bc-b46c-d76f2fe7c28c', '2026-10-29T03:00:00.000Z', '[]'::jsonb, 'en_proceso', FALSE)
ON CONFLICT DO NOTHING;

-- Datos para public.trivia_questions (50 filas)
INSERT INTO public.trivia_questions (id, pregunta, alternativas, correct_index, explicacion, categoria, dificultad, fuente, fingerprint, veces_usada, ultima_vez_usada, created_at, dato_curioso) VALUES
  ('0850d7df-08be-42a1-bfbc-2785849c7cc6', '¿Qué indica una etiqueta de eficiencia energética con clasificación A?', '["Mayor ruido","Menor eficiencia","Mayor tamaño","Alta eficiencia"]'::jsonb, 3, 'La clasificación A identifica equipos que aprovechan mejor la energía.', 'energia', 'facil', 'curada', '3e292bf0e51f72183fb7d28b4a326f098132595cb1e1dac5647276c93f5dfaee', 4, '2026-10-13T18:34:01.579Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? Un refrigerador clase A consume hasta un 60% menos electricidad que uno convencional.'),
  ('0f691a17-009b-4d30-ab4e-bd84d49d7145', '¿Cómo conviene lavar una carga de ropa?', '["Con una prenda","Con carga completa","Repitiendo el ciclo","Sin centrifugado nunca"]'::jsonb, 1, 'Una carga completa aprovecha mejor el agua y la energía de cada ciclo.', 'agua', 'facil', 'curada', '0bbad2aaecb315529739302eaff7a163bf159cc1e4efff860fd410b9a65bdcda', 4, '2026-10-07T16:30:14.161Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? Usar la lavadora con carga completa ahorra más de 3.000 litros de agua limpia al año.'),
  ('1d0fe7a9-7157-41a0-b950-843dbe9819df', '¿Qué acción reduce el consumo eléctrico de los aparatos en espera?', '["Desenchufarlos","Subir el brillo","Abrir las ventanas","Usar agua caliente"]'::jsonb, 0, 'Los aparatos en espera siguen consumiendo energía si permanecen conectados.', 'energia', 'facil', 'curada', '0db37d4d144527b09af26c2cd74350b2515c590f13196af117e9fed1cebf011c', 4, '2026-10-13T18:35:26.100Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? El consumo fantasma de aparatos en espera representa hasta el 10% de tu boleta de luz.'),
  ('49a80e73-7fbd-4b3a-b8bd-40b2657dc535', '¿Qué medida mejora la eficiencia de un refrigerador?', '["Ponerlo junto al horno","Revisar el sello de la puerta","Dejar la puerta abierta","Guardar alimentos calientes"]'::jsonb, 1, 'Un sello en buen estado evita fugas de aire frío y trabajo extra del motor.', 'energia', 'media', 'curada', 'a3634f383b27e78c64037f84b8ecb41d05abaca10382deec3888a5d465f0c17f', 4, '2026-10-13T18:33:47.572Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? Una goma rota en la puerta del refrigerador duplica su consumo eléctrico de inmediato.'),
  ('f157a2e7-d70e-40e6-8979-94d37c7e7811', '¿Qué residuo suele aceptarse limpio y seco en reciclaje de papel?', '["Servilleta usada","Papel higiénico","Cartón limpio","Papel con aceite"]'::jsonb, 2, 'El cartón limpio y seco puede incorporarse a procesos de reciclaje.', 'reciclaje', 'facil', 'curada', '5d535a857afee351bfb5d7230e357adbc9e57e2f83d5fee641846c75a3ab02cf', 5, '2026-10-23T23:05:57.006Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: Reciclar una tonelada de papel salva 17 árboles maduros y ahorra más de 25.000 litros de agua.'),
  ('6db6cd0a-294d-4955-b012-ce44a98a9f25', '¿Qué ampolleta consume menos energía para entregar una iluminación similar?', '["Incandescente","Halógena","LED","De filamento decorativo"]'::jsonb, 2, 'Las ampolletas LED usan menos electricidad y duran más que las incandescentes.', 'energia', 'facil', 'curada', 'f2afb4d8ba6d254e6133c4234d9936ae6263b124f847c2eada503423f78e3bd5', 4, '2026-10-13T18:34:13.340Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: Las ampolletas LED gastan hasta un 85% menos energía y duran 15 veces más que las comunes.'),
  ('a4fc7df4-4b96-4910-99ee-472948a6b873', '¿Cuál ducha suele consumir menos agua?', '["Una ducha corta","Una ducha de una hora","Una tina llena","Una ducha con la llave abierta antes de entrar"]'::jsonb, 0, 'Reducir el tiempo de ducha disminuye el consumo de agua y energía.', 'agua', 'facil', 'curada', '8b34758c224f482c0a0c91d1e048d9d173115470920eaec990b5b70e7bd44cd6', 5, '2026-10-23T01:06:19.535Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? Bajar la ducha a 5 minutos ahorra más de 60 litros de agua y 40% de gas en cada baño.'),
  ('6a6b63ad-d932-4416-9148-e4ce21d27b92', '¿Cuándo es mejor regar el jardín para reducir la evaporación?', '["Al mediodía","Durante el mayor calor","Temprano o al atardecer","Solo cuando hay viento"]'::jsonb, 2, 'A menor temperatura se evapora menos agua antes de llegar a las raíces.', 'agua', 'media', 'curada', '8572459fd70f4244776b78d96086ce5f3efd24a51ce6a5d98079146a1f5e2831', 5, '2026-10-23T23:05:18.092Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? Regar al atardecer ahorra hasta un 30% de agua al evitar la evaporación por el sol.'),
  ('a5d13914-f0b3-4be1-8583-19cb10822637', '¿Cuál es una fuente de energía renovable disponible en el norte de Chile?', '["Carbón","Energía solar","Diésel","Gasolina"]'::jsonb, 1, 'La alta radiación solar del norte de Chile favorece la generación fotovoltaica.', 'energia', 'facil', 'curada', 'fcae6a1f53b70f0b27c5812a1e2aa0d07c1c985d73acf756644a5439321a0d9a', 4, '2026-10-07T16:29:27.790Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: El norte de Chile tiene la radiación solar más alta del planeta, impulsando la energía limpia.'),
  ('cbe7410b-e687-41af-8e09-9bb0beb75438', '¿Qué se debe hacer al detectar una llave que gotea?', '["Ignorarla","Abrirla más","Cubrirla con un paño","Repararla pronto"]'::jsonb, 3, 'Un goteo continuo puede desperdiciar mucha agua con el paso de los días.', 'agua', 'facil', 'curada', '03dc582bb0b712cd420b27f222af43dca1310b3499218a4bd0b429a8169b4c36', 5, '2026-10-13T18:36:05.599Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: Una llave que gotea lentamente pierde hasta 30 litros de agua potable cada 24 horas.'),
  ('50f7c672-2778-4e0c-8015-8cfff6a46879', '¿Cómo se evita perder calor al cocinar en una olla?', '["Usando fuego máximo siempre","Agregando agua fría","Cocinando con tapa","Abriendo el horno"]'::jsonb, 2, 'La tapa conserva el calor y permite cocinar usando menos energía.', 'energia', 'facil', 'curada', 'f8eb9aea3278b68c10d98967f1abcedbf9ce822b2f7b0e3165fba71ba7cd94f9', 5, '2026-10-27T15:02:26.339Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? Cocinar con la olla tapada reduce el consumo de gas o electricidad hasta en un 25%.'),
  ('da4bf614-9e4e-4cae-a96d-2769764a3cf8', '¿Qué hábito ahorra agua al cepillarse los dientes?', '["Usar agua caliente","Cerrar la llave","Abrir dos llaves","Dejar correr el agua"]'::jsonb, 1, 'Cerrar la llave evita perder varios litros de agua durante el cepillado.', 'agua', 'facil', 'curada', '1730b70d8db548199bc4df002c69b5484b1670902324ce051f6f9861454c621e', 4, '2026-10-07T16:29:12.077Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? Cerrar la llave mientras te cepillas los dientes ahorra hasta 12 litros de agua por minuto.'),
  ('dce0a8ae-8ee1-4a98-8e90-b85f4cf9916f', '¿Qué opción aprovecha agua sin usar agua potable nueva?', '["Recolectar agua lluvia para riego","Lavar la vereda con manguera","Vaciar una piscina","Dejar correr la ducha"]'::jsonb, 0, 'El agua lluvia almacenada puede emplearse en tareas como el riego.', 'agua', 'media', 'curada', '7e08e71e436ca8b1940d57586fbaf11b890586095bff9eb5088f9756fea7c2f0', 4, '2026-10-13T18:35:01.711Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? Usar el agua de lavar frutas y verduras para regar tus maceteros nutre la tierra sin gastar de más.'),
  ('da1eb88b-dfce-49f1-ae39-d80044fa02ec', '¿Qué artefacto permite reducir el caudal sin cortar el agua?', '["Una estufa","Un alargador","Un aireador de grifo","Una ampolleta"]'::jsonb, 2, 'El aireador mezcla aire con agua y mantiene una sensación de buen caudal.', 'agua', 'media', 'curada', '3d4564d6c024d6578f208a7e4d377842809b49383cb880b053aceb32dd4e0bce', 5, '2026-10-23T23:05:59.915Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: Instalar aireadores en las llaves reduce hasta un 50% el caudal de agua sin perder presión.'),
  ('8d0a7f50-40d9-4fcc-ae9c-618dbd9d17e0', '¿Qué ayuda a saber si existe una fuga oculta en el hogar?', '["Revisar el medidor sin consumo","Cambiar las cortinas","Encender las luces","Abrir el refrigerador"]'::jsonb, 0, 'Si el medidor avanza con todas las llaves cerradas, puede existir una fuga.', 'agua', 'media', 'curada', '4b9614f64e6649c9edd470e88edd606a4057cd47b050a677d047b1cca0b3d320', 5, '2026-10-23T01:05:51.602Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: Una fuga de inodoro que corre sin parar puede desperdiciar más de 200.000 litros al año.'),
  ('0e637a7b-f7f4-4e7d-b0b4-4bd813bf3e5b', '¿Qué material no debe mezclarse con vidrio de botellas en un punto limpio?', '["Botellas transparentes","Ampolletas","Frascos","Botellas verdes"]'::jsonb, 1, 'Las ampolletas tienen una composición distinta y requieren otra gestión.', 'reciclaje', 'media', 'curada', '57376b84804fc7973e307ac63b26c6eed5c8e72a7caa881c6b5d1d2b0cbf26cc', 4, '2026-10-07T16:29:52.003Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: La cerámica se funde a mayor temperatura que el vidrio y arruina lotes de reciclaje completos.'),
  ('23f54a63-9c12-4609-9d12-63b826919a02', '¿Qué significa reutilizar un objeto?', '["Botarlo antes","Usarlo nuevamente","Mezclarlo con basura","Quemarlo"]'::jsonb, 1, 'Reutilizar extiende la vida del objeto y evita generar un residuo nuevo.', 'reciclaje', 'facil', 'curada', '857efc380bedcc01c77900f70d61d117d9cc49e8b534f34e0cf13a4e5ce3fbbd', 4, '2026-10-13T18:36:00.883Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: Reutilizar frascos de vidrio para guardar alimentos ahorra dinero y evita plásticos en casa.'),
  ('33a8c132-76be-4ba4-bb61-eecbc44adcef', '¿Por qué no se deben liberar mascotas exóticas en la naturaleza?', '["Porque pueden volverse invasoras","Porque aprenden a reciclar","Porque limpian los ríos","Porque reducen el ruido"]'::jsonb, 0, 'Pueden reproducirse, transmitir enfermedades o afectar a especies nativas.', 'biodiversidad', 'media', 'curada', '6617092b8a5f05b940b71d0b0153e735aeeccf8e07e46dba20b4ad352b6bca69', 4, '2026-10-13T18:33:00.791Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? Especies invasoras como el visón o el castor causan graves daños a la fauna nativa del sur.'),
  ('665219e2-7444-4948-b706-3ef1f2d41fe3', '¿Qué ecosistema chileno destaca por su adaptación a la escasez de lluvia?', '["Selva amazónica","Desierto de Atacama","Tundra ártica","Sabana africana"]'::jsonb, 1, 'Las especies del desierto de Atacama poseen adaptaciones a condiciones extremadamente secas.', 'biodiversidad', 'facil', 'curada', '06763e2b7a5227bdcd6139b5f2d32203826e0d1df3ae375339d35510e41a8b4e', 5, '2026-10-23T01:06:17.869Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? En Atacama existen plantas que viven absorbiendo agua únicamente de la camanchaca marina.'),
  ('594d9f65-d770-4c0d-be4c-8faf91619076', '¿Qué efecto puede tener una especie invasora?', '["Crear agua potable","Aumentar siempre la diversidad","Desplazar especies nativas","Detener el viento"]'::jsonb, 2, 'Una especie invasora puede competir por alimento y espacio con especies nativas.', 'biodiversidad', 'media', 'curada', '724cd3d1a943c37a87475db1c7c24d6607bf194a9e8966280331e4246200a154', 4, '2026-10-13T18:34:31.016Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: La avispa chaqueta amarilla compite agresivamente con los polinizadores nativos chilenos.'),
  ('69676b8f-d44a-4d31-916b-c4a3c4bf3282', '¿Por qué los envases reciclables deben ir sin restos de comida?', '["Para que pesen más","Para cambiar su color","Para no contaminar otros materiales","Para que ocupen más espacio"]'::jsonb, 2, 'Los restos pueden ensuciar un lote y dificultar su aprovechamiento.', 'reciclaje', 'media', 'curada', '12654b970c0d4b654dbe0a5aae67af9791558ff9a78012252783c7035ad32458', 4, '2026-10-09T00:21:05.050Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: Enjuagar envases con agua de enjuague evita malos olores y que se rechace un lote de reciclaje.'),
  ('74521154-5e76-42a5-b6d9-5e7ed11b4775', '¿Cuál de estos residuos es apropiado para compostar?', '["Vidrio","Metal","Plástico","Cáscaras de frutas"]'::jsonb, 3, 'Las cáscaras son materia orgánica que puede transformarse en compost.', 'reciclaje', 'facil', 'curada', 'c8ea4d5c3360181b752db736e97660ebc5d906e6edf60532e1e249f7c5cde1bf', 5, '2026-10-13T18:36:15.483Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: El 50% de la basura familiar son restos orgánicos que pueden convertirse en abono nutritivo.'),
  ('b35fc50b-eb86-4b11-9547-31bf80a83e3f', '¿Dónde deben llevarse las pilas usadas?', '["A un punto de recepción autorizado","Al compost","Al inodoro","A una fogata"]'::jsonb, 0, 'Las pilas requieren manejo especial por los materiales que contienen.', 'reciclaje', 'facil', 'curada', 'ba28e1a451674e4b9a5ed4894e7fd7edd3de931ef14ba199c0e4d366900db7cd', 4, '2026-10-07T16:29:37.062Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? Una sola pila de botón arrojada al suelo puede llegar a contaminar 600.000 litros de agua.'),
  ('b61b66bf-437d-472c-9382-01ea59902efd', '¿Qué árbol es característico de los bosques del sur de Chile?', '["Baobab","Secuoya gigante","Alerce","Cocotero"]'::jsonb, 2, 'El alerce es una especie nativa emblemática de los bosques australes.', 'biodiversidad', 'facil', 'curada', '1daa1e6701fe969f35e41edf14d08c5422eba2824afd84c6a3af80018a751421', 4, '2026-10-13T18:34:51.349Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? El Alerce Milenario del sur de Chile tiene más de 3.600 años y es de los más viejos del mundo.'),
  ('b919b3e1-908c-4155-8261-5ba427356f6a', '¿Qué compra genera menos residuos?', '["Un producto con doble envoltorio","Un envase desechable","Un producto a granel en recipiente reutilizable","Una porción individual envuelta"]'::jsonb, 2, 'Comprar a granel con un recipiente reutilizable evita envases de un solo uso.', 'consumo_responsable', 'facil', 'curada', '1e63f30cd4558db889300afe6513313edc97650328b709a536e4590c46edafbc', 4, '2026-10-13T18:35:46.449Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: Comprar legumbres a granel con tus propios envases elimina bolsas plásticas innecesarias.'),
  ('bcc3b08f-ff13-4923-b080-47d50f3b57a0', '¿Qué animal nativo chileno es el ciervo más pequeño del mundo?', '["Huemul","Pudú","Guanaco","Puma"]'::jsonb, 1, 'El pudú es un pequeño ciervo nativo de los bosques templados de Chile.', 'biodiversidad', 'media', 'curada', 'fb39fec3ebe69fbabbad442f9d078dd8e26ea425f0a5a89f24d25d31374842e4', 4, '2026-10-09T00:21:10.224Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? El pudú chileno es el ciervo más pequeño del mundo y mide menos de 40 cm de estatura.'),
  ('daf5ff8a-acfc-4aa8-9fea-a9165b23896c', '¿Cuál es una especie emblemática de la cordillera de los Andes en Chile?', '["Cóndor","Pingüino emperador","Canguro","Oso polar"]'::jsonb, 0, 'El cóndor andino habita zonas montañosas y forma parte del escudo nacional.', 'biodiversidad', 'facil', 'curada', 'aa860fbbd955b43b93c70a908e9f613a4742febb09d9ef65604e36f8b9b5a4ea', 4, '2026-10-13T18:34:20.288Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: El cóndor andino puede volar cientos de kilómetros planeando sin batir sus alas.'),
  ('e0470fbe-4175-4abe-a3ab-2c2cc9dee1c9', '¿Qué se debe hacer con una botella plástica antes de reciclarla?', '["Llenarla con comida","Enjuagarla y compactarla","Quemarla","Enterrarla"]'::jsonb, 1, 'Limpiarla evita contaminación y compactarla reduce el espacio de transporte.', 'reciclaje', 'facil', 'curada', 'ad6eb953db1c26a33622da321e41863e1d7e865e2b0a6659c2c51b62ae79f04d', 4, '2026-10-13T18:33:07.430Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: Aplastar botellas plásticas reduce su volumen un 75%, optimizando el espacio en el punto limpio.'),
  ('eced2e7f-72e2-4e8c-9a5e-bf40626a0146', '¿Qué práctica ayuda a proteger a los animales silvestres?', '["Observarlos a distancia","Alimentarlos siempre","Llevarlos a casa","Perseguirlos para fotografiarlos"]'::jsonb, 0, 'Mantener distancia evita estrés, accidentes y cambios en su conducta.', 'biodiversidad', 'facil', 'curada', '2670d9d1ab4f5669f10c78fb76fcdf9abf69fe61551c9a1cf3df97978559b2dd', 4, '2026-10-07T16:30:24.955Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: Mantener mascotas supervisadas o con cascabel protege anualmente a miles de aves nativas.'),
  ('19527ec9-1e24-4f59-b112-0385ce52285c', '¿Qué ventaja puede tener comprar productos locales?', '["Siempre usan más envases","Pueden requerir menos transporte","Nunca tienen temporada","Eliminan todo impacto ambiental"]'::jsonb, 1, 'Una menor distancia de transporte puede reducir consumo de combustible y emisiones.', 'consumo_responsable', 'media', 'curada', 'a4a601c12d5c2dd52ca235710007558dd3259312770d2c878cbee535ae6bdb75', 4, '2026-10-13T18:33:21.745Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: Los alimentos locales reducen la huella de carbono de transporte hasta en un 80%.'),
  ('1e5da6e8-c7c1-4946-a9a7-2fa02a68dd51', '¿Qué característica es preferible en una botella de uso diario?', '["Que sea reutilizable","Que sea de un solo uso","Que venga con varios envoltorios","Que no pueda lavarse"]'::jsonb, 0, 'Una botella reutilizable reemplaza muchos envases desechables.', 'consumo_responsable', 'facil', 'curada', '57d326d31c30a6a7e4a0e79da82db8ca7699f1d99a95fd4d202d0e64e15da89b', 4, '2026-10-13T18:35:30.427Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: Una botella reutilizable evita que más de 160 botellas plásticas terminen en vertederos al año.'),
  ('1f8e42dc-7a15-46be-a2b3-197c50629f0b', '¿Cuál es el orden preferible para manejar residuos?', '["Botar, comprar y quemar","Quemar, mezclar y enterrar","Reciclar, comprar y desechar","Reducir, reutilizar y reciclar"]'::jsonb, 3, 'Primero se evita el residuo, luego se reutiliza y finalmente se recicla.', 'reciclaje', 'media', 'curada', '3e644fbca6a8daa259b1a7f1ca01cf871219d2fa015dba5c62f1aee904b694fb', 4, '2026-10-09T00:20:11.107Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? El mejor residuo es el que no se genera: reducir siempre es más eficaz que reciclar.'),
  ('3e503f56-efaa-46f1-885e-f6bf84009ba6', '¿Qué residuo debe gestionarse como aparato eléctrico o electrónico?', '["Un teléfono dañado","Una cáscara de plátano","Una caja de cartón","Una botella de vidrio"]'::jsonb, 0, 'Los teléfonos contienen componentes que requieren tratamiento especializado.', 'reciclaje', 'media', 'curada', '4cd46d6224f80979faf1cc5eead870f7770e3c008cd77a05e22a74744e6ed320', 5, '2026-10-23T01:06:20.816Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: Los celulares viejos contienen oro y cobre reciclables; llévalos siempre a un punto limpio.'),
  ('2cf08b56-1142-4fd3-9a7d-e5074bab835a', '¿Qué acción permite aprovechar mejor los alimentos antes de que venzan?', '["Esconderlos al fondo","Comprar duplicados","Desecharlos de inmediato","Ordenarlos por fecha"]'::jsonb, 3, 'Dejar adelante los productos que vencen primero facilita consumirlos a tiempo.', 'consumo_responsable', 'media', 'curada', '592f1e8c162afa7c981a849fb5b1fd61b255a50ed592eefeeda53674b0a23380', 4, '2026-10-07T16:30:32.692Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: Dejar adelante lo que vence primero en el refrigerador evita botar comida en buen estado.'),
  ('3b07f061-7920-43c2-a2e7-7cd5cccd79ec', '¿Para qué sirve aislar puertas y ventanas en invierno?', '["Para aumentar la humedad","Para oscurecer la casa","Para conservar el calor","Para enfriar los muros"]'::jsonb, 2, 'El aislamiento reduce la pérdida de calor y la necesidad de calefacción.', 'energia', 'media', 'curada', 'bf835b0b53de9bbb752ff86ebe13db7748c027e6961d0525a8ef61506efe0105', 4, '2026-10-09T00:20:51.650Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? Sellar rendijas en puertas y ventanas evita hasta un 25% de pérdida de calor en invierno.'),
  ('4a7e10d1-a2f1-46d2-9e7d-b60a9ccdb32a', '¿Qué significa preferir un producto durable?', '["Elegir el que dura más y puede repararse","Elegir el más desechable","Comprar varios iguales","Cambiarlo aunque funcione"]'::jsonb, 0, 'Un producto durable necesita menos reemplazos y reduce el uso de materiales.', 'consumo_responsable', 'media', 'curada', '4ee9add7a7ad4f1e77dc62ee40def386e40871b4be2e4f0b1ba72555b3ecefcf', 4, '2026-10-13T18:31:59.943Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: Elegir productos durables y reparables combate la obsolescencia y cuida el presupuesto familiar.'),
  ('706b3ce0-1536-4564-a0ee-2befad485461', '¿Qué acción desperdicia más agua al lavar un automóvil?', '["Usar un balde","Usar un paño húmedo","Reutilizar agua apta","Dejar la manguera abierta"]'::jsonb, 3, 'Una manguera abierta entrega agua continuamente aunque no se esté enjuagando.', 'agua', 'facil', 'curada', '4abd3b6e23eb1f134e77a1ed0f362f89ead9a3fdef7276faa864defa8367f632', 4, '2026-10-09T00:20:42.528Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? Lavar el auto con manguera gasta 500 litros de agua; usando un balde gastas menos de 50.'),
  ('c53f83a5-a363-481a-83e2-3c7a523a767b', '¿Qué elección ayuda a disminuir bolsas desechables?', '["Pedir varias bolsas","Usar una bolsa por artículo","Llevar una bolsa reutilizable","Botar la bolsa después de una compra"]'::jsonb, 2, 'Una bolsa resistente puede usarse muchas veces y reemplazar bolsas de un solo uso.', 'consumo_responsable', 'facil', 'curada', '91a2854c5bea54b616aa268f2d5946b3f2fcd9c348ca2d4e3ba4b0e4a3b079dd', 4, '2026-10-13T18:33:31.713Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? Una sola bolsa de tela reutilizable evita usar más de 500 bolsas plásticas desechables.'),
  ('c60ed76d-a670-4426-ba1b-f3c58bbc3901', '¿Por qué no se debe botar aceite de cocina por el lavaplatos?', '["Porque enfría el agua","Porque contamina y tapa tuberías","Porque cambia el color del metal","Porque produce electricidad"]'::jsonb, 1, 'El aceite puede obstruir tuberías y contaminar grandes cantidades de agua.', 'agua', 'media', 'curada', '66a91e7f7198e5e9a0949634c28590f49d8883c06cf305fbac52b6d599898468', 4, '2026-10-09T00:20:33.383Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: 1 litro de aceite usado contamina 1.000 litros de agua; junta tu aceite en una botella plástica.'),
  ('d10006f1-c93a-48ef-8a9f-a1260a564c5f', '¿Qué conviene hacer antes de comprar algo nuevo?', '["Preguntarse si realmente se necesita","Botar un objeto útil","Elegir el mayor envase","Comprar sin comparar"]'::jsonb, 0, 'Evaluar la necesidad evita compras impulsivas y el uso innecesario de recursos.', 'consumo_responsable', 'facil', 'curada', '15273f4990641619d1080491e216882d67ee1bf07b2435643a4ee2f1cda81006', 4, '2026-10-13T18:34:42.911Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? Esperar un día antes de comprar por impulso evita acumular objetos que terminan en desuso.'),
  ('f9c08c3e-fdf2-4f22-a94a-7eef32566d75', '¿Cómo se reduce el desperdicio de alimentos en el hogar?', '["Comprando sin lista","Planificando las comidas","Botando las sobras","Ignorando las fechas"]'::jsonb, 1, 'Planificar ayuda a comprar cantidades adecuadas y aprovechar lo disponible.', 'consumo_responsable', 'facil', 'curada', '176ef38d1b18f06ebe606f7a552d0679fdb735cb2d5732ed600f894d580f482b', 4, '2026-10-07T16:29:18.527Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: Planificar los almuerzos de la semana antes de comprar reduce el desecho de alimentos en un 40%.'),
  ('259aed0d-16bb-4053-9a88-0f270a08d807', '¿Qué opción extiende la vida útil de una prenda?', '["Desecharla por un botón","Lavarlo todo a diario","Quemarla","Repararla"]'::jsonb, 3, 'Reparar evita una compra nueva y aprovecha los materiales ya producidos.', 'consumo_responsable', 'facil', 'curada', '2ac730e6869bd6d1b21c99ec6fb89aedfc551b3a1fba499333c89d4f8173ae92', 5, '2026-10-23T01:05:24.455Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? Extender la vida de tu ropa solo 9 meses reduce su huella hídrica y de carbono en un 30%.'),
  ('f3fef784-9edf-46a0-b8ca-74158e5a3cd5', '¿Cuál es una alternativa responsable para un objeto que aún funciona y ya no se usa?', '["Romperlo","Donarlo o venderlo","Enterrarlo","Mezclarlo con residuos orgánicos"]'::jsonb, 1, 'Entregarlo a otra persona prolonga su uso y evita que se transforme en residuo.', 'consumo_responsable', 'facil', 'curada', '53ee32967df50dac0d2bb67b458dce22809b8e5a737dd776177e4651eb086a39', 5, '2026-10-27T15:02:38.523Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? Donar ropa o artefactos en buen estado da una segunda vida a los productos y apoya a tu comunidad.'),
  ('84ca73b4-f398-4646-a0f8-556253dcbb9e', '¿Por qué son importantes los humedales urbanos?', '["Porque reemplazan todas las plazas","Porque almacenan basura","Porque eliminan toda inundación","Porque albergan especies y regulan agua"]'::jsonb, 3, 'Los humedales entregan hábitat y ayudan a retener y filtrar agua.', 'biodiversidad', 'media', 'curada', 'f9173237cf2ec3630ee05c6f2c33fb1211da7f587f346c0611c5380559a45e66', 4, '2026-10-07T16:30:41.196Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? Los humedales urbanos filtran contaminantes del agua y previenen inundaciones en ciudades.'),
  ('c7d26c49-fc0f-4957-bb92-1402228de5cf', '¿Qué conducta protege la vegetación de un parque nacional?', '["Salirse de los senderos","Extraer flores","Encender fuego libremente","Caminar por senderos habilitados"]'::jsonb, 3, 'Usar senderos reduce el daño sobre plantas y suelos frágiles.', 'biodiversidad', 'facil', 'curada', '24e81740bef864df0f4276c66c13b3986f006c9b27a5cad4f62a9caf712f1989', 4, '2026-10-13T18:35:12.201Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? Mantenerse en senderos marcados evita pisar líquenes y plantas que tardan décadas en crecer.'),
  ('e2aceaa4-51c7-470a-8599-963df811d600', '¿Qué beneficio tiene separar residuos en el hogar?', '["Facilita recuperar materiales","Aumenta la basura mezclada","Impide reutilizar","Elimina la necesidad de puntos limpios"]'::jsonb, 0, 'La separación permite entregar cada material a su cadena de valorización.', 'reciclaje', 'facil', 'curada', '40c23f3a5343bc80bad80389f8c0f5daa2371071a1077379257bf672c80e37e1', 5, '2026-10-13T18:36:41.619Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? Separar residuos en casa evita que cartones y plásticos limpios se contaminen con basura.'),
  ('35cfb3f4-f3ad-43d0-8dfd-c32305d263c2', '¿Qué acción favorece a los polinizadores en un jardín?', '["Usar pesticidas sin control","Plantar flores nativas","Cortar todas las flores","Reemplazar plantas por cemento"]'::jsonb, 1, 'Las flores nativas entregan alimento y refugio adecuados a polinizadores locales.', 'biodiversidad', 'media', 'curada', '59398971c9be1a6e92dc73e4a9aabf979fd1a532258d9514f01c1568710e566b', 5, '2026-10-23T01:05:35.262Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: Plantar lavanda o romero en maceteros crea refugios vitales para abejas nativas en la ciudad.'),
  ('c27073d2-d367-49a1-b287-325fa2b8242f', '¿Qué hábito ayuda a gastar menos energía al hervir agua?', '["Hervir solo la cantidad necesaria","Llenar siempre el hervidor","Destaparlo mientras hierve","Repetir el hervido"]'::jsonb, 0, 'Calentar únicamente el agua necesaria reduce electricidad y tiempo.', 'energia', 'facil', 'curada', 'a9f8bcb7ed5cf8f8a8d28dd5ab73716c488e1ca1713f6d0461d3a5ad039d7c59', 5, '2026-10-23T01:05:46.328Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: Hervir solo las tazas que vas a consumir ahorra tiempo y cuida la potencia eléctrica de tu hogar.'),
  ('b464be63-f863-4b77-b9ab-1d42342869ed', '¿Qué conviene hacer con la calefacción al ventilar una habitación?', '["Apagarla durante la ventilación","Subirla al máximo","Abrir todas las puertas","Cubrir el calefactor"]'::jsonb, 0, 'Apagarla evita desperdiciar energía mientras entra aire frío.', 'energia', 'media', 'curada', 'c6081a9eddaa2a51946ed5e484bab93c974d2a26590f2f4b2253809ecd3a2dbd', 5, '2026-10-23T01:06:00.410Z', '2026-09-30T12:41:35.146Z', '🌱 Eco-Tip: Basta abrir ventanas 10 minutos para renovar el aire sin que se enfríen los muros del hogar.'),
  ('efbab23d-e0ab-47b6-a50b-077177402a50', '¿Qué transporte usa energía humana directamente?', '["Automóvil","Motocicleta","Avión","Bicicleta"]'::jsonb, 3, 'La bicicleta se mueve con energía humana y no emite gases durante su uso.', 'energia', 'facil', 'curada', '5f68ba4cd9465fbcebd9ca29804601396d06db74b9e6e86c212cfcd101eb4797', 5, '2026-10-23T23:05:45.455Z', '2026-09-30T12:41:35.146Z', '💡 ¿Sabías que? Andar en bicicleta 5 km al día evita emitir más de 1 kg de CO2 respecto a viajar en auto.')
ON CONFLICT DO NOTHING;

-- Datos para public.trivia_sessions (16 filas)
INSERT INTO public.trivia_sessions (id, user_id, family_id, vidas_restantes, vida_extra_comprada, correctas, incorrectas, xp_acumulada, monedas_ganadas, current_question_id, current_question_started_at, estado, recompensa_acreditada, xp_total_resultado, saldo_monedas_resultado, nivel_resultado, level_up_resultado, started_at, finished_at) VALUES
  ('c8690c7b-715b-49fb-a256-5b1e1ab7b5c6', 'fbfe8f40-f773-4484-800a-9d64dd464e88', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 0, FALSE, 8, 3, 460, 1, NULL, NULL, 'finalizada', TRUE, 1600, 5, 4, TRUE, '2026-10-01T19:13:13.446Z', '2026-10-01T20:00:27.896Z'),
  ('52b5114c-4f1c-4b58-8d57-0380608271f4', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'ddc58f46-2379-405b-b85f-4f44850e777f', 0, FALSE, 7, 3, 400, 1, NULL, NULL, 'finalizada', TRUE, 4020, 23, 9, TRUE, '2026-10-07T16:29:01.650Z', '2026-10-07T16:30:55.677Z'),
  ('56b2b0e6-9ac1-4e3d-acdc-28b1f6ed7cbf', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'ddc58f46-2379-405b-b85f-4f44850e777f', 2, FALSE, 1, 1, 40, 0, NULL, NULL, 'finalizada', TRUE, 3520, 21, 8, TRUE, '2026-10-02T00:45:01.766Z', '2026-10-02T01:02:00.944Z'),
  ('770d6fc8-ef1f-4831-bb57-227eceb611e0', 'ad6baf06-89f8-4392-9f39-80b09900d270', '2228e641-973f-4955-ac27-0b96ea526559', 2, FALSE, 0, 1, 0, 0, NULL, NULL, 'finalizada', TRUE, 460, 5, 1, FALSE, '2026-10-01T20:47:22.736Z', '2026-10-01T20:48:01.399Z'),
  ('d3425e95-01f9-4602-a3d8-dc6848cf7096', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'ddc58f46-2379-405b-b85f-4f44850e777f', 0, FALSE, 4, 3, 200, 0, NULL, NULL, 'finalizada', TRUE, 1400, 13, 3, FALSE, '2026-10-01T20:27:53.194Z', '2026-10-01T20:29:11.199Z'),
  ('6d477eba-05f7-445b-a7df-0da55a6d545f', 'fbfe8f40-f773-4484-800a-9d64dd464e88', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 0, TRUE, 4, 4, 200, 0, NULL, NULL, 'finalizada', TRUE, 1140, 4, 3, TRUE, '2026-10-01T19:11:09.252Z', '2026-10-01T19:12:29.999Z'),
  ('bf873cda-ce4a-4c7a-9e4a-aa7a4082020a', 'b67e8b2b-f88f-41fe-99ec-d550c970f817', '2228e641-973f-4955-ac27-0b96ea526559', 0, FALSE, 12, 3, 640, 2, NULL, NULL, 'finalizada', TRUE, 840, 7, 2, TRUE, '2026-10-04T20:11:27.525Z', '2026-10-04T20:13:40.319Z'),
  ('1c4ee6b7-2212-43e5-a570-d1e39c6b4dff', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'ddc58f46-2379-405b-b85f-4f44850e777f', 3, FALSE, 2, 0, 17, 0, NULL, NULL, 'finalizada', TRUE, 4467, 21, 9, FALSE, '2026-10-27T15:02:25.995Z', '2026-10-27T15:02:57.774Z'),
  ('789b610f-7423-4a8f-adcc-2b8afa4ab656', '87f66d69-5697-4dd4-bb84-42150e1db851', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 0, FALSE, 5, 3, 280, 1, NULL, NULL, 'finalizada', TRUE, 480, 9, 1, FALSE, '2026-10-23T01:05:24.175Z', '2026-10-23T01:06:23.691Z'),
  ('4c8be462-64ac-4bb3-91d7-0a8f75cd2741', '502636de-20d6-4644-aae5-ac70bec5db7a', 'ddc58f46-2379-405b-b85f-4f44850e777f', 0, FALSE, 17, 3, 900, 3, NULL, NULL, 'finalizada', TRUE, 2000, 18, 5, TRUE, '2026-10-13T18:33:00.485Z', '2026-10-13T18:36:58.884Z'),
  ('71ce2357-f14b-4ab5-9c61-02b725a6ee7f', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'ddc58f46-2379-405b-b85f-4f44850e777f', 1, TRUE, 3, 3, 180, 0, NULL, NULL, 'finalizada', TRUE, 4200, 18, 9, FALSE, '2026-10-09T00:20:10.787Z', '2026-10-09T00:21:18.123Z'),
  ('bdbddc67-bb28-4a55-990d-6e813118308a', 'fbfe8f40-f773-4484-800a-9d64dd464e88', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 0, TRUE, 8, 4, 380, 1, NULL, NULL, 'finalizada', TRUE, 1980, 1, 4, FALSE, '2026-10-01T20:00:35.683Z', '2026-10-01T20:02:29.277Z'),
  ('917e005b-41da-4da6-bfac-fae381c561e3', '502636de-20d6-4644-aae5-ac70bec5db7a', 'ddc58f46-2379-405b-b85f-4f44850e777f', 3, FALSE, 0, 0, 0, 0, NULL, NULL, 'finalizada', TRUE, 1100, 15, 3, FALSE, '2026-10-13T18:31:59.638Z', '2026-10-13T18:32:02.822Z'),
  ('b2451116-d8cd-4bf5-9bef-5c88446b9b7f', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'ddc58f46-2379-405b-b85f-4f44850e777f', 0, FALSE, 22, 3, 1200, 4, NULL, NULL, 'finalizada', TRUE, 3380, 20, 7, TRUE, '2026-10-01T22:45:53.534Z', '2026-10-01T22:49:59.441Z'),
  ('def69bf2-c674-4132-b29c-8eeb265b9c31', 'ad6baf06-89f8-4392-9f39-80b09900d270', '2228e641-973f-4955-ac27-0b96ea526559', 0, FALSE, 7, 3, 360, 1, NULL, NULL, 'finalizada', TRUE, 460, 5, 1, FALSE, '2026-10-01T20:45:26.250Z', '2026-10-01T20:46:59.229Z'),
  ('64ff5e29-0131-492b-a3fd-3705ab5cc6dd', 'ce4b9004-6723-46be-9096-0d3b261f76dd', '1eec3da2-d030-457b-9c72-85e0b386c70d', 0, FALSE, 1, 3, 60, 0, NULL, NULL, 'finalizada', TRUE, 210, 2, 1, FALSE, '2026-10-23T23:05:17.600Z', '2026-10-23T23:06:08.817Z')
ON CONFLICT DO NOTHING;

-- Datos para public.trivia_answers (107 filas)
INSERT INTO public.trivia_answers (id, session_id, question_id, pregunta_snapshot, alternativas_snapshot, explicacion_snapshot, selected_index, correct_index, correcta, tiempo_segundos, xp_otorgada, vidas_restantes_resultado, correctas_resultado, xp_acumulada_resultado, answered_at) VALUES
  ('ad2545f6-aa4b-429d-808d-4d967bc4f1ea', 'd3425e95-01f9-4602-a3d8-dc6848cf7096', '3e503f56-efaa-46f1-885e-f6bf84009ba6', '¿Qué residuo debe gestionarse como aparato eléctrico o electrónico?', '["Un teléfono dañado","Una cáscara de plátano","Una caja de cartón","Una botella de vidrio"]'::jsonb, 'Los teléfonos contienen componentes que requieren tratamiento especializado.', 0, 0, TRUE, 8, 60, 1, 2, 120, '2026-10-01T20:28:31.486Z'),
  ('48e1acd0-96bc-443a-95cc-d4f5634737a6', 'd3425e95-01f9-4602-a3d8-dc6848cf7096', '6a6b63ad-d932-4416-9148-e4ce21d27b92', '¿Cuándo es mejor regar el jardín para reducir la evaporación?', '["Al mediodía","Durante el mayor calor","Temprano o al atardecer","Solo cuando hay viento"]'::jsonb, 'A menor temperatura se evapora menos agua antes de llegar a las raíces.', 2, 2, TRUE, 13, 40, 1, 3, 160, '2026-10-01T20:28:45.954Z'),
  ('01ec1a3a-7a9a-4f33-b4dd-4a82e0cbc342', 'd3425e95-01f9-4602-a3d8-dc6848cf7096', 'efbab23d-e0ab-47b6-a50b-077177402a50', '¿Qué transporte usa energía humana directamente?', '["Automóvil","Motocicleta","Avión","Bicicleta"]'::jsonb, 'La bicicleta se mueve con energía humana y no emite gases durante su uso.', 3, 3, TRUE, 11, 40, 1, 4, 200, '2026-10-01T20:28:58.514Z'),
  ('67c3c9cb-4c0b-4b36-9d07-6077bb744b67', 'd3425e95-01f9-4602-a3d8-dc6848cf7096', 'f157a2e7-d70e-40e6-8979-94d37c7e7811', '¿Qué residuo suele aceptarse limpio y seco en reciclaje de papel?', '["Servilleta usada","Papel higiénico","Cartón limpio","Papel con aceite"]'::jsonb, 'El cartón limpio y seco puede incorporarse a procesos de reciclaje.', 1, 2, FALSE, 8, 0, 0, 4, 200, '2026-10-01T20:29:08.383Z'),
  ('eb1ab953-ae74-4c40-9b64-d716804b1d52', 'def69bf2-c674-4132-b29c-8eeb265b9c31', 'da1eb88b-dfce-49f1-ae39-d80044fa02ec', '¿Qué artefacto permite reducir el caudal sin cortar el agua?', '["Una estufa","Un alargador","Un aireador de grifo","Una ampolleta"]'::jsonb, 'El aireador mezcla aire con agua y mantiene una sensación de buen caudal.', 2, 2, TRUE, 10, 40, 3, 1, 40, '2026-10-01T20:45:36.770Z'),
  ('bf3cb4ec-4522-480d-8f98-5da2e65f0cd4', 'def69bf2-c674-4132-b29c-8eeb265b9c31', '50f7c672-2778-4e0c-8015-8cfff6a46879', '¿Cómo se evita perder calor al cocinar en una olla?', '["Usando fuego máximo siempre","Agregando agua fría","Cocinando con tapa","Abriendo el horno"]'::jsonb, 'La tapa conserva el calor y permite cocinar usando menos energía.', 2, 2, TRUE, 9, 60, 3, 2, 100, '2026-10-01T20:45:47.664Z'),
  ('dec7e986-65d2-4104-bbf4-314c275e8dfe', 'def69bf2-c674-4132-b29c-8eeb265b9c31', 'f3fef784-9edf-46a0-b8ca-74158e5a3cd5', '¿Cuál es una alternativa responsable para un objeto que aún funciona y ya no se usa?', '["Romperlo","Donarlo o venderlo","Enterrarlo","Mezclarlo con residuos orgánicos"]'::jsonb, 'Entregarlo a otra persona prolonga su uso y evita que se transforme en residuo.', 1, 1, TRUE, 9, 60, 3, 3, 160, '2026-10-01T20:45:58.598Z'),
  ('b7e59227-e806-4d93-a965-e5242224ead4', 'def69bf2-c674-4132-b29c-8eeb265b9c31', 'da4bf614-9e4e-4cae-a96d-2769764a3cf8', '¿Qué hábito ahorra agua al cepillarse los dientes?', '["Usar agua caliente","Cerrar la llave","Abrir dos llaves","Dejar correr el agua"]'::jsonb, 'Cerrar la llave evita perder varios litros de agua durante el cepillado.', 1, 1, TRUE, 8, 60, 3, 4, 220, '2026-10-01T20:46:08.665Z'),
  ('99923bfc-5ad2-42a7-ba31-31e689c0d4c6', 'def69bf2-c674-4132-b29c-8eeb265b9c31', 'f9c08c3e-fdf2-4f22-a94a-7eef32566d75', '¿Cómo se reduce el desperdicio de alimentos en el hogar?', '["Comprando sin lista","Planificando las comidas","Botando las sobras","Ignorando las fechas"]'::jsonb, 'Planificar ayuda a comprar cantidades adecuadas y aprovechar lo disponible.', 1, 1, TRUE, 12, 40, 3, 5, 260, '2026-10-01T20:46:22.820Z'),
  ('871ac0b6-5e34-4390-bf60-8105c9bdc03b', 'def69bf2-c674-4132-b29c-8eeb265b9c31', 'a5d13914-f0b3-4be1-8583-19cb10822637', '¿Cuál es una fuente de energía renovable disponible en el norte de Chile?', '["Carbón","Energía solar","Diésel","Gasolina"]'::jsonb, 'La alta radiación solar del norte de Chile favorece la generación fotovoltaica.', 1, 1, TRUE, 13, 40, 3, 6, 300, '2026-10-01T20:46:37.158Z'),
  ('a6fca09e-3f96-48a9-b99e-d90ea6a81766', 'def69bf2-c674-4132-b29c-8eeb265b9c31', 'b35fc50b-eb86-4b11-9547-31bf80a83e3f', '¿Dónde deben llevarse las pilas usadas?', '["A un punto de recepción autorizado","Al compost","Al inodoro","A una fogata"]'::jsonb, 'Las pilas requieren manejo especial por los materiales que contienen.', 2, 0, FALSE, 5, 0, 2, 6, 300, '2026-10-01T20:46:43.383Z'),
  ('f4689d15-e3cd-4acf-b816-1181eeef759c', 'def69bf2-c674-4132-b29c-8eeb265b9c31', '0e637a7b-f7f4-4e7d-b0b4-4bd813bf3e5b', '¿Qué material no debe mezclarse con vidrio de botellas en un punto limpio?', '["Botellas transparentes","Ampolletas","Frascos","Botellas verdes"]'::jsonb, 'Las ampolletas tienen una composición distinta y requieren otra gestión.', 3, 1, FALSE, 1, 0, 1, 6, 300, '2026-10-01T20:46:46.269Z'),
  ('ab425146-d1ca-40d0-a4f5-e905e99409f4', 'def69bf2-c674-4132-b29c-8eeb265b9c31', '0f691a17-009b-4d30-ab4e-bd84d49d7145', '¿Cómo conviene lavar una carga de ropa?', '["Con una prenda","Con carga completa","Repitiendo el ciclo","Sin centrifugado nunca"]'::jsonb, 'Una carga completa aprovecha mejor el agua y la energía de cada ciclo.', 1, 1, TRUE, 0, 60, 1, 7, 360, '2026-10-01T20:46:50.209Z'),
  ('6da91f9c-4252-4140-9c69-d350bd30dc7b', 'def69bf2-c674-4132-b29c-8eeb265b9c31', 'eced2e7f-72e2-4e8c-9a5e-bf40626a0146', '¿Qué práctica ayuda a proteger a los animales silvestres?', '["Observarlos a distancia","Alimentarlos siempre","Llevarlos a casa","Perseguirlos para fotografiarlos"]'::jsonb, 'Mantener distancia evita estrés, accidentes y cambios en su conducta.', 2, 0, FALSE, 1, 0, 0, 7, 360, '2026-10-01T20:46:52.603Z'),
  ('367838e3-71c6-444a-8e5d-8d33ab685ec3', '770d6fc8-ef1f-4831-bb57-227eceb611e0', 'cbe7410b-e687-41af-8e09-9bb0beb75438', '¿Qué se debe hacer al detectar una llave que gotea?', '["Ignorarla","Abrirla más","Cubrirla con un paño","Repararla pronto"]'::jsonb, 'Un goteo continuo puede desperdiciar mucha agua con el paso de los días.', NULL, 3, FALSE, 30, 0, 2, 0, 0, '2026-10-01T20:47:53.978Z'),
  ('4e63f6e3-ec7b-40ff-bcc3-e9b63bf87e24', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', '2cf08b56-1142-4fd3-9a7d-e5074bab835a', '¿Qué acción permite aprovechar mejor los alimentos antes de que venzan?', '["Esconderlos al fondo","Comprar duplicados","Desecharlos de inmediato","Ordenarlos por fecha"]'::jsonb, 'Dejar adelante los productos que vencen primero facilita consumirlos a tiempo.', 3, 3, TRUE, 11, 40, 3, 1, 40, '2026-10-01T22:46:05.172Z'),
  ('fbf9b14e-6f83-405c-97b3-6fb08d616e75', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', '84ca73b4-f398-4646-a0f8-556253dcbb9e', '¿Por qué son importantes los humedales urbanos?', '["Porque reemplazan todas las plazas","Porque almacenan basura","Porque eliminan toda inundación","Porque albergan especies y regulan agua"]'::jsonb, 'Los humedales entregan hábitat y ayudan a retener y filtrar agua.', 3, 3, TRUE, 7, 60, 3, 2, 100, '2026-10-01T22:46:13.797Z'),
  ('1f6bf12f-7cfc-4c8a-8a9e-983c4acd4d1a', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', '1f8e42dc-7a15-46be-a2b3-197c50629f0b', '¿Cuál es el orden preferible para manejar residuos?', '["Botar, comprar y quemar","Quemar, mezclar y enterrar","Reciclar, comprar y desechar","Reducir, reutilizar y reciclar"]'::jsonb, 'Primero se evita el residuo, luego se reutiliza y finalmente se recicla.', 3, 3, TRUE, 11, 40, 3, 3, 140, '2026-10-01T22:46:26.379Z'),
  ('a1546135-e38f-4c12-a697-dfed5912d677', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', 'c60ed76d-a670-4426-ba1b-f3c58bbc3901', '¿Por qué no se debe botar aceite de cocina por el lavaplatos?', '["Porque enfría el agua","Porque contamina y tapa tuberías","Porque cambia el color del metal","Porque produce electricidad"]'::jsonb, 'El aceite puede obstruir tuberías y contaminar grandes cantidades de agua.', 1, 1, TRUE, 4, 60, 3, 4, 200, '2026-10-01T22:46:31.713Z'),
  ('83f157b4-3eee-4206-a7bb-e9b269e14611', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', '706b3ce0-1536-4564-a0ee-2befad485461', '¿Qué acción desperdicia más agua al lavar un automóvil?', '["Usar un balde","Usar un paño húmedo","Reutilizar agua apta","Dejar la manguera abierta"]'::jsonb, 'Una manguera abierta entrega agua continuamente aunque no se esté enjuagando.', 3, 3, TRUE, 9, 60, 3, 5, 260, '2026-10-01T22:46:41.634Z'),
  ('1d8a0c57-2755-43b1-a4cf-3cb7397e2e9b', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', '3b07f061-7920-43c2-a2e7-7cd5cccd79ec', '¿Para qué sirve aislar puertas y ventanas en invierno?', '["Para aumentar la humedad","Para oscurecer la casa","Para conservar el calor","Para enfriar los muros"]'::jsonb, 'El aislamiento reduce la pérdida de calor y la necesidad de calefacción.', 2, 2, TRUE, 6, 60, 3, 6, 320, '2026-10-01T22:46:48.824Z'),
  ('cc8b5873-a87d-4b9f-a872-13713ef2faab', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', '69676b8f-d44a-4d31-916b-c4a3c4bf3282', '¿Por qué los envases reciclables deben ir sin restos de comida?', '["Para que pesen más","Para cambiar su color","Para no contaminar otros materiales","Para que ocupen más espacio"]'::jsonb, 'Los restos pueden ensuciar un lote y dificultar su aprovechamiento.', 2, 2, TRUE, 5, 60, 3, 7, 380, '2026-10-01T22:46:55.692Z'),
  ('c57a578c-a7be-45b7-a5cd-afa4485d1169', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', 'bcc3b08f-ff13-4923-b080-47d50f3b57a0', '¿Qué animal nativo chileno es el ciervo más pequeño del mundo?', '["Huemul","Pudú","Guanaco","Puma"]'::jsonb, 'El pudú es un pequeño ciervo nativo de los bosques templados de Chile.', 1, 1, TRUE, 5, 60, 3, 8, 440, '2026-10-01T22:47:01.881Z'),
  ('9b4771c2-1aed-4126-99e7-0127f7da53b4', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', '4a7e10d1-a2f1-46d2-9e7d-b60a9ccdb32a', '¿Qué significa preferir un producto durable?', '["Elegir el que dura más y puede repararse","Elegir el más desechable","Comprar varios iguales","Cambiarlo aunque funcione"]'::jsonb, 'Un producto durable necesita menos reemplazos y reduce el uso de materiales.', 0, 0, TRUE, 11, 40, 3, 9, 480, '2026-10-01T22:47:13.973Z'),
  ('5c5460ab-a8e7-46eb-84e2-1aaac9e9333d', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', '33a8c132-76be-4ba4-bb61-eecbc44adcef', '¿Por qué no se deben liberar mascotas exóticas en la naturaleza?', '["Porque pueden volverse invasoras","Porque aprenden a reciclar","Porque limpian los ríos","Porque reducen el ruido"]'::jsonb, 'Pueden reproducirse, transmitir enfermedades o afectar a especies nativas.', 0, 0, TRUE, 5, 60, 3, 10, 540, '2026-10-01T22:47:20.675Z'),
  ('ccf56f6c-e1c9-41c0-ae5d-0ed593d892ae', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', 'e0470fbe-4175-4abe-a3ab-2c2cc9dee1c9', '¿Qué se debe hacer con una botella plástica antes de reciclarla?', '["Llenarla con comida","Enjuagarla y compactarla","Quemarla","Enterrarla"]'::jsonb, 'Limpiarla evita contaminación y compactarla reduce el espacio de transporte.', 1, 1, TRUE, 5, 60, 3, 11, 600, '2026-10-01T22:47:27.388Z'),
  ('aa3240a1-6ad1-4a65-b1a5-ae5951f4c22b', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', '19527ec9-1e24-4f59-b112-0385ce52285c', '¿Qué ventaja puede tener comprar productos locales?', '["Siempre usan más envases","Pueden requerir menos transporte","Nunca tienen temporada","Eliminan todo impacto ambiental"]'::jsonb, 'Una menor distancia de transporte puede reducir consumo de combustible y emisiones.', 1, 1, TRUE, 20, 40, 3, 12, 640, '2026-10-01T22:47:48.803Z'),
  ('096bd58c-7560-4847-898d-066047cdcc11', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', 'c53f83a5-a363-481a-83e2-3c7a523a767b', '¿Qué elección ayuda a disminuir bolsas desechables?', '["Pedir varias bolsas","Usar una bolsa por artículo","Llevar una bolsa reutilizable","Botar la bolsa después de una compra"]'::jsonb, 'Una bolsa resistente puede usarse muchas veces y reemplazar bolsas de un solo uso.', 2, 2, TRUE, 9, 60, 3, 13, 700, '2026-10-01T22:47:59.474Z'),
  ('d5887430-5601-4ace-9e8c-829af096d5ca', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', '49a80e73-7fbd-4b3a-b8bd-40b2657dc535', '¿Qué medida mejora la eficiencia de un refrigerador?', '["Ponerlo junto al horno","Revisar el sello de la puerta","Dejar la puerta abierta","Guardar alimentos calientes"]'::jsonb, 'Un sello en buen estado evita fugas de aire frío y trabajo extra del motor.', 1, 1, TRUE, 13, 40, 3, 14, 740, '2026-10-01T22:48:13.653Z'),
  ('32f16017-ae54-48e7-85c2-0dfe225fff89', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', '0850d7df-08be-42a1-bfbc-2785849c7cc6', '¿Qué indica una etiqueta de eficiencia energética con clasificación A?', '["Mayor ruido","Menor eficiencia","Mayor tamaño","Alta eficiencia"]'::jsonb, 'La clasificación A identifica equipos que aprovechan mejor la energía.', 3, 3, TRUE, 6, 60, 3, 15, 800, '2026-10-01T22:48:21.372Z'),
  ('2f41a06f-934a-40d5-9cdc-b33bb993a68d', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', '6db6cd0a-294d-4955-b012-ce44a98a9f25', '¿Qué ampolleta consume menos energía para entregar una iluminación similar?', '["Incandescente","Halógena","LED","De filamento decorativo"]'::jsonb, 'Las ampolletas LED usan menos electricidad y duran más que las incandescentes.', 2, 2, TRUE, 6, 60, 3, 16, 860, '2026-10-01T22:48:29.213Z'),
  ('745f52ee-27c6-4cfe-b6e6-9d1af2c2965c', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', 'daf5ff8a-acfc-4aa8-9fea-a9165b23896c', '¿Cuál es una especie emblemática de la cordillera de los Andes en Chile?', '["Cóndor","Pingüino emperador","Canguro","Oso polar"]'::jsonb, 'El cóndor andino habita zonas montañosas y forma parte del escudo nacional.', 0, 0, TRUE, 4, 60, 3, 17, 920, '2026-10-01T22:48:34.733Z'),
  ('ffe1957a-d1af-4226-9862-67166a1b57df', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', '594d9f65-d770-4c0d-be4c-8faf91619076', '¿Qué efecto puede tener una especie invasora?', '["Crear agua potable","Aumentar siempre la diversidad","Desplazar especies nativas","Detener el viento"]'::jsonb, 'Una especie invasora puede competir por alimento y espacio con especies nativas.', 2, 2, TRUE, 4, 60, 3, 18, 980, '2026-10-01T22:48:40.667Z'),
  ('246c478d-bca7-4641-909b-f12a3330fdd7', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', 'd10006f1-c93a-48ef-8a9f-a1260a564c5f', '¿Qué conviene hacer antes de comprar algo nuevo?', '["Preguntarse si realmente se necesita","Botar un objeto útil","Elegir el mayor envase","Comprar sin comparar"]'::jsonb, 'Evaluar la necesidad evita compras impulsivas y el uso innecesario de recursos.', 0, 0, TRUE, 5, 60, 3, 19, 1040, '2026-10-01T22:48:47.093Z'),
  ('a3d94c55-0ecc-4d14-b539-4fe6da00f064', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', 'b61b66bf-437d-472c-9382-01ea59902efd', '¿Qué árbol es característico de los bosques del sur de Chile?', '["Baobab","Secuoya gigante","Alerce","Cocotero"]'::jsonb, 'El alerce es una especie nativa emblemática de los bosques australes.', 2, 2, TRUE, 4, 60, 3, 20, 1100, '2026-10-01T22:48:53.163Z'),
  ('ef1e3ec2-5efe-41f5-bd17-3f38e339fd0d', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', 'dce0a8ae-8ee1-4a98-8e90-b85f4cf9916f', '¿Qué opción aprovecha agua sin usar agua potable nueva?', '["Recolectar agua lluvia para riego","Lavar la vereda con manguera","Vaciar una piscina","Dejar correr la ducha"]'::jsonb, 'El agua lluvia almacenada puede emplearse en tareas como el riego.', 0, 0, TRUE, 13, 40, 3, 21, 1140, '2026-10-01T22:49:07.605Z'),
  ('b55146a4-a02c-4f69-aa15-5875135c3e88', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', 'c7d26c49-fc0f-4957-bb92-1402228de5cf', '¿Qué conducta protege la vegetación de un parque nacional?', '["Salirse de los senderos","Extraer flores","Encender fuego libremente","Caminar por senderos habilitados"]'::jsonb, 'Usar senderos reduce el daño sobre plantas y suelos frágiles.', NULL, 3, FALSE, 30, 0, 2, 21, 1140, '2026-10-01T22:49:39.637Z'),
  ('1f979544-9ed3-4909-8a44-f858262f75a0', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', 'cbe7410b-e687-41af-8e09-9bb0beb75438', '¿Qué se debe hacer al detectar una llave que gotea?', '["Ignorarla","Abrirla más","Cubrirla con un paño","Repararla pronto"]'::jsonb, 'Un goteo continuo puede desperdiciar mucha agua con el paso de los días.', 3, 3, TRUE, 6, 60, 2, 22, 1200, '2026-10-01T22:49:49.486Z'),
  ('7e5914bd-ac40-4b77-9584-95cfc28bb899', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', '74521154-5e76-42a5-b6d9-5e7ed11b4775', '¿Cuál de estos residuos es apropiado para compostar?', '["Vidrio","Metal","Plástico","Cáscaras de frutas"]'::jsonb, 'Las cáscaras son materia orgánica que puede transformarse en compost.', 2, 3, FALSE, 1, 0, 1, 22, 1200, '2026-10-01T22:49:52.463Z'),
  ('39786b13-5a9e-49cb-ac55-a7e8cc89dc7e', 'b2451116-d8cd-4bf5-9bef-5c88446b9b7f', '1d0fe7a9-7157-41a0-b950-843dbe9819df', '¿Qué acción reduce el consumo eléctrico de los aparatos en espera?', '["Desenchufarlos","Subir el brillo","Abrir las ventanas","Usar agua caliente"]'::jsonb, 'Los aparatos en espera siguen consumiendo energía si permanecen conectados.', 1, 0, FALSE, 1, 0, 0, 22, 1200, '2026-10-01T22:49:54.681Z'),
  ('64d5f713-f8e7-4007-9633-6f0f485c0f1a', '56b2b0e6-9ac1-4e3d-acdc-28b1f6ed7cbf', '1e5da6e8-c7c1-4946-a9a7-2fa02a68dd51', '¿Qué característica es preferible en una botella de uso diario?', '["Que sea reutilizable","Que sea de un solo uso","Que venga con varios envoltorios","Que no pueda lavarse"]'::jsonb, 'Una botella reutilizable reemplaza muchos envases desechables.', 0, 0, TRUE, 11, 40, 3, 1, 40, '2026-10-02T00:45:14.000Z'),
  ('17727433-01e6-4a0c-adc3-994513ec6f11', '56b2b0e6-9ac1-4e3d-acdc-28b1f6ed7cbf', 'b919b3e1-908c-4155-8261-5ba427356f6a', '¿Qué compra genera menos residuos?', '["Un producto con doble envoltorio","Un envase desechable","Un producto a granel en recipiente reutilizable","Una porción individual envuelta"]'::jsonb, 'Comprar a granel con un recipiente reutilizable evita envases de un solo uso.', NULL, 2, FALSE, 31, 0, 2, 1, 40, '2026-10-02T00:45:46.696Z'),
  ('abebf73b-db12-4fd6-a08b-b375c6f81fa7', 'bf873cda-ce4a-4c7a-9e4a-aa7a4082020a', '23f54a63-9c12-4609-9d12-63b826919a02', '¿Qué significa reutilizar un objeto?', '["Botarlo antes","Usarlo nuevamente","Mezclarlo con basura","Quemarlo"]'::jsonb, 'Reutilizar extiende la vida del objeto y evita generar un residuo nuevo.', 1, 1, TRUE, 6, 60, 3, 1, 60, '2026-10-04T20:11:34.625Z'),
  ('3388246a-45b4-49cc-b076-1b132a2618d9', 'bf873cda-ce4a-4c7a-9e4a-aa7a4082020a', 'e2aceaa4-51c7-470a-8599-963df811d600', '¿Qué beneficio tiene separar residuos en el hogar?', '["Facilita recuperar materiales","Aumenta la basura mezclada","Impide reutilizar","Elimina la necesidad de puntos limpios"]'::jsonb, 'La separación permite entregar cada material a su cadena de valorización.', 1, 0, FALSE, 4, 0, 2, 1, 60, '2026-10-04T20:11:40.658Z'),
  ('2731e7f6-5d1e-4cc8-af63-9cc617d9f32b', 'bf873cda-ce4a-4c7a-9e4a-aa7a4082020a', '259aed0d-16bb-4053-9a88-0f270a08d807', '¿Qué opción extiende la vida útil de una prenda?', '["Desecharla por un botón","Lavarlo todo a diario","Quemarla","Repararla"]'::jsonb, 'Reparar evita una compra nueva y aprovecha los materiales ya producidos.', 3, 3, TRUE, 7, 60, 2, 2, 120, '2026-10-04T20:11:49.977Z'),
  ('deb88086-6917-4d84-bbcd-e797fc29eaff', 'bf873cda-ce4a-4c7a-9e4a-aa7a4082020a', '35cfb3f4-f3ad-43d0-8dfd-c32305d263c2', '¿Qué acción favorece a los polinizadores en un jardín?', '["Usar pesticidas sin control","Plantar flores nativas","Cortar todas las flores","Reemplazar plantas por cemento"]'::jsonb, 'Las flores nativas entregan alimento y refugio adecuados a polinizadores locales.', 1, 1, TRUE, 10, 40, 2, 3, 160, '2026-10-04T20:12:01.951Z'),
  ('4a17316d-9e82-4bcd-917d-dfc187f71153', 'bf873cda-ce4a-4c7a-9e4a-aa7a4082020a', 'c27073d2-d367-49a1-b287-325fa2b8242f', '¿Qué hábito ayuda a gastar menos energía al hervir agua?', '["Hervir solo la cantidad necesaria","Llenar siempre el hervidor","Destaparlo mientras hierve","Repetir el hervido"]'::jsonb, 'Calentar únicamente el agua necesaria reduce electricidad y tiempo.', 0, 0, TRUE, 5, 60, 2, 4, 220, '2026-10-04T20:12:08.780Z'),
  ('1e8b927a-be7a-424e-9faa-77ec29137499', 'bf873cda-ce4a-4c7a-9e4a-aa7a4082020a', '8d0a7f50-40d9-4fcc-ae9c-618dbd9d17e0', '¿Qué ayuda a saber si existe una fuga oculta en el hogar?', '["Revisar el medidor sin consumo","Cambiar las cortinas","Encender las luces","Abrir el refrigerador"]'::jsonb, 'Si el medidor avanza con todas las llaves cerradas, puede existir una fuga.', 0, 0, TRUE, 11, 40, 2, 5, 260, '2026-10-04T20:12:21.596Z'),
  ('137e9a49-b805-485c-a4e2-67216c752f39', 'bf873cda-ce4a-4c7a-9e4a-aa7a4082020a', 'b464be63-f863-4b77-b9ab-1d42342869ed', '¿Qué conviene hacer con la calefacción al ventilar una habitación?', '["Apagarla durante la ventilación","Subirla al máximo","Abrir todas las puertas","Cubrir el calefactor"]'::jsonb, 'Apagarla evita desperdiciar energía mientras entra aire frío.', 0, 0, TRUE, 6, 60, 2, 6, 320, '2026-10-04T20:12:29.147Z'),
  ('4ce53fd6-7dee-40e6-a938-b928750de9de', 'bf873cda-ce4a-4c7a-9e4a-aa7a4082020a', '665219e2-7444-4948-b706-3ef1f2d41fe3', '¿Qué ecosistema chileno destaca por su adaptación a la escasez de lluvia?', '["Selva amazónica","Desierto de Atacama","Tundra ártica","Sabana africana"]'::jsonb, 'Las especies del desierto de Atacama poseen adaptaciones a condiciones extremadamente secas.', 1, 1, TRUE, 11, 40, 2, 7, 360, '2026-10-04T20:12:42.028Z')
ON CONFLICT DO NOTHING;

INSERT INTO public.trivia_answers (id, session_id, question_id, pregunta_snapshot, alternativas_snapshot, explicacion_snapshot, selected_index, correct_index, correcta, tiempo_segundos, xp_otorgada, vidas_restantes_resultado, correctas_resultado, xp_acumulada_resultado, answered_at) VALUES
  ('71f61d48-0f9c-4704-a00b-fdb8bf9e7e16', 'bf873cda-ce4a-4c7a-9e4a-aa7a4082020a', 'a4fc7df4-4b96-4910-99ee-472948a6b873', '¿Cuál ducha suele consumir menos agua?', '["Una ducha corta","Una ducha de una hora","Una tina llena","Una ducha con la llave abierta antes de entrar"]'::jsonb, 'Reducir el tiempo de ducha disminuye el consumo de agua y energía.', 0, 0, TRUE, 9, 60, 2, 8, 420, '2026-10-04T20:12:52.325Z'),
  ('e99fd564-eebc-43d2-bc20-48b017242b8b', 'bf873cda-ce4a-4c7a-9e4a-aa7a4082020a', '3e503f56-efaa-46f1-885e-f6bf84009ba6', '¿Qué residuo debe gestionarse como aparato eléctrico o electrónico?', '["Un teléfono dañado","Una cáscara de plátano","Una caja de cartón","Una botella de vidrio"]'::jsonb, 'Los teléfonos contienen componentes que requieren tratamiento especializado.', 0, 0, TRUE, 8, 60, 2, 9, 480, '2026-10-04T20:13:01.477Z'),
  ('4bbf719c-fa97-4a30-bea6-bcee607300df', 'bf873cda-ce4a-4c7a-9e4a-aa7a4082020a', '6a6b63ad-d932-4416-9148-e4ce21d27b92', '¿Cuándo es mejor regar el jardín para reducir la evaporación?', '["Al mediodía","Durante el mayor calor","Temprano o al atardecer","Solo cuando hay viento"]'::jsonb, 'A menor temperatura se evapora menos agua antes de llegar a las raíces.', 2, 2, TRUE, 1, 60, 2, 10, 540, '2026-10-04T20:13:04.092Z'),
  ('17257e75-4425-4baf-b75a-97ce8b7b0219', 'bf873cda-ce4a-4c7a-9e4a-aa7a4082020a', 'efbab23d-e0ab-47b6-a50b-077177402a50', '¿Qué transporte usa energía humana directamente?', '["Automóvil","Motocicleta","Avión","Bicicleta"]'::jsonb, 'La bicicleta se mueve con energía humana y no emite gases durante su uso.', 3, 3, TRUE, 3, 60, 2, 11, 600, '2026-10-04T20:13:08.476Z'),
  ('38f5b25f-284d-420a-9adb-d0c36fe1151c', 'bf873cda-ce4a-4c7a-9e4a-aa7a4082020a', 'f157a2e7-d70e-40e6-8979-94d37c7e7811', '¿Qué residuo suele aceptarse limpio y seco en reciclaje de papel?', '["Servilleta usada","Papel higiénico","Cartón limpio","Papel con aceite"]'::jsonb, 'El cartón limpio y seco puede incorporarse a procesos de reciclaje.', 2, 2, TRUE, 12, 40, 2, 12, 640, '2026-10-04T20:13:23.131Z'),
  ('376b6804-ca23-414f-9de3-b3488b2e15a7', 'bf873cda-ce4a-4c7a-9e4a-aa7a4082020a', 'da1eb88b-dfce-49f1-ae39-d80044fa02ec', '¿Qué artefacto permite reducir el caudal sin cortar el agua?', '["Una estufa","Un alargador","Un aireador de grifo","Una ampolleta"]'::jsonb, 'El aireador mezcla aire con agua y mantiene una sensación de buen caudal.', 1, 2, FALSE, 7, 0, 1, 12, 640, '2026-10-04T20:13:31.839Z'),
  ('9c70dd9c-7f40-4d16-87d7-391b68128d8a', 'bf873cda-ce4a-4c7a-9e4a-aa7a4082020a', '50f7c672-2778-4e0c-8015-8cfff6a46879', '¿Cómo se evita perder calor al cocinar en una olla?', '["Usando fuego máximo siempre","Agregando agua fría","Cocinando con tapa","Abriendo el horno"]'::jsonb, 'La tapa conserva el calor y permite cocinar usando menos energía.', 0, 2, FALSE, 1, 0, 0, 12, 640, '2026-10-04T20:13:34.945Z'),
  ('e512c352-94ac-42c7-a5dc-d34dd0adf42a', '52b5114c-4f1c-4b58-8d57-0380608271f4', 'f3fef784-9edf-46a0-b8ca-74158e5a3cd5', '¿Cuál es una alternativa responsable para un objeto que aún funciona y ya no se usa?', '["Romperlo","Donarlo o venderlo","Enterrarlo","Mezclarlo con residuos orgánicos"]'::jsonb, 'Entregarlo a otra persona prolonga su uso y evita que se transforme en residuo.', 1, 1, TRUE, 8, 60, 3, 1, 60, '2026-10-07T16:29:10.048Z'),
  ('35af4407-ac4a-480b-a03a-873c78147244', '52b5114c-4f1c-4b58-8d57-0380608271f4', 'da4bf614-9e4e-4cae-a96d-2769764a3cf8', '¿Qué hábito ahorra agua al cepillarse los dientes?', '["Usar agua caliente","Cerrar la llave","Abrir dos llaves","Dejar correr el agua"]'::jsonb, 'Cerrar la llave evita perder varios litros de agua durante el cepillado.', 1, 1, TRUE, 5, 60, 3, 2, 120, '2026-10-07T16:29:17.327Z'),
  ('ce6e84c5-7933-4b65-9b44-040124ab2f34', '52b5114c-4f1c-4b58-8d57-0380608271f4', 'f9c08c3e-fdf2-4f22-a94a-7eef32566d75', '¿Cómo se reduce el desperdicio de alimentos en el hogar?', '["Comprando sin lista","Planificando las comidas","Botando las sobras","Ignorando las fechas"]'::jsonb, 'Planificar ayuda a comprar cantidades adecuadas y aprovechar lo disponible.', 0, 1, FALSE, 7, 0, 2, 2, 120, '2026-10-07T16:29:25.808Z'),
  ('d9e6cc6b-04a9-4933-9819-05c371222952', '52b5114c-4f1c-4b58-8d57-0380608271f4', 'a5d13914-f0b3-4be1-8583-19cb10822637', '¿Cuál es una fuente de energía renovable disponible en el norte de Chile?', '["Carbón","Energía solar","Diésel","Gasolina"]'::jsonb, 'La alta radiación solar del norte de Chile favorece la generación fotovoltaica.', 1, 1, TRUE, 8, 60, 2, 3, 180, '2026-10-07T16:29:35.902Z'),
  ('06dbdcc8-fc92-43ff-a532-4bcaee793c04', '52b5114c-4f1c-4b58-8d57-0380608271f4', 'b35fc50b-eb86-4b11-9547-31bf80a83e3f', '¿Dónde deben llevarse las pilas usadas?', '["A un punto de recepción autorizado","Al compost","Al inodoro","A una fogata"]'::jsonb, 'Las pilas requieren manejo especial por los materiales que contienen.', 0, 0, TRUE, 13, 40, 2, 4, 220, '2026-10-07T16:29:50.883Z'),
  ('3a606825-afaf-4960-a5c5-3a00e06c1124', '52b5114c-4f1c-4b58-8d57-0380608271f4', '0e637a7b-f7f4-4e7d-b0b4-4bd813bf3e5b', '¿Qué material no debe mezclarse con vidrio de botellas en un punto limpio?', '["Botellas transparentes","Ampolletas","Frascos","Botellas verdes"]'::jsonb, 'Las ampolletas tienen una composición distinta y requieren otra gestión.', 0, 1, FALSE, 19, 0, 1, 4, 220, '2026-10-07T16:30:11.827Z'),
  ('d2fba674-6d46-429e-a5ae-adcf861f4775', '52b5114c-4f1c-4b58-8d57-0380608271f4', '0f691a17-009b-4d30-ab4e-bd84d49d7145', '¿Cómo conviene lavar una carga de ropa?', '["Con una prenda","Con carga completa","Repitiendo el ciclo","Sin centrifugado nunca"]'::jsonb, 'Una carga completa aprovecha mejor el agua y la energía de cada ciclo.', 1, 1, TRUE, 9, 60, 1, 5, 280, '2026-10-07T16:30:24.023Z'),
  ('df77df81-656d-49ee-b441-c10f15b5c60c', '52b5114c-4f1c-4b58-8d57-0380608271f4', 'eced2e7f-72e2-4e8c-9a5e-bf40626a0146', '¿Qué práctica ayuda a proteger a los animales silvestres?', '["Observarlos a distancia","Alimentarlos siempre","Llevarlos a casa","Perseguirlos para fotografiarlos"]'::jsonb, 'Mantener distancia evita estrés, accidentes y cambios en su conducta.', 0, 0, TRUE, 6, 60, 1, 6, 340, '2026-10-07T16:30:31.588Z'),
  ('a0a9a096-4dab-4462-802b-50ebdb4ae889', '52b5114c-4f1c-4b58-8d57-0380608271f4', '2cf08b56-1142-4fd3-9a7d-e5074bab835a', '¿Qué acción permite aprovechar mejor los alimentos antes de que venzan?', '["Esconderlos al fondo","Comprar duplicados","Desecharlos de inmediato","Ordenarlos por fecha"]'::jsonb, 'Dejar adelante los productos que vencen primero facilita consumirlos a tiempo.', 3, 3, TRUE, 7, 60, 1, 7, 400, '2026-10-07T16:30:40.246Z'),
  ('71654618-93f6-4cdb-b183-8863972bee99', '52b5114c-4f1c-4b58-8d57-0380608271f4', '84ca73b4-f398-4646-a0f8-556253dcbb9e', '¿Por qué son importantes los humedales urbanos?', '["Porque reemplazan todas las plazas","Porque almacenan basura","Porque eliminan toda inundación","Porque albergan especies y regulan agua"]'::jsonb, 'Los humedales entregan hábitat y ayudan a retener y filtrar agua.', 2, 3, FALSE, 11, 0, 0, 7, 400, '2026-10-07T16:30:53.136Z'),
  ('68089ae6-9e89-4537-bb2d-3f13ca097b7a', '71ce2357-f14b-4ab5-9c61-02b725a6ee7f', '1f8e42dc-7a15-46be-a2b3-197c50629f0b', '¿Cuál es el orden preferible para manejar residuos?', '["Botar, comprar y quemar","Quemar, mezclar y enterrar","Reciclar, comprar y desechar","Reducir, reutilizar y reciclar"]'::jsonb, 'Primero se evita el residuo, luego se reutiliza y finalmente se recicla.', 1, 3, FALSE, 20, 0, 2, 0, 0, '2026-10-09T00:20:31.781Z'),
  ('1d406f17-806e-48cc-bd57-2de5d2198c45', '71ce2357-f14b-4ab5-9c61-02b725a6ee7f', 'c60ed76d-a670-4426-ba1b-f3c58bbc3901', '¿Por qué no se debe botar aceite de cocina por el lavaplatos?', '["Porque enfría el agua","Porque contamina y tapa tuberías","Porque cambia el color del metal","Porque produce electricidad"]'::jsonb, 'El aceite puede obstruir tuberías y contaminar grandes cantidades de agua.', 1, 1, TRUE, 7, 60, 2, 1, 60, '2026-10-09T00:20:41.306Z'),
  ('3a7773ec-cb1b-4c94-922b-a687974f32b3', '71ce2357-f14b-4ab5-9c61-02b725a6ee7f', '706b3ce0-1536-4564-a0ee-2befad485461', '¿Qué acción desperdicia más agua al lavar un automóvil?', '["Usar un balde","Usar un paño húmedo","Reutilizar agua apta","Dejar la manguera abierta"]'::jsonb, 'Una manguera abierta entrega agua continuamente aunque no se esté enjuagando.', 3, 3, TRUE, 8, 60, 2, 2, 120, '2026-10-09T00:20:50.745Z'),
  ('3c76f77a-96fc-4f51-b060-7357abf5ae1f', '71ce2357-f14b-4ab5-9c61-02b725a6ee7f', '3b07f061-7920-43c2-a2e7-7cd5cccd79ec', '¿Para qué sirve aislar puertas y ventanas en invierno?', '["Para aumentar la humedad","Para oscurecer la casa","Para conservar el calor","Para enfriar los muros"]'::jsonb, 'El aislamiento reduce la pérdida de calor y la necesidad de calefacción.', 0, 2, FALSE, 12, 0, 1, 2, 120, '2026-10-09T00:21:03.757Z'),
  ('a90354fe-8259-4e75-9e69-ea6b0ad20cfa', '71ce2357-f14b-4ab5-9c61-02b725a6ee7f', '69676b8f-d44a-4d31-916b-c4a3c4bf3282', '¿Por qué los envases reciclables deben ir sin restos de comida?', '["Para que pesen más","Para cambiar su color","Para no contaminar otros materiales","Para que ocupen más espacio"]'::jsonb, 'Los restos pueden ensuciar un lote y dificultar su aprovechamiento.', 1, 2, FALSE, 1, 0, 0, 2, 120, '2026-10-09T00:21:06.499Z'),
  ('1d953324-fc3f-4db8-8131-1519e041b6a3', '71ce2357-f14b-4ab5-9c61-02b725a6ee7f', 'bcc3b08f-ff13-4923-b080-47d50f3b57a0', '¿Qué animal nativo chileno es el ciervo más pequeño del mundo?', '["Huemul","Pudú","Guanaco","Puma"]'::jsonb, 'El pudú es un pequeño ciervo nativo de los bosques templados de Chile.', 1, 1, TRUE, 1, 60, 1, 3, 180, '2026-10-09T00:21:11.958Z'),
  ('ec2577a1-b243-4d25-ba60-f01ab8134551', '4c8be462-64ac-4bb3-91d7-0a8f75cd2741', '33a8c132-76be-4ba4-bb61-eecbc44adcef', '¿Por qué no se deben liberar mascotas exóticas en la naturaleza?', '["Porque pueden volverse invasoras","Porque aprenden a reciclar","Porque limpian los ríos","Porque reducen el ruido"]'::jsonb, 'Pueden reproducirse, transmitir enfermedades o afectar a especies nativas.', 0, 0, TRUE, 5, 60, 3, 1, 60, '2026-10-13T18:33:06.054Z'),
  ('d34e63a2-a6b6-4bff-b072-cff6eebb5d8c', '4c8be462-64ac-4bb3-91d7-0a8f75cd2741', 'e0470fbe-4175-4abe-a3ab-2c2cc9dee1c9', '¿Qué se debe hacer con una botella plástica antes de reciclarla?', '["Llenarla con comida","Enjuagarla y compactarla","Quemarla","Enterrarla"]'::jsonb, 'Limpiarla evita contaminación y compactarla reduce el espacio de transporte.', 1, 1, TRUE, 12, 40, 3, 2, 100, '2026-10-13T18:33:20.087Z'),
  ('b9525099-c386-4be7-a9c7-2ff5f608b4d4', '4c8be462-64ac-4bb3-91d7-0a8f75cd2741', '19527ec9-1e24-4f59-b112-0385ce52285c', '¿Qué ventaja puede tener comprar productos locales?', '["Siempre usan más envases","Pueden requerir menos transporte","Nunca tienen temporada","Eliminan todo impacto ambiental"]'::jsonb, 'Una menor distancia de transporte puede reducir consumo de combustible y emisiones.', 1, 1, TRUE, 8, 60, 3, 3, 160, '2026-10-13T18:33:30.247Z'),
  ('ced91822-61b2-4b41-b1e8-28dcc890e5c0', '4c8be462-64ac-4bb3-91d7-0a8f75cd2741', 'c53f83a5-a363-481a-83e2-3c7a523a767b', '¿Qué elección ayuda a disminuir bolsas desechables?', '["Pedir varias bolsas","Usar una bolsa por artículo","Llevar una bolsa reutilizable","Botar la bolsa después de una compra"]'::jsonb, 'Una bolsa resistente puede usarse muchas veces y reemplazar bolsas de un solo uso.', 2, 2, TRUE, 14, 40, 3, 4, 200, '2026-10-13T18:33:46.265Z'),
  ('cf01e835-f74e-4d54-8962-a3baf3b0c5cd', '4c8be462-64ac-4bb3-91d7-0a8f75cd2741', '49a80e73-7fbd-4b3a-b8bd-40b2657dc535', '¿Qué medida mejora la eficiencia de un refrigerador?', '["Ponerlo junto al horno","Revisar el sello de la puerta","Dejar la puerta abierta","Guardar alimentos calientes"]'::jsonb, 'Un sello en buen estado evita fugas de aire frío y trabajo extra del motor.', 1, 1, TRUE, 12, 40, 3, 5, 240, '2026-10-13T18:34:00.148Z'),
  ('77351004-e787-4f1a-a3a8-86d2c8d829dc', '4c8be462-64ac-4bb3-91d7-0a8f75cd2741', '0850d7df-08be-42a1-bfbc-2785849c7cc6', '¿Qué indica una etiqueta de eficiencia energética con clasificación A?', '["Mayor ruido","Menor eficiencia","Mayor tamaño","Alta eficiencia"]'::jsonb, 'La clasificación A identifica equipos que aprovechan mejor la energía.', 3, 3, TRUE, 8, 60, 3, 6, 300, '2026-10-13T18:34:09.627Z'),
  ('dc329ce9-cd78-4aaa-9137-37d2709db7bb', '4c8be462-64ac-4bb3-91d7-0a8f75cd2741', '6db6cd0a-294d-4955-b012-ce44a98a9f25', '¿Qué ampolleta consume menos energía para entregar una iluminación similar?', '["Incandescente","Halógena","LED","De filamento decorativo"]'::jsonb, 'Las ampolletas LED usan menos electricidad y duran más que las incandescentes.', 2, 2, TRUE, 5, 60, 3, 7, 360, '2026-10-13T18:34:18.947Z'),
  ('617e2e01-c63e-43a6-aedd-d7ee75aacf00', '4c8be462-64ac-4bb3-91d7-0a8f75cd2741', 'daf5ff8a-acfc-4aa8-9fea-a9165b23896c', '¿Cuál es una especie emblemática de la cordillera de los Andes en Chile?', '["Cóndor","Pingüino emperador","Canguro","Oso polar"]'::jsonb, 'El cóndor andino habita zonas montañosas y forma parte del escudo nacional.', 0, 0, TRUE, 9, 60, 3, 8, 420, '2026-10-13T18:34:29.816Z'),
  ('02f17ffe-8e6a-4718-85e0-dcdba3463db8', '4c8be462-64ac-4bb3-91d7-0a8f75cd2741', '594d9f65-d770-4c0d-be4c-8faf91619076', '¿Qué efecto puede tener una especie invasora?', '["Crear agua potable","Aumentar siempre la diversidad","Desplazar especies nativas","Detener el viento"]'::jsonb, 'Una especie invasora puede competir por alimento y espacio con especies nativas.', 2, 2, TRUE, 10, 40, 3, 9, 460, '2026-10-13T18:34:41.703Z'),
  ('c976c9e6-eb0c-4509-b40b-9d480026bddf', '4c8be462-64ac-4bb3-91d7-0a8f75cd2741', 'd10006f1-c93a-48ef-8a9f-a1260a564c5f', '¿Qué conviene hacer antes de comprar algo nuevo?', '["Preguntarse si realmente se necesita","Botar un objeto útil","Elegir el mayor envase","Comprar sin comparar"]'::jsonb, 'Evaluar la necesidad evita compras impulsivas y el uso innecesario de recursos.', 0, 0, TRUE, 7, 60, 3, 10, 520, '2026-10-13T18:34:50.199Z'),
  ('def8906f-074f-4924-8967-875feb76d892', '4c8be462-64ac-4bb3-91d7-0a8f75cd2741', 'b61b66bf-437d-472c-9382-01ea59902efd', '¿Qué árbol es característico de los bosques del sur de Chile?', '["Baobab","Secuoya gigante","Alerce","Cocotero"]'::jsonb, 'El alerce es una especie nativa emblemática de los bosques australes.', 2, 2, TRUE, 8, 60, 3, 11, 580, '2026-10-13T18:35:00.129Z'),
  ('6d9675cf-4eb2-40eb-b160-da0b5711141b', '4c8be462-64ac-4bb3-91d7-0a8f75cd2741', 'dce0a8ae-8ee1-4a98-8e90-b85f4cf9916f', '¿Qué opción aprovecha agua sin usar agua potable nueva?', '["Recolectar agua lluvia para riego","Lavar la vereda con manguera","Vaciar una piscina","Dejar correr la ducha"]'::jsonb, 'El agua lluvia almacenada puede emplearse en tareas como el riego.', 0, 0, TRUE, 9, 60, 3, 12, 640, '2026-10-13T18:35:10.825Z'),
  ('199dee24-12a1-464f-87ea-bc7a197115dc', '4c8be462-64ac-4bb3-91d7-0a8f75cd2741', 'c7d26c49-fc0f-4957-bb92-1402228de5cf', '¿Qué conducta protege la vegetación de un parque nacional?', '["Salirse de los senderos","Extraer flores","Encender fuego libremente","Caminar por senderos habilitados"]'::jsonb, 'Usar senderos reduce el daño sobre plantas y suelos frágiles.', 3, 3, TRUE, 12, 40, 3, 13, 680, '2026-10-13T18:35:25.059Z'),
  ('2f1f2b08-28ec-46b4-b23e-31be39dd5763', '4c8be462-64ac-4bb3-91d7-0a8f75cd2741', '1d0fe7a9-7157-41a0-b950-843dbe9819df', '¿Qué acción reduce el consumo eléctrico de los aparatos en espera?', '["Desenchufarlos","Subir el brillo","Abrir las ventanas","Usar agua caliente"]'::jsonb, 'Los aparatos en espera siguen consumiendo energía si permanecen conectados.', 0, 0, TRUE, 3, 60, 3, 14, 740, '2026-10-13T18:35:29.382Z'),
  ('08b8e70f-0b15-40e8-acb9-69ed751ba90d', '4c8be462-64ac-4bb3-91d7-0a8f75cd2741', '1e5da6e8-c7c1-4946-a9a7-2fa02a68dd51', '¿Qué característica es preferible en una botella de uso diario?', '["Que sea reutilizable","Que sea de un solo uso","Que venga con varios envoltorios","Que no pueda lavarse"]'::jsonb, 'Una botella reutilizable reemplaza muchos envases desechables.', 0, 0, TRUE, 14, 40, 3, 15, 780, '2026-10-13T18:35:44.724Z'),
  ('ec925ff3-a063-4e3c-b563-c244ac090705', '4c8be462-64ac-4bb3-91d7-0a8f75cd2741', 'b919b3e1-908c-4155-8261-5ba427356f6a', '¿Qué compra genera menos residuos?', '["Un producto con doble envoltorio","Un envase desechable","Un producto a granel en recipiente reutilizable","Una porción individual envuelta"]'::jsonb, 'Comprar a granel con un recipiente reutilizable evita envases de un solo uso.', 1, 2, FALSE, 12, 0, 2, 15, 780, '2026-10-13T18:35:59.392Z'),
  ('7fd19fc9-275a-4e86-a34e-a443d3e887d8', '4c8be462-64ac-4bb3-91d7-0a8f75cd2741', '23f54a63-9c12-4609-9d12-63b826919a02', '¿Qué significa reutilizar un objeto?', '["Botarlo antes","Usarlo nuevamente","Mezclarlo con basura","Quemarlo"]'::jsonb, 'Reutilizar extiende la vida del objeto y evita generar un residuo nuevo.', 1, 1, TRUE, 3, 60, 2, 16, 840, '2026-10-13T18:36:04.519Z'),
  ('1650066c-ace6-40c1-8f32-e17ad8266b15', '4c8be462-64ac-4bb3-91d7-0a8f75cd2741', 'cbe7410b-e687-41af-8e09-9bb0beb75438', '¿Qué se debe hacer al detectar una llave que gotea?', '["Ignorarla","Abrirla más","Cubrirla con un paño","Repararla pronto"]'::jsonb, 'Un goteo continuo puede desperdiciar mucha agua con el paso de los días.', 3, 3, TRUE, 8, 60, 2, 17, 900, '2026-10-13T18:36:14.016Z'),
  ('a94b492d-d0ec-4065-9932-d3ce2c3953d2', '4c8be462-64ac-4bb3-91d7-0a8f75cd2741', '74521154-5e76-42a5-b6d9-5e7ed11b4775', '¿Cuál de estos residuos es apropiado para compostar?', '["Vidrio","Metal","Plástico","Cáscaras de frutas"]'::jsonb, 'Las cáscaras son materia orgánica que puede transformarse en compost.', 2, 3, FALSE, 21, 0, 1, 17, 900, '2026-10-13T18:36:36.959Z'),
  ('99f8b7f2-5f2f-4fa7-92a9-8223e1c9e5b0', '4c8be462-64ac-4bb3-91d7-0a8f75cd2741', 'e2aceaa4-51c7-470a-8599-963df811d600', '¿Qué beneficio tiene separar residuos en el hogar?', '["Facilita recuperar materiales","Aumenta la basura mezclada","Impide reutilizar","Elimina la necesidad de puntos limpios"]'::jsonb, 'La separación permite entregar cada material a su cadena de valorización.', 3, 0, FALSE, 12, 0, 0, 17, 900, '2026-10-13T18:36:53.954Z'),
  ('e592e2f6-9ad0-4d68-a731-ecf50c48f60b', '789b610f-7423-4a8f-adcc-2b8afa4ab656', '259aed0d-16bb-4053-9a88-0f270a08d807', '¿Qué opción extiende la vida útil de una prenda?', '["Desecharla por un botón","Lavarlo todo a diario","Quemarla","Repararla"]'::jsonb, 'Reparar evita una compra nueva y aprovecha los materiales ya producidos.', 3, 3, TRUE, 8, 60, 3, 1, 60, '2026-10-23T01:05:32.575Z'),
  ('51914968-259d-42eb-b443-c5e420725da9', '789b610f-7423-4a8f-adcc-2b8afa4ab656', '35cfb3f4-f3ad-43d0-8dfd-c32305d263c2', '¿Qué acción favorece a los polinizadores en un jardín?', '["Usar pesticidas sin control","Plantar flores nativas","Cortar todas las flores","Reemplazar plantas por cemento"]'::jsonb, 'Las flores nativas entregan alimento y refugio adecuados a polinizadores locales.', 1, 1, TRUE, 9, 60, 3, 2, 120, '2026-10-23T01:05:44.729Z'),
  ('2c11ac98-c4d0-4dcf-b9e3-4e4fcfe2b1d2', '789b610f-7423-4a8f-adcc-2b8afa4ab656', 'c27073d2-d367-49a1-b287-325fa2b8242f', '¿Qué hábito ayuda a gastar menos energía al hervir agua?', '["Hervir solo la cantidad necesaria","Llenar siempre el hervidor","Destaparlo mientras hierve","Repetir el hervido"]'::jsonb, 'Calentar únicamente el agua necesaria reduce electricidad y tiempo.', 0, 0, TRUE, 4, 60, 3, 3, 180, '2026-10-23T01:05:50.603Z'),
  ('0767afe0-d3c5-4c7f-9c77-2b9b23072e9e', '789b610f-7423-4a8f-adcc-2b8afa4ab656', '8d0a7f50-40d9-4fcc-ae9c-618dbd9d17e0', '¿Qué ayuda a saber si existe una fuga oculta en el hogar?', '["Revisar el medidor sin consumo","Cambiar las cortinas","Encender las luces","Abrir el refrigerador"]'::jsonb, 'Si el medidor avanza con todas las llaves cerradas, puede existir una fuga.', 0, 0, TRUE, 7, 60, 3, 4, 240, '2026-10-23T01:05:58.921Z'),
  ('3419b60f-bd68-4902-9a13-8d81e19f5103', '789b610f-7423-4a8f-adcc-2b8afa4ab656', 'b464be63-f863-4b77-b9ab-1d42342869ed', '¿Qué conviene hacer con la calefacción al ventilar una habitación?', '["Apagarla durante la ventilación","Subirla al máximo","Abrir todas las puertas","Cubrir el calefactor"]'::jsonb, 'Apagarla evita desperdiciar energía mientras entra aire frío.', 0, 0, TRUE, 16, 40, 3, 5, 280, '2026-10-23T01:06:17.063Z'),
  ('b51c4721-e4b6-4d04-8673-42efdce0a5c8', '789b610f-7423-4a8f-adcc-2b8afa4ab656', '665219e2-7444-4948-b706-3ef1f2d41fe3', '¿Qué ecosistema chileno destaca por su adaptación a la escasez de lluvia?', '["Selva amazónica","Desierto de Atacama","Tundra ártica","Sabana africana"]'::jsonb, 'Las especies del desierto de Atacama poseen adaptaciones a condiciones extremadamente secas.', 2, 1, FALSE, 0, 0, 2, 5, 280, '2026-10-23T01:06:18.635Z'),
  ('54692b87-e4a0-41f7-8a2b-49b9375b5b17', '789b610f-7423-4a8f-adcc-2b8afa4ab656', 'a4fc7df4-4b96-4910-99ee-472948a6b873', '¿Cuál ducha suele consumir menos agua?', '["Una ducha corta","Una ducha de una hora","Una tina llena","Una ducha con la llave abierta antes de entrar"]'::jsonb, 'Reducir el tiempo de ducha disminuye el consumo de agua y energía.', 3, 0, FALSE, 0, 0, 1, 5, 280, '2026-10-23T01:06:20.204Z')
ON CONFLICT DO NOTHING;

INSERT INTO public.trivia_answers (id, session_id, question_id, pregunta_snapshot, alternativas_snapshot, explicacion_snapshot, selected_index, correct_index, correcta, tiempo_segundos, xp_otorgada, vidas_restantes_resultado, correctas_resultado, xp_acumulada_resultado, answered_at) VALUES
  ('b6774544-679a-44a3-9be9-dcd599bb9832', '789b610f-7423-4a8f-adcc-2b8afa4ab656', '3e503f56-efaa-46f1-885e-f6bf84009ba6', '¿Qué residuo debe gestionarse como aparato eléctrico o electrónico?', '["Un teléfono dañado","Una cáscara de plátano","Una caja de cartón","Una botella de vidrio"]'::jsonb, 'Los teléfonos contienen componentes que requieren tratamiento especializado.', 1, 0, FALSE, 0, 0, 0, 5, 280, '2026-10-23T01:06:21.485Z'),
  ('e8c9ab86-7dc7-4405-bc4d-5badb3127d8c', '64ff5e29-0131-492b-a3fd-3705ab5cc6dd', '6a6b63ad-d932-4416-9148-e4ce21d27b92', '¿Cuándo es mejor regar el jardín para reducir la evaporación?', '["Al mediodía","Durante el mayor calor","Temprano o al atardecer","Solo cuando hay viento"]'::jsonb, 'A menor temperatura se evapora menos agua antes de llegar a las raíces.', 1, 2, FALSE, 17, 0, 2, 0, 0, '2026-10-23T23:05:35.525Z'),
  ('813cc698-6085-4fa4-93ac-527477ac56d9', '64ff5e29-0131-492b-a3fd-3705ab5cc6dd', 'efbab23d-e0ab-47b6-a50b-077177402a50', '¿Qué transporte usa energía humana directamente?', '["Automóvil","Motocicleta","Avión","Bicicleta"]'::jsonb, 'La bicicleta se mueve con energía humana y no emite gases durante su uso.', 3, 3, TRUE, 9, 60, 2, 1, 60, '2026-10-23T23:05:54.652Z'),
  ('e1fb272f-97a3-47ed-afa3-a3109b68ae7d', '64ff5e29-0131-492b-a3fd-3705ab5cc6dd', 'f157a2e7-d70e-40e6-8979-94d37c7e7811', '¿Qué residuo suele aceptarse limpio y seco en reciclaje de papel?', '["Servilleta usada","Papel higiénico","Cartón limpio","Papel con aceite"]'::jsonb, 'El cartón limpio y seco puede incorporarse a procesos de reciclaje.', 0, 2, FALSE, 1, 0, 1, 1, 60, '2026-10-23T23:05:58.771Z'),
  ('1538a067-4cc2-4d54-b17e-e599300f0b7c', '64ff5e29-0131-492b-a3fd-3705ab5cc6dd', 'da1eb88b-dfce-49f1-ae39-d80044fa02ec', '¿Qué artefacto permite reducir el caudal sin cortar el agua?', '["Una estufa","Un alargador","Un aireador de grifo","Una ampolleta"]'::jsonb, 'El aireador mezcla aire con agua y mantiene una sensación de buen caudal.', 1, 2, FALSE, 0, 0, 0, 1, 60, '2026-10-23T23:06:00.891Z'),
  ('09f9f3c1-e47e-46b2-aead-aa55dd78a1cd', '1c4ee6b7-2212-43e5-a570-d1e39c6b4dff', '50f7c672-2778-4e0c-8015-8cfff6a46879', '¿Cómo se evita perder calor al cocinar en una olla?', '["Usando fuego máximo siempre","Agregando agua fría","Cocinando con tapa","Abriendo el horno"]'::jsonb, 'La tapa conserva el calor y permite cocinar usando menos energía.', 2, 2, TRUE, 10, 9, 3, 1, 9, '2026-10-27T15:02:37.289Z'),
  ('03463faf-08bf-46dd-b403-ad387061deaa', '1c4ee6b7-2212-43e5-a570-d1e39c6b4dff', 'f3fef784-9edf-46a0-b8ca-74158e5a3cd5', '¿Cuál es una alternativa responsable para un objeto que aún funciona y ya no se usa?', '["Romperlo","Donarlo o venderlo","Enterrarlo","Mezclarlo con residuos orgánicos"]'::jsonb, 'Entregarlo a otra persona prolonga su uso y evita que se transforme en residuo.', 1, 1, TRUE, 12, 8, 3, 2, 17, '2026-10-27T15:02:51.134Z')
ON CONFLICT DO NOTHING;

-- Datos para public.logros (11 filas)
INSERT INTO public.logros (id, codigo, titulo, descripcion, monedas_recompensa, created_at) VALUES
  ('ca5f187f-9bbb-46fc-bda1-b65f959cd4fd', 'PRIMERA_DUCHA', 'Ducha Eficiente', 'Completa tu primer Speedrun de Ducha válido', 5, '2026-09-22T12:52:12.099Z'),
  ('bb7de31d-0f81-42c2-80d9-2d7de9b0f73d', 'MAESTRO_ECO', 'Experto del Reciclaje', 'Completa un Eco-Puzzle con 0 errores', 5, '2026-09-22T12:52:12.099Z'),
  ('b5756983-789d-4dd7-86b8-f2841d8a8417', 'RACHA_3', 'Constancia Verde', 'Alcanza una racha de 3 días consecutivos', 8, '2026-09-22T12:52:12.099Z'),
  ('26929b5c-d0a1-4acd-bd5e-45f6a5e92a9b', 'MEDALLA_DUCHA_BRONCE', 'Ducha de Bronce', 'Completa 5 duchas ecológicas válidas.', 12, '2026-10-23T00:36:09.230Z'),
  ('7523862f-2c91-49aa-979e-95a7082e155b', 'MEDALLA_PUZZLE_ORO', 'Mente Maestra', 'Completa 10 Eco-Puzzles sin errores.', 15, '2026-10-23T00:36:09.230Z'),
  ('4143455b-581b-43e9-9116-5f9be512020c', 'MEDALLA_FAMILIA', 'Espíritu Familiar', 'Aporta a tu primera colecta familiar.', 5, '2026-10-23T00:36:09.230Z'),
  ('06596663-b694-41d7-91ed-2554c3dc450a', 'RECICLADOR_PERFECTO', 'Reciclador Impecable', 'Clasifica todos los residuos del Eco-Puzzle con 0 errores.', 8, '2026-10-24T02:02:55.771Z'),
  ('6b476458-ec1f-4e7f-9ae9-807dc1ca461e', 'ESPIRITU_FAMILIAR', 'Espíritu de Equipo', 'Aporta monedas para alcanzar un premio colaborativo familiar.', 10, '2026-10-24T02:02:55.771Z'),
  ('02f52121-ad74-4925-a409-118e7936adbf', 'RACHA_7', 'Semana Verde', 'Mantén una racha de constancia activa por 7 días seguidos.', 15, '2026-10-24T02:02:55.771Z'),
  ('345923e9-db4a-407e-b7eb-26bb1f9fa44e', 'BILLETERA_ECO', 'Ahorrador Experto', 'Acumula tus primeras 100 monedas en tu saldo.', 8, '2026-10-24T02:02:55.771Z'),
  ('53d8e5c8-2cd3-426c-8e73-b2a4ef234d38', 'DUCHA_FLASH', 'Ducha Relámpago', 'Termina una ducha ecológica en 5 minutos o menos.', 10, '2026-10-24T02:02:55.771Z')
ON CONFLICT DO NOTHING;

-- Datos para public.usuario_logros (24 filas)
INSERT INTO public.usuario_logros (id, user_id, logro_id, reclamado, fecha_desbloqueo) VALUES
  ('a9eddd98-9a61-4e87-b6ce-eded03681e78', 'b1c2e021-e2ae-4f88-a983-ec89916bf767', 'ca5f187f-9bbb-46fc-bda1-b65f959cd4fd', TRUE, '2026-09-22T13:36:31.777Z'),
  ('a73c1b28-6838-4723-b850-1c333213d5b8', 'b1c2e021-e2ae-4f88-a983-ec89916bf767', 'bb7de31d-0f81-42c2-80d9-2d7de9b0f73d', TRUE, '2026-09-22T13:36:32.630Z'),
  ('77f80c06-8b95-469d-8cee-c5488099ede1', '5f0813c3-216e-4158-b1b9-af2abbb845d0', 'ca5f187f-9bbb-46fc-bda1-b65f959cd4fd', TRUE, '2026-09-22T13:36:32.053Z'),
  ('52e270f4-e517-46ee-a328-0aecdf72838d', '5f0813c3-216e-4158-b1b9-af2abbb845d0', 'bb7de31d-0f81-42c2-80d9-2d7de9b0f73d', TRUE, '2026-09-22T13:36:32.899Z'),
  ('c066a0d0-a471-4b14-aefc-54758117e579', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'ca5f187f-9bbb-46fc-bda1-b65f959cd4fd', FALSE, '2026-09-28T01:08:40.838Z'),
  ('bf703ad1-aaef-4835-9812-d1cd53fcbdd0', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'bb7de31d-0f81-42c2-80d9-2d7de9b0f73d', FALSE, '2026-10-01T20:27:40.524Z'),
  ('1ebbd5dc-9165-4301-89ee-15a4aeb89016', 'ee5ae37b-9d73-4bad-be43-df67b724d535', '06596663-b694-41d7-91ed-2554c3dc450a', FALSE, '2026-10-26T19:07:44.050Z'),
  ('2afb8a7d-dd81-429f-b48d-8dbd30b99a69', 'ee5ae37b-9d73-4bad-be43-df67b724d535', '345923e9-db4a-407e-b7eb-26bb1f9fa44e', FALSE, '2026-10-26T19:07:44.050Z'),
  ('b36007f9-8736-431e-8ebb-48a31f6b35c7', 'ee5ae37b-9d73-4bad-be43-df67b724d535', 'ca5f187f-9bbb-46fc-bda1-b65f959cd4fd', FALSE, '2026-10-26T20:33:56.692Z'),
  ('3daf8e3a-9bcb-404d-bb90-79a0350fa73e', 'ee5ae37b-9d73-4bad-be43-df67b724d535', 'bb7de31d-0f81-42c2-80d9-2d7de9b0f73d', TRUE, '2026-10-26T19:07:44.050Z'),
  ('3f5d926e-ecb8-4f4b-a52c-fe8e7fa7926e', '94779849-d3cf-473b-878d-593f1aa65f7f', 'bb7de31d-0f81-42c2-80d9-2d7de9b0f73d', TRUE, '2026-10-27T00:43:05.689Z'),
  ('6a94eb0b-1eeb-41dd-90f0-361a2979403e', '94779849-d3cf-473b-878d-593f1aa65f7f', '06596663-b694-41d7-91ed-2554c3dc450a', TRUE, '2026-10-27T00:43:05.689Z'),
  ('347d88f3-5957-49db-a318-5d7c121071a0', 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'bb7de31d-0f81-42c2-80d9-2d7de9b0f73d', TRUE, '2026-10-27T16:43:16.614Z'),
  ('ebec0240-04ea-4064-99c6-b9686696afc6', 'fbfe8f40-f773-4484-800a-9d64dd464e88', '06596663-b694-41d7-91ed-2554c3dc450a', TRUE, '2026-10-27T16:43:16.614Z'),
  ('49b37d2e-fb0f-4771-a59c-c5343ccc46ed', 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'ca5f187f-9bbb-46fc-bda1-b65f959cd4fd', TRUE, '2026-10-27T16:52:34.124Z'),
  ('9368f254-f4b1-4ba6-9f18-2e54080bb9ec', '502636de-20d6-4644-aae5-ac70bec5db7a', 'ca5f187f-9bbb-46fc-bda1-b65f959cd4fd', TRUE, '2026-09-24T15:40:44.907Z'),
  ('2a0e2b8f-9ad7-48d9-b263-ff6de621bc57', '502636de-20d6-4644-aae5-ac70bec5db7a', '4143455b-581b-43e9-9116-5f9be512020c', TRUE, '2026-10-28T15:46:27.342Z'),
  ('9ee31dcf-04d9-44da-a4d2-9853ebfc47c4', '502636de-20d6-4644-aae5-ac70bec5db7a', '6b476458-ec1f-4e7f-9ae9-807dc1ca461e', TRUE, '2026-10-28T15:46:27.342Z'),
  ('5442df0e-5980-4ac9-b2ff-f1ffd0e6f769', '502636de-20d6-4644-aae5-ac70bec5db7a', '06596663-b694-41d7-91ed-2554c3dc450a', FALSE, '2026-10-28T16:20:18.591Z'),
  ('d8c1e59e-dae7-4c23-81dc-8a5a3ed5be11', '502636de-20d6-4644-aae5-ac70bec5db7a', 'bb7de31d-0f81-42c2-80d9-2d7de9b0f73d', TRUE, '2026-10-28T16:20:18.591Z'),
  ('d41ee632-b23b-4f9f-8fc3-abaac2ae86bc', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'ca5f187f-9bbb-46fc-bda1-b65f959cd4fd', TRUE, '2026-09-28T01:07:05.520Z'),
  ('06311d8f-f998-4c51-b84b-9ba3815009e3', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'bb7de31d-0f81-42c2-80d9-2d7de9b0f73d', TRUE, '2026-09-24T00:23:44.497Z'),
  ('011374cf-f7bf-43b8-aaa7-eb588565ff66', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', '4143455b-581b-43e9-9116-5f9be512020c', TRUE, '2026-10-29T02:00:29.000Z'),
  ('d1c60322-e2d7-400e-8123-fb022f79ca62', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', '6b476458-ec1f-4e7f-9ae9-807dc1ca461e', TRUE, '2026-10-29T02:00:29.000Z')
ON CONFLICT DO NOTHING;

-- Datos para public.historial_gamificacion (93 filas)
INSERT INTO public.historial_gamificacion (id, user_id, origen_actividad, monedas_otorgadas, xp_otorgada, created_at) VALUES
  (1, 'b1c2e021-e2ae-4f88-a983-ec89916bf767', 'speedrun_ducha', 2, 200, '2026-09-22T13:36:31.777Z'),
  (2, '5f0813c3-216e-4158-b1b9-af2abbb845d0', 'speedrun_ducha', 1, 100, '2026-09-22T13:36:32.053Z'),
  (3, 'b1c2e021-e2ae-4f88-a983-ec89916bf767', 'eco_puzzle', 2, 150, '2026-09-22T13:36:32.630Z'),
  (4, '5f0813c3-216e-4158-b1b9-af2abbb845d0', 'eco_puzzle', 2, 150, '2026-09-22T13:36:32.899Z'),
  (5, 'b1c2e021-e2ae-4f88-a983-ec89916bf767', 'logro', 10, 0, '2026-09-22T13:36:34.233Z'),
  (6, 'b1c2e021-e2ae-4f88-a983-ec89916bf767', 'logro', 15, 0, '2026-09-22T13:36:34.496Z'),
  (7, '5f0813c3-216e-4158-b1b9-af2abbb845d0', 'logro', 10, 0, '2026-09-22T13:36:34.760Z'),
  (8, '5f0813c3-216e-4158-b1b9-af2abbb845d0', 'logro', 15, 0, '2026-09-22T13:36:35.026Z'),
  (9, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'eco_puzzle', 2, 150, '2026-09-24T00:23:44.497Z'),
  (10, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'eco_puzzle', 2, 150, '2026-09-24T15:14:30.215Z'),
  (11, '502636de-20d6-4644-aae5-ac70bec5db7a', 'speedrun_ducha', 1, 100, '2026-09-24T15:40:44.907Z'),
  (12, '502636de-20d6-4644-aae5-ac70bec5db7a', 'eco_puzzle', 2, 150, '2026-09-24T17:07:09.670Z'),
  (13, '502636de-20d6-4644-aae5-ac70bec5db7a', 'eco_puzzle', 2, 150, '2026-09-24T17:48:27.286Z'),
  (14, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'speedrun_ducha', 2, 200, '2026-09-28T01:07:05.520Z'),
  (15, 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'eco_puzzle', 2, 150, '2026-09-28T01:08:04.617Z'),
  (16, 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'speedrun_ducha', 2, 200, '2026-09-28T01:08:40.838Z'),
  (17, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'speedrun_ducha', 2, 200, '2026-09-28T18:32:02.142Z'),
  (18, 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'speedrun_ducha', 2, 200, '2026-09-28T18:39:13.140Z'),
  (19, 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'speedrun_ducha', 2, 200, '2026-09-28T18:42:30.723Z'),
  (20, 'ce4b9004-6723-46be-9096-0d3b261f76dd', 'eco_puzzle', 2, 150, '2026-09-28T18:43:18.027Z'),
  (21, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'eco_puzzle', 2, 150, '2026-09-28T20:37:33.545Z'),
  (22, '502636de-20d6-4644-aae5-ac70bec5db7a', 'speedrun_ducha', 2, 200, '2026-09-29T17:28:23.629Z'),
  (23, '502636de-20d6-4644-aae5-ac70bec5db7a', 'speedrun_ducha', 2, 200, '2026-09-29T18:04:04.681Z'),
  (24, '502636de-20d6-4644-aae5-ac70bec5db7a', 'speedrun_ducha', 2, 200, '2026-09-29T18:04:18.249Z'),
  (25, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'eco_puzzle', 2, 150, '2026-09-30T16:31:16.229Z'),
  (26, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'trivia', 0, 0, '2026-09-30T22:12:19.918Z'),
  (27, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'trivia', 0, 0, '2026-09-30T22:12:43.273Z'),
  (28, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'trivia', 0, 0, '2026-09-30T22:14:01.344Z'),
  (29, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'trivia', 0, 0, '2026-09-30T22:16:14.280Z'),
  (30, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'trivia', 0, 0, '2026-09-30T22:18:05.690Z'),
  (31, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'trivia', 0, 0, '2026-09-30T22:18:37.007Z'),
  (32, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'eco_puzzle', 2, 150, '2026-09-30T22:19:05.130Z'),
  (33, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'trivia', 0, 160, '2026-09-30T22:21:45.647Z'),
  (34, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'trivia', 1, 260, '2026-09-30T22:23:22.149Z'),
  (35, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'trivia', 0, 60, '2026-09-30T22:31:43.094Z'),
  (36, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'trivia', 0, 0, '2026-09-30T23:16:07.915Z'),
  (37, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'trivia', 0, 60, '2026-09-30T23:17:19.595Z'),
  (38, 'b833590c-94e6-4b82-af62-85fedb37584f', 'eco_puzzle', 2, 150, '2026-09-30T23:29:05.061Z'),
  (39, 'b833590c-94e6-4b82-af62-85fedb37584f', 'trivia', 0, 40, '2026-09-30T23:32:41.399Z'),
  (40, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'trivia', 2, 720, '2026-10-01T01:46:38.552Z'),
  (41, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'eco_puzzle', 2, 150, '2026-10-01T06:00:54.932Z'),
  (42, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'trivia', 1, 360, '2026-10-01T11:44:44.757Z'),
  (43, '502636de-20d6-4644-aae5-ac70bec5db7a', 'trivia', 0, 0, '2026-10-01T12:41:08.828Z'),
  (44, 'b833590c-94e6-4b82-af62-85fedb37584f', 'eco_puzzle', 2, 150, '2026-10-01T15:37:14.314Z'),
  (45, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'trivia', 0, 0, '2026-10-01T15:50:12.597Z'),
  (46, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'trivia', 0, 200, '2026-10-01T19:12:29.999Z'),
  (47, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'trivia', 1, 460, '2026-10-01T20:00:27.896Z'),
  (48, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'trivia', 1, 380, '2026-10-01T20:02:29.277Z'),
  (49, 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'eco_puzzle', 2, 150, '2026-10-01T20:27:40.524Z'),
  (50, 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'trivia', 0, 200, '2026-10-01T20:29:11.199Z')
ON CONFLICT DO NOTHING;

INSERT INTO public.historial_gamificacion (id, user_id, origen_actividad, monedas_otorgadas, xp_otorgada, created_at) VALUES
  (51, 'ad6baf06-89f8-4392-9f39-80b09900d270', 'trivia', 1, 360, '2026-10-01T20:46:59.229Z'),
  (52, 'ad6baf06-89f8-4392-9f39-80b09900d270', 'trivia', 0, 0, '2026-10-01T20:48:01.399Z'),
  (53, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'trivia', 4, 1200, '2026-10-01T22:49:59.441Z'),
  (54, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'trivia', 0, 40, '2026-10-02T01:02:00.944Z'),
  (55, 'b67e8b2b-f88f-41fe-99ec-d550c970f817', 'trivia', 2, 640, '2026-10-04T20:13:40.319Z'),
  (56, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'trivia', 1, 400, '2026-10-07T16:30:55.677Z'),
  (57, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'trivia', 0, 180, '2026-10-09T00:21:18.123Z'),
  (58, '502636de-20d6-4644-aae5-ac70bec5db7a', 'trivia', 0, 0, '2026-10-13T18:32:02.822Z'),
  (59, '502636de-20d6-4644-aae5-ac70bec5db7a', 'trivia', 3, 900, '2026-10-13T18:36:58.884Z'),
  (60, '87f66d69-5697-4dd4-bb84-42150e1db851', 'trivia', 1, 280, '2026-10-23T01:06:23.691Z'),
  (61, 'ce4b9004-6723-46be-9096-0d3b261f76dd', 'trivia', 0, 60, '2026-10-23T23:06:08.817Z'),
  (62, 'ee5ae37b-9d73-4bad-be43-df67b724d535', 'eco_puzzle', 2, 150, '2026-10-26T19:07:44.050Z'),
  (63, 'ee5ae37b-9d73-4bad-be43-df67b724d535', 'eco_puzzle', 2, 150, '2026-10-26T19:09:04.495Z'),
  (64, 'ee5ae37b-9d73-4bad-be43-df67b724d535', 'speedrun_ducha', 2, 200, '2026-10-26T20:33:56.692Z'),
  (65, 'ee5ae37b-9d73-4bad-be43-df67b724d535', 'logro', 15, 0, '2026-10-26T21:00:29.687Z'),
  (66, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'eco_puzzle', 2, 150, '2026-10-27T00:27:15.102Z'),
  (67, '87f66d69-5697-4dd4-bb84-42150e1db851', 'eco_puzzle', 2, 150, '2026-10-27T00:42:29.180Z'),
  (68, '94779849-d3cf-473b-878d-593f1aa65f7f', 'eco_puzzle', 2, 150, '2026-10-27T00:43:05.689Z'),
  (69, '94779849-d3cf-473b-878d-593f1aa65f7f', 'logro', 15, 0, '2026-10-27T00:43:27.776Z'),
  (70, '94779849-d3cf-473b-878d-593f1aa65f7f', 'logro', 20, 0, '2026-10-27T00:43:32.002Z'),
  (71, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'eco_puzzle', 2, 150, '2026-10-27T14:50:16.446Z'),
  (72, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'trivia', 0, 17, '2026-10-27T15:02:57.774Z'),
  (73, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'eco_puzzle', 2, 150, '2026-10-27T16:43:16.614Z'),
  (74, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'logro', 15, 0, '2026-10-27T16:43:39.027Z'),
  (75, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'logro', 20, 0, '2026-10-27T16:43:43.906Z'),
  (76, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'speedrun_ducha', 2, 200, '2026-10-27T16:52:34.124Z'),
  (77, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'logro', 10, 0, '2026-10-27T16:52:50.971Z'),
  (78, '502636de-20d6-4644-aae5-ac70bec5db7a', 'logro', 10, 0, '2026-10-28T15:32:12.832Z'),
  (79, '502636de-20d6-4644-aae5-ac70bec5db7a', 'logro', 20, 0, '2026-10-28T15:47:42.502Z'),
  (80, '502636de-20d6-4644-aae5-ac70bec5db7a', 'logro', 30, 0, '2026-10-28T15:47:46.961Z'),
  (81, '502636de-20d6-4644-aae5-ac70bec5db7a', 'eco_puzzle', 2, 150, '2026-10-28T16:19:56.371Z'),
  (82, '502636de-20d6-4644-aae5-ac70bec5db7a', 'eco_puzzle', 2, 150, '2026-10-28T16:20:18.591Z'),
  (83, '502636de-20d6-4644-aae5-ac70bec5db7a', 'logro', 5, 0, '2026-10-28T16:20:46.148Z'),
  (84, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'eco_puzzle', 2, 150, '2026-10-28T17:16:12.747Z'),
  (85, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'logro', 5, 0, '2026-10-29T02:00:55.042Z'),
  (86, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'logro', 5, 0, '2026-10-29T02:01:05.168Z'),
  (87, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'logro', 5, 0, '2026-10-29T02:01:08.744Z'),
  (88, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'logro', 10, 0, '2026-10-29T02:01:13.821Z'),
  (89, 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'inspeccion_fotografica', 4, 80, '2026-10-29T19:36:30.232Z'),
  (90, 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'inspeccion_fotografica', 4, 80, '2026-10-30T01:14:55.410Z'),
  (91, 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'inspeccion_fotografica', 4, 80, '2026-10-30T02:00:17.987Z'),
  (92, 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'inspeccion_fotografica', 4, 80, '2026-10-30T03:03:25.562Z'),
  (93, 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'inspeccion_fotografica', 4, 80, '2026-10-30T03:16:48.095Z')
ON CONFLICT DO NOTHING;

-- Datos para public.feed_reacciones (6 filas)
INSERT INTO public.feed_reacciones (id, feed_id, family_id, user_id, tipo_reaccion, created_at) VALUES
  ('527e4987-df40-4333-b8d2-8862c7af3cb7', '5442df0e-5980-4ac9-b2ff-f1ffd0e6f769', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'aplauso', '2026-10-29T01:59:53.344Z'),
  ('3181b001-e534-4389-8a95-54ca332a88eb', '84', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 'fbfe8f40-f773-4484-800a-9d64dd464e88', 'fuego', '2026-10-29T19:41:39.895Z'),
  ('8f3ec5a1-4a35-463d-b610-15e9c3325d19', '89', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'corazon', '2026-10-30T02:12:25.230Z'),
  ('879687da-c7d6-482f-9e5f-d2d680184769', '91', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'fuego', '2026-10-30T02:20:37.253Z'),
  ('23e9b08c-3f56-4ac0-8817-efeadd8be119', '011374cf-f7bf-43b8-aaa7-eb588565ff66', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', 'fuego', '2026-10-30T03:01:22.752Z'),
  ('6baf53b5-837b-423e-9204-c12205c09a0b', '92', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', 'fuego', '2026-10-30T03:03:51.500Z')
ON CONFLICT DO NOTHING;

-- Datos para public.bills (3 filas)
INSERT INTO public.bills (id, family_id, created_at, service_type, provider_code, period_start, period_end, consumption, consumption_unit, amount_clp, due_date, entry_source, updated_at) VALUES
  ('29e0b3b0-54f3-4f68-8fe0-c28bdb874489', '6a127351-6385-439b-832a-98301d281f8a', '2026-10-30T02:55:14.531Z', 'water', 'esval', '2018-07-20T04:00:00.000Z', '2018-08-21T03:00:00.000Z', '13.00', 'm3', 20050, '2026-11-10T03:00:00.000Z', 'ocr_confirmed', '2026-10-30T02:55:14.531Z'),
  ('4b232e0d-52f2-4ae6-902d-b7e10d748317', '6a127351-6385-439b-832a-98301d281f8a', '2026-10-30T02:58:33.169Z', 'water', 'esval', '2026-09-01T04:00:00.000Z', '2026-09-30T03:00:00.000Z', '5.00', 'm3', 12151, '2026-11-10T03:00:00.000Z', 'ocr_confirmed', '2026-10-30T02:58:33.169Z'),
  ('0525f5e7-690b-4025-aa9b-a18c6b53dd49', 'ddc58f46-2379-405b-b85f-4f44850e777f', '2026-10-30T03:17:44.367Z', 'electricity', 'chilquinta', '2026-09-01T04:00:00.000Z', '2026-09-30T03:00:00.000Z', '199.00', 'kWh', 52103, '2026-11-11T03:00:00.000Z', 'ocr_confirmed', '2026-10-30T03:17:44.367Z')
ON CONFLICT DO NOTHING;

-- Datos para public.password_reset_codes (11 filas)
INSERT INTO public.password_reset_codes (id, email, code, expires_at, used, created_at, phone) VALUES
  ('c4b57b88-3de9-4b5f-8ec5-84608bfd2954', 'carolinailabaca2@gmail.com', '777507', '2026-10-29T02:44:51.199Z', TRUE, '2026-10-29T02:29:51.205Z', NULL),
  ('33aad50b-89ae-4c44-9db6-b10403ea7173', 'carolinailabaca2@gmail.com', '806163', '2026-10-29T02:46:06.756Z', FALSE, '2026-10-29T02:31:06.762Z', NULL),
  ('2d376849-f590-4619-9184-dd95056ecf6e', 'bastian@habitik.com', '105849', '2026-10-29T22:12:54.030Z', TRUE, '2026-10-29T21:57:54.036Z', NULL),
  ('2a3b0706-d9b4-4aa7-80b4-bf20a0d8318c', 'bastian@habitik.com', '919005', '2026-10-29T22:13:51.660Z', FALSE, '2026-10-29T21:58:51.667Z', NULL),
  ('8c88747f-d959-4913-95b2-adeccf0e8744', 'cristobalzamoralazo2@gmail.com', '982675', '2026-10-29T23:51:00.138Z', TRUE, '2026-10-29T23:36:00.145Z', NULL),
  ('abf05035-a827-4a0a-85cd-27002b9dc2e1', 'cristobalzamoralazo2@gmail.com', '611913', '2026-10-29T23:52:01.758Z', TRUE, '2026-10-29T23:37:01.768Z', NULL),
  ('0dfc8407-c62e-4a34-9fbb-eed0ec93825c', 'cristobalzamoralazo2@gmail.com', '947722', '2026-10-30T00:43:29.746Z', TRUE, '2026-10-30T00:28:29.750Z', NULL),
  ('5b978c76-8dc4-4c55-b623-2681455aef5e', 'cristobalzamoralazo2@gmail.com', '132740', '2026-10-30T00:45:18.825Z', TRUE, '2026-10-30T00:30:18.830Z', NULL),
  ('7ba8f0ce-412a-484b-86d0-0ffb27ce8073', 'cristobalzamoralazo2@gmail.com', '342288', '2026-10-30T00:45:52.076Z', TRUE, '2026-10-30T00:30:52.081Z', NULL),
  ('bf776f1f-c976-44bd-b57c-97d231edf308', 'cristobalzamoralazo2@gmail.com', '352032', '2026-10-30T00:58:12.878Z', TRUE, '2026-10-30T00:43:12.881Z', NULL),
  ('a40c3f19-b624-4e4b-872c-dddddc4bd881', 'cristobalzamoralazo2@gmail.com', '323742', '2026-10-30T00:59:06.076Z', FALSE, '2026-10-30T00:44:06.080Z', NULL)
ON CONFLICT DO NOTHING;

-- Datos para public.qr_tokens (30 filas)
INSERT INTO public.qr_tokens (id, family_id, token, used, expires_at, created_at) VALUES
  ('22898295-4e76-475a-95ca-448f45e6dbb2', '03cf9667-b2f0-4b8e-bc0d-836451a302b3', '2b85035b-96bf-4e9a-8481-60d06e83da44', TRUE, '2026-09-22T13:46:28.899Z', '2026-09-22T13:36:28.901Z'),
  ('16e9236f-dd56-494e-9ca0-7da64ef2fe88', '1eec3da2-d030-457b-9c72-85e0b386c70d', 'cf0a5fe2-2d88-4a77-92fd-a1d71bf7e4b4', FALSE, '2026-09-24T00:07:32.693Z', '2026-09-23T23:57:32.696Z'),
  ('6ada6ca3-a0ef-4e82-8fd4-6a43aaa480f9', 'ddc58f46-2379-405b-b85f-4f44850e777f', '5c1117d6-0217-4531-9f88-d4423f5defe4', FALSE, '2026-09-24T00:08:13.228Z', '2026-09-23T23:58:13.232Z'),
  ('7185d1ae-b87c-4bb4-b0a2-da25059ed920', 'ddc58f46-2379-405b-b85f-4f44850e777f', '57b80a07-42d3-467e-8d26-1cfede48a8ca', FALSE, '2026-09-24T13:59:29.000Z', '2026-09-24T13:49:29.002Z'),
  ('031c3413-567e-463c-935c-c3669025d78e', 'ddc58f46-2379-405b-b85f-4f44850e777f', '5ad123a4-b59a-488c-bc2b-26eab5d150d5', TRUE, '2026-09-24T15:23:04.970Z', '2026-09-24T15:13:04.972Z'),
  ('6a163d85-4485-4012-a2b8-37b9558fc84a', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'ea0223cc-c3e2-41d2-aa9a-fcaaec2f39e8', FALSE, '2026-09-27T17:03:23.317Z', '2026-09-27T16:53:23.318Z'),
  ('13889cc6-4dfe-4162-8fc0-2e4358428fcb', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'fb7e96b1-e566-419b-994e-1f7f691f30ef', FALSE, '2026-09-28T01:13:34.736Z', '2026-09-28T01:03:34.768Z'),
  ('a49b52c7-91b6-452d-bc5d-eae7f56ac473', 'ddc58f46-2379-405b-b85f-4f44850e777f', '3f4d6dd2-f043-470c-ac0b-f280aad33258', TRUE, '2026-09-28T01:13:34.886Z', '2026-09-28T01:03:34.887Z'),
  ('153d7eee-e1e3-4eea-880e-fca92273729f', 'ddc58f46-2379-405b-b85f-4f44850e777f', '3c7c141e-666c-4d45-bca3-8e677bc7a2d2', FALSE, '2026-09-28T18:44:17.389Z', '2026-09-28T18:34:17.390Z'),
  ('6be9ff7b-1f8a-4caa-a510-297ea41aa840', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', '66f95c4e-6fc0-4f0d-aa87-c04cc1bcc7fb', FALSE, '2026-09-29T23:45:33.309Z', '2026-09-29T23:35:33.304Z'),
  ('5f9ee4e1-f12f-47af-951d-e20afbbe26a2', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', '5390951f-11f2-4ce2-b727-bd1498769425', TRUE, '2026-09-30T22:05:03.424Z', '2026-09-30T21:55:03.426Z'),
  ('7b0f4275-cf3f-4f38-b72e-4bca9606bd7f', 'ab092b3a-1e4a-49b5-ad16-1dbe61cf1d1d', '6a27d880-cf02-4a80-8576-0c7be94f32a7', FALSE, '2026-09-30T22:26:43.060Z', '2026-09-30T22:16:43.061Z'),
  ('f3980c73-db08-44ec-9024-d650cc400b8b', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', '837f11ab-d263-46a8-a6e5-227bebda4cbf', TRUE, '2026-09-30T22:48:26.808Z', '2026-09-30T22:38:26.810Z'),
  ('263f43d7-2ec9-470f-91b9-d8f5941cc357', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', '5a10d456-2760-4e57-a493-c154ea184bcc', TRUE, '2026-09-30T23:12:38.433Z', '2026-09-30T23:02:38.434Z'),
  ('4beda965-dcfe-4e8f-9347-464cce43fb06', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', 'a9fdc8fc-5f01-47fc-aeae-95f51ce5c2e6', TRUE, '2026-09-30T23:34:52.222Z', '2026-09-30T23:24:52.223Z'),
  ('30352d27-cc3d-4468-a282-2fb6a143e581', 'ddc58f46-2379-405b-b85f-4f44850e777f', '762613dc-51fe-4ccc-b2cc-f74506902e60', FALSE, '2026-10-01T16:25:49.464Z', '2026-10-01T16:15:49.503Z'),
  ('68baf0f8-6206-4ab2-a3e7-8f38e86a9926', '2228e641-973f-4955-ac27-0b96ea526559', 'b0b07e78-ef8c-47b4-9e8f-d227ae249a44', FALSE, '2026-10-01T20:50:59.484Z', '2026-10-01T20:40:59.484Z'),
  ('9b09d8f9-c013-4164-9f9e-6a56427de9f5', '2228e641-973f-4955-ac27-0b96ea526559', 'f65baf1d-9dc4-4e72-aae5-233760a19d2a', TRUE, '2026-10-01T20:52:29.229Z', '2026-10-01T20:42:29.230Z'),
  ('1e14f16f-c318-47c4-a37b-dff9efb19453', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', '0195e073-d82b-434c-aff1-2a310ed97574', FALSE, '2026-10-28T17:43:29.884Z', '2026-10-28T17:33:29.890Z'),
  ('1a0e2a5d-5f98-4ec4-a9a5-872dccbdcadb', '1bedfc88-505c-4998-a7fb-0f3b3848635c', '65754dbc-8248-48c1-aa9d-8a3655741c46', TRUE, '2026-10-29T00:02:47.656Z', '2026-10-28T23:52:47.656Z'),
  ('694e2362-6e00-4a62-bce4-41282f0a7fc9', 'a8d78a96-c4dd-462e-8040-7b734081dee4', '910627b9-fa37-47fb-b42f-c7a7bbc91293', TRUE, '2026-10-29T02:11:24.876Z', '2026-10-29T02:01:24.877Z'),
  ('2987c41c-dd11-49e3-befe-36a41059a06d', 'b84c42e5-fce1-40c8-a7d7-9a03765cb58a', '9b1c0ae4-fc08-4a00-9638-0d66afbf0dc5', TRUE, '2026-10-29T02:11:43.632Z', '2026-10-29T02:01:43.634Z'),
  ('37374df7-312e-4969-b4ac-026ea2f1b7b0', '804bc88c-2e29-4c19-9f2d-4ce1b2a36881', 'c83cf406-b5dc-4f2b-9569-a2d94213f02a', TRUE, '2026-10-29T02:19:16.350Z', '2026-10-29T02:09:21.189Z'),
  ('edf4eb66-4816-4102-b4b3-44f80a263f9e', 'c269dd1e-45a8-47d3-b43a-e3bfd5c97d56', 'b8657a3e-1534-4177-8cea-99361f3cca2d', TRUE, '2026-10-29T02:19:43.299Z', '2026-10-29T02:09:48.145Z'),
  ('70fa3678-a069-4287-aa06-dc29f431c861', 'ca9a5e5e-0ca5-465a-8943-fd149d7ac51d', 'b3297fae-44a2-4d21-bac3-63e2c590f2f5', TRUE, '2026-10-29T02:27:27.192Z', '2026-10-29T02:17:32.022Z'),
  ('9779b7d9-afd5-47c2-8206-d755f848cb4d', 'ca401ad9-93d7-44ce-962c-5bd49df843ed', 'a0d96b9f-f3c1-4383-843a-7252c204e613', FALSE, '2026-10-29T02:31:34.346Z', '2026-10-29T02:21:34.347Z'),
  ('6e5a143f-2058-4a36-a76f-5d3ee5c13af4', 'b2950da5-3e3f-4dc5-938f-c242ca575fac', '370fa276-62cb-43b2-b8f6-b694bbbd469d', TRUE, '2026-10-29T21:48:27.544Z', '2026-10-29T21:38:26.563Z'),
  ('1e424934-96b4-4011-b837-16d2e9b3594b', '19d6af61-55d7-483a-8905-5110622ba043', 'e174be99-5964-426e-b710-79d75ee285e8', TRUE, '2026-10-29T21:56:56.428Z', '2026-10-29T21:46:55.426Z'),
  ('79256e34-014a-43e8-a387-8b8c5a9587d7', 'eebd2f7d-156a-44da-8efb-e0c913e0bd8f', 'a104423d-564b-4a51-b734-b444a129bd79', FALSE, '2026-10-29T23:45:36.237Z', '2026-10-29T23:35:36.242Z'),
  ('a448e598-a810-4015-93df-a7bf7285526f', '6a127351-6385-439b-832a-98301d281f8a', '1433fbf8-c553-4d20-9a34-f46621bf5bb2', FALSE, '2026-10-30T02:04:17.411Z', '2026-10-30T01:54:17.413Z')
ON CONFLICT DO NOTHING;

-- Datos para public.notifications (35 filas)
INSERT INTO public.notifications (id, user_id, title, desc_text, visual, payload, is_read, created_at, family_id, sender_id, sender_name, type) VALUES
  ('0d707a74-cb1b-41bc-8d75-2275717324fc', NULL, '📸 Nueva Inspección Pendiente', 'Criszamora1 envió evidencia para "Inspección de luces y enchufes". ¡Ingresa a revisar!', '{"icon":"notifications","color":"#388E3C"}'::jsonb, '{"type":"inspeccion_pendiente","evidencia_id":"f8e9eba4-f0ae-43c5-b6b7-0e84bd54ca5b"}'::jsonb, FALSE, '2026-10-30T03:01:46.515Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', NULL, 'inspeccion_pendiente'),
  ('d4b11582-f214-4932-85c9-63b99855b062', NULL, '🎉 ¡Evidencia Aprobada!', 'El Jefe aprobó tu foto de "Inspección de luces y enchufes". Ganaste +80 XP y +4 🪙.', '{"icon":"notifications","color":"#388E3C"}'::jsonb, '{"type":"inspeccion_aprobada","evidencia_id":"f8e9eba4-f0ae-43c5-b6b7-0e84bd54ca5b"}'::jsonb, FALSE, '2026-10-30T03:03:25.585Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', NULL, 'inspeccion_aprobada'),
  ('687de895-f760-4372-bcf8-28a5a03f0d95', NULL, '❌ Inspección Rechazada', 'Tu evidencia para "Inspección de luces y enchufes" no fue aprobada. Motivo: no se ve', '{"icon":"notifications","color":"#388E3C"}'::jsonb, '{"type":"inspeccion_rechazada","evidencia_id":"ef792cb4-a0d5-4394-9142-27c3e6bc6936"}'::jsonb, FALSE, '2026-10-30T03:09:23.587Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', NULL, 'inspeccion_rechazada'),
  ('7f2c754a-308c-460b-95d8-aa67e5f5ff8e', NULL, '📸 Nueva Inspección Pendiente', 'Criszamora13 envió evidencia para "Inspección de luces y enchufes". ¡Ingresa a revisar!', '{"icon":"notifications","color":"#388E3C"}'::jsonb, '{"type":"inspeccion_pendiente","evidencia_id":"13431f22-b859-4685-a2d6-cb4928ac2159"}'::jsonb, FALSE, '2026-10-30T03:15:27.055Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'a0d856d8-8e83-4ea0-a08b-c1d87ecd3838', NULL, 'inspeccion_pendiente'),
  ('dec4f7f4-1da0-45a1-bb54-4d87bccb1619', NULL, '🎉 ¡Evidencia Aprobada!', 'El Jefe aprobó tu foto de "Inspección de luces y enchufes". Ganaste +80 XP y +4 🪙.', '{"icon":"notifications","color":"#388E3C"}'::jsonb, '{"type":"inspeccion_aprobada","evidencia_id":"13431f22-b859-4685-a2d6-cb4928ac2159"}'::jsonb, FALSE, '2026-10-30T03:16:48.109Z', 'ddc58f46-2379-405b-b85f-4f44850e777f', 'e22ba49c-5fca-4b29-b56a-4d66264904a0', NULL, 'inspeccion_aprobada'),
  ('37d22d48-160b-40c1-afd0-bacd0ff13b5a', 'ad6baf06-89f8-4392-9f39-80b09900d270', '⚡ Consejo de Climatización', '💡 Climatización Eficiente: Cada grado menos en el termostato ahorra un 7% de electricidad mensual.', '{"icon":"lightbulb","color":"#0091EA"}'::jsonb, '{"fecha":"2026-10-30T12:23:32.879Z","origen":"autonomous_engine","categoria_origen":"TIP_ONBOARDING"}'::jsonb, FALSE, '2026-10-30T12:23:33.033Z', '2228e641-973f-4955-ac27-0b96ea526559', NULL, 'Habitik AI', 'TIP_ONBOARDING'),
  ('61f8cb07-e4a6-43ff-ad90-cac385ddb97b', 'fbfe8f40-f773-4484-800a-9d64dd464e88', '⚡ Consejo de Climatización', '💡 Climatización Eficiente: Cada grado menos en el termostato ahorra un 7% de electricidad mensual.', '{"icon":"lightbulb","color":"#0091EA"}'::jsonb, '{"fecha":"2026-10-30T12:23:32.879Z","origen":"autonomous_engine","categoria_origen":"TIP_ONBOARDING"}'::jsonb, FALSE, '2026-10-30T12:23:33.057Z', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', NULL, 'Habitik AI', 'TIP_ONBOARDING'),
  ('07d5ce67-672a-47b6-8fcb-c4b438c2a696', '7e945795-f8f2-49bc-b46c-d76f2fe7c28c', '⚡ Consejo de Climatización', '💡 Climatización Eficiente: Cada grado menos en el termostato ahorra un 7% de electricidad mensual.', '{"icon":"lightbulb","color":"#0091EA"}'::jsonb, '{"fecha":"2026-10-30T12:23:32.879Z","origen":"autonomous_engine","categoria_origen":"TIP_ONBOARDING"}'::jsonb, FALSE, '2026-10-30T12:23:33.066Z', 'eebd2f7d-156a-44da-8efb-e0c913e0bd8f', NULL, 'Habitik AI', 'TIP_ONBOARDING'),
  ('428ff225-a216-446e-bb8e-699e05bc7718', 'a5851bf5-3a39-44dc-acf4-c8faefbbaa72', '⚡ Consejo de Climatización', '💡 Climatización Eficiente: Cada grado menos en el termostato ahorra un 7% de electricidad mensual.', '{"icon":"lightbulb","color":"#0091EA"}'::jsonb, '{"fecha":"2026-10-30T12:23:32.879Z","origen":"autonomous_engine","categoria_origen":"TIP_ONBOARDING"}'::jsonb, FALSE, '2026-10-30T12:23:33.075Z', 'ca401ad9-93d7-44ce-962c-5bd49df843ed', NULL, 'Habitik AI', 'TIP_ONBOARDING'),
  ('135236a0-376d-40d2-ba43-170f44fc6e5b', 'b1c2e021-e2ae-4f88-a983-ec89916bf767', '⚡ Consejo de Climatización', '💡 Climatización Eficiente: Cada grado menos en el termostato ahorra un 7% de electricidad mensual.', '{"icon":"lightbulb","color":"#0091EA"}'::jsonb, '{"fecha":"2026-10-30T12:23:32.879Z","origen":"autonomous_engine","categoria_origen":"TIP_ONBOARDING"}'::jsonb, FALSE, '2026-10-30T12:23:33.088Z', '03cf9667-b2f0-4b8e-bc0d-836451a302b3', NULL, 'Habitik AI', 'TIP_ONBOARDING'),
  ('60d9525c-790d-4ff2-8803-544579a467d0', NULL, '💡 ¿Sabías que? Eco-Dato Habitik', '🌱 Eco-Tip: Reciclar una tonelada de papel salva 17 árboles maduros y ahorra más de 25.000 litros de agua.', '{"icon":"eco","color":"#00C853"}'::jsonb, '{"fecha":"2026-10-30T12:23:32.879Z","origen":"autonomous_engine","categoria_origen":"ECO_CURIOSIDAD"}'::jsonb, FALSE, '2026-10-30T12:23:33.097Z', '699b7be0-4e4f-49c7-83c0-9c204838b5cf', NULL, 'Habitik AI', 'ECO_CURIOSIDAD'),
  ('e3fefbd8-f4bb-4440-babb-80083de59782', 'bd5856d5-6054-4847-b519-c1a024e6bfd7', '⚡ Consejo de Climatización', '💡 Climatización Eficiente: Cada grado menos en el termostato ahorra un 7% de electricidad mensual.', '{"icon":"lightbulb","color":"#0091EA"}'::jsonb, '{"fecha":"2026-10-30T12:23:32.879Z","origen":"autonomous_engine","categoria_origen":"TIP_ONBOARDING"}'::jsonb, FALSE, '2026-10-30T12:23:33.104Z', '6a127351-6385-439b-832a-98301d281f8a', NULL, 'Habitik AI', 'TIP_ONBOARDING'),
  ('fbca48e8-4388-46be-8ee9-f7c88d885043', NULL, '💡 ¿Sabías que? Eco-Dato Habitik', '💡 ¿Sabías que? Usar la lavadora con carga completa ahorra más de 3.000 litros de agua limpia al año.', '{"icon":"eco","color":"#00C853"}'::jsonb, '{"fecha":"2026-10-30T12:23:32.879Z","origen":"autonomous_engine","categoria_origen":"ECO_CURIOSIDAD"}'::jsonb, FALSE, '2026-10-30T12:23:33.114Z', 'ab092b3a-1e4a-49b5-ad16-1dbe61cf1d1d', NULL, 'Habitik AI', 'ECO_CURIOSIDAD'),
  ('0163e43a-a7de-4d23-a5c5-b8e447686aff', 'c60ca6e9-04b3-47c6-856e-b2bd142d582c', '⚡ Consejo de Climatización', '💡 Climatización Eficiente: Cada grado menos en el termostato ahorra un 7% de electricidad mensual.', '{"icon":"lightbulb","color":"#0091EA"}'::jsonb, '{"fecha":"2026-10-30T12:23:32.879Z","origen":"autonomous_engine","categoria_origen":"TIP_ONBOARDING"}'::jsonb, FALSE, '2026-10-30T12:23:33.123Z', '1bedfc88-505c-4998-a7fb-0f3b3848635c', NULL, 'Habitik AI', 'TIP_ONBOARDING'),
  ('e0c3871d-460d-414d-bec6-1a9f72e0aad5', 'ce4b9004-6723-46be-9096-0d3b261f76dd', '⚡ Consejo de Climatización', '💡 Climatización Eficiente: Cada grado menos en el termostato ahorra un 7% de electricidad mensual.', '{"icon":"lightbulb","color":"#0091EA"}'::jsonb, '{"fecha":"2026-10-30T12:23:32.879Z","origen":"autonomous_engine","categoria_origen":"TIP_ONBOARDING"}'::jsonb, FALSE, '2026-10-30T12:23:33.130Z', '1eec3da2-d030-457b-9c72-85e0b386c70d', NULL, 'Habitik AI', 'TIP_ONBOARDING'),
  ('1c631514-a670-4fd3-8a62-91866e0bf8ee', NULL, '💡 ¿Sabías que? Eco-Dato Habitik', '🌱 Eco-Tip: Mantener mascotas supervisadas o con cascabel protege anualmente a miles de aves nativas.', '{"icon":"eco","color":"#00C853"}'::jsonb, '{"fecha":"2026-10-30T15:53:32.944Z","origen":"autonomous_engine","categoria_origen":"ECO_CURIOSIDAD"}'::jsonb, FALSE, '2026-10-30T15:53:33.002Z', '699b7be0-4e4f-49c7-83c0-9c204838b5cf', NULL, 'Habitik AI', 'ECO_CURIOSIDAD'),
  ('44961479-e5ec-4742-9da5-c6eda45bf360', 'ee5ae37b-9d73-4bad-be43-df67b724d535', '⚡ Consejo de Climatización', '💡 Climatización Eficiente: Cada grado menos en el termostato ahorra un 7% de electricidad mensual.', '{"icon":"lightbulb","color":"#0091EA"}'::jsonb, '{"fecha":"2026-10-30T15:53:32.944Z","origen":"autonomous_engine","categoria_origen":"TIP_ONBOARDING"}'::jsonb, FALSE, '2026-10-30T15:53:33.016Z', 'ab092b3a-1e4a-49b5-ad16-1dbe61cf1d1d', NULL, 'Habitik AI', 'TIP_ONBOARDING'),
  ('e4e6e86a-15ca-4030-b048-a33144ef6bfc', NULL, '💡 ¿Sabías que? Eco-Dato Habitik', '🌱 Eco-Tip: Aplastar botellas plásticas reduce su volumen un 75%, optimizando el espacio en el punto limpio.', '{"icon":"eco","color":"#00C853"}'::jsonb, '{"fecha":"2026-10-30T15:53:32.944Z","origen":"autonomous_engine","categoria_origen":"ECO_CURIOSIDAD"}'::jsonb, FALSE, '2026-10-30T15:53:33.025Z', '1bedfc88-505c-4998-a7fb-0f3b3848635c', NULL, 'Habitik AI', 'ECO_CURIOSIDAD'),
  ('a4d50bf0-1595-4457-bfd7-7f43104481f6', 'ad6baf06-89f8-4392-9f39-80b09900d270', '⭐ ¡Cerca de un nuevo nivel!', '¡Christian está a solo 40 XP de alcanzar el nivel 2! Completen un reto para subir.', '{"icon":"military_tech","color":"#FFD600"}'::jsonb, '{"fecha":"2026-10-30T17:23:32.975Z","origen":"autonomous_engine","categoria_origen":"HITO_NIVEL"}'::jsonb, FALSE, '2026-10-30T17:23:33.026Z', '2228e641-973f-4955-ac27-0b96ea526559', NULL, 'Habitik AI', 'HITO_NIVEL'),
  ('4ea135a5-8194-4c5f-a9ee-5952454d782c', NULL, '💡 ¿Sabías que? Eco-Dato Habitik', '💡 ¿Sabías que? Donar ropa o artefactos en buen estado da una segunda vida a los productos y apoya a tu comunidad.', '{"icon":"eco","color":"#00C853"}'::jsonb, '{"fecha":"2026-10-30T17:23:32.975Z","origen":"autonomous_engine","categoria_origen":"ECO_CURIOSIDAD"}'::jsonb, FALSE, '2026-10-30T17:23:33.035Z', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', NULL, 'Habitik AI', 'ECO_CURIOSIDAD'),
  ('af38c6e1-c0f0-48af-9122-612cee26647f', NULL, '💡 ¿Sabías que? Eco-Dato Habitik', '🌱 Eco-Tip: Hervir solo las tazas que vas a consumir ahorra tiempo y cuida la potencia eléctrica de tu hogar.', '{"icon":"eco","color":"#00C853"}'::jsonb, '{"fecha":"2026-10-30T17:23:32.975Z","origen":"autonomous_engine","categoria_origen":"ECO_CURIOSIDAD"}'::jsonb, FALSE, '2026-10-30T17:23:33.046Z', 'eebd2f7d-156a-44da-8efb-e0c913e0bd8f', NULL, 'Habitik AI', 'ECO_CURIOSIDAD'),
  ('71fe0595-f463-4e5f-8e33-9dc082217bf8', NULL, '💡 ¿Sabías que? Eco-Dato Habitik', '💡 ¿Sabías que? Cocinar con la olla tapada reduce el consumo de gas o electricidad hasta en un 25%.', '{"icon":"eco","color":"#00C853"}'::jsonb, '{"fecha":"2026-10-30T17:23:32.975Z","origen":"autonomous_engine","categoria_origen":"ECO_CURIOSIDAD"}'::jsonb, FALSE, '2026-10-30T17:23:33.054Z', 'ca401ad9-93d7-44ce-962c-5bd49df843ed', NULL, 'Habitik AI', 'ECO_CURIOSIDAD'),
  ('ae63470b-4cc5-4aa9-bd3a-c0d0723010ef', NULL, '💡 ¿Sabías que? Eco-Dato Habitik', '💡 ¿Sabías que? Mantenerse en senderos marcados evita pisar líquenes y plantas que tardan décadas en crecer.', '{"icon":"eco","color":"#00C853"}'::jsonb, '{"fecha":"2026-10-30T17:23:32.975Z","origen":"autonomous_engine","categoria_origen":"ECO_CURIOSIDAD"}'::jsonb, FALSE, '2026-10-30T17:23:33.063Z', '03cf9667-b2f0-4b8e-bc0d-836451a302b3', NULL, 'Habitik AI', 'ECO_CURIOSIDAD'),
  ('4526aaae-f2fd-4f17-8a23-47c0f469466c', NULL, '💡 ¿Sabías que? Eco-Dato Habitik', '🌱 Eco-Tip: Plantar lavanda o romero en maceteros crea refugios vitales para abejas nativas en la ciudad.', '{"icon":"eco","color":"#00C853"}'::jsonb, '{"fecha":"2026-10-30T17:23:32.975Z","origen":"autonomous_engine","categoria_origen":"ECO_CURIOSIDAD"}'::jsonb, FALSE, '2026-10-30T17:23:33.076Z', '6a127351-6385-439b-832a-98301d281f8a', NULL, 'Habitik AI', 'ECO_CURIOSIDAD'),
  ('3d3e6031-a897-44f2-869a-7c0061f3110b', NULL, '💡 ¿Sabías que? Eco-Dato Habitik', '🌱 Eco-Tip: El norte de Chile tiene la radiación solar más alta del planeta, impulsando la energía limpia.', '{"icon":"eco","color":"#00C853"}'::jsonb, '{"fecha":"2026-10-30T17:23:32.975Z","origen":"autonomous_engine","categoria_origen":"ECO_CURIOSIDAD"}'::jsonb, FALSE, '2026-10-30T17:23:33.086Z', '1eec3da2-d030-457b-9c72-85e0b386c70d', NULL, 'Habitik AI', 'ECO_CURIOSIDAD'),
  ('1df3633f-da65-44cd-ad95-bf162cf6c5cb', NULL, '💡 ¿Sabías que? Eco-Dato Habitik', '💡 ¿Sabías que? Una goma rota en la puerta del refrigerador duplica su consumo eléctrico de inmediato.', '{"icon":"eco","color":"#00C853"}'::jsonb, '{"fecha":"2026-10-30T20:23:33.019Z","origen":"autonomous_engine","categoria_origen":"ECO_CURIOSIDAD"}'::jsonb, FALSE, '2026-10-30T20:23:33.082Z', '699b7be0-4e4f-49c7-83c0-9c204838b5cf', NULL, 'Habitik AI', 'ECO_CURIOSIDAD'),
  ('8f9ed859-6f0d-4d23-9920-cad206861258', NULL, '💡 ¿Sabías que? Eco-Dato Habitik', '💡 ¿Sabías que? Cerrar la llave mientras te cepillas los dientes ahorra hasta 12 litros de agua por minuto.', '{"icon":"eco","color":"#00C853"}'::jsonb, '{"fecha":"2026-10-30T20:53:33.039Z","origen":"autonomous_engine","categoria_origen":"ECO_CURIOSIDAD"}'::jsonb, FALSE, '2026-10-30T20:53:33.107Z', 'ab092b3a-1e4a-49b5-ad16-1dbe61cf1d1d', NULL, 'Habitik AI', 'ECO_CURIOSIDAD'),
  ('a3e865fd-3292-4a07-a9b9-534422d1fd3d', NULL, '💡 ¿Sabías que? Eco-Dato Habitik', '🌱 Eco-Tip: Los celulares viejos contienen oro y cobre reciclables; llévalos siempre a un punto limpio.', '{"icon":"eco","color":"#00C853"}'::jsonb, '{"fecha":"2026-10-30T20:53:33.039Z","origen":"autonomous_engine","categoria_origen":"ECO_CURIOSIDAD"}'::jsonb, FALSE, '2026-10-30T20:53:33.119Z', '1bedfc88-505c-4998-a7fb-0f3b3848635c', NULL, 'Habitik AI', 'ECO_CURIOSIDAD'),
  ('84a1d392-5857-49fb-9c1c-bed76dde6405', NULL, '💡 ¿Sabías que? Eco-Dato Habitik', '💡 ¿Sabías que? Una sola pila de botón arrojada al suelo puede llegar a contaminar 600.000 litros de agua.', '{"icon":"eco","color":"#00C853"}'::jsonb, '{"fecha":"2026-10-30T21:23:33.047Z","origen":"autonomous_engine","categoria_origen":"ECO_CURIOSIDAD"}'::jsonb, FALSE, '2026-10-30T21:23:33.099Z', '1ff7e340-13c7-4fdb-8f35-bed6de308f4c', NULL, 'Habitik AI', 'ECO_CURIOSIDAD'),
  ('fd890093-bd5e-4488-9e2d-ec66860ca1be', NULL, '💡 ¿Sabías que? Eco-Dato Habitik', '💡 ¿Sabías que? El Alerce Milenario del sur de Chile tiene más de 3.600 años y es de los más viejos del mundo.', '{"icon":"eco","color":"#00C853"}'::jsonb, '{"fecha":"2026-10-30T21:23:33.047Z","origen":"autonomous_engine","categoria_origen":"ECO_CURIOSIDAD"}'::jsonb, FALSE, '2026-10-30T21:23:33.115Z', 'ca401ad9-93d7-44ce-962c-5bd49df843ed', NULL, 'Habitik AI', 'ECO_CURIOSIDAD'),
  ('53b600c5-8225-4aba-8f1a-c750b0634547', NULL, '💡 ¿Sabías que? Eco-Dato Habitik', '🌱 Eco-Tip: La cerámica se funde a mayor temperatura que el vidrio y arruina lotes de reciclaje completos.', '{"icon":"eco","color":"#00C853"}'::jsonb, '{"fecha":"2026-10-30T21:23:33.047Z","origen":"autonomous_engine","categoria_origen":"ECO_CURIOSIDAD"}'::jsonb, FALSE, '2026-10-30T21:23:33.127Z', '03cf9667-b2f0-4b8e-bc0d-836451a302b3', NULL, 'Habitik AI', 'ECO_CURIOSIDAD'),
  ('a1ba5c34-e60b-4610-bba1-f4197270001c', NULL, '💡 ¿Sabías que? Eco-Dato Habitik', '💡 ¿Sabías que? Esperar un día antes de comprar por impulso evita acumular objetos que terminan en desuso.', '{"icon":"eco","color":"#00C853"}'::jsonb, '{"fecha":"2026-10-30T21:23:33.047Z","origen":"autonomous_engine","categoria_origen":"ECO_CURIOSIDAD"}'::jsonb, FALSE, '2026-10-30T21:23:33.148Z', '6a127351-6385-439b-832a-98301d281f8a', NULL, 'Habitik AI', 'ECO_CURIOSIDAD'),
  ('5ae05174-6dc1-427d-8e8f-ae7010ec4acc', NULL, '💡 ¿Sabías que? Eco-Dato Habitik', '🌱 Eco-Tip: Instalar aireadores en las llaves reduce hasta un 50% el caudal de agua sin perder presión.', '{"icon":"eco","color":"#00C853"}'::jsonb, '{"fecha":"2026-10-30T21:23:33.047Z","origen":"autonomous_engine","categoria_origen":"ECO_CURIOSIDAD"}'::jsonb, FALSE, '2026-10-30T21:23:33.169Z', '1eec3da2-d030-457b-9c72-85e0b386c70d', NULL, 'Habitik AI', 'ECO_CURIOSIDAD'),
  ('15f52544-2012-4700-a3c3-1df0f6c9388f', NULL, '💡 ¿Sabías que? Eco-Dato Habitik', '🌱 Eco-Tip: Los alimentos locales reducen la huella de carbono de transporte hasta en un 80%.', '{"icon":"eco","color":"#00C853"}'::jsonb, '{"fecha":"2026-10-30T22:53:33.087Z","origen":"autonomous_engine","categoria_origen":"ECO_CURIOSIDAD"}'::jsonb, FALSE, '2026-10-30T22:53:33.138Z', '2228e641-973f-4955-ac27-0b96ea526559', NULL, 'Habitik AI', 'ECO_CURIOSIDAD'),
  ('ce318ae7-3789-4a2c-b30a-27ef7d413f0f', NULL, '💡 ¿Sabías que? Eco-Dato Habitik', '💡 ¿Sabías que? Usar la lavadora con carga completa ahorra más de 3.000 litros de agua limpia al año.', '{"icon":"eco","color":"#00C853"}'::jsonb, '{"fecha":"2026-10-30T22:53:33.087Z","origen":"autonomous_engine","categoria_origen":"ECO_CURIOSIDAD"}'::jsonb, FALSE, '2026-10-30T22:53:33.153Z', 'eebd2f7d-156a-44da-8efb-e0c913e0bd8f', NULL, 'Habitik AI', 'ECO_CURIOSIDAD')
ON CONFLICT DO NOTHING;

-- ========================================================
-- ÍNDICES DE ALTO RENDIMIENTO
-- ========================================================

CREATE INDEX IF NOT EXISTS idx_profiles_family_id ON public.profiles (family_id);
CREATE INDEX IF NOT EXISTS idx_shower_logs_user_valid ON public.shower_logs (user_id, es_valido);
CREATE INDEX IF NOT EXISTS idx_historial_user_created ON public.historial_gamificacion (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_rewards_active ON public.family_rewards (family_id, estado);
CREATE INDEX IF NOT EXISTS idx_canjes_colecta_estado ON public.canjes (family_id, es_colecta, estado);
CREATE INDEX IF NOT EXISTS idx_canje_aportes_canje ON public.canje_aportes (canje_id, user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_family_created ON public.notifications (family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspeccion_family_estado ON public.inspeccion_evidencias (family_id, estado);
CREATE INDEX IF NOT EXISTS idx_reto_validations_family_estado ON public.reto_validations (family_id, estado);
CREATE INDEX IF NOT EXISTS idx_tasks_family_hecho ON public.tasks (family_id, hecho);
CREATE INDEX IF NOT EXISTS idx_usuario_logros_user ON public.usuario_logros (user_id);
CREATE INDEX IF NOT EXISTS idx_feed_reacciones_feed_id ON public.feed_reacciones (feed_id);
CREATE INDEX IF NOT EXISTS idx_feed_reacciones_family_id ON public.feed_reacciones (family_id);
CREATE INDEX IF NOT EXISTS idx_feed_reacciones_user_id ON public.feed_reacciones (user_id);
    
