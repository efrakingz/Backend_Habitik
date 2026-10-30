import { pool } from '../config/db';
import { NotificationService } from './notificationService';
import { acreditarProgresoUsuario } from './gamification/progressEngine';

export class InspeccionService {
  /**
   * CA-2.2-2: Registra la evidencia fotográfica subida al servidor y notifica al Jefe.
   */
  static async enviarEvidencia(userId: string, familyId: string, tituloMision: string, fotoUrl: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertQuery = `
        INSERT INTO public.inspeccion_evidencias (family_id, user_id, titulo_mision, foto_url, estado)
        VALUES ($1, $2, $3, $4, 'pendiente')
        RETURNING *;
      `;
      const resEvidencia = await client.query(insertQuery, [familyId, userId, tituloMision, fotoUrl]);
      const evidencia = resEvidencia.rows[0];

      const profileRes = await client.query('SELECT nombre FROM public.profiles WHERE id = $1', [userId]);
      const nombreUsuario = profileRes.rows[0]?.nombre || 'Un integrante';

      await NotificationService.sendFamilyPushNotification(
        familyId,
        userId,
        '📸 Nueva Inspección Pendiente',
        `${nombreUsuario} envió evidencia para "${tituloMision}". ¡Ingresa a revisar!`,
        { type: 'inspeccion_pendiente', evidencia_id: evidencia.id }
      );

      await client.query('COMMIT');
      return evidencia;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async obtenerPendientesFamilia(familyId: string) {
    const query = `
      SELECT 
        e.id,
        e.titulo_mision,
        e.foto_url,
        e.created_at,
        p.id AS user_id,
        p.nombre AS usuario_nombre,
        COALESCE(p.avatar->>'url', null) AS usuario_avatar
      FROM public.inspeccion_evidencias e
      JOIN public.profiles p ON e.user_id = p.id
      WHERE e.family_id = $1 AND e.estado = 'pendiente'
      ORDER BY e.created_at ASC;
    `;
    const res = await pool.query(query, [familyId]);
    return res.rows;
  }

  static async aprobarEvidencia(jefeId: string, evidenciaId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const jefeRes = await client.query('SELECT family_id, rol FROM public.profiles WHERE id = $1', [jefeId]);
      const jefe = jefeRes.rows[0];
      const rol = (jefe?.rol || '').toLowerCase();
      
      if (!jefe || (rol !== 'jefe' && rol !== 'admin')) {
        throw new Error('Solo el Jefe de Hogar puede aprobar inspecciones.');
      }

      const evidenciaRes = await client.query(
        'SELECT * FROM public.inspeccion_evidencias WHERE id = $1 AND estado = \'pendiente\' FOR UPDATE;',
        [evidenciaId]
      );
      const evidencia = evidenciaRes.rows[0];
      if (!evidencia) {
        throw new Error('La evidencia no existe o ya fue procesada.');
      }

      // CA-Multitenant: Validar aislamiento de familias
      if (jefe.family_id && evidencia.family_id && jefe.family_id !== evidencia.family_id) {
        throw new Error('No tienes permisos para validar evidencias de otra familia.');
      }

      await client.query(
        'UPDATE public.inspeccion_evidencias SET estado = \'aprobado\', validated_at = NOW() WHERE id = $1;',
        [evidenciaId]
      );

      const xpGanada = 80;
      const monedasGanadas = 4;

      // Motor unificado de acreditación de progreso (XP, monedas, nivel, racha, historial y logros transversales)
      const progreso = await acreditarProgresoUsuario({
        userId: evidencia.user_id,
        xpGanada,
        monedasGanadas,
        origenActividad: 'inspeccion_fotografica',
        actualizarRacha: true
      }, client);

      await NotificationService.sendFamilyPushNotification(
        evidencia.family_id,
        jefeId,
        '🎉 ¡Evidencia Aprobada!',
        `El Jefe aprobó tu foto de "${evidencia.titulo_mision}". Ganaste +80 XP y +4 🪙.`,
        { type: 'inspeccion_aprobada', evidencia_id: evidenciaId }
      );

      await client.query('COMMIT');

      return {
        exito: true,
        mensaje: 'Evidencia aprobada con éxito.',
        recompensas: {
          xp_ganada: xpGanada,
          monedas_ganadas: monedasGanadas,
          nuevo_saldo_monedas: progreso.saldo_monedas,
          total_xp: progreso.total_xp,
          nuevo_nivel: progreso.nivel_actual
        }
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async rechazarEvidencia(jefeId: string, evidenciaId: string, motivo: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const jefeRes = await client.query('SELECT family_id, rol FROM public.profiles WHERE id = $1', [jefeId]);
      const jefe = jefeRes.rows[0];
      const rol = (jefe?.rol || '').toLowerCase();
      
      if (!jefe || (rol !== 'jefe' && rol !== 'admin')) {
        throw new Error('Solo el Jefe de Hogar puede rechazar inspecciones.');
      }

      const evidenciaRes = await client.query(
        'SELECT * FROM public.inspeccion_evidencias WHERE id = $1 AND estado = \'pendiente\' FOR UPDATE;',
        [evidenciaId]
      );
      const evidencia = evidenciaRes.rows[0];
      if (!evidencia) {
        throw new Error('La evidencia no existe o ya fue procesada.');
      }

      // CA-Multitenant: Validar aislamiento de familias
      if (jefe.family_id && evidencia.family_id && jefe.family_id !== evidencia.family_id) {
        throw new Error('No tienes permisos para validar evidencias de otra familia.');
      }

      const updateRes = await client.query(`
        UPDATE public.inspeccion_evidencias 
        SET estado = 'rechazado', motivo_rechazo = $1, validated_at = NOW() 
        WHERE id = $2 AND estado = 'pendiente'
        RETURNING *;
      `, [motivo || 'Evidencia no clara o incompleta', evidenciaId]);

      await NotificationService.sendFamilyPushNotification(
        evidencia.family_id,
        jefeId,
        '❌ Inspección Rechazada',
        `Tu evidencia para "${evidencia.titulo_mision}" no fue aprobada. Motivo: ${motivo}`,
        { type: 'inspeccion_rechazada', evidencia_id: evidenciaId }
      );

      await client.query('COMMIT');
      return { exito: true, mensaje: 'Evidencia rechazada con éxito.' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
