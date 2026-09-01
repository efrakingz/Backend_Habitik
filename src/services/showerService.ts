import { ShowerRepository } from '../repositories/showerRepository';
import { ShowerLog } from '../models/types';
import { query, pool } from '../config/db';

const showerRepository = new ShowerRepository();

export class ShowerService {
  async registerShowerTime(userId: string, duracionSegundos: number) {
    // Asegurar que la tabla exista
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS public.shower_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
          duracion_segundos INTEGER NOT NULL,
          estado VARCHAR(50) NOT NULL,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
    } catch (e) {
      // Ignorar si ya existe
    }

    // CA-2.1-2: Validación anti-trampa (< 3 minutos = 180 segundos es inválido)
    const esValido = duracionSegundos >= 180;
    const estado = esValido ? 'valido' : 'invalido';

    // Guardar log inicial de ducha
    const log = await showerRepository.saveShowerLog(userId, duracionSegundos, estado);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Consultar perfil actual del usuario para gamificación
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

        // Actualizar Perfil en PostgreSQL (Soluciona el bug de que no se guardaba la XP)
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