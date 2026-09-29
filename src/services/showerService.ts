import { ShowerRepository } from '../repositories/showerRepository';
import { query, pool } from '../config/db';

const showerRepository = new ShowerRepository();

export class ShowerService {
  /**
   * Momento 1: Inicia la ducha (1ª Notificación).
   * Registra el inicio utilizando la hora exacta del servidor para evitar manipulaciones en el frontend.
   */
  async startShower(userId: string) {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS public.shower_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
          duracion_segundos INTEGER NOT NULL DEFAULT 0,
          estado VARCHAR(50) NOT NULL,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          iniciado_en TIMESTAMPTZ,
          finalizado_en TIMESTAMPTZ
        )
      `);
      await query(`ALTER TABLE public.shower_logs ADD COLUMN IF NOT EXISTS iniciado_en TIMESTAMPTZ;`);
      await query(`ALTER TABLE public.shower_logs ADD COLUMN IF NOT EXISTS finalizado_en TIMESTAMPTZ;`);
    } catch (e) {
      // Ignorar si ya existen
    }

    const client = await pool.connect();
    try {
      const insertQuery = `
        INSERT INTO public.shower_logs (user_id, duracion_segundos, estado, iniciado_en, created_at)
        VALUES ($1, 0, 'en_proceso', NOW(), NOW())
        RETURNING id, iniciado_en;
      `;
      const res = await client.query(insertQuery, [userId]);
      return res.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Momento 2: Finaliza la ducha (2ª Notificación).
   * El backend MIDE y CALCULA el tiempo real transcurrido, aplica validaciones y otorga recompensas.
   */
  async finishShower(userId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Buscar la ducha activa del usuario en estado 'en_proceso'
      const activeRes = await client.query(`
        SELECT id, iniciado_en 
        FROM public.shower_logs 
        WHERE user_id = $1 AND estado = 'en_proceso' 
        ORDER BY created_at DESC 
        LIMIT 1 
        FOR UPDATE;
      `, [userId]);

      if (activeRes.rows.length === 0) {
        throw new Error('No hay ninguna ducha activa registrada para finalizar.');
      }

      const { id: logId, iniciado_en } = activeRes.rows[0];
      const startTimestamp = iniciado_en || new Date();

      // 2. EL BACKEND CALCULA EL TIEMPO real transcurrido mediante la diferencia matemática en PostgreSQL
      const calcRes = await client.query(`
        SELECT EXTRACT(EPOCH FROM (NOW() - $1::timestamptz))::integer AS duracion
      `, [startTimestamp]);

      const duracionSegundos = Math.max(0, calcRes.rows[0].duracion);

      // Validación anti-trampa en el backend (< 3 minutos = 180 segundos es inválido)
      const esValido = duracionSegundos >= 180;
      const estado = esValido ? 'valido' : 'invalido';

      // 3. Consultar perfil actual del usuario para gamificación
      const profileQuery = `
        SELECT family_id, xp, nivel, monedas, onboarding_answers 
        FROM public.profiles 
        WHERE id = $1 FOR UPDATE;
      `;
      const profileRes = await client.query(profileQuery, [userId]);
      const profile = profileRes.rows[0];

      if (!profile) {
        throw new Error('Perfil de usuario no encontrado.');
      }

      let xpGanada = 0;
      let monedasGanadas = 0;

      // Asignación de recompensas escalonadas si la ducha es válida
      if (esValido) {
        if (duracionSegundos <= 300) {
          xpGanada = 200;
          monedasGanadas = 2;
        } else if (duracionSegundos <= 480) {
          xpGanada = 100;
          monedasGanadas = 1;
        } else {
          xpGanada = 50;
          monedasGanadas = 0;
        }
      }

      let levelUp = false;
      let nuevoNivel = profile.nivel || 1;
      let xpTotal = profile.xp || 0;
      let saldoMonedas = profile.monedas || 0;

      if (esValido && (xpGanada > 0 || monedasGanadas > 0)) {
        xpTotal += xpGanada;
        saldoMonedas += monedasGanadas;

        // Fórmula de Nivel: floor(XP / 500) + 1
        nuevoNivel = Math.floor(xpTotal / 500) + 1;
        if (nuevoNivel > (profile.nivel || 1)) {
          levelUp = true;
        }

        // Registrar 'speedrun_ducha' en el objeto JSONB onboarding_answers para el bonus diario
        const todayStr = new Date().toISOString().split('T')[0];
        const onboardingAnswers = profile.onboarding_answers || {};
        const dailyTracking = onboardingAnswers.daily_tracking || {};
        const todayChallenges: string[] = dailyTracking[todayStr] || [];

        if (!todayChallenges.includes('speedrun_ducha')) {
          todayChallenges.push('speedrun_ducha');
        }

        const updatedOnboarding = {
          ...onboardingAnswers,
          daily_tracking: {
            ...dailyTracking,
            [todayStr]: todayChallenges
          }
        };

        // Actualizar Perfil en PostgreSQL
        const updateProfileQuery = `
          UPDATE public.profiles
          SET xp = $1, nivel = $2, monedas = $3, onboarding_answers = $4, ultima_actividad = CURRENT_DATE
          WHERE id = $5;
        `;
        await client.query(updateProfileQuery, [
          xpTotal,
          nuevoNivel,
          saldoMonedas,
          JSON.stringify(updatedOnboarding),
          userId
        ]);
      }

      // 4. Actualizar el log de ducha con la duración medida y calculada por el backend
      const updateLogQuery = `
        UPDATE public.shower_logs
        SET duracion_segundos = $1, estado = $2, finalizado_en = NOW()
        WHERE id = $3
        RETURNING *;
      `;
      const logRes = await client.query(updateLogQuery, [duracionSegundos, estado, logId]);
      const log = logRes.rows[0];

      await client.query('COMMIT');

      return {
        log,
        recompensas: {
          es_valido: esValido,
          tiempo_segundos: duracionSegundos,
          xp_ganada: xpGanada,
          monedas_ganadas: monedasGanadas,
          total_xp: xpTotal,
          saldo_monedas: saldoMonedas,
          nivel_actual: nuevoNivel,
          level_up: levelUp
        }
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}