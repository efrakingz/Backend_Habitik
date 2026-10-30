import { pool } from './db';

const PERFORMANCE_INDEX_STATEMENTS = [
  `CREATE INDEX IF NOT EXISTS idx_profiles_family_xp ON public.profiles (family_id, xp DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_shower_logs_user_estado ON public.shower_logs (user_id, estado, iniciado_en DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_shower_logs_user_valid_date ON public.shower_logs (user_id, es_valido, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_historial_gamif_user_created ON public.historial_gamificacion (user_id, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_historial_gamif_user_origen ON public.historial_gamificacion (user_id, origen_actividad, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_family_rewards_family_estado ON public.family_rewards (family_id, estado, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_family_rewards_propuesto_fecha ON public.family_rewards (propuesto_por, fecha_propuesta);`,
  `CREATE INDEX IF NOT EXISTS idx_canjes_family_estado_colecta ON public.canjes (family_id, estado, es_colecta, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_canjes_user_reward_date ON public.canjes (user_id, reward_id, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_canje_aportes_canje_user ON public.canje_aportes (canje_id, user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_family_created ON public.notifications (family_id, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_inspeccion_family_estado ON public.inspeccion_evidencias (family_id, estado, created_at ASC);`,
  `CREATE INDEX IF NOT EXISTS idx_reto_validations_user_estado ON public.reto_validations (user_id, estado, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_family_hecho_created ON public.tasks (family_id, hecho, created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_usuario_logros_user_fecha ON public.usuario_logros (user_id, fecha_desbloqueo DESC);`,
];

let indexesEnsured = false;

/**
 * Crea de forma idempotente los índices compuestos clave para acelerar
 * JOINs, CTEs del feed familiar, tienda de recompensas y gamificación.
 */
export async function ensurePerformanceIndexes(): Promise<void> {
  if (indexesEnsured) return;
  indexesEnsured = true;

  for (const sql of PERFORMANCE_INDEX_STATEMENTS) {
    try {
      await pool.query(sql);
    } catch {
      // Ignorar silenciosamente si alguna tabla opcional no está presente en un entorno de test aislado
    }
  }
}
