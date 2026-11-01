-- ============================================================
-- FUNCIONES ALMACENADAS FALTANTES PARA ENTORNO LOCAL
-- ============================================================

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

CREATE OR REPLACE FUNCTION public.obtener_nivel_usuario(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_xp INT;
    v_nivel INT;
BEGIN
    SELECT COALESCE(xp, 0) INTO v_xp
    FROM public.profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN 1;
    END IF;

    v_nivel := (v_xp / 500) + 1;

    IF v_nivel > 99 THEN
        v_nivel := 99;
    END IF;

    RETURN v_nivel;
END;
$function$;

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
    v_inicio_semana := date_trunc('week', CURRENT_DATE)::DATE;
    v_fin_semana := (v_inicio_semana + INTERVAL '6 days')::DATE;

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

    UPDATE public.profiles
    SET racha_dias = 0
    WHERE id = p_user_id
      AND (ultima_actividad IS NULL OR ultima_actividad < CURRENT_DATE - 1)
      AND racha_dias > 0;

    SELECT COALESCE(racha_dias, 0)
    INTO v_racha_dias
    FROM public.profiles
    WHERE id = p_user_id;

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

DROP TRIGGER IF EXISTS tr_nueva_notificacion_habitik ON public.notifications;
CREATE TRIGGER tr_nueva_notificacion_habitik AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION fn_despachar_evento_habitik();

