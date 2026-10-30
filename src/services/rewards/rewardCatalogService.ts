import { pool } from '../../config/db';
import { broadcastFamilyLiveEvent } from '../../utils/eventBroadcaster';

export class RewardCatalogService {
  /**
   * 1. Listar todas las recompensas activas de la familia,
   *    junto con la propuesta diaria del usuario y las colectas familiares activas.
   *    Ejecuta las 3 consultas de lectura en paralelo (Promise.all) directamente en el pool.
   */
  async getRewardsByFamily(familyId: string, currentUserId?: string) {
    const rewardsPromise = pool.query(`
      SELECT id, titulo, descripcion, emoji, costo, disponible, es_familiar, 
             created_at, last_redeemed_at, metadata, estado, propuesto_por
      FROM public.family_rewards
      WHERE family_id = $1 AND estado = 'activo'
      ORDER BY created_at DESC;
    `, [familyId]);

    const propPromise = currentUserId
      ? pool.query(`
          SELECT id, titulo, descripcion, emoji, costo, estado, fecha_propuesta, created_at
          FROM public.family_rewards
          WHERE propuesto_por = $1 AND fecha_propuesta = CURRENT_DATE
          ORDER BY created_at DESC
          LIMIT 1;
        `, [currentUserId])
      : Promise.resolve({ rows: [] as any[] });

    const colectasPromise = pool.query(`
      SELECT c.id as canje_id, c.reward_id, c.total_requerido, c.total_recaudado, c.estado,
             json_agg(json_build_object(
               'user_id', ca.user_id,
               'nombre', p.nombre,
               'avatar', p.avatar,
               'monto_asignado', ca.monto_asignado,
               'monto_pagado', ca.monto_pagado,
               'pagado', ca.pagado
             )) as aportes
      FROM public.canjes c
      JOIN public.canje_aportes ca ON c.id = ca.canje_id
      JOIN public.profiles p ON ca.user_id = p.id
      WHERE c.family_id = $1 AND c.es_colecta = true AND c.estado = 'recaudando'
      GROUP BY c.id, c.reward_id, c.total_requerido, c.total_recaudado, c.estado;
    `, [familyId]);

    const [rewardsRes, propRes, colectasRes] = await Promise.all([
      rewardsPromise,
      propPromise,
      colectasPromise,
    ]);

    const propuestaHoy = propRes.rows.length > 0 ? propRes.rows[0] : null;

    // Mapear colectas por reward_id
    const colectasMap = new Map<string, any>();
    for (const col of colectasRes.rows) {
      colectasMap.set(String(col.reward_id), col);
    }

    // Adjuntar colecta si aplica
    const items = rewardsRes.rows.map((r: any) => {
      const col = colectasMap.get(String(r.id));
      return {
        ...r,
        colecta_activa: col || null
      };
    });

    return {
      rewards: items,
      propuesta_hoy: propuestaHoy,
      colectas_activas: colectasRes.rows
    };
  }

  /**
   * 2. Crear recompensa directa (Restringido exclusivamente al rol 'Jefe' / Admin)
   */
  async createReward(
    userId: string,
    userRole: string,
    familyId: string,
    data: { titulo: string; descripcion: string; emoji?: string; costo: number; es_familiar: boolean; metadata?: any },
    io?: any
  ) {
    const roleNormalized = (userRole || '').toLowerCase();
    if (roleNormalized !== 'jefe' && roleNormalized !== 'admin') {
      throw new Error('Acceso denegado: Solo el jefe de hogar puede crear recompensas directamente.');
    }

    const { titulo, descripcion, emoji, costo, es_familiar, metadata } = data;

    const result = await pool.query(`
      INSERT INTO public.family_rewards (family_id, titulo, descripcion, emoji, costo, disponible, creador_id, es_familiar, estado, metadata)
      VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7, 'activo', $8)
      RETURNING id, titulo, descripcion, emoji, costo, disponible, es_familiar, estado, metadata;
    `, [familyId, titulo, descripcion, emoji || '🎁', costo, userId, es_familiar, metadata || JSON.stringify({ frecuencia: 'semanal' })]);

    const created = result.rows[0];

    // Emitir evento WebSocket para que la tienda de todos los miembros se actualice
    if (io) {
      broadcastFamilyLiveEvent(io, familyId, {
        tipo: 'PREMIO_CREADO',
        family_id: familyId,
        titulo: '🎁 ¡Nuevo premio en la tienda!',
        mensaje: `Se ha agregado "${titulo}" a los premios ${es_familiar ? 'familiares' : 'personales'}.`,
        reward: created
      });
    }

    return created;
  }
}
