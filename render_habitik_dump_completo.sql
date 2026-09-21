-- ============================================================
-- HABITIK - DUMP COMPLETO DE BASE DE DATOS (RENDER POSTGRESQL)
-- Generado: 2026-09-20T17:53:01.047Z
-- Motor: PostgreSQL 18.6
-- Base de datos: render_oto7
-- Host: dpg-da8qclegekts7380bt60-a.oregon-postgres.render.com
-- ============================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- ============================================================
-- 1. EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;


-- ============================================================
-- 2. FUNCIONES Y PROCEDIMIENTOS ALMACENADOS
-- ============================================================
-- Procedimiento / Función: fn_despachar_evento_habitik
CREATE OR REPLACE FUNCTION public.fn_despachar_evento_habitik()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
      DECLARE
          v_payload JSON;
          v_sender_name VARCHAR(100);
      BEGIN
          IF NEW.sender_name IS NOT NULL THEN
              v_sender_name := NEW.sender_name;
          ELSIF NEW.sender_id IS NOT NULL THEN
              SELECT nombre INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;
          ELSE
              v_sender_name := 'Familiar';
          END IF;

          v_payload = json_build_object(
              'id', NEW.id,
              'family_id', NEW.family_id,
              'user_id', NEW.user_id,
              'sender_id', NEW.sender_id,
              'usuario_nombre', COALESCE(v_sender_name, 'Familiar'),
              'titulo', NEW.title,
              'mensaje', NEW.desc_text,
              'tipo', COALESCE(NEW.type, 'ALERTA_GENERAL'),
              'visual', NEW.visual,
              'payload', NEW.payload,
              'creado_en', NEW.created_at
          );

          PERFORM pg_notify('canal_eventos_familia', v_payload::text);
          RETURN NEW;
      END;
      $function$;

-- Procedimiento / Función: obtener_nivel_usuario
CREATE OR REPLACE FUNCTION public.obtener_nivel_usuario(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_xp INT;
    v_nivel INT;
BEGIN
    -- 1. Obtener la XP acumulada del perfil del usuario
    SELECT COALESCE(xp, 0) INTO v_xp
    FROM public.profiles
    WHERE id = p_user_id;

    -- Si el usuario no existe en la tabla, retorna nivel 1 por defecto
    IF NOT FOUND THEN
        RETURN 1;
    END IF;

    -- 2. Algoritmo: Cada 500 XP otorga 1 nivel -> Floor(XP / 500) + 1
    v_nivel := (v_xp / 500) + 1;

    -- 3. Topar el nivel máximo en 99
    IF v_nivel > 99 THEN
        v_nivel := 99;
    END IF;

    RETURN v_nivel;
END;
$function$;

-- Procedimiento / Función: calcular_racha_semanal
CREATE OR REPLACE FUNCTION public.calcular_racha_semanal(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_inicio_semana DATE;
    v_fin_semana DATE;
    v_dias_array BOOLEAN[];
    v_dias_activos INT;
    v_racha_dias INT;
    v_racha_semanas INT;
    v_resultado JSONB;
BEGIN
    -- 1. Determinar inicio (Lunes) y fin (Domingo) de la semana actual según ISO
    v_inicio_semana := date_trunc('week', CURRENT_DATE)::DATE;
    v_fin_semana := (v_inicio_semana + INTERVAL '6 days')::DATE;

    -- 2. Calcular los 7 días [L, M, X, J, V, S, D] cruzando con historial_gamificacion
    WITH dias_semana AS (
        SELECT generate_series(v_inicio_semana, v_fin_semana, '1 day'::interval)::DATE AS fecha
    ),
    actividades AS (
        SELECT DISTINCT DATE(created_at) AS fecha_activa
        FROM public.historial_gamificacion
        WHERE user_id = p_user_id
          AND created_at >= v_inicio_semana
          AND created_at < (v_fin_semana + INTERVAL '1 day')
    )
    SELECT 
        array_agg((a.fecha_activa IS NOT NULL) ORDER BY d.fecha),
        COUNT(a.fecha_activa)
    INTO v_dias_array, v_dias_activos
    FROM dias_semana d
    LEFT JOIN actividades a ON d.fecha = a.fecha_activa;

    -- 3. Resetear racha diaria en BD si pasaron días sin actividad (ayer no hubo actividad)
    UPDATE public.profiles
    SET racha_dias = 0
    WHERE id = p_user_id
      AND (ultima_actividad IS NULL OR ultima_actividad < CURRENT_DATE - 1)
      AND racha_dias > 0;

    -- Obtener racha diaria actual del perfil
    SELECT COALESCE(racha_dias, 0)
    INTO v_racha_dias
    FROM public.profiles
    WHERE id = p_user_id;

    -- 4. Calcular racha de semanas consecutivas con al menos 1 actividad
    WITH semanas_consecutivas AS (
        SELECT 
            ((date_trunc('week', CURRENT_DATE)::DATE - date_trunc('week', created_at)::DATE) / 7)::INT AS diff_semanas
        FROM public.historial_gamificacion
        WHERE user_id = p_user_id
        GROUP BY date_trunc('week', created_at)::DATE
    ),
    secuencia AS (
        SELECT diff_semanas,
               (ROW_NUMBER() OVER (ORDER BY diff_semanas ASC) - 1)::INT AS rn
        FROM semanas_consecutivas
    )
    SELECT COUNT(*)::INT
    INTO v_racha_semanas
    FROM secuencia
    WHERE diff_semanas = rn;

    -- 5. Ensamblar JSON
    v_resultado := jsonb_build_object(
        'user_id', p_user_id,
        'inicio_semana', v_inicio_semana,
        'fin_semana', v_fin_semana,
        'dias', COALESCE(to_jsonb(v_dias_array), '[false,false,false,false,false,false,false]'::jsonb),
        'dias_activos', COALESCE(v_dias_activos, 0),
        'racha_dias', COALESCE(v_racha_dias, 0),
        'racha_semanas', COALESCE(v_racha_semanas, 0)
    );

    RETURN v_resultado;
END;
$function$;

-- ============================================================
-- 3. ESQUEMA DE TABLAS
-- ============================================================
-- ------------------------------------------------------------
-- Tabla: public.users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email)
);

-- ------------------------------------------------------------
-- Tabla: public.families
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.families (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    family_code VARCHAR(100),
    meta_luz INTEGER DEFAULT 0,
    meta_agua INTEGER DEFAULT 0,
    avatar JSONB DEFAULT '{"url": null, "color": "#2e7d32", "emoji": "home"}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT families_pkey PRIMARY KEY (id),
    CONSTRAINT families_family_code_key UNIQUE (family_code)
);

-- ------------------------------------------------------------
-- Tabla: public.profiles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    avatar JSONB DEFAULT '{"url": null, "color": "#2e7d32", "letra": "U"}'::jsonb,
    rol VARCHAR(50) DEFAULT 'miembro'::character varying,
    family_id UUID,
    xp INTEGER DEFAULT 0,
    nivel INTEGER DEFAULT 1,
    monedas INTEGER DEFAULT 0,
    trivia_correct_count INTEGER DEFAULT 0,
    trivia_last_updated VARCHAR(100),
    daily_bonus_claimed_at VARCHAR(100),
    onboarding_answers JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    ultima_actividad DATE,
    racha_dias INTEGER DEFAULT 0,
    CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

-- ------------------------------------------------------------
-- Tabla: public.achievements
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    user_id UUID NOT NULL,
    logro_key VARCHAR(100) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    desbloqueado_en TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT achievements_pkey PRIMARY KEY (id),
    CONSTRAINT achievements_user_id_logro_key_key UNIQUE (user_id, logro_key)
);

-- ------------------------------------------------------------
-- Tabla: public.evidences
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evidences (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    user_id UUID NOT NULL,
    family_id UUID NOT NULL,
    accion VARCHAR(255) NOT NULL,
    descripcion TEXT,
    likes INTEGER DEFAULT 0,
    xp INTEGER DEFAULT 0,
    emoji VARCHAR(20) DEFAULT 'star'::character varying,
    snapshot_usuario JSONB DEFAULT '{}'::jsonb,
    media JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT evidences_pkey PRIMARY KEY (id)
);

-- ------------------------------------------------------------
-- Tabla: public.tasks
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    family_id UUID NOT NULL,
    tarea VARCHAR(255) NOT NULL,
    asignado_id UUID,
    hecho BOOLEAN DEFAULT false,
    xp INTEGER DEFAULT 0,
    tipo VARCHAR(50) DEFAULT 'general'::character varying,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT tasks_pkey PRIMARY KEY (id)
);

-- ------------------------------------------------------------
-- Tabla: public.bills
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    family_id UUID NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    consumo NUMERIC NOT NULL,
    monto NUMERIC NOT NULL,
    periodo VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ocr_result JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT bills_pkey PRIMARY KEY (id)
);

-- ------------------------------------------------------------
-- Tabla: public.family_rewards
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.family_rewards (
    id BIGINT DEFAULT nextval('family_rewards_id_seq'::regclass) NOT NULL,
    family_id UUID NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    emoji VARCHAR(20) DEFAULT 'gift'::character varying,
    costo INTEGER DEFAULT 100,
    disponible BOOLEAN DEFAULT true,
    creador_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    last_redeemed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    es_familiar BOOLEAN DEFAULT false,
    CONSTRAINT family_rewards_pkey PRIMARY KEY (id)
);

-- ------------------------------------------------------------
-- Tabla: public.reto_validations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reto_validations (
    id BIGINT NOT NULL,
    family_id UUID NOT NULL,
    user_id UUID NOT NULL,
    reto VARCHAR(255) NOT NULL,
    hora VARCHAR(50) DEFAULT 'Recien'::character varying,
    xp INTEGER DEFAULT 0,
    monedas INTEGER DEFAULT 0,
    evidencias JSONB DEFAULT '[]'::jsonb,
    snapshot_usuario JSONB DEFAULT '{}'::jsonb,
    requiere_evidencia BOOLEAN DEFAULT false,
    estado VARCHAR(50) DEFAULT 'pendiente'::character varying,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT reto_validations_pkey PRIMARY KEY (id)
);

-- ------------------------------------------------------------
-- Tabla: public.qr_tokens
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qr_tokens (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    family_id UUID NOT NULL,
    token VARCHAR(100) NOT NULL,
    used BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT qr_tokens_pkey PRIMARY KEY (id),
    CONSTRAINT qr_tokens_token_key UNIQUE (token)
);

-- ------------------------------------------------------------
-- Tabla: public.daily_bonus_claims
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_bonus_claims (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    user_id UUID NOT NULL,
    bonus_date DATE NOT NULL,
    xp_bonus INTEGER DEFAULT 30,
    monedas_bonus INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT daily_bonus_claims_pkey PRIMARY KEY (id),
    CONSTRAINT daily_bonus_claims_user_id_bonus_date_key UNIQUE (user_id, bonus_date)
);

-- ------------------------------------------------------------
-- Tabla: public.logros
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.logros (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    codigo VARCHAR(50) NOT NULL,
    titulo VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    monedas_recompensa INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT logros_pkey PRIMARY KEY (id),
    CONSTRAINT logros_codigo_key UNIQUE (codigo)
);

-- ------------------------------------------------------------
-- Tabla: public.notifications
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    user_id UUID,
    title VARCHAR(255) NOT NULL,
    desc_text TEXT NOT NULL,
    visual JSONB DEFAULT '{"icon": "notifications", "color": "#388E3C"}'::jsonb,
    payload JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    family_id UUID,
    sender_id UUID,
    sender_name VARCHAR(100),
    type VARCHAR(50) DEFAULT 'ALERTA_GENERAL'::character varying,
    CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

-- ------------------------------------------------------------
-- Tabla: public.canjes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.canjes (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    reward_id BIGINT NOT NULL,
    user_id UUID NOT NULL,
    family_id UUID NOT NULL,
    costo_pagado INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT canjes_pkey PRIMARY KEY (id)
);

-- ------------------------------------------------------------
-- Tabla: public.historial_gamificacion
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.historial_gamificacion (
    id INTEGER DEFAULT nextval('historial_gamificacion_id_seq'::regclass) NOT NULL,
    user_id UUID NOT NULL,
    origen_actividad VARCHAR(50) NOT NULL,
    monedas_otorgadas INTEGER DEFAULT 0,
    xp_otorgada INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT historial_gamificacion_pkey PRIMARY KEY (id)
);

-- ------------------------------------------------------------
-- Tabla: public.shower_logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shower_logs (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    user_id UUID NOT NULL,
    duracion_segundos INTEGER NOT NULL,
    estado VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    family_id UUID,
    xp_otorgada INTEGER DEFAULT 0,
    monedas_otorgadas INTEGER DEFAULT 0,
    es_valido BOOLEAN DEFAULT true,
    CONSTRAINT shower_logs_pkey PRIMARY KEY (id)
);

-- ------------------------------------------------------------
-- Tabla: public.ecopuzzle
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ecopuzzle (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    imagen_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ecopuzzle_pkey PRIMARY KEY (id)
);

-- ------------------------------------------------------------
-- Tabla: public.usuario_logros
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usuario_logros (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    user_id UUID NOT NULL,
    logro_id UUID NOT NULL,
    reclamado BOOLEAN DEFAULT false,
    fecha_desbloqueo TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT usuario_logros_pkey PRIMARY KEY (id),
    CONSTRAINT usuario_logros_user_id_logro_id_key UNIQUE (user_id, logro_id)
);

-- ============================================================
-- 4. DATOS DE LAS TABLAS
-- ============================================================
-- Datos para public.users (14 registros)
INSERT INTO public."users" ("id", "email", "password_hash", "created_at") VALUES ('62dba794-5a69-4006-8233-4a009a6af1b2', 'jefe_32kia1@test.com', '$2a$10$ybeTdlb2cGE/iSd3p4/nWOQjHF7BWh0QnSC59V7.TP9hyXc0xxHEO', '2026-08-29T00:33:30.697Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."users" ("id", "email", "password_hash", "created_at") VALUES ('fc408ac1-d241-4bc8-afc0-1602fbc25ba8', 'miembro_32kia1@test.com', '$2a$10$gwOucKG8NHF0J/kCUR03G.2DAc3TpGvumzUTrbQcg6dnrEWaP5u8O', '2026-08-29T00:33:32.786Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."users" ("id", "email", "password_hash", "created_at") VALUES ('b2f809cb-5e17-497b-9b37-e1c0219e8375', 'efra@gmail.com', '$2a$10$5NYYdeK9v4eUX2TEuZNwVuGwcx5FSHLRCQy3W38YURGd20ZHLxxLu', '2026-08-29T00:35:01.203Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."users" ("id", "email", "password_hash", "created_at") VALUES ('e6c0b5a6-909e-4b8a-80c3-5f64007a4ff9', 'jefe_9npy5a@test.com', '$2a$10$3mga8OBCdy.Mr3plOiDHYOlzH4e3kar7bq8P2Ntp6IRe3VTWwZas.', '2026-08-29T00:48:46.646Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."users" ("id", "email", "password_hash", "created_at") VALUES ('b1a5a81a-1bae-418d-8527-e2859ffa0ad8', 'miembro_9npy5a@test.com', '$2a$10$b4aRjsytvzfRvSimdQrOQ.CvH5EklmYJRBPsFjDfy3IzGF5CxeRi.', '2026-08-29T00:48:48.773Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."users" ("id", "email", "password_hash", "created_at") VALUES ('37966106-6357-426b-a064-9d68945a187e', 'caro@gmail.com', '$2a$10$LUkFV.FHD78lFjSF/jb06uKO9u2k7pgakPQ2GKZG9U1FKmNChpxYO', '2026-08-29T22:09:34.677Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."users" ("id", "email", "password_hash", "created_at") VALUES ('3a40a98b-0cd6-4df2-8f2b-2a1cd3ca3734', 'jefe_6jjxys@test.com', '$2a$10$47MzeOtbhj1G07ohM3oNZ.LCQzgY4HXXxPnDoNEOUQSGbcZvLZXCC', '2026-08-30T16:14:17.627Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."users" ("id", "email", "password_hash", "created_at") VALUES ('6d5016f0-4afa-4e49-bbc2-2981f192a549', 'miembro_6jjxys@test.com', '$2a$10$BbCqgw2JkG115t2bbp0yueWpGtOHc2MUDEJqye2aB2Vii537Pm47C', '2026-08-30T16:14:19.723Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."users" ("id", "email", "password_hash", "created_at") VALUES ('ae7b2f02-31a2-4edb-adaa-f228e99f0331', 'jefe_hgij71@test.com', '$2a$10$2MML9DaaJlxBSMkLeemKlO6E.M3SFG1BBVcTuZ/eNA4pxOvYxJFqS', '2026-08-30T16:44:53.005Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."users" ("id", "email", "password_hash", "created_at") VALUES ('c712f8b6-9329-43af-ac9c-8260d186363c', 'miembro_hgij71@test.com', '$2a$10$PRjM5dkNsxfyEShF/FEWpeBJKdACAWFGVFaBkl0NeZu27YtFzlH8G', '2026-08-30T16:44:55.076Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."users" ("id", "email", "password_hash", "created_at") VALUES ('d0210af4-2536-4422-80d4-14a0e74b0fb6', 'jefe_3nqytk@test.com', '$2a$10$8ji513TdR6pPiWJYTVlaTO1U4nU0cOA36SgEzAE8Bd13VxrcWIjb2', '2026-08-30T16:48:45.754Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."users" ("id", "email", "password_hash", "created_at") VALUES ('b641306e-defc-4075-8e68-3d125522369d', 'miembro_3nqytk@test.com', '$2a$10$54n7C3wC.0MQvzm133IieevPvnQHjTVZ4NlI72syesJw.hunwrwIe', '2026-08-30T16:48:47.854Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."users" ("id", "email", "password_hash", "created_at") VALUES ('b7173f68-e247-4b98-acd6-123b65670a54', 'benja@habitik.com', '$2a$10$bJirPN0YbNPTdoinhRakbuw/voapWVtvy/tYIE71bnWoHDDmxAzaK', '2026-09-03T01:08:51.853Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."users" ("id", "email", "password_hash", "created_at") VALUES ('ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'mati@habitik.com', '$2a$10$2f8jgMlmPblWzMwV13No2usSccjk3DJOxaS5cGtvqP0tu.kD3KRYO', '2026-09-03T16:32:37.302Z'::timestamptz) ON CONFLICT DO NOTHING;


-- Datos para public.families (14 registros)
INSERT INTO public."families" ("id", "nombre", "family_code", "meta_luz", "meta_agua", "avatar", "created_at") VALUES ('2108c732-0e33-4065-9f53-03a9d7bd3a91', 'Nuevo Nombre Test', 'TGKSJU', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-08-29T00:33:30.697Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."families" ("id", "nombre", "family_code", "meta_luz", "meta_agua", "avatar", "created_at") VALUES ('fc6e7ce0-5851-4be4-9c31-b59d597f606c', 'Familia Temporal Pedro', 'MQL455', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-08-29T00:33:32.786Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."families" ("id", "nombre", "family_code", "meta_luz", "meta_agua", "avatar", "created_at") VALUES ('4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'Mi Hogar', '4FS1WO', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-08-29T00:35:01.203Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."families" ("id", "nombre", "family_code", "meta_luz", "meta_agua", "avatar", "created_at") VALUES ('d46b6ab9-cac7-4319-adae-5794bc3ee5e6', 'Nuevo Nombre Test', 'B8MWQH', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-08-29T00:48:46.646Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."families" ("id", "nombre", "family_code", "meta_luz", "meta_agua", "avatar", "created_at") VALUES ('d3724e12-3551-4822-a694-569f661cfd39', 'Familia Temporal Pedro', 'YC3BIZ', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-08-29T00:48:48.773Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."families" ("id", "nombre", "family_code", "meta_luz", "meta_agua", "avatar", "created_at") VALUES ('4d4a2bd6-22b3-4ba4-8323-ed5b569d41e2', 'Hogar de carolina', 'FHTRYS', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-08-29T22:09:34.677Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."families" ("id", "nombre", "family_code", "meta_luz", "meta_agua", "avatar", "created_at") VALUES ('f3b7a402-faa4-4b3e-8f4d-f014dc4cc6b1', 'Nuevo Nombre Test', '721V21', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-08-30T16:14:17.627Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."families" ("id", "nombre", "family_code", "meta_luz", "meta_agua", "avatar", "created_at") VALUES ('d23dcf9e-f927-4eb5-8af3-a0a8f35d29d5', 'Familia Temporal Pedro', '6QLQE6', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-08-30T16:14:19.723Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."families" ("id", "nombre", "family_code", "meta_luz", "meta_agua", "avatar", "created_at") VALUES ('9d1b880c-bcc9-456c-8b4a-3a2a0bd2cbb3', 'Nuevo Nombre Test', 'VKKPVG', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-08-30T16:44:53.005Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."families" ("id", "nombre", "family_code", "meta_luz", "meta_agua", "avatar", "created_at") VALUES ('f72a8909-b2f4-403e-b9f2-d2523a879798', 'Familia Temporal Pedro', '7WADWV', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-08-30T16:44:55.076Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."families" ("id", "nombre", "family_code", "meta_luz", "meta_agua", "avatar", "created_at") VALUES ('28c32ba5-476d-4521-b290-0500b3ed33b3', 'Nuevo Nombre Test', '1V9C02', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-08-30T16:48:45.754Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."families" ("id", "nombre", "family_code", "meta_luz", "meta_agua", "avatar", "created_at") VALUES ('b6464968-3e23-4d9a-8c4c-827fee128a4c', 'Familia Temporal Pedro', 'GI5W25', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-08-30T16:48:47.854Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."families" ("id", "nombre", "family_code", "meta_luz", "meta_agua", "avatar", "created_at") VALUES ('a4e76ea5-78af-461c-9a1e-4fd91ccad100', 'DEVS', 'L3Y2RY', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-09-03T01:08:51.853Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."families" ("id", "nombre", "family_code", "meta_luz", "meta_agua", "avatar", "created_at") VALUES ('c4d23a0a-6c80-4797-aae7-6eed71432fc0', 'Hogar de Matias', 'MLARP0', 0, 0, '{"url":null,"color":"#2e7d32","emoji":"home"}'::jsonb, '2026-09-03T16:32:37.302Z'::timestamptz) ON CONFLICT DO NOTHING;


-- Datos para public.profiles (14 registros)
INSERT INTO public."profiles" ("id", "email", "nombre", "avatar", "rol", "family_id", "xp", "nivel", "monedas", "trivia_correct_count", "trivia_last_updated", "daily_bonus_claimed_at", "onboarding_answers", "created_at", "ultima_actividad", "racha_dias") VALUES ('62dba794-5a69-4006-8233-4a009a6af1b2', 'jefe_32kia1@test.com', 'Bastian', '{"url":null,"color":"#2e7d32","letra":"B"}'::jsonb, 'Jefe', '2108c732-0e33-4065-9f53-03a9d7bd3a91', 0, 1, 0, 0, NULL, NULL, '{"personasCount":4,"tipoCalefaccion":"electrica","electrodomesticos":["lavadora","secadora","aire_acondicionado"],"habitacionesCount":3}'::jsonb, '2026-08-29T00:33:30.697Z'::timestamptz, NULL, 0) ON CONFLICT DO NOTHING;
INSERT INTO public."profiles" ("id", "email", "nombre", "avatar", "rol", "family_id", "xp", "nivel", "monedas", "trivia_correct_count", "trivia_last_updated", "daily_bonus_claimed_at", "onboarding_answers", "created_at", "ultima_actividad", "racha_dias") VALUES ('fc408ac1-d241-4bc8-afc0-1602fbc25ba8', 'miembro_32kia1@test.com', 'Pedro', '{"url":null,"color":"#2e7d32","letra":"P"}'::jsonb, 'Miembro', '2108c732-0e33-4065-9f53-03a9d7bd3a91', 0, 1, 0, 0, NULL, NULL, '{"frecuenciaReciclaje":"siempre","tiempoDuchaPromedio":10,"horasPantallaDiarias":4}'::jsonb, '2026-08-29T00:33:32.786Z'::timestamptz, NULL, 0) ON CONFLICT DO NOTHING;
INSERT INTO public."profiles" ("id", "email", "nombre", "avatar", "rol", "family_id", "xp", "nivel", "monedas", "trivia_correct_count", "trivia_last_updated", "daily_bonus_claimed_at", "onboarding_answers", "created_at", "ultima_actividad", "racha_dias") VALUES ('e6c0b5a6-909e-4b8a-80c3-5f64007a4ff9', 'jefe_9npy5a@test.com', 'Bastian', '{"url":null,"color":"#2e7d32","letra":"B"}'::jsonb, 'Jefe', 'd46b6ab9-cac7-4319-adae-5794bc3ee5e6', 0, 1, 0, 0, NULL, NULL, '{"personasCount":4,"tipoCalefaccion":"electrica","electrodomesticos":["lavadora","secadora","aire_acondicionado"],"habitacionesCount":3}'::jsonb, '2026-08-29T00:48:46.646Z'::timestamptz, NULL, 0) ON CONFLICT DO NOTHING;
INSERT INTO public."profiles" ("id", "email", "nombre", "avatar", "rol", "family_id", "xp", "nivel", "monedas", "trivia_correct_count", "trivia_last_updated", "daily_bonus_claimed_at", "onboarding_answers", "created_at", "ultima_actividad", "racha_dias") VALUES ('b1a5a81a-1bae-418d-8527-e2859ffa0ad8', 'miembro_9npy5a@test.com', 'Pedro', '{"url":null,"color":"#2e7d32","letra":"P"}'::jsonb, 'Miembro', 'd46b6ab9-cac7-4319-adae-5794bc3ee5e6', 0, 1, 0, 0, NULL, NULL, '{"frecuenciaReciclaje":"siempre","tiempoDuchaPromedio":10,"horasPantallaDiarias":4}'::jsonb, '2026-08-29T00:48:48.773Z'::timestamptz, NULL, 0) ON CONFLICT DO NOTHING;
INSERT INTO public."profiles" ("id", "email", "nombre", "avatar", "rol", "family_id", "xp", "nivel", "monedas", "trivia_correct_count", "trivia_last_updated", "daily_bonus_claimed_at", "onboarding_answers", "created_at", "ultima_actividad", "racha_dias") VALUES ('3a40a98b-0cd6-4df2-8f2b-2a1cd3ca3734', 'jefe_6jjxys@test.com', 'Bastian', '{"url":null,"color":"#2e7d32","letra":"B"}'::jsonb, 'Jefe', 'f3b7a402-faa4-4b3e-8f4d-f014dc4cc6b1', 0, 1, 0, 0, NULL, NULL, '{"personasCount":4,"tipoCalefaccion":"electrica","electrodomesticos":["lavadora","secadora","aire_acondicionado"],"habitacionesCount":3}'::jsonb, '2026-08-30T16:14:17.627Z'::timestamptz, NULL, 0) ON CONFLICT DO NOTHING;
INSERT INTO public."profiles" ("id", "email", "nombre", "avatar", "rol", "family_id", "xp", "nivel", "monedas", "trivia_correct_count", "trivia_last_updated", "daily_bonus_claimed_at", "onboarding_answers", "created_at", "ultima_actividad", "racha_dias") VALUES ('ae7b2f02-31a2-4edb-adaa-f228e99f0331', 'jefe_hgij71@test.com', 'Bastian', '{"url":null,"color":"#2e7d32","letra":"B"}'::jsonb, 'Jefe', '9d1b880c-bcc9-456c-8b4a-3a2a0bd2cbb3', 0, 1, 0, 0, NULL, NULL, '{"personasCount":4,"tipoCalefaccion":"electrica","electrodomesticos":["lavadora","secadora","aire_acondicionado"],"habitacionesCount":3}'::jsonb, '2026-08-30T16:44:53.005Z'::timestamptz, NULL, 0) ON CONFLICT DO NOTHING;
INSERT INTO public."profiles" ("id", "email", "nombre", "avatar", "rol", "family_id", "xp", "nivel", "monedas", "trivia_correct_count", "trivia_last_updated", "daily_bonus_claimed_at", "onboarding_answers", "created_at", "ultima_actividad", "racha_dias") VALUES ('c712f8b6-9329-43af-ac9c-8260d186363c', 'miembro_hgij71@test.com', 'Pedro', '{"url":null,"color":"#2e7d32","letra":"P"}'::jsonb, 'Miembro', '9d1b880c-bcc9-456c-8b4a-3a2a0bd2cbb3', 150, 1, 2, 0, NULL, NULL, '{"daily_tracking":{"2026-08-30":["eco_puzzle"]},"frecuenciaReciclaje":"siempre","tiempoDuchaPromedio":10,"horasPantallaDiarias":4}'::jsonb, '2026-08-30T16:44:55.076Z'::timestamptz, NULL, 0) ON CONFLICT DO NOTHING;
INSERT INTO public."profiles" ("id", "email", "nombre", "avatar", "rol", "family_id", "xp", "nivel", "monedas", "trivia_correct_count", "trivia_last_updated", "daily_bonus_claimed_at", "onboarding_answers", "created_at", "ultima_actividad", "racha_dias") VALUES ('d0210af4-2536-4422-80d4-14a0e74b0fb6', 'jefe_3nqytk@test.com', 'Bastian', '{"url":null,"color":"#2e7d32","letra":"B"}'::jsonb, 'Jefe', '28c32ba5-476d-4521-b290-0500b3ed33b3', 0, 1, 0, 0, NULL, NULL, '{"personasCount":4,"tipoCalefaccion":"electrica","electrodomesticos":["lavadora","secadora","aire_acondicionado"],"habitacionesCount":3}'::jsonb, '2026-08-30T16:48:45.754Z'::timestamptz, NULL, 0) ON CONFLICT DO NOTHING;
INSERT INTO public."profiles" ("id", "email", "nombre", "avatar", "rol", "family_id", "xp", "nivel", "monedas", "trivia_correct_count", "trivia_last_updated", "daily_bonus_claimed_at", "onboarding_answers", "created_at", "ultima_actividad", "racha_dias") VALUES ('b641306e-defc-4075-8e68-3d125522369d', 'miembro_3nqytk@test.com', 'Pedro', '{"url":null,"color":"#2e7d32","letra":"P"}'::jsonb, 'Miembro', '28c32ba5-476d-4521-b290-0500b3ed33b3', 150, 1, 2, 0, NULL, NULL, '{"fcm_token":"fcm_fake_token_test_abc123xyz","daily_tracking":{"2026-08-30":["eco_puzzle"]},"frecuenciaReciclaje":"siempre","tiempoDuchaPromedio":10,"horasPantallaDiarias":4}'::jsonb, '2026-08-30T16:48:47.854Z'::timestamptz, NULL, 0) ON CONFLICT DO NOTHING;
INSERT INTO public."profiles" ("id", "email", "nombre", "avatar", "rol", "family_id", "xp", "nivel", "monedas", "trivia_correct_count", "trivia_last_updated", "daily_bonus_claimed_at", "onboarding_answers", "created_at", "ultima_actividad", "racha_dias") VALUES ('37966106-6357-426b-a064-9d68945a187e', 'caro@gmail.com', 'carolina', '{"url":null,"color":"#2e7d32","letra":"C"}'::jsonb, 'Miembro', '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 300, 1, 4, 0, NULL, NULL, '{"daily_tracking":{"2026-08-30":["eco_puzzle"]},"frecuenciaReciclaje":"ocasional","tiempoDuchaPromedio":12,"horasPantallaDiarias":4}'::jsonb, '2026-08-29T22:09:34.677Z'::timestamptz, '2026-09-02T04:00:00.000Z'::timestamptz, 0) ON CONFLICT DO NOTHING;
INSERT INTO public."profiles" ("id", "email", "nombre", "avatar", "rol", "family_id", "xp", "nivel", "monedas", "trivia_correct_count", "trivia_last_updated", "daily_bonus_claimed_at", "onboarding_answers", "created_at", "ultima_actividad", "racha_dias") VALUES ('b2f809cb-5e17-497b-9b37-e1c0219e8375', 'efra@gmail.com', 'efra', '{"url":null,"color":"#2e7d32","letra":"E"}'::jsonb, 'Jefe', '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 10200, 21, 5024, 0, NULL, NULL, '{"personasCount":4,"daily_tracking":{"2026-09-01":["speedrun_ducha"]},"tipoCalefaccion":"electrica","electrodomesticos":["lavadora","secadora"],"habitacionesCount":3}'::jsonb, '2026-08-29T00:35:01.203Z'::timestamptz, '2026-09-05T04:00:00.000Z'::timestamptz, 13) ON CONFLICT DO NOTHING;
INSERT INTO public."profiles" ("id", "email", "nombre", "avatar", "rol", "family_id", "xp", "nivel", "monedas", "trivia_correct_count", "trivia_last_updated", "daily_bonus_claimed_at", "onboarding_answers", "created_at", "ultima_actividad", "racha_dias") VALUES ('ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'mati@habitik.com', 'Matias', '{"url":null,"color":"#2e7d32","letra":"M"}'::jsonb, 'Miembro', 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 550, 2, 9, 0, NULL, NULL, '{"frecuenciaReciclaje":"ocasional","tiempoDuchaPromedio":8,"horasPantallaDiarias":4}'::jsonb, '2026-09-03T16:32:37.302Z'::timestamptz, '2026-09-03T04:00:00.000Z'::timestamptz, 0) ON CONFLICT DO NOTHING;
INSERT INTO public."profiles" ("id", "email", "nombre", "avatar", "rol", "family_id", "xp", "nivel", "monedas", "trivia_correct_count", "trivia_last_updated", "daily_bonus_claimed_at", "onboarding_answers", "created_at", "ultima_actividad", "racha_dias") VALUES ('6d5016f0-4afa-4e49-bbc2-2981f192a549', 'miembro_6jjxys@test.com', 'Pedro', '{"url":null,"color":"#2e7d32","letra":"P"}'::jsonb, 'Miembro', 'f3b7a402-faa4-4b3e-8f4d-f014dc4cc6b1', 530, 2, 11, 0, NULL, NULL, '{"daily_tracking":{"2026-08-30":["eco_puzzle"]},"frecuenciaReciclaje":"siempre","tiempoDuchaPromedio":10,"horasPantallaDiarias":4}'::jsonb, '2026-08-30T16:14:19.723Z'::timestamptz, '2026-08-31T04:00:00.000Z'::timestamptz, 0) ON CONFLICT DO NOTHING;
INSERT INTO public."profiles" ("id", "email", "nombre", "avatar", "rol", "family_id", "xp", "nivel", "monedas", "trivia_correct_count", "trivia_last_updated", "daily_bonus_claimed_at", "onboarding_answers", "created_at", "ultima_actividad", "racha_dias") VALUES ('b7173f68-e247-4b98-acd6-123b65670a54', 'benja@habitik.com', 'Benja', '{"url":null,"color":"#2e7d32","letra":"B"}'::jsonb, 'Jefe', 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 300, 1, 30, 0, NULL, NULL, '{"personasCount":4,"tipoCalefaccion":"electrica","electrodomesticos":["lavadora","secadora"],"habitacionesCount":3}'::jsonb, '2026-09-03T01:08:51.853Z'::timestamptz, '2026-09-03T04:00:00.000Z'::timestamptz, 0) ON CONFLICT DO NOTHING;


-- public.achievements: Sin registros actualmente

-- public.evidences: Sin registros actualmente

-- public.tasks: Sin registros actualmente

-- public.bills: Sin registros actualmente

-- Datos para public.family_rewards (2 registros)
INSERT INTO public."family_rewards" ("id", "family_id", "titulo", "descripcion", "emoji", "costo", "disponible", "creador_id", "metadata", "last_redeemed_at", "created_at", "es_familiar") VALUES ('2', '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', '1 Hora de Videojuegos', 'Canje de prueba de tienda', 'gift', 30, TRUE, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', '{}'::jsonb, '2026-08-30T23:26:53.661Z'::timestamptz, '2026-08-30T23:24:21.947Z'::timestamptz, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."family_rewards" ("id", "family_id", "titulo", "descripcion", "emoji", "costo", "disponible", "creador_id", "metadata", "last_redeemed_at", "created_at", "es_familiar") VALUES ('3', '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'Salida por un Helado', 'Válido para un helado doble el fin de semana', 'gift', 25, TRUE, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', '{}'::jsonb, NULL, '2026-08-31T01:27:01.670Z'::timestamptz, FALSE) ON CONFLICT DO NOTHING;


-- Datos para public.reto_validations (5 registros)
INSERT INTO public."reto_validations" ("id", "family_id", "user_id", "reto", "hora", "xp", "monedas", "evidencias", "snapshot_usuario", "requiere_evidencia", "estado", "created_at") VALUES ('1', 'f3b7a402-faa4-4b3e-8f4d-f014dc4cc6b1', '6d5016f0-4afa-4e49-bbc2-2981f192a549', 'Eco-Puzzle Temático', 'Recien', 150, 2, '[{"errores":1,"tiempo_segundos":45}]'::jsonb, '{}'::jsonb, FALSE, 'aprobado', '2026-08-30T16:14:24.302Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."reto_validations" ("id", "family_id", "user_id", "reto", "hora", "xp", "monedas", "evidencias", "snapshot_usuario", "requiere_evidencia", "estado", "created_at") VALUES ('2', '9d1b880c-bcc9-456c-8b4a-3a2a0bd2cbb3', 'c712f8b6-9329-43af-ac9c-8260d186363c', 'Eco-Puzzle Temático', 'Recien', 150, 2, '[{"errores":1,"tiempo_segundos":45}]'::jsonb, '{}'::jsonb, FALSE, 'aprobado', '2026-08-30T16:44:59.734Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."reto_validations" ("id", "family_id", "user_id", "reto", "hora", "xp", "monedas", "evidencias", "snapshot_usuario", "requiere_evidencia", "estado", "created_at") VALUES ('3', '28c32ba5-476d-4521-b290-0500b3ed33b3', 'b641306e-defc-4075-8e68-3d125522369d', 'Eco-Puzzle Temático', 'Recien', 150, 2, '[{"errores":1,"tiempo_segundos":45}]'::jsonb, '{}'::jsonb, FALSE, 'aprobado', '2026-08-30T16:48:52.486Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."reto_validations" ("id", "family_id", "user_id", "reto", "hora", "xp", "monedas", "evidencias", "snapshot_usuario", "requiere_evidencia", "estado", "created_at") VALUES ('4', '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', '37966106-6357-426b-a064-9d68945a187e', 'Eco-Puzzle Temático', 'Recien', 150, 2, '[{"errores":1,"tiempo_segundos":35}]'::jsonb, '{}'::jsonb, FALSE, 'aprobado', '2026-08-30T17:21:47.113Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."reto_validations" ("id", "family_id", "user_id", "reto", "hora", "xp", "monedas", "evidencias", "snapshot_usuario", "requiere_evidencia", "estado", "created_at") VALUES ('5', '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', '37966106-6357-426b-a064-9d68945a187e', 'Eco-Puzzle Temático', 'Recien', 150, 2, '[{"errores":1,"tiempo_segundos":24}]'::jsonb, '{"avatar":{"url":null,"color":"#2e7d32","letra":"C"},"nombre":"carolina"}'::jsonb, FALSE, 'aprobado', '2026-09-02T02:46:42.003Z'::timestamptz) ON CONFLICT DO NOTHING;


-- Datos para public.qr_tokens (15 registros)
INSERT INTO public."qr_tokens" ("id", "family_id", "token", "used", "expires_at", "created_at") VALUES ('7ab51a4d-2d73-4a2b-99e0-271f603cc26f', '2108c732-0e33-4065-9f53-03a9d7bd3a91', '88868fab-edfb-4bda-9b90-86938d0b5d3d', TRUE, '2026-08-29T00:43:31.731Z'::timestamptz, '2026-08-29T00:33:32.464Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."qr_tokens" ("id", "family_id", "token", "used", "expires_at", "created_at") VALUES ('a8e95d00-04bf-4b90-8601-ce568c251c6c', '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', '25abc04f-d2cb-4062-8df5-9ba0f9c39b0b', FALSE, '2026-08-29T00:45:13.258Z'::timestamptz, '2026-08-29T00:35:13.989Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."qr_tokens" ("id", "family_id", "token", "used", "expires_at", "created_at") VALUES ('217b5098-154f-41d7-842e-4c2c4373b52e', '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', '7adc7b1f-8622-490b-9df2-e9e50234be7d', FALSE, '2026-08-29T00:45:25.950Z'::timestamptz, '2026-08-29T00:35:26.681Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."qr_tokens" ("id", "family_id", "token", "used", "expires_at", "created_at") VALUES ('d5b05746-c479-4283-b1db-4068b72d3e0b', 'd46b6ab9-cac7-4319-adae-5794bc3ee5e6', 'c659b18f-b2a9-47c1-97c2-82a884674b7b', TRUE, '2026-08-29T00:58:47.735Z'::timestamptz, '2026-08-29T00:48:48.451Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."qr_tokens" ("id", "family_id", "token", "used", "expires_at", "created_at") VALUES ('b18aaa72-1533-4788-8d2b-9d2abe445864', '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', '3ed4a1ac-2f70-4fe0-93ca-d923549ee15c', FALSE, '2026-08-29T01:13:43.012Z'::timestamptz, '2026-08-29T01:03:43.711Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."qr_tokens" ("id", "family_id", "token", "used", "expires_at", "created_at") VALUES ('df16765e-31f0-4307-92cf-c489fd9e3c9a', '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', '2804de49-a69f-4913-9b96-272f9d69b32b', FALSE, '2026-08-29T22:09:37.588Z'::timestamptz, '2026-08-29T21:59:38.287Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."qr_tokens" ("id", "family_id", "token", "used", "expires_at", "created_at") VALUES ('e5eef472-1f69-4280-a6d5-ce5d554bdebf', '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', '333fea0d-0e06-4731-85e0-1f0ba01cb0e0', TRUE, '2026-08-29T22:22:57.167Z'::timestamptz, '2026-08-29T22:12:57.775Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."qr_tokens" ("id", "family_id", "token", "used", "expires_at", "created_at") VALUES ('87da6af5-1e1b-412d-8c9e-aec45c466eb2', 'f3b7a402-faa4-4b3e-8f4d-f014dc4cc6b1', '8ca8b0ab-4b10-48c4-badd-38d6873f144b', TRUE, '2026-08-30T16:24:19.486Z'::timestamptz, '2026-08-30T16:14:19.398Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."qr_tokens" ("id", "family_id", "token", "used", "expires_at", "created_at") VALUES ('4c1b36f3-57e2-44ca-bde1-110c04af7b64', '9d1b880c-bcc9-456c-8b4a-3a2a0bd2cbb3', '59052f32-d6e6-400d-999f-b3d7129044e8', TRUE, '2026-08-30T16:54:54.871Z'::timestamptz, '2026-08-30T16:44:54.750Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."qr_tokens" ("id", "family_id", "token", "used", "expires_at", "created_at") VALUES ('38b5f39d-ece5-4b96-b0f5-e693f2b66736', '28c32ba5-476d-4521-b290-0500b3ed33b3', '3bce98cd-eabc-469c-a0d5-2408c3192f09', TRUE, '2026-08-30T16:58:47.653Z'::timestamptz, '2026-08-30T16:48:47.525Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."qr_tokens" ("id", "family_id", "token", "used", "expires_at", "created_at") VALUES ('40d22995-76b1-4f38-83d3-9d25c3820a01', '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'bd73d6d7-df99-424d-94de-2f3cb3c1a4f0', FALSE, '2026-09-03T00:59:08.975Z'::timestamptz, '2026-09-03T00:49:11.371Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."qr_tokens" ("id", "family_id", "token", "used", "expires_at", "created_at") VALUES ('4f948673-e210-432a-95ef-0456c372bd6e', 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 'ca02300c-cf0d-4909-be9a-1ac1214ee41c', FALSE, '2026-09-03T01:19:05.351Z'::timestamptz, '2026-09-03T01:09:05.874Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."qr_tokens" ("id", "family_id", "token", "used", "expires_at", "created_at") VALUES ('1c4e6b2d-c7e2-4493-ad7b-ee66b63f872f', 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', '2679f4c0-677e-48c6-a3af-9c5c76e3d640', TRUE, '2026-09-03T16:42:19.585Z'::timestamptz, '2026-09-03T16:31:42.840Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."qr_tokens" ("id", "family_id", "token", "used", "expires_at", "created_at") VALUES ('a1107c91-f91a-45d9-b632-12c7fe509645', '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', '9ab09a62-5355-42f5-8c24-17ccefc0b365', FALSE, '2026-09-04T01:25:22.611Z'::timestamptz, '2026-09-04T01:15:26.106Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."qr_tokens" ("id", "family_id", "token", "used", "expires_at", "created_at") VALUES ('bf5fa054-2790-49ce-8ef8-909368cec17d', '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', '0f2b8a56-6c38-4e67-84f3-2b6893810fad', FALSE, '2026-09-05T21:24:31.263Z'::timestamptz, '2026-09-05T21:14:35.765Z'::timestamptz) ON CONFLICT DO NOTHING;


-- public.daily_bonus_claims: Sin registros actualmente

-- Datos para public.logros (3 registros)
INSERT INTO public."logros" ("id", "codigo", "titulo", "descripcion", "monedas_recompensa", "created_at") VALUES ('ac7b91a1-2587-472b-b282-dbc7c18160de', 'PRIMERA_DUCHA', 'Ducha Eficiente', 'Completa tu primer Speedrun de Ducha válido', 10, '2026-09-05T00:50:32.084Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."logros" ("id", "codigo", "titulo", "descripcion", "monedas_recompensa", "created_at") VALUES ('c082fd8f-2098-4100-bb2f-c19136826dc3', 'MAESTRO_ECO', 'Experto del Reciclaje', 'Completa un Eco-Puzzle con 0 errores', 15, '2026-09-05T00:50:32.084Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."logros" ("id", "codigo", "titulo", "descripcion", "monedas_recompensa", "created_at") VALUES ('fd795d04-16bd-43aa-b108-154d05ba064e', 'RACHA_3', 'Constancia Verde', 'Alcanza una racha de 3 días consecutivos', 20, '2026-09-05T00:50:32.084Z'::timestamptz) ON CONFLICT DO NOTHING;


-- Datos para public.notifications (43 registros)
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('9333a4d1-e2b0-43a1-b204-3068c4f58b1c', NULL, '🚿 ¡Hora de la Ducha!', 'Carlos ha iniciado el reto Speedrun Ducha.', '{"icon":"notifications","color":"#388E3C"}'::jsonb, '{}'::jsonb, FALSE, '2026-08-29T21:36:18.591Z'::timestamptz, '2108c732-0e33-4065-9f53-03a9d7bd3a91', NULL, 'Carlos', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('045c442a-8673-4b02-abcd-d9b948756293', NULL, '🚿 ¡Hora de la Ducha!', '¡efra ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-08-29T21:42:42.113909","usuario_nombre":"efra"}'::jsonb, FALSE, '2026-08-29T21:42:45.407Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'efra', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('800813da-ff29-47e2-b34c-34f6d69455f7', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', '🚿 ¡Hora de la Ducha!', '¡efra ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-08-29T21:56:47.162843","usuario_nombre":"efra"}'::jsonb, FALSE, '2026-08-29T21:56:50.832Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'efra', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('a6904abc-6caa-4d89-a076-d6cca54dbe0b', '37966106-6357-426b-a064-9d68945a187e', '🚿 ¡Hora de la Ducha!', '¡carolina ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-08-29T18:13:25.061977","usuario_nombre":"carolina"}'::jsonb, FALSE, '2026-08-29T22:13:26.144Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', '37966106-6357-426b-a064-9d68945a187e', 'carolina', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('63d888db-e9a7-427d-ab74-1c55be753ff3', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', '🚿 ¡Hora de la Ducha!', '¡efra ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-08-29T22:20:59.890446","usuario_nombre":"efra"}'::jsonb, FALSE, '2026-08-29T22:21:03.379Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'efra', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('7fe7ea2f-d2eb-4920-aa4f-d0aabe0dd4e0', '37966106-6357-426b-a064-9d68945a187e', '🚿 ¡Hora de la Ducha!', '¡carolina ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-08-29T18:22:12.557459","usuario_nombre":"carolina"}'::jsonb, FALSE, '2026-08-29T22:22:13.659Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', '37966106-6357-426b-a064-9d68945a187e', 'carolina', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('432e80ea-004e-46eb-8cba-73ca66e9e8fe', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', '🚿 ¡Hora de la Ducha!', '¡efra ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-08-30T15:34:19.733279","usuario_nombre":"efra"}'::jsonb, FALSE, '2026-08-30T15:34:22.852Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'efra', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('00d5c7e5-5361-4189-a22e-c11e25ed72ed', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', '🚿 ¡Hora de la Ducha!', '¡efra ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-08-30T15:36:16.984313","usuario_nombre":"efra"}'::jsonb, FALSE, '2026-08-30T15:36:19.943Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'efra', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('2705aae7-258c-4771-93ca-3fd48438be21', '37966106-6357-426b-a064-9d68945a187e', '🚿 ¡Hora de la Ducha!', '¡carolina ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-08-30T11:36:59.031767","usuario_nombre":"carolina"}'::jsonb, FALSE, '2026-08-30T15:37:00.235Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', '37966106-6357-426b-a064-9d68945a187e', 'carolina', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('4a97a90c-aa3b-4d05-8f84-a0407b440373', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', '🚿 ¡Hora de la Ducha!', '¡efra ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-08-30T16:16:17.535815","usuario_nombre":"efra"}'::jsonb, FALSE, '2026-08-30T16:16:20.450Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'efra', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('ef875e20-9c15-4c4a-8c32-14a49b2aee46', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', '🚿 ¡Hora de la Ducha!', '¡efra ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-08-30T16:16:52.227907","usuario_nombre":"efra"}'::jsonb, FALSE, '2026-08-30T16:16:55.051Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'efra', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('e8744b21-4ff5-4426-9d14-caee48fc2afa', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', '🚿 ¡Hora de la Ducha!', '¡efra ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-08-30T16:24:37.627904","usuario_nombre":"efra"}'::jsonb, FALSE, '2026-08-30T16:24:40.697Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'efra', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('3eee6e64-b2a5-4e89-a600-98fa1a3d9af7', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', '🚿 ¡Hora de la Ducha!', '¡efra ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-08-30T16:56:04.870056","usuario_nombre":"efra"}'::jsonb, FALSE, '2026-08-30T16:56:07.987Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'efra', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('3fef5c6f-74a6-46fe-a69c-964129f40854', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', '🚿 ¡Hora de la Ducha!', '¡efra ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-08-30T16:56:53.271837","usuario_nombre":"efra"}'::jsonb, FALSE, '2026-08-30T16:56:56.507Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'efra', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('e139f9c3-b89b-469e-9e07-5f06b5a8e9aa', '37966106-6357-426b-a064-9d68945a187e', '🚿 ¡Hora de la Ducha!', '¡carolina ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-08-30T13:26:29.768468","usuario_nombre":"carolina"}'::jsonb, FALSE, '2026-08-30T17:26:30.828Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', '37966106-6357-426b-a064-9d68945a187e', 'carolina', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('2910ca93-f406-4de1-94ae-971174f152c3', '37966106-6357-426b-a064-9d68945a187e', '🚿 ¡Hora de la Ducha!', '¡carolina ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-08-30T13:41:40.070595","usuario_nombre":"carolina"}'::jsonb, FALSE, '2026-08-30T17:41:41.201Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', '37966106-6357-426b-a064-9d68945a187e', 'carolina', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('ce9af9c1-3fad-4df3-a52a-0d2c1fa5fef1', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', '🚿 ¡Hora de la Ducha!', '¡efra ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-08-30T17:48:20.466703","usuario_nombre":"efra"}'::jsonb, FALSE, '2026-08-30T17:48:23.676Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'efra', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('28b71ced-9158-48d1-bf89-9c8813fe77d9', '37966106-6357-426b-a064-9d68945a187e', '🚿 ¡Hora de la Ducha!', '¡carolina ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-08-30T13:57:43.310597","usuario_nombre":"carolina"}'::jsonb, FALSE, '2026-08-30T17:57:44.419Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', '37966106-6357-426b-a064-9d68945a187e', 'carolina', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('6003d00e-1300-408e-96d3-58be4b444339', '37966106-6357-426b-a064-9d68945a187e', '🚿 ¡Hora de la Ducha!', '¡carolina ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-08-30T14:01:12.159986","usuario_nombre":"carolina"}'::jsonb, FALSE, '2026-08-30T18:01:13.264Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', '37966106-6357-426b-a064-9d68945a187e', 'carolina', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('377a0d0d-2d63-4e99-9e1a-af3cd6e2b924', '37966106-6357-426b-a064-9d68945a187e', '🚿 ¡Hora de la Ducha!', '¡carolina ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-08-30T14:03:36.352593","usuario_nombre":"carolina"}'::jsonb, FALSE, '2026-08-30T18:03:37.455Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', '37966106-6357-426b-a064-9d68945a187e', 'carolina', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('adce60b1-7a52-459f-9548-fdfc58454d1e', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', '🚿 ¡Hora de la Ducha!', '¡efra ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-08-30T18:06:12.605006","usuario_nombre":"efra"}'::jsonb, FALSE, '2026-08-30T18:06:15.647Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'efra', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('7f9b670f-faea-4a2f-aa6c-020faed47816', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', '🚿 ¡Hora de la Ducha!', '¡efra ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-09-02T02:36:39.262409","usuario_nombre":"efra"}'::jsonb, FALSE, '2026-09-02T02:36:44.766Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'efra', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('fb266319-ceee-4dfe-bf25-39bfb79370e0', '37966106-6357-426b-a064-9d68945a187e', '🚿 ¡Hora de la Ducha!', '¡carolina ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-09-01T22:47:23.089314","usuario_nombre":"carolina"}'::jsonb, FALSE, '2026-09-02T02:47:24.200Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', '37966106-6357-426b-a064-9d68945a187e', 'carolina', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('2a9f1653-31c4-404b-897e-fa8a9f593d19', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', '🚿 ¡Hora de la Ducha!', '¡efra ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-09-03T02:38:16.613480","usuario_nombre":"efra"}'::jsonb, FALSE, '2026-09-03T02:38:21.193Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'efra', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('690ff295-09c3-431b-aaec-5191aac2ba82', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', '🚿 ¡Eco-Ducha Completada!', 'efra completó su ducha en 5.7 min y sumó 100 XP al hogar.', '{"icon":"emoji_events","color":"#10B981"}'::jsonb, '{"xp":100,"tipo":"ducha","monedas":1,"duracion_segundos":344}'::jsonb, FALSE, '2026-09-03T02:44:30.846Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'efra', 'RETO_COMPLETADO') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('25235215-98fa-4931-b55e-944fe4523321', 'b7173f68-e247-4b98-acd6-123b65670a54', '🚿 ¡Hora de la Ducha!', '¡Benja ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-09-03T16:45:24.685263","usuario_nombre":"Benja"}'::jsonb, FALSE, '2026-09-03T16:44:48.990Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 'b7173f68-e247-4b98-acd6-123b65670a54', 'Benja', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('3e816f65-b5b1-4b8a-bc26-34008a956180', 'b7173f68-e247-4b98-acd6-123b65670a54', '🚿 ¡Eco-Ducha Completada!', 'Benja completó su ducha en 4.9 min y sumó 200 XP al hogar.', '{"icon":"emoji_events","color":"#10B981"}'::jsonb, '{"xp":200,"tipo":"ducha","monedas":2,"duracion_segundos":295}'::jsonb, FALSE, '2026-09-03T16:49:57.032Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 'b7173f68-e247-4b98-acd6-123b65670a54', 'Benja', 'RETO_COMPLETADO') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('ae7e5b3c-2892-403a-ab37-40ec445023a4', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', '🚿 ¡Hora de la Ducha!', '¡Matias ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-09-03T17:03:30.766814","usuario_nombre":"Matias"}'::jsonb, FALSE, '2026-09-03T17:03:36.104Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'Matias', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('a0049b7a-e870-4fb3-b8e0-acce63a8b6f8', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', '🚿 ¡Eco-Ducha Completada!', 'Matias completó su ducha en 4.9 min y sumó 200 XP al hogar.', '{"icon":"emoji_events","color":"#10B981"}'::jsonb, '{"xp":200,"tipo":"ducha","monedas":2,"duracion_segundos":292}'::jsonb, FALSE, '2026-09-03T17:08:32.783Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'Matias', 'RETO_COMPLETADO') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('cfdb9b1c-64aa-4582-a940-68e5a67cea56', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', '🚿 ¡Hora de la Ducha!', '¡Matias ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-09-03T17:17:09.216384","usuario_nombre":"Matias"}'::jsonb, FALSE, '2026-09-03T17:17:13.914Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'Matias', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('f96fc315-d355-430c-8273-cf41495d954f', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', '🚿 ¡Eco-Ducha Completada!', 'Matias completó su ducha en 4.0 min y sumó 200 XP al hogar.', '{"icon":"emoji_events","color":"#10B981"}'::jsonb, '{"xp":200,"tipo":"ducha","monedas":2,"duracion_segundos":240}'::jsonb, FALSE, '2026-09-03T17:17:20.358Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'Matias', 'RETO_COMPLETADO') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('720ecf9c-30c0-49d1-95b0-1f516f6260a2', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', '🚿 ¡Hora de la Ducha!', '¡Matias ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-09-03T17:30:39.340281","usuario_nombre":"Matias"}'::jsonb, FALSE, '2026-09-03T17:30:44.313Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'Matias', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('0d7d09c8-3b3a-41ae-b86d-e4f77367dab7', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', '🚿 ¡Eco-Ducha Completada!', 'Matias completó su ducha en 4.0 min y sumó 200 XP al hogar.', '{"icon":"emoji_events","color":"#10B981"}'::jsonb, '{"xp":200,"tipo":"ducha","monedas":2,"duracion_segundos":240}'::jsonb, FALSE, '2026-09-03T17:30:49.182Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'Matias', 'RETO_COMPLETADO') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('974ab8f1-0275-440f-801f-c01dea7f0000', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', '🚿 ¡Hora de la Ducha!', '¡Matias ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-09-03T17:35:34.848605","usuario_nombre":"Matias"}'::jsonb, FALSE, '2026-09-03T17:35:39.713Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'Matias', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('eb3add50-44a2-4f7d-a817-91f0cff88dec', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', '🚿 ¡Eco-Ducha Completada!', 'Matias completó su ducha en 4.0 min y sumó 200 XP al hogar.', '{"icon":"emoji_events","color":"#10B981"}'::jsonb, '{"xp":200,"tipo":"ducha","monedas":2,"duracion_segundos":240}'::jsonb, FALSE, '2026-09-03T17:35:42.163Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'Matias', 'RETO_COMPLETADO') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('9d0a1769-12e9-4d30-9dbf-181cc4fd2078', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', '🚿 ¡Hora de la Ducha!', '¡Matias ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-09-03T17:37:49.342505","usuario_nombre":"Matias"}'::jsonb, FALSE, '2026-09-03T17:37:54.458Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'Matias', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('3e139c90-6677-4ba5-a04a-8c18886b2fa0', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', '🚿 ¡Eco-Ducha Completada!', 'Matias completó su ducha en 4.0 min y sumó 200 XP al hogar.', '{"icon":"emoji_events","color":"#10B981"}'::jsonb, '{"xp":200,"tipo":"ducha","monedas":2,"duracion_segundos":243}'::jsonb, FALSE, '2026-09-03T17:42:05.451Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'Matias', 'RETO_COMPLETADO') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('6a9c9b23-07a7-4bea-b2ad-8892ca13de73', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', '🚿 ¡Hora de la Ducha!', '¡Matias ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-09-03T17:47:09.114868","usuario_nombre":"Matias"}'::jsonb, FALSE, '2026-09-03T17:47:14.089Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'Matias', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('4a69a7db-7208-48b0-922e-faed073ee6e5', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', '🚿 ¡Eco-Ducha Completada!', 'Matias completó su ducha en 4.0 min y sumó 200 XP al hogar.', '{"icon":"emoji_events","color":"#10B981"}'::jsonb, '{"xp":200,"tipo":"ducha","monedas":2,"duracion_segundos":243}'::jsonb, FALSE, '2026-09-03T17:51:21.857Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'Matias', 'RETO_COMPLETADO') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('66fc6f1b-0953-49b6-85dd-3a9be4dc7572', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', '🚿 ¡Hora de la Ducha!', '¡efra ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-09-04T00:22:01.727500","usuario_nombre":"efra"}'::jsonb, FALSE, '2026-09-04T00:22:35.385Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'efra', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('7078eb71-81f7-4fa8-a8ff-d62487727007', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', '🚿 ¡Hora de la Ducha!', '¡efra ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-09-04T00:25:50.258670","usuario_nombre":"efra"}'::jsonb, FALSE, '2026-09-04T00:26:24.079Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'efra', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('6e35324d-7d5c-4c72-8c08-3371b7259308', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', '🚿 ¡Eco-Ducha Completada!', 'efra completó su ducha en 3.5 min y sumó 200 XP al hogar.', '{"icon":"emoji_events","color":"#10B981"}'::jsonb, '{"xp":200,"tipo":"ducha","monedas":2,"duracion_segundos":210}'::jsonb, FALSE, '2026-09-04T00:29:57.573Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'efra', 'RETO_COMPLETADO') ON CONFLICT DO NOTHING;
INSERT INTO public."notifications" ("id", "user_id", "title", "desc_text", "visual", "payload", "is_read", "created_at", "family_id", "sender_id", "sender_name", "type") VALUES ('ec8cce9c-080d-4e79-8707-b3c7f52227e9', '37966106-6357-426b-a064-9d68945a187e', '🚿 ¡Hora de la Ducha!', '¡carolina ha comenzado a bañarse en modo Speedrun! Ahorrando agua en el hogar.', '{"icon":"shower","color":"#00ACC1"}'::jsonb, '{"juego":"speedrun_ducha","iniciado_en":"2026-09-03T21:18:49.438188","usuario_nombre":"carolina"}'::jsonb, FALSE, '2026-09-04T01:18:49.693Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', '37966106-6357-426b-a064-9d68945a187e', 'carolina', 'DUCHA_SPEEDRUN') ON CONFLICT DO NOTHING;


-- Datos para public.canjes (1 registros)
INSERT INTO public."canjes" ("id", "reward_id", "user_id", "family_id", "costo_pagado", "created_at") VALUES ('2ff74ab0-8890-4083-b534-6f7013a0a6aa', '2', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 30, '2026-08-30T23:26:53.661Z'::timestamptz) ON CONFLICT DO NOTHING;


-- Datos para public.historial_gamificacion (42 registros)
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (1, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'speedrun_ducha', 40, 80, '2026-08-30T23:55:04.692Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (2, '6d5016f0-4afa-4e49-bbc2-2981f192a549', 'speedrun_ducha', 2, 200, '2026-08-31T00:42:40.404Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (3, '6d5016f0-4afa-4e49-bbc2-2981f192a549', 'eco_puzzle', 2, 150, '2026-08-31T00:43:16.912Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (4, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'eco_puzzle', 2, 150, '2026-09-01T15:45:53.907Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (5, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'eco_puzzle', 2, 150, '2026-09-01T15:55:21.317Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (6, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'speedrun_ducha', 2, 200, '2026-09-01T16:46:59.617Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (7, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'speedrun_ducha', 2, 200, '2026-09-01T18:03:28.011Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (8, '37966106-6357-426b-a064-9d68945a187e', 'eco_puzzle', 2, 150, '2026-09-02T02:46:42.003Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (9, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'eco_puzzle', 2, 150, '2026-09-03T00:07:37.278Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (10, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'eco_puzzle', 2, 150, '2026-09-03T00:07:41.195Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (11, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'eco_puzzle', 2, 150, '2026-09-03T00:08:06.518Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (12, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'eco_puzzle', 2, 150, '2026-09-03T00:09:01.716Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (13, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'eco_puzzle', 2, 150, '2026-09-03T00:09:57.782Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (14, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'eco_puzzle', 2, 150, '2026-09-03T00:50:09.103Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (15, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'eco_puzzle', 2, 150, '2026-09-03T01:00:21.572Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (16, 'b7173f68-e247-4b98-acd6-123b65670a54', 'eco_puzzle', 2, 150, '2026-09-03T01:09:38.262Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (17, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'speedrun_ducha', 2, 200, '2026-09-03T02:28:32.639Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (18, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'speedrun_ducha', 1, 100, '2026-09-03T02:28:33.775Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (19, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'speedrun_ducha', 0, 50, '2026-09-03T02:28:34.910Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (20, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'speedrun_ducha', 0, 0, '2026-09-03T02:28:36.100Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (21, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'speedrun_ducha', 1, 100, '2026-09-03T02:44:29.160Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (22, 'b7173f68-e247-4b98-acd6-123b65670a54', 'eco_puzzle', 2, 150, '2026-09-03T16:38:01.160Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (23, 'b7173f68-e247-4b98-acd6-123b65670a54', 'eco_puzzle', 2, 150, '2026-09-03T16:43:10.627Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (24, 'b7173f68-e247-4b98-acd6-123b65670a54', 'eco_puzzle', 2, 150, '2026-09-03T16:44:00.290Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (25, 'b7173f68-e247-4b98-acd6-123b65670a54', 'speedrun_ducha', 2, 200, '2026-09-03T16:49:55.409Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (26, 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'speedrun_ducha', 2, 200, '2026-09-03T17:08:31.134Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (27, 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'speedrun_ducha', 2, 200, '2026-09-03T17:17:18.708Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (28, 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'speedrun_ducha', 2, 200, '2026-09-03T17:30:47.535Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (29, 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'speedrun_ducha', 2, 200, '2026-09-03T17:35:40.496Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (30, 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'eco_puzzle', 2, 150, '2026-09-03T17:37:32.532Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (31, 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'speedrun_ducha', 2, 200, '2026-09-03T17:42:03.762Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (32, 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'speedrun_ducha', 2, 200, '2026-09-03T17:51:20.195Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (33, 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 'eco_puzzle', 2, 150, '2026-09-03T17:51:53.958Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (34, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'speedrun_ducha', 2, 200, '2026-09-04T00:29:55.874Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (35, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'eco_puzzle', 2, 150, '2026-09-04T01:14:09.725Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (37, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'speedrun_ducha', 2, 200, '2026-09-05T01:23:24.690Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (38, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'speedrun_ducha', 2, 200, '2026-09-05T01:25:05.068Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (39, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'speedrun_ducha', 2, 200, '2026-09-05T01:54:50.617Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (40, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'speedrun_ducha', 2, 200, '2026-09-05T02:03:33.331Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (41, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'logro', 10, 0, '2026-09-05T02:08:41.663Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (42, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'speedrun_ducha', 2, 200, '2026-09-05T03:09:00.123Z'::timestamptz) ON CONFLICT DO NOTHING;
INSERT INTO public."historial_gamificacion" ("id", "user_id", "origen_actividad", "monedas_otorgadas", "xp_otorgada", "created_at") VALUES (43, 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'speedrun_ducha', 2, 200, '2026-09-05T03:09:44.779Z'::timestamptz) ON CONFLICT DO NOTHING;


-- Datos para public.shower_logs (47 registros)
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('25fba8ee-013e-43d1-8ef4-5b0bd265883d', 'fc408ac1-d241-4bc8-afc0-1602fbc25ba8', 120, 'invalido', '{}'::jsonb, '2026-08-29T00:33:37.110Z'::timestamptz, NULL, 0, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('4b6dd9da-eed5-4428-9900-38505c6bdef1', 'fc408ac1-d241-4bc8-afc0-1602fbc25ba8', 240, 'valido', '{}'::jsonb, '2026-08-29T00:33:37.432Z'::timestamptz, NULL, 0, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('6a80ee23-2afc-4a72-87a9-47175fa9465f', 'b1a5a81a-1bae-418d-8527-e2859ffa0ad8', 120, 'invalido', '{}'::jsonb, '2026-08-29T00:48:53.012Z'::timestamptz, NULL, 0, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('1f2180ed-f3d9-4ab8-8999-6d340266ab4f', 'b1a5a81a-1bae-418d-8527-e2859ffa0ad8', 240, 'valido', '{}'::jsonb, '2026-08-29T00:48:53.334Z'::timestamptz, NULL, 0, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('c1ce9d38-b54a-4906-9b79-570e3b0361fc', '37966106-6357-426b-a064-9d68945a187e', 247, 'valido', '{}'::jsonb, '2026-08-29T22:26:50.832Z'::timestamptz, NULL, 0, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('cdca69e0-029f-40cc-9ff5-259b425f1358', '6d5016f0-4afa-4e49-bbc2-2981f192a549', 120, 'invalido', '{}'::jsonb, '2026-08-30T16:14:23.814Z'::timestamptz, NULL, 0, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('c9574384-74b1-4cdd-9933-479d4e8fdc1e', '6d5016f0-4afa-4e49-bbc2-2981f192a549', 240, 'valido', '{}'::jsonb, '2026-08-30T16:14:23.978Z'::timestamptz, NULL, 0, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('bbacf74a-f806-4182-ba3c-71618b37c23f', 'c712f8b6-9329-43af-ac9c-8260d186363c', 120, 'invalido', '{}'::jsonb, '2026-08-30T16:44:59.248Z'::timestamptz, NULL, 0, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('1fc6ea11-4275-4ad6-b000-3626bedb6613', 'c712f8b6-9329-43af-ac9c-8260d186363c', 240, 'valido', '{}'::jsonb, '2026-08-30T16:44:59.412Z'::timestamptz, NULL, 0, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('0c0dc396-90e8-4252-9ecc-6f9e70bb931e', 'b641306e-defc-4075-8e68-3d125522369d', 120, 'invalido', '{}'::jsonb, '2026-08-30T16:48:51.988Z'::timestamptz, NULL, 0, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('7efabe14-ae75-4649-8478-c4bdc6d5ccdb', 'b641306e-defc-4075-8e68-3d125522369d', 240, 'valido', '{}'::jsonb, '2026-08-30T16:48:52.153Z'::timestamptz, NULL, 0, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('7c4fa8fe-91f1-43fd-84f3-fa3ca8102ac5', '6d5016f0-4afa-4e49-bbc2-2981f192a549', 120, 'invalido', '{}'::jsonb, '2026-08-31T00:38:03.604Z'::timestamptz, NULL, 0, 0, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('a1bbe4c7-1ca6-404f-9646-7506e24ed7f5', '6d5016f0-4afa-4e49-bbc2-2981f192a549', 120, 'invalido', '{}'::jsonb, '2026-08-31T00:39:40.011Z'::timestamptz, NULL, 0, 0, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('24575f8d-20a0-4d30-b3af-ed0b5d612466', '6d5016f0-4afa-4e49-bbc2-2981f192a549', 120, 'invalido', '{}'::jsonb, '2026-08-31T00:40:04.665Z'::timestamptz, NULL, 0, 0, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('89b96d07-eb75-46f0-a7e5-cf3dd791b7b0', '6d5016f0-4afa-4e49-bbc2-2981f192a549', 140, 'invalido', '{}'::jsonb, '2026-08-31T00:40:37.052Z'::timestamptz, NULL, 0, 0, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('1fc569e4-6bf8-4572-9d18-7ed50ba5f11a', '6d5016f0-4afa-4e49-bbc2-2981f192a549', 240, 'valido', '{}'::jsonb, '2026-08-31T00:42:40.404Z'::timestamptz, NULL, 200, 2, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('edb0c38c-dcee-4c66-a9de-f6428d6c6c36', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 240, 'valido', '{}'::jsonb, '2026-09-01T16:09:16.051Z'::timestamptz, NULL, 0, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('035b0ed7-7444-4b64-a812-f4fbf47f35e4', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 120, 'invalido', '{}'::jsonb, '2026-09-01T16:09:36.405Z'::timestamptz, NULL, 0, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('cd29c184-3840-4135-8b0f-c04b8ea63a09', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 240, 'valido', '{}'::jsonb, '2026-09-01T16:09:53.465Z'::timestamptz, NULL, 0, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('cb4732aa-6487-4655-8962-c2c1a71a3411', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 240, 'valido', '{}'::jsonb, '2026-09-01T16:10:21.064Z'::timestamptz, NULL, 0, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('56d28e06-285b-4cbf-8ea6-ac0ba9f11c90', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 240, 'valido', '{}'::jsonb, '2026-09-01T16:22:41.681Z'::timestamptz, NULL, 0, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('cd731b17-68c5-4764-92d7-90b5e874c482', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 240, 'valido', '{}'::jsonb, '2026-09-01T16:29:50.778Z'::timestamptz, NULL, 0, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('3316bd3f-f4b6-45b2-b7d6-ab09a9114baf', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 240, 'valido', '{}'::jsonb, '2026-09-01T16:33:43.053Z'::timestamptz, NULL, 0, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('daff1d12-71b2-47f2-be5e-1e9222336598', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 240, 'valido', '{}'::jsonb, '2026-09-01T16:39:48.787Z'::timestamptz, NULL, 0, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('12839833-b267-468c-89ec-184b7ab47db5', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 240, 'valido', '{}'::jsonb, '2026-09-01T16:40:24.069Z'::timestamptz, NULL, 0, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('d38d05c3-00d0-4729-ba62-60e330d1cd2c', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 240, 'valido', '{}'::jsonb, '2026-09-01T16:46:59.617Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 200, 2, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('de98beec-b66f-4001-93c4-1695dde5bff6', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 120, 'invalido', '{}'::jsonb, '2026-09-01T17:53:14.146Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 0, 0, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('368654b4-931f-4b19-a4d1-afba8ef2f918', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 240, 'valido', '{}'::jsonb, '2026-09-01T18:03:28.011Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 200, 2, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('b8263364-930e-4d42-ae40-a8f14d93c6df', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 240, 'valido', '{}'::jsonb, '2026-09-03T02:28:32.639Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 200, 2, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('43a9e12c-8438-4973-86c1-4290369bc245', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 400, 'valido', '{}'::jsonb, '2026-09-03T02:28:33.775Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 100, 1, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('ca6e1778-25e5-40cd-a1e3-7f2347db835c', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 600, 'valido', '{}'::jsonb, '2026-09-03T02:28:34.910Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 50, 0, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('d5560ecc-22ef-4cfa-97a7-8c4056c6e521', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 1900, 'excesivo', '{}'::jsonb, '2026-09-03T02:28:36.100Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 0, 0, FALSE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('2c7e2802-a4b2-4069-aeae-f04ed6728a75', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 344, 'valido', '{}'::jsonb, '2026-09-03T02:44:29.160Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 100, 1, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('cc35a351-85d4-4c61-afb0-8a32db9d4e2f', 'b7173f68-e247-4b98-acd6-123b65670a54', 295, 'valido', '{}'::jsonb, '2026-09-03T16:49:55.409Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 200, 2, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('07c70f96-1f95-4a7a-8f94-04ca0b268059', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 292, 'valido', '{}'::jsonb, '2026-09-03T17:08:31.134Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 200, 2, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('07d0f8dd-a7ff-41cf-bc9e-049f753e76e8', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 240, 'valido', '{}'::jsonb, '2026-09-03T17:17:18.708Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 200, 2, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('bbcf694c-d888-4cf1-9d72-a99df038675d', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 240, 'valido', '{}'::jsonb, '2026-09-03T17:30:47.535Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 200, 2, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('392d6035-0f0e-4c19-b623-8ddea868a563', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 240, 'valido', '{}'::jsonb, '2026-09-03T17:35:40.496Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 200, 2, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('ff931037-ede0-4820-a791-4c80eda0587d', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 243, 'valido', '{}'::jsonb, '2026-09-03T17:42:03.762Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 200, 2, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('bd2b46c8-8aa6-43fd-b993-a11530642b5a', 'ac7a3e4b-5d06-4130-a25b-5d9a08b3ff15', 243, 'valido', '{}'::jsonb, '2026-09-03T17:51:20.195Z'::timestamptz, 'a4e76ea5-78af-461c-9a1e-4fd91ccad100', 200, 2, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('79601671-f14b-4f5a-963b-98b4bcf156f4', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 210, 'valido', '{}'::jsonb, '2026-09-04T00:29:55.874Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 200, 2, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('38fbb90d-c6b2-40ec-8d25-77e842212e6e', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 280, 'valido', '{}'::jsonb, '2026-09-05T01:23:24.690Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 200, 2, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('ef15a7b9-7a4d-4f34-85a2-b92ae74798a8', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 280, 'valido', '{}'::jsonb, '2026-09-05T01:25:05.068Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 200, 2, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('5fa7efe7-6f32-43f0-bcaa-93a38a5e5c6c', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 280, 'valido', '{}'::jsonb, '2026-09-05T01:54:50.617Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 200, 2, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('96261c0e-505f-493b-be74-410e4f5eb806', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 280, 'valido', '{}'::jsonb, '2026-09-05T02:03:33.331Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 200, 2, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('009081b2-da9a-41fa-a1a6-19b1014bc968', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 280, 'valido', '{}'::jsonb, '2026-09-05T03:09:00.123Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 200, 2, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO public."shower_logs" ("id", "user_id", "duracion_segundos", "estado", "metadata", "created_at", "family_id", "xp_otorgada", "monedas_otorgadas", "es_valido") VALUES ('72872899-3659-411e-ad43-0fb45290192a', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 280, 'valido', '{}'::jsonb, '2026-09-05T03:09:44.779Z'::timestamptz, '4853461b-fcfb-4ef8-b4ce-68a660cc4d44', 200, 2, TRUE) ON CONFLICT DO NOTHING;


-- public.ecopuzzle: Sin registros actualmente

-- Datos para public.usuario_logros (1 registros)
INSERT INTO public."usuario_logros" ("id", "user_id", "logro_id", "reclamado", "fecha_desbloqueo") VALUES ('9784be4d-e5be-4771-8ea0-d25be16f0c01', 'b2f809cb-5e17-497b-9b37-e1c0219e8375', 'ac7b91a1-2587-472b-b282-dbc7c18160de', TRUE, '2026-09-05T01:54:50.617Z'::timestamptz) ON CONFLICT DO NOTHING;


-- ============================================================
-- 5. LLAVES FORÁNEAS (FOREIGN KEYS)
-- ============================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'achievements_user_id_fkey') THEN
        ALTER TABLE public."achievements" ADD CONSTRAINT "achievements_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bills_family_id_fkey') THEN
        ALTER TABLE public."bills" ADD CONSTRAINT "bills_family_id_fkey" FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'canjes_family_id_fkey') THEN
        ALTER TABLE public."canjes" ADD CONSTRAINT "canjes_family_id_fkey" FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'canjes_reward_id_fkey') THEN
        ALTER TABLE public."canjes" ADD CONSTRAINT "canjes_reward_id_fkey" FOREIGN KEY (reward_id) REFERENCES family_rewards(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'canjes_user_id_fkey') THEN
        ALTER TABLE public."canjes" ADD CONSTRAINT "canjes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_bonus_claims_user_id_fkey') THEN
        ALTER TABLE public."daily_bonus_claims" ADD CONSTRAINT "daily_bonus_claims_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidences_family_id_fkey') THEN
        ALTER TABLE public."evidences" ADD CONSTRAINT "evidences_family_id_fkey" FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidences_user_id_fkey') THEN
        ALTER TABLE public."evidences" ADD CONSTRAINT "evidences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'family_rewards_creador_id_fkey') THEN
        ALTER TABLE public."family_rewards" ADD CONSTRAINT "family_rewards_creador_id_fkey" FOREIGN KEY (creador_id) REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'family_rewards_family_id_fkey') THEN
        ALTER TABLE public."family_rewards" ADD CONSTRAINT "family_rewards_family_id_fkey" FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'historial_gamificacion_user_id_fkey') THEN
        ALTER TABLE public."historial_gamificacion" ADD CONSTRAINT "historial_gamificacion_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_family_id_fkey') THEN
        ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_family_id_fkey" FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_sender_id_fkey') THEN
        ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_fkey') THEN
        ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_family_id_fkey') THEN
        ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_family_id_fkey" FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_fkey') THEN
        ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qr_tokens_family_id_fkey') THEN
        ALTER TABLE public."qr_tokens" ADD CONSTRAINT "qr_tokens_family_id_fkey" FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reto_validations_family_id_fkey') THEN
        ALTER TABLE public."reto_validations" ADD CONSTRAINT "reto_validations_family_id_fkey" FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reto_validations_user_id_fkey') THEN
        ALTER TABLE public."reto_validations" ADD CONSTRAINT "reto_validations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shower_logs_family_id_fkey') THEN
        ALTER TABLE public."shower_logs" ADD CONSTRAINT "shower_logs_family_id_fkey" FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shower_logs_user_id_fkey') THEN
        ALTER TABLE public."shower_logs" ADD CONSTRAINT "shower_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_asignado_id_fkey') THEN
        ALTER TABLE public."tasks" ADD CONSTRAINT "tasks_asignado_id_fkey" FOREIGN KEY (asignado_id) REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_family_id_fkey') THEN
        ALTER TABLE public."tasks" ADD CONSTRAINT "tasks_family_id_fkey" FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuario_logros_logro_id_fkey') THEN
        ALTER TABLE public."usuario_logros" ADD CONSTRAINT "usuario_logros_logro_id_fkey" FOREIGN KEY (logro_id) REFERENCES logros(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuario_logros_user_id_fkey') THEN
        ALTER TABLE public."usuario_logros" ADD CONSTRAINT "usuario_logros_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================
-- 6. ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_achievements_user ON public.achievements USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_bills_family ON public.bills USING btree (family_id);
CREATE INDEX IF NOT EXISTS idx_bills_metadata_gin ON public.bills USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_bills_ocr_result_gin ON public.bills USING gin (ocr_result);
CREATE INDEX IF NOT EXISTS idx_canjes_user_reward ON public.canjes USING btree (user_id, reward_id, created_at);
CREATE INDEX IF NOT EXISTS idx_evidences_family ON public.evidences USING btree (family_id);
CREATE INDEX IF NOT EXISTS idx_evidences_media_gin ON public.evidences USING gin (media);
CREATE INDEX IF NOT EXISTS idx_family_rewards_family ON public.family_rewards USING btree (family_id);
CREATE INDEX IF NOT EXISTS idx_notifications_payload_gin ON public.notifications USING gin (payload);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_avatar_gin ON public.profiles USING gin (avatar);
CREATE INDEX IF NOT EXISTS idx_profiles_family ON public.profiles USING btree (family_id);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_answers_gin ON public.profiles USING gin (onboarding_answers);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON public.qr_tokens USING btree (token);
CREATE INDEX IF NOT EXISTS idx_reto_validations_evidencias_gin ON public.reto_validations USING gin (evidencias);
CREATE INDEX IF NOT EXISTS idx_reto_validations_family_estado ON public.reto_validations USING btree (family_id, estado);
CREATE INDEX IF NOT EXISTS idx_shower_logs_user ON public.shower_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_family ON public.tasks USING btree (family_id);


-- ============================================================
-- 7. DISPARADORES (TRIGGERS)
-- ============================================================
DROP TRIGGER IF EXISTS tr_nueva_notificacion_habitik ON public."notifications";
CREATE TRIGGER tr_nueva_notificacion_habitik AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION fn_despachar_evento_habitik();

-- ============================================================
-- 8. SINCRONIZACIÓN DE SECUENCIAS
-- ============================================================
SELECT setval('public."family_rewards_id_seq"', COALESCE((SELECT MAX(id) FROM public.family_rewards), 1), true);
SELECT setval('public."historial_gamificacion_id_seq"', COALESCE((SELECT MAX(id) FROM public.family_rewards), 1), true);


-- ============================================================
-- FIN DEL DUMP COMPLETO
-- ============================================================