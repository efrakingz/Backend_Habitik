import { PoolClient } from 'pg';
import { pool } from '../../config/db';

export interface AcreditarProgresoInput {
  userId: string;
  xpGanada: number;
  monedasGanadas: number;
  origenActividad?: string;
  actualizarRacha?: boolean;
}

export interface AcreditarProgresoResult {
  user_id: string;
  nombre: string;
  total_xp: number;
  saldo_monedas: number;
  nivel_actual: number;
  level_up: boolean;
  racha_dias: number;
}

/**
 * Motor unificado de progreso:
 * Actualiza XP, monedas, nivel (Floor(XP/500)+1, máx 99) y racha diaria en UNA SOLA
 * consulta SQL atómica (1 round-trip en lugar de 5), y registra la auditoría en historial_gamificacion.
 */
export async function acreditarProgresoUsuario(
  input: AcreditarProgresoInput,
  dbClient?: PoolClient
): Promise<AcreditarProgresoResult> {
  const executor = dbClient || pool;
  const actualizarRacha = input.actualizarRacha !== false;

  const updateRes = await executor.query(
    `
    WITH prev AS (
      SELECT
        id,
        nombre,
        COALESCE(xp, 0) AS old_xp,
        COALESCE(monedas, 0) AS old_monedas,
        COALESCE(nivel, 1) AS old_nivel,
        COALESCE(racha_dias, 0) AS old_racha,
        ultima_actividad
      FROM public.profiles
      WHERE id = $1
      FOR UPDATE
    ),
    updated AS (
      UPDATE public.profiles p
      SET
        xp = prev.old_xp + $2,
        monedas = prev.old_monedas + $3,
        nivel = LEAST(99, FLOOR((prev.old_xp + $2) / 500.0)::int + 1),
        racha_dias = CASE
          WHEN $4::boolean IS FALSE THEN prev.old_racha
          WHEN prev.ultima_actividad = CURRENT_DATE THEN GREATEST(prev.old_racha, 1)
          WHEN prev.ultima_actividad = CURRENT_DATE - 1 THEN prev.old_racha + 1
          ELSE 1
        END,
        ultima_actividad = CASE
          WHEN $4::boolean IS TRUE THEN CURRENT_DATE
          ELSE p.ultima_actividad
        END
      FROM prev
      WHERE p.id = prev.id
      RETURNING
        p.id AS user_id,
        p.nombre,
        p.xp AS total_xp,
        p.monedas AS saldo_monedas,
        p.nivel AS nivel_actual,
        p.racha_dias,
        (p.nivel > prev.old_nivel) AS level_up
    )
    SELECT * FROM updated;
    `,
    [input.userId, input.xpGanada, input.monedasGanadas, actualizarRacha]
  );

  if (updateRes.rows.length === 0) {
    throw new Error('Perfil no encontrado.');
  }

  const row = updateRes.rows[0];

  if (input.origenActividad) {
    await executor.query(
      `INSERT INTO public.historial_gamificacion (user_id, origen_actividad, monedas_otorgadas, xp_otorgada)
       VALUES ($1, $2, $3, $4);`,
      [input.userId, input.origenActividad, input.monedasGanadas, input.xpGanada]
    );
  }

  return {
    user_id: row.user_id,
    nombre: row.nombre || 'Usuario',
    total_xp: Number(row.total_xp) || 0,
    saldo_monedas: Number(row.saldo_monedas) || 0,
    nivel_actual: Number(row.nivel_actual) || 1,
    level_up: Boolean(row.level_up),
    racha_dias: Number(row.racha_dias) || 0,
  };
}

/**
 * Calcula los códigos de logros transversales (rachas y billetera) que aplican según el estado actual.
 */
export function evaluarLogrosTransversales(rachaDias: number, saldoMonedas: number, baseCodigos: string[] = []): string[] {
  const codigos = [...baseCodigos];
  if (rachaDias >= 3) codigos.push('RACHA_3');
  if (rachaDias >= 7) codigos.push('RACHA_7');
  if (saldoMonedas >= 100) codigos.push('BILLETERA_ECO');
  return codigos;
}
