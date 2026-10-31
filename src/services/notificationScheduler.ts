import { Server as SocketIOServer } from 'socket.io';
import { autonomousNotificationService } from './autonomousNotificationService';

let schedulerInterval: NodeJS.Timeout | null = null;
let isCycleRunning = false;

// Intervalo por defecto: cada 4 horas (14.400.000 ms) para evitar saturación
const DEFAULT_INTERVAL_MS = 4 * 60 * 60 * 1000;

export function startNotificationScheduler(io: SocketIOServer, intervalMs: number = DEFAULT_INTERVAL_MS): void {
  if (schedulerInterval) {
    console.log('⚠️ [NotificationScheduler] El programador ya se encuentra en ejecución.');
    return;
  }

  console.log(`⏰ [NotificationScheduler] Iniciando motor autónomo de notificaciones (intervalo: ${intervalMs / 60000} min)...`);

  // Pequeña espera inicial de 30 segundos tras iniciar el servidor antes del primer ciclo
  setTimeout(async () => {
    await executeSafeCycle(io);
  }, 30000);

  schedulerInterval = setInterval(async () => {
    await executeSafeCycle(io);
  }, intervalMs);
}

export function stopNotificationScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('🛑 [NotificationScheduler] Programador autónomo detenido.');
  }
}

async function executeSafeCycle(io: SocketIOServer): Promise<void> {
  if (isCycleRunning) {
    console.log('⏳ [NotificationScheduler] Ciclo previo aún en ejecución. Omitiendo intervalo.');
    return;
  }

  isCycleRunning = true;
  try {
    console.log('🔄 [NotificationScheduler] Evaluando ciclo autónomo de notificaciones...');
    await autonomousNotificationService.runCycle(io);
  } catch (err) {
    console.error('❌ [NotificationScheduler] Error no controlado en ciclo autónomo:', err);
  } finally {
    isCycleRunning = false;
  }
}
