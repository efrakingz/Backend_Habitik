import { Pool } from 'pg';
import { Server as SocketIOServer } from 'socket.io';
import { pool } from '../config/db';
import { NotificationService } from './notificationService';
import { triviaRepository, TriviaRepository } from '../repositories/triviaRepository';

export interface AutonomousNotificationConfig {
  minHour: number; // 09:00
  maxHour: number; // 22:00
  cooldownMinHours: number; // 3 horas
  cooldownMaxHours: number; // 5 horas
  maxDailyNotifications: number; // 3 notificaciones
  jitterProbability: number; // 60% por ciclo
  timeZone: string; // America/Santiago
}

export const DEFAULT_AUTONOMOUS_CONFIG: AutonomousNotificationConfig = {
  minHour: 9,
  maxHour: 22,
  cooldownMinHours: 3,
  cooldownMaxHours: 5,
  maxDailyNotifications: 3,
  jitterProbability: 0.60,
  timeZone: 'America/Santiago',
};

export interface CandidateNotification {
  tipo: 'ECO_CURIOSIDAD' | 'ALERTA_RACHA' | 'TIP_ONBOARDING' | 'HITO_NIVEL';
  titulo: string;
  mensaje: string;
  visual: { icon: string; color: string };
  userId?: string | null;
  peso: number;
}

export class AutonomousNotificationService {
  constructor(
    private readonly database: Pool = pool,
    private readonly notificationService: NotificationService = new NotificationService(),
    private readonly triviaRepo: TriviaRepository = triviaRepository,
    private readonly config: AutonomousNotificationConfig = DEFAULT_AUTONOMOUS_CONFIG
  ) {}

  /**
   * Determina si la hora actual está dentro de la ventana sagrada permitida (09:00 - 22:00)
   */
  isWithinAllowedHours(now: Date = new Date()): boolean {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: this.config.timeZone,
        hour: 'numeric',
        hour12: false,
      });
      const hour = parseInt(formatter.format(now), 10);
      return hour >= this.config.minHour && hour < this.config.maxHour;
    } catch {
      const hour = now.getHours();
      return hour >= this.config.minHour && hour < this.config.maxHour;
    }
  }

  /**
   * Obtiene la hora actual en la zona horaria configurada
   */
  getCurrentHour(now: Date = new Date()): number {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: this.config.timeZone,
        hour: 'numeric',
        hour12: false,
      });
      return parseInt(formatter.format(now), 10);
    } catch {
      return now.getHours();
    }
  }

  /**
   * Evalúa y ejecuta un ciclo de despacho para todas las familias activas
   */
  async runCycle(io?: SocketIOServer | null, forcedDate?: Date): Promise<{ sent: number; skipped: number; reason?: string }> {
    const now = forcedDate || new Date();

    // 1. Filtro estricto de ventana horaria sagrada (09:00 a 22:00)
    if (!this.isWithinAllowedHours(now)) {
      console.log('🌙 [AutonomousNotification] Fuera de ventana horaria permitida (09:00 - 22:00). Ciclo omitido.');
      return { sent: 0, skipped: 0, reason: 'outside_allowed_hours' };
    }

    // 2. Tirada estocástica de Jitter (probabilidad configurada, p. ej. 60%)
    if (Math.random() > this.config.jitterProbability) {
      console.log('🎲 [AutonomousNotification] Jitter estocástico no activado en este intervalo.');
      return { sent: 0, skipped: 0, reason: 'jitter_skipped' };
    }

    let sentCount = 0;
    let skippedCount = 0;

    try {
      // 2.1 Purgar notificaciones de más de 7 días para proteger almacenamiento
      try {
        await this.notificationService.purgeOldNotifications(7);
      } catch (_) {}

      // 3. Obtener familias activas registradas
      const familiesRes = await this.database.query(`
        SELECT DISTINCT family_id 
        FROM public.profiles 
        WHERE family_id IS NOT NULL;
      `);

      for (const row of familiesRes.rows) {
        const familyId = row.family_id;
        const processed = await this.evaluateAndDispatchForFamily(familyId, now, io);
        if (processed) {
          sentCount++;
        } else {
          skippedCount++;
        }
      }
    } catch (error) {
      console.error('❌ [AutonomousNotification] Error ejecutando ciclo autónomo:', error);
    }

    console.log(`🔔 [AutonomousNotification] Ciclo completado. Enviadas: ${sentCount}, Omitidas: ${skippedCount}`);
    return { sent: sentCount, skipped: skippedCount };
  }

  /**
   * Evalúa y despacha una notificación para una familia específica si cumple cooldown y fatiga
   */
  async evaluateAndDispatchForFamily(familyId: string, now: Date, io?: SocketIOServer | null): Promise<boolean> {
    // A. Control de fatiga diaria y cooldown
    const notifsRes = await this.database.query(`
      SELECT title, desc_text, created_at
      FROM public.notifications
      WHERE family_id = $1 AND created_at >= $2::timestamptz - INTERVAL '24 hours'
      ORDER BY created_at DESC;
    `, [familyId, now.toISOString()]);

    const recentNotifs = notifsRes.rows;

    // Límite diario (máximo 2 a 3 por familia)
    if (recentNotifs.length >= this.config.maxDailyNotifications) {
      return false;
    }

    // Cooldown variable (entre cooldownMinHours y cooldownMaxHours)
    if (recentNotifs.length > 0) {
      const lastCreated = new Date(recentNotifs[0].created_at);
      const hoursSinceLast = (now.getTime() - lastCreated.getTime()) / (1000 * 60 * 60);
      const randomCooldown = this.config.cooldownMinHours + Math.random() * (this.config.cooldownMaxHours - this.config.cooldownMinHours);
      if (hoursSinceLast < randomCooldown) {
        return false;
      }
    }

    // B. Obtener perfiles de la familia para ponderación contextual
    const profilesRes = await this.database.query(`
      SELECT id, nombre, rol, xp, nivel, monedas, racha_dias, ultima_actividad, onboarding_answers
      FROM public.profiles
      WHERE family_id = $1;
    `, [familyId]);

    const members = profilesRes.rows;
    if (members.length === 0) return false;

    // C. Consultar antirrepetición de los últimos 7 días
    const antiRepeatRes = await this.database.query(`
      SELECT desc_text
      FROM public.notifications
      WHERE family_id = $1 AND created_at >= $2::timestamptz - INTERVAL '7 days';
    `, [familyId, now.toISOString()]);

    const sentTextsLast7Days = new Set<string>(antiRepeatRes.rows.map((r: any) => String(r.desc_text).trim()));

    // D. Construir candidatos ponderados
    const candidates = await this.buildCandidateNotifications(members, now, sentTextsLast7Days);
    if (candidates.length === 0) return false;

    // E. Selección estocástica ponderada por pesos
    const selected = this.weightedRandomSelect(candidates);
    if (!selected) return false;

    // F. Despachar notificación
    await this.notificationService.sendFamilyEvent({
      family_id: familyId,
      user_id: selected.userId || null,
      sender_name: 'Habitik AI',
      title: selected.titulo,
      desc_text: selected.mensaje,
      type: selected.tipo,
      visual: selected.visual,
      payload: {
        origen: 'autonomous_engine',
        categoria_origen: selected.tipo,
        fecha: now.toISOString(),
      },
    }, io);

    return true;
  }

  /**
   * Construye los candidatos de notificación contextualmente ponderados
   */
  async buildCandidateNotifications(
    members: any[],
    now: Date,
    sentTextsLast7Days: Set<string>
  ): Promise<CandidateNotification[]> {
    const candidates: CandidateNotification[] = [];
    const currentHour = this.getCurrentHour(now);

    // 1. Alerta de Racha en Peligro (18:00 - 21:30)
    // Peso elevado a 60 si algún miembro tiene racha y no ha entrado hoy
    const todayStr = now.toISOString().split('T')[0];
    const isEvening = currentHour >= 18 && currentHour <= 21;

    for (const m of members) {
      const racha = parseInt(m.racha_dias || 0, 10);
      const lastAct = m.ultima_actividad ? new Date(m.ultima_actividad).toISOString().split('T')[0] : null;

      if (isEvening && racha > 0 && lastAct !== todayStr) {
        const text = `¡${m.nombre}, tu racha de ${racha} días vence a las 22:00! Completa tu acción diaria para no perderla.`;
        if (!sentTextsLast7Days.has(text)) {
          candidates.push({
            tipo: 'ALERTA_RACHA',
            titulo: '🔥 ¡Protege tu racha de días!',
            mensaje: text,
            visual: { icon: 'local_fire_department', color: '#FF6D00' },
            userId: m.id,
            peso: 60,
          });
        }
      }
    }

    // 2. Tips Contextuales de Onboarding
    // Peso 50 si hay hábitos de alto impacto detectados
    for (const m of members) {
      let answers: any = m.onboarding_answers;
      if (typeof answers === 'string') {
        try { answers = JSON.parse(answers); } catch { answers = {}; }
      }
      if (answers && typeof answers === 'object') {
        const answersStr = JSON.stringify(answers).toLowerCase();

        // Ducha > 10 min
        if (answersStr.includes('> 15 min') || answersStr.includes('10-15 min') || answersStr.includes('>10')) {
          const text = '🚿 Eco-Ducha: Bajar tu ducha a menos de 5 minutos ahorra más de 60 litros de agua al día.';
          if (!sentTextsLast7Days.has(text)) {
            candidates.push({
              tipo: 'TIP_ONBOARDING',
              titulo: '💧 Reto de Agua Familiar',
              mensaje: text,
              visual: { icon: 'shower', color: '#0091EA' },
              userId: m.id,
              peso: 50,
            });
          }
        }

        // Calefacción eléctrica
        if (answersStr.includes('electrica') || answersStr.includes('eléctrica')) {
          const text = '💡 Climatización Eficiente: Cada grado menos en el termostato ahorra un 7% de electricidad mensual.';
          if (!sentTextsLast7Days.has(text)) {
            candidates.push({
              tipo: 'TIP_ONBOARDING',
              titulo: '⚡ Consejo de Climatización',
              mensaje: text,
              visual: { icon: 'lightbulb', color: '#0091EA' },
              userId: m.id,
              peso: 50,
            });
          }
        }

        // Reciclaje escaso
        if (answersStr.includes('"nunca"') || answersStr.includes('nunca')) {
          const text = '♻️ Hábito Verde: Separar envases y botellas plásticas reduce hasta el 40% de los residuos del hogar.';
          if (!sentTextsLast7Days.has(text)) {
            candidates.push({
              tipo: 'TIP_ONBOARDING',
              titulo: '🌱 Inicia tu Rincón de Reciclaje',
              mensaje: text,
              visual: { icon: 'recycling', color: '#0091EA' },
              userId: m.id,
              peso: 50,
            });
          }
        }
      }
    }

    // 3. Eco-Curiosidades generadas por Gemini (o fallback)
    // Peso 35
    try {
      const curiosidadItem = await this.triviaRepo.getRandomCuriosidad();
      if (curiosidadItem && !sentTextsLast7Days.has(curiosidadItem.curiosidad)) {
        candidates.push({
          tipo: 'ECO_CURIOSIDAD',
          titulo: '💡 ¿Sabías que? Eco-Dato Habitik',
          mensaje: curiosidadItem.curiosidad,
          visual: { icon: 'eco', color: '#00C853' },
          peso: 35,
        });
      }
    } catch (err) {
      console.warn('⚠️ [AutonomousNotification] No se pudo cargar curiosidad:', err);
    }

    // 4. Hitos de Nivel / Tienda
    // Peso 15
    for (const m of members) {
      const xp = parseInt(m.xp || 0, 10);
      const nivel = parseInt(m.nivel || 1, 10);
      const proxNivelXp = nivel * 100;
      const restante = proxNivelXp - (xp % 100);

      if (restante <= 40 && restante > 0) {
        const text = `¡${m.nombre} está a solo ${restante} XP de alcanzar el nivel ${nivel + 1}! Completen un reto para subir.`;
        if (!sentTextsLast7Days.has(text)) {
          candidates.push({
            tipo: 'HITO_NIVEL',
            titulo: '⭐ ¡Cerca de un nuevo nivel!',
            mensaje: text,
            visual: { icon: 'military_tech', color: '#FFD600' },
            userId: m.id,
            peso: 15,
          });
        }
      }
    }

    return candidates;
  }

  /**
   * Realiza una selección aleatoria estocástica ponderada según el peso de cada candidato
   */
  weightedRandomSelect(candidates: CandidateNotification[]): CandidateNotification | null {
    if (candidates.length === 0) return null;
    const totalWeight = candidates.reduce((acc, c) => acc + c.peso, 0);
    if (totalWeight <= 0) return candidates[0];

    let randomVal = Math.random() * totalWeight;
    for (const candidate of candidates) {
      if (randomVal < candidate.peso) {
        return candidate;
      }
      randomVal -= candidate.peso;
    }
    return candidates[candidates.length - 1];
  }
}

export const autonomousNotificationService = new AutonomousNotificationService();
