import { pool } from '../config/db';

/**
 * Catálogo de reglas de negocio y recompensas base asociadas a cada juego.
 * - baseMonedas: Saldo máximo de monedas a otorgar al completar el 100%.
 * - baseXP: Puntos de experiencia máximos a otorgar al completar el 100%.
 * - escalaConProgreso: Indica si la recompensa se calcula de forma proporcional según el porcentaje alcanzado.
 */
const REGLAS_JUEGOS: Record<string, { baseMonedas: number; baseXP: number; escalaConProgreso: boolean }> = {
  'eco_puzzle': { baseMonedas: 50, baseXP: 100, escalaConProgreso: true },
  'speedrun_ducha': { baseMonedas: 40, baseXP: 80, escalaConProgreso: true }
};

export class GamificationService {
  /**
   * Calcula de forma dinámica la recompensa (monedas y XP) según el juego y el avance del usuario,
   * actualiza la tabla de perfiles (public.profiles) y registra una auditoría en la BD.
   * 
   * @param userId UUID del usuario que completó la actividad.
   * @param origenActividad Clave del juego ('eco_puzzle' o 'speedrun_ducha').
   * @param progresoPorcentaje Porcentaje de avance o eficiencia del jugador (0 a 100%).
   */
  static async otorgarRecompensaPorProgreso(
    userId: string,
    origenActividad: string,
    progresoPorcentaje: number = 100
  ) {
    // 1. Validar que el juego enviado exista en nuestro catálogo de reglas
    const regla = REGLAS_JUEGOS[origenActividad];

    if (!regla) {
      throw new Error(`El juego '${origenActividad}' no está registrado. Juegos válidos: eco_puzzle, speedrun_ducha.`);
    }

    // 2. Normalizar el porcentaje entre 0 y 100 para evitar desbordamientos
    const porcentajeValido = Math.min(100, Math.max(0, progresoPorcentaje));
    
    // 3. Obtener el factor de proporcionalidad (ej. 75% -> 0.75)
    const factor = regla.escalaConProgreso ? (porcentajeValido / 100) : (porcentajeValido === 100 ? 1 : 0);

    // 4. Calcular el monto final de monedas y XP redondeando al entero más cercano
    const monedasCalculadas = Math.round(regla.baseMonedas * factor);
    const xpCalculada = Math.round(regla.baseXP * factor);

    // 5. Validar que la actividad otorgue al menos una recompensa
    if (monedasCalculadas === 0 && xpCalculada === 0) {
      throw new Error('El progreso alcanzado no genera recompensas.');
    }

    // 6. Conectar a la base de datos e iniciar transacción atómica SQL
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Actualizar el acumulado global de monedas y XP en el perfil del usuario
      const updateQuery = `
        UPDATE public.profiles
        SET 
          monedas = COALESCE(monedas, 0) + $1,
          xp = COALESCE(xp, 0) + $2
        WHERE id = $3
        RETURNING id, monedas, xp;
      `;

      const res = await client.query(updateQuery, [monedasCalculadas, xpCalculada, userId]);

      if (res.rows.length === 0) {
        throw new Error('Perfil de usuario no encontrado.');
      }

      // Guardar el registro de auditoría en la tabla historial_gamificacion
      await client.query(`
        INSERT INTO public.historial_gamificacion (user_id, origen_actividad, monedas_otorgadas, xp_otorgada)
        VALUES ($1, $2, $3, $4);
      `, [userId, origenActividad, monedasCalculadas, xpCalculada]);

      // Confirmar los cambios en la BD si todo fue correcto
      await client.query('COMMIT');

      // Retornar objeto con el resumen del cálculo y el nuevo saldo del usuario
      return {
        exito: true,
        juego: origenActividad,
        desempeno_evaluado: `${porcentajeValido}%`,
        monedas_ganadas: monedasCalculadas,
        xp_ganada: xpCalculada,
        saldo_total_monedas: res.rows[0].monedas,
        total_xp: res.rows[0].xp
      };
    } catch (error) {
      // Revertir cambios en la BD si ocurrió algún error durante la transacción
      await client.query('ROLLBACK');
      throw error;
    } finally {
      // Liberar la conexión devuelta al pool
      client.release();
    }
  }
}