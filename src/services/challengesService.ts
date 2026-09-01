import { pool } from '../config/db';

export class ChallengesService {
  /**
   * HU 2.1: Finalizar Speedrun de la Ducha
   * Registra el intento con XP/monedas reales en 'shower_logs' y actualiza 'profiles'.
   */
  static async finalizarDucha(userId: string, familyId: string | null, tiempoSegundos: number) {
    let xp = 0;
    let monedas = 0;
    let esValido = true;
    let estado = 'valido';

    // Reglas Anti-trampa y asignación de recompensas
    if (tiempoSegundos < 180) { // < 3 min
      esValido = false;
      estado = 'invalido';
    } else if (tiempoSegundos <= 300) { // <= 5 min: +200 XP, +2 monedas
      xp = 200;
      monedas = 2;
    } else if (tiempoSegundos <= 480) { // 5 a 8 min: +100 XP, +1 moneda
      xp = 100;
      monedas = 1;
    } else { // > 8 min: +50 XP, 0 monedas
      xp = 50;
      monedas = 0;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // INSERT CORREGIDO: Pasa $6 (xp) y $7 (monedas) y devuelve la fila insertada con RETURNING *
      const insertRes = await client.query(`
        INSERT INTO public.shower_logs (
          user_id, family_id, duracion_segundos, estado, es_valido, xp_otorgada, monedas_otorgadas
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `, [userId, familyId, tiempoSegundos, estado, esValido, xp, monedas]);

      const logInsertado = insertRes.rows[0];

      let levelUp = false;
      let nuevoNivel = 1;
      let totalXp = 0;
      let saldoMonedas = 0;

      if (esValido) {
        const prof = await client.query(`SELECT xp, monedas, nivel FROM public.profiles WHERE id = $1;`, [userId]);
        if (prof.rows.length === 0) throw new Error('Perfil no encontrado.');

        const currentXp = prof.rows[0].xp || 0;
        const currentNivel = prof.rows[0].nivel || 1;

        totalXp = currentXp + xp;
        saldoMonedas = (prof.rows[0].monedas || 0) + monedas;

        nuevoNivel = Math.floor(totalXp / 500) + 1;
        levelUp = nuevoNivel > currentNivel;

        await client.query(`
          UPDATE public.profiles
          SET xp = $1, monedas = $2, nivel = $3, ultima_actividad = CURRENT_DATE
          WHERE id = $4;
        `, [totalXp, saldoMonedas, nuevoNivel, userId]);

        await client.query(`
          INSERT INTO public.historial_gamificacion (user_id, origen_actividad, monedas_otorgadas, xp_otorgada)
          VALUES ($1, 'speedrun_ducha', $2, $3);
        `, [userId, monedas, xp]);
      } else {
        const prof = await client.query(`SELECT xp, monedas, nivel FROM public.profiles WHERE id = $1;`, [userId]);
        if (prof.rows.length > 0) {
          totalXp = prof.rows[0].xp || 0;
          saldoMonedas = prof.rows[0].monedas || 0;
          nuevoNivel = prof.rows[0].nivel || 1;
        }
      }

      await client.query('COMMIT');

      return {
        log: logInsertado,
        es_valido: esValido,
        tiempo_segundos: tiempoSegundos,
        xp_ganada: xp,
        monedas_ganadas: monedas,
        total_xp: totalXp,
        saldo_monedas: saldoMonedas,
        nivel_actual: nuevoNivel,
        level_up: levelUp
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * HU 2.4: Completar Eco-Puzzle
   */
  static async completarPuzzle(userId: string, errores: number) {
    if (errores > 3) {
      throw new Error('Has superado el límite de 3 errores permitidos.');
    }

    const xp = 150;
    const monedas = 2;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const prof = await client.query(`SELECT xp, monedas, nivel FROM public.profiles WHERE id = $1;`, [userId]);
      if (prof.rows.length === 0) throw new Error('Perfil no encontrado.');

      const totalXp = (prof.rows[0].xp || 0) + xp;
      const saldoMonedas = (prof.rows[0].monedas || 0) + monedas;
      const currentNivel = prof.rows[0].nivel || 1;

      const nuevoNivel = Math.floor(totalXp / 500) + 1;
      const levelUp = nuevoNivel > currentNivel;

      await client.query(`
        UPDATE public.profiles
        SET xp = $1, monedas = $2, nivel = $3, ultima_actividad = CURRENT_DATE
        WHERE id = $4;
      `, [totalXp, saldoMonedas, nuevoNivel, userId]);

      await client.query(`
        INSERT INTO public.historial_gamificacion (user_id, origen_actividad, monedas_otorgadas, xp_otorgada)
        VALUES ($1, 'eco_puzzle', $2, $3);
      `, [userId, monedas, xp]);

      await client.query('COMMIT');

      return {
        exito: true,
        xp_ganada: xp,
        monedas_ganadas: monedas,
        total_xp: totalXp,
        saldo_monedas: saldoMonedas,
        nivel_actual: nuevoNivel,
        level_up: levelUp
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * HU 4.2A-2: Bonus de Constancia Diaria
   */
  static async evaluarConstanciaDiaria(userId: string) {
    const client = await pool.connect();
    try {
      const resCount = await client.query(`
        SELECT COUNT(DISTINCT origen_actividad) as total
        FROM public.historial_gamificacion
        WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE;
      `, [userId]);

      const totalRetos = parseInt(resCount.rows[0].total || '0');

      if (totalRetos >= 2) {
        const prof = await client.query(`SELECT xp, monedas, nivel FROM public.profiles WHERE id = $1;`, [userId]);
        const totalXp = (prof.rows[0].xp || 0) + 30;
        const saldoMonedas = (prof.rows[0].monedas || 0) + 5;
        const nuevoNivel = Math.floor(totalXp / 500) + 1;

        await client.query(`
          UPDATE public.profiles
          SET xp = $1, monedas = $2, nivel = $3 WHERE id = $4;
        `, [totalXp, saldoMonedas, nuevoNivel, userId]);

        return { activado: true, xp_bonus: 30, monedas_bonus: 5, total_xp: totalXp, saldo_monedas: saldoMonedas };
      }

      return { activado: false, xp_bonus: 0, monedas_bonus: 0 };
    } finally {
      client.release();
    }
  }

  /**
   * HU 4.2A-3: Obtener Perfil Completo
   */
  static async obtenerPerfilGamificado(userId: string) {
    const client = await pool.connect();
    try {
      const res = await client.query(`
        SELECT id, xp, monedas, nivel, racha_dias FROM public.profiles WHERE id = $1;
      `, [userId]);

      if (res.rows.length === 0) throw new Error('Perfil no encontrado.');

      const p = res.rows[0];
      const xpTotal = p.xp || 0;
      const nivelActual = Math.floor(xpTotal / 500) + 1;
      const porcentajeProgreso = Number(((xpTotal % 500) / 500 * 100).toFixed(2));

      return {
        user_id: p.id,
        xp_total: xpTotal,
        nivel: nivelActual,
        porcentaje_siguiente_nivel: `${porcentajeProgreso}%`,
        saldo_monedas: p.monedas || 0,
        racha_dias: p.racha_dias || 0
      };
    } finally {
      client.release();
    }
  }
}