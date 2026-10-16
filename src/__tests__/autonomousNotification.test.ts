import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  AutonomousNotificationService,
  CandidateNotification,
} from '../services/autonomousNotificationService';

describe('AutonomousNotificationService', () => {
  let mockDb: any;
  let mockNotificationService: any;
  let mockTriviaRepo: any;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    };
    mockNotificationService = {
      sendFamilyEvent: vi.fn().mockResolvedValue({ id: 'notif-123' }),
    };
    mockTriviaRepo = {
      getRandomCuriosidad: vi.fn().mockResolvedValue({
        curiosidad: '💡 Apagar equipos en stand-by ahorra hasta 10% de energía.',
        categoria: 'energia',
      }),
    };
  });

  describe('Filtro de Ventana Horaria (09:00 - 22:00)', () => {
    it('rechaza horarios fuera del rango permitido', () => {
      const service = new AutonomousNotificationService(
        mockDb,
        mockNotificationService,
        mockTriviaRepo,
        {
          minHour: 9,
          maxHour: 22,
          cooldownMinHours: 3,
          cooldownMaxHours: 5,
          maxDailyNotifications: 3,
          jitterProbability: 1.0,
          timeZone: 'UTC',
        }
      );

      // 08:30 (Mañana temprano)
      const morningEarly = new Date('2026-10-15T08:30:00.000Z');
      // 22:05 (Noche)
      const lateNight = new Date('2026-10-15T22:05:00.000Z');
      // 03:00 (Madrugada)
      const midnight = new Date('2026-10-15T03:00:00.000Z');

      expect(service.isWithinAllowedHours(morningEarly)).toBe(false);
      expect(service.isWithinAllowedHours(lateNight)).toBe(false);
      expect(service.isWithinAllowedHours(midnight)).toBe(false);
    });

    it('acepta horarios dentro de la ventana sagrada 09:00 - 22:00', () => {
      const service = new AutonomousNotificationService(mockDb, mockNotificationService, mockTriviaRepo);

      // 09:00 exactamente
      const start = new Date('2026-10-15T09:00:00.000Z');
      // 14:30 (Tarde)
      const midDay = new Date('2026-10-15T14:30:00.000Z');
      // 21:59 (Antes de las 22)
      const nightBeforeClose = new Date('2026-10-15T21:59:00.000Z');

      // Usando timezone UTC para el test
      const serviceUtc = new AutonomousNotificationService(
        mockDb,
        mockNotificationService,
        mockTriviaRepo,
        {
          minHour: 9,
          maxHour: 22,
          cooldownMinHours: 3,
          cooldownMaxHours: 5,
          maxDailyNotifications: 3,
          jitterProbability: 1.0,
          timeZone: 'UTC',
        }
      );

      expect(serviceUtc.isWithinAllowedHours(start)).toBe(true);
      expect(serviceUtc.isWithinAllowedHours(midDay)).toBe(true);
      expect(serviceUtc.isWithinAllowedHours(nightBeforeClose)).toBe(true);
    });

    it('omite el ciclo completo si está fuera de ventana horaria', async () => {
      const service = new AutonomousNotificationService(
        mockDb,
        mockNotificationService,
        mockTriviaRepo,
        {
          minHour: 9,
          maxHour: 22,
          cooldownMinHours: 3,
          cooldownMaxHours: 5,
          maxDailyNotifications: 3,
          jitterProbability: 1.0,
          timeZone: 'UTC',
        }
      );

      const outsideDate = new Date('2026-10-15T04:00:00.000Z');
      const result = await service.runCycle(null, outsideDate);

      expect(result.sent).toBe(0);
      expect(result.reason).toBe('outside_allowed_hours');
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('Control de Cooldown y Límite Diario', () => {
    it('omite la familia si ya alcanzó el máximo diario de 3 notificaciones', async () => {
      const service = new AutonomousNotificationService(
        mockDb,
        mockNotificationService,
        mockTriviaRepo,
        {
          minHour: 9,
          maxHour: 22,
          cooldownMinHours: 3,
          cooldownMaxHours: 5,
          maxDailyNotifications: 3,
          jitterProbability: 1.0,
          timeZone: 'UTC',
        }
      );

      const now = new Date('2026-10-15T15:00:00.000Z');
      // Simular 3 notificaciones enviadas hoy
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { title: 'A', desc_text: 'A', created_at: new Date('2026-10-15T10:00:00.000Z') },
          { title: 'B', desc_text: 'B', created_at: new Date('2026-10-15T12:00:00.000Z') },
          { title: 'C', desc_text: 'C', created_at: new Date('2026-10-15T14:00:00.000Z') },
        ],
      });

      const dispatched = await service.evaluateAndDispatchForFamily('family-1', now, null);
      expect(dispatched).toBe(false);
      expect(mockNotificationService.sendFamilyEvent).not.toHaveBeenCalled();
    });

    it('omite la familia si la última notificación fue hace menos del cooldown', async () => {
      const service = new AutonomousNotificationService(
        mockDb,
        mockNotificationService,
        mockTriviaRepo,
        {
          minHour: 9,
          maxHour: 22,
          cooldownMinHours: 3,
          cooldownMaxHours: 3, // fijo en 3 horas para la prueba
          maxDailyNotifications: 3,
          jitterProbability: 1.0,
          timeZone: 'UTC',
        }
      );

      const now = new Date('2026-10-15T15:00:00.000Z');
      // Última notificación hace 1 hora (14:00)
      mockDb.query.mockResolvedValueOnce({
        rows: [
          { title: 'A', desc_text: 'A', created_at: new Date('2026-10-15T14:00:00.000Z') },
        ],
      });

      const dispatched = await service.evaluateAndDispatchForFamily('family-1', now, null);
      expect(dispatched).toBe(false);
      expect(mockNotificationService.sendFamilyEvent).not.toHaveBeenCalled();
    });
  });

  describe('Ponderación Contextual y Antirrepetición', () => {
    it('construye alerta de racha con peso 60 en horario vespertino si no se ha registrado actividad', async () => {
      const service = new AutonomousNotificationService(
        mockDb,
        mockNotificationService,
        mockTriviaRepo,
        {
          minHour: 9,
          maxHour: 22,
          cooldownMinHours: 3,
          cooldownMaxHours: 5,
          maxDailyNotifications: 3,
          jitterProbability: 1.0,
          timeZone: 'UTC',
        }
      );

      const eveningNow = new Date('2026-10-15T19:30:00.000Z');
      const members = [
        {
          id: 'user-1',
          nombre: 'Matías',
          racha_dias: 5,
          ultima_actividad: '2026-10-14', // ayer
          onboarding_answers: {},
        },
      ];

      const candidates = await service.buildCandidateNotifications(members, eveningNow, new Set());
      const rachaCandidate = candidates.find((c) => c.tipo === 'ALERTA_RACHA');

      expect(rachaCandidate).toBeDefined();
      expect(rachaCandidate?.peso).toBe(60);
      expect(rachaCandidate?.mensaje).toContain('tu racha de 5 días vence');
    });

    it('construye tip de onboarding con peso 50 si hay respuestas de alto impacto', async () => {
      const service = new AutonomousNotificationService(
        mockDb,
        mockNotificationService,
        mockTriviaRepo,
        {
          minHour: 9,
          maxHour: 22,
          cooldownMinHours: 3,
          cooldownMaxHours: 5,
          maxDailyNotifications: 3,
          jitterProbability: 1.0,
          timeZone: 'UTC',
        }
      );

      const midDay = new Date('2026-10-15T12:00:00.000Z');
      const members = [
        {
          id: 'user-2',
          nombre: 'Camila',
          racha_dias: 0,
          ultima_actividad: '2026-10-15',
          onboarding_answers: {
            tiempoDucha: '> 15 min',
            reciclaje: 'Nunca',
          },
        },
      ];

      const candidates = await service.buildCandidateNotifications(members, midDay, new Set());
      const showerCandidate = candidates.find((c) => c.tipo === 'TIP_ONBOARDING' && c.mensaje.includes('Eco-Ducha'));
      const recyclingCandidate = candidates.find((c) => c.tipo === 'TIP_ONBOARDING' && c.titulo.includes('Reciclaje'));

      expect(showerCandidate).toBeDefined();
      expect(showerCandidate?.peso).toBe(50);
      expect(recyclingCandidate).toBeDefined();
    });

    it('descarta candidatos si ya fueron enviados en los últimos 7 días (antirrepetición)', async () => {
      const service = new AutonomousNotificationService(
        mockDb,
        mockNotificationService,
        mockTriviaRepo,
        {
          minHour: 9,
          maxHour: 22,
          cooldownMinHours: 3,
          cooldownMaxHours: 5,
          maxDailyNotifications: 3,
          jitterProbability: 1.0,
          timeZone: 'UTC',
        }
      );

      const midDay = new Date('2026-10-15T12:00:00.000Z');
      const textAlreadySent = '🚿 Eco-Ducha: Bajar tu ducha a menos de 5 minutos ahorra más de 60 litros de agua al día.';
      const sentSet = new Set([textAlreadySent]);

      const members = [
        {
          id: 'user-2',
          nombre: 'Camila',
          racha_dias: 0,
          onboarding_answers: { tiempoDucha: '> 15 min' },
        },
      ];

      const candidates = await service.buildCandidateNotifications(members, midDay, sentSet);
      const showerCandidate = candidates.find((c) => c.mensaje === textAlreadySent);

      expect(showerCandidate).toBeUndefined();
    });

    it('selecciona estocásticamente candidatos según sus pesos ponderados', () => {
      const service = new AutonomousNotificationService(mockDb, mockNotificationService, mockTriviaRepo);
      const candidates: CandidateNotification[] = [
        { tipo: 'ECO_CURIOSIDAD', titulo: 'A', mensaje: 'A', visual: { icon: '', color: '' }, peso: 10 },
        { tipo: 'ALERTA_RACHA', titulo: 'B', mensaje: 'B', visual: { icon: '', color: '' }, peso: 90 },
      ];

      const selected = service.weightedRandomSelect(candidates);
      expect(selected).toBeDefined();
      expect(['A', 'B']).toContain(selected?.titulo);
    });
  });
});
