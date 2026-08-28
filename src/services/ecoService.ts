import { pool } from '../config/db';

export class RetoService {
  static async completarEcoPuzzle(userId: string, errores: number, tiempoSegundos: number) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Validar reglas de la HU 2.4 (Máximo 3 errores en <= 60 segundos)
      const esValido = errores <= 3 && tiempoSegundos <= 60;
      const xpGanado = esValido ? 150 : 0;
      const monedasGanadas = esValido ? 2 : 0;

      // 2. Consultar perfil actual del usuario en PostgreSQL
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

      let levelUp = false;
      let nuevoNivel = profile.nivel || 1;
      let xpTotal = profile.xp || 0;
      let saldoMonedas = profile.monedas || 0;

      if (esValido) {
        xpTotal += xpGanado;
        saldoMonedas += monedasGanadas;

        // Fórmula de Nivel: floor(XP / 500) + 1
        nuevoNivel = Math.floor(xpTotal / 500) + 1;
        if (nuevoNivel > (profile.nivel || 1)) {
          levelUp = true;
        }

        // Registrar 'eco_puzzle' en el objeto JSONB onboarding_answers para el bonus diario
        const todayStr = new Date().toISOString().split('T')[0];
        const onboardingAnswers = profile.onboarding_answers || {};
        const dailyTracking = onboardingAnswers.daily_tracking || {};
        const todayChallenges: string[] = dailyTracking[todayStr] || [];

        if (!todayChallenges.includes('eco_puzzle')) {
          todayChallenges.push('eco_puzzle');
        }

        const updatedOnboarding = {
          ...onboardingAnswers,
          daily_tracking: {
            ...dailyTracking,
            [todayStr]: todayChallenges
          }
        };

        // Actualizar Perfil
        const updateProfileQuery = `
          UPDATE public.profiles
          SET xp = $1, nivel = $2, monedas = $3, onboarding_answers = $4
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

      // 3. Insertar el intento en la tabla reto_validations
      const insertRetoQuery = `
        INSERT INTO public.reto_validations (
          family_id, user_id, reto, xp, monedas, estado, evidencias
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;
      const evidenciaObj = JSON.stringify([{ errores, tiempo_segundos: tiempoSegundos }]);
      const estadoReto = esValido ? 'aprobado' : 'rechazado';

      const retoRes = await client.query(insertRetoQuery, [
        profile.family_id,
        userId,
        'Eco-Puzzle Temático',
        xpGanado,
        monedasGanadas,
        estadoReto,
        evidenciaObj
      ]);

      await client.query('COMMIT');

      return {
        reto: retoRes.rows[0],
        recompensas: {
          valido: esValido,
          errores,
          tiempo_segundos: tiempoSegundos,
          xp_ganado: xpGanado,
          monedas_ganadas: monedasGanadas,
          xp_total: xpTotal,
          monedas_total: saldoMonedas,
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