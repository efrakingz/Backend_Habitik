import { pool } from '../config/db';

export class RetoService {
  static async completarEcoPuzzle(userId: string, errores: number, tiempoSegundos: number) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const esValido = errores <= 3 && tiempoSegundos <= 60;
      const xpGanado = esValido ? 150 : 0;
      const monedasGanadas = esValido ? 2 : 0;

      const profileQuery = `
        SELECT family_id, nombre, avatar, xp, nivel, monedas
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

        const updateProfileQuery = `
          UPDATE public.profiles
          SET xp = $1, nivel = $2, monedas = $3, ultima_actividad = CURRENT_DATE
          WHERE id = $4;
        `;
        await client.query(updateProfileQuery, [
          xpTotal,
          nuevoNivel,
          saldoMonedas,
          userId
        ]);

        await client.query(`
          INSERT INTO public.historial_gamificacion (user_id, origen_actividad, monedas_otorgadas, xp_otorgada)
          VALUES ($1, 'eco_puzzle', $2, $3);
        `, [userId, monedasGanadas, xpGanado]);
      }

      const insertRetoQuery = `
        INSERT INTO public.reto_validations (
          family_id, user_id, reto, xp, monedas, estado, evidencias, snapshot_usuario
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
        RETURNING *;
      `;
      const evidenciaObj = JSON.stringify([{ errores, tiempo_segundos: tiempoSegundos }]);
      const estadoReto = esValido ? 'aprobado' : 'rechazado';
      const snapshotUsuario = JSON.stringify({
        nombre: profile.nombre || 'Usuario',
        avatar: profile.avatar || null
      });

      const retoRes = await client.query(insertRetoQuery, [
        profile.family_id,
        userId,
        'Eco-Puzzle Temático',
        xpGanado,
        monedasGanadas,
        estadoReto,
        evidenciaObj,
        snapshotUsuario
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

export { RetoService as EcoService };
