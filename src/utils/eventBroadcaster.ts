import { Server as SocketIOServer } from 'socket.io';

const recentEmittedEvents = new Map<string, number>();

// Limpiar entradas antiguas cada 60 segundos para evitar fugas de memoria
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentEmittedEvents.entries()) {
    if (now - timestamp > 15000) {
      recentEmittedEvents.delete(key);
    }
  }
}, 60000);

/**
 * Transmite un evento en tiempo real a la sala familiar deduplicando
 * de manera robusta emisiones directas y desencadenadas por triggers de base de datos.
 */
export function broadcastFamilyLiveEvent(
  io: SocketIOServer | any,
  familyId: string | number,
  eventPayload: Record<string, any>
): boolean {
  if (!io || !familyId) return false;

  const now = Date.now();
  const rawTitle = (eventPayload.titulo || eventPayload.title || '')
    .toString()
    .replace(/^[^\w\s]+/g, '')
    .trim()
    .toLowerCase();
  const tipo = (eventPayload.tipo || eventPayload.type || '').toString().trim().toUpperCase();
  const notifId = eventPayload.id ? String(eventPayload.id) : '';

  // Llaves de deduplicación por contenido e ID
  const contentKey = `fam_${familyId}_${tipo}_${rawTitle}`;
  const idKey = notifId ? `fam_${familyId}_id_${notifId}` : null;

  if (
    (recentEmittedEvents.has(contentKey) && now - (recentEmittedEvents.get(contentKey) || 0) < 4000) ||
    (idKey && recentEmittedEvents.has(idKey) && now - (recentEmittedEvents.get(idKey) || 0) < 4000)
  ) {
    console.log(`🛡️ [EventBroadcaster] Emisión duplicada bloqueada en backend: "${eventPayload.titulo || eventPayload.title || tipo}"`);
    return false;
  }

  recentEmittedEvents.set(contentKey, now);
  if (idKey) recentEmittedEvents.set(idKey, now);

  io.to(`familia_${familyId}`).emit('evento_en_vivo', eventPayload);
  console.log(`📡 [EventBroadcaster] Evento emitido a familia_${familyId}:`, eventPayload.titulo || eventPayload.title || tipo);
  return true;
}
