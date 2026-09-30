import { afterEach, describe, expect, it, vi } from 'vitest';
import { StreakService } from './streakService';
import { TriviaConflictError, TriviaService } from './triviaService';

function createClient(handler: (sql: string, params?: unknown[]) => { rows?: unknown[]; rowCount?: number } = () => ({ rows: [] })) {
  const query = vi.fn(async (sql: string, params?: unknown[]) => ({ rows: [], rowCount: 0, ...handler(sql, params) }));
  return { query, release: vi.fn() };
}

function createService(client: ReturnType<typeof createClient>, repository = {}, generation = {}) {
  return new TriviaService(
    { connect: vi.fn().mockResolvedValue(client) } as never,
    repository as never,
    { refillIfNeeded: vi.fn().mockResolvedValue(0), ...generation } as never,
  );
}

const activeSession = {
  id: '11111111-1111-4111-8111-111111111111',
  vidas_restantes: 3,
  vida_extra_comprada: false,
  correctas: 0,
  incorrectas: 0,
  xp_acumulada: 0,
  monedas_ganadas: 0,
  current_question_id: null,
  current_question_started_at: null,
  estado: 'activa',
  recompensa_acreditada: false,
  xp_total_resultado: null,
  saldo_monedas_resultado: null,
  nivel_resultado: null,
  level_up_resultado: null,
};

describe('TriviaService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('crea una partida con tres vidas', async () => {
    const client = createClient((sql) => {
      if (sql.includes('INSERT INTO public.trivia_sessions')) return { rows: [activeSession] };
      return { rows: [] };
    });
    const result = await createService(client).iniciar('user-1', null);
    expect(result.created).toBe(true);
    expect(result.session.vidas).toBe(3);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO public.trivia_sessions'), ['user-1', null, 3]);
  });

  it('reutiliza una partida activa', async () => {
    const client = createClient((sql) => sql.includes("estado = 'activa'") ? { rows: [activeSession] } : { rows: [] });
    const result = await createService(client).iniciar('user-1', null);
    expect(result.created).toBe(false);
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO public.trivia_sessions'))).toBe(false);
  });

  it.each([[9, 60], [10, 40], [21, 20], [31, 0]])('calcula %s segundos como %s XP', async (elapsed, expectedXp) => {
    const client = createClient((sql) => {
      if (sql.includes('FROM public.trivia_answers a')) return { rows: [] };
      if (sql.includes('GREATEST(0')) return { rows: [{
        ...activeSession,
        current_question_id: '22222222-2222-4222-8222-222222222222',
        elapsed_seconds: elapsed,
        pregunta: 'Pregunta',
        alternativas: ['A', 'B', 'C', 'D'],
        correct_index: 2,
        explicacion: 'Explicación',
      }] };
      return { rows: [] };
    });
    const result = await createService(client).responder(
      'user-1', activeSession.id, '22222222-2222-4222-8222-222222222222', 2,
    );
    expect(result.xp_ganada).toBe(expectedXp);
    expect(result.correcta).toBe(elapsed <= 30);
    expect(result.vidas_restantes).toBe(elapsed <= 30 ? 3 : 2);
  });

  it('devuelve una respuesta repetida sin descontar otra vida', async () => {
    const saved = {
      correcta: false,
      correct_index: 1,
      explicacion_snapshot: 'Explicación',
      tiempo_segundos: 30,
      xp_otorgada: 0,
      vidas_restantes_resultado: 2,
      correctas_resultado: 0,
      xp_acumulada_resultado: 0,
    };
    const client = createClient((sql) => sql.includes('FROM public.trivia_answers a') ? { rows: [saved] } : { rows: [] });
    const result = await createService(client).responder('user-1', activeSession.id, '22222222-2222-4222-8222-222222222222', null);
    expect(result.vidas_restantes).toBe(2);
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes('UPDATE public.trivia_sessions'))).toBe(false);
  });

  it('compra una sola vida por cinco monedas cuando quedan cero vidas', async () => {
    const client = createClient((sql) => {
      if (sql.includes('FROM public.trivia_sessions')) return { rows: [{ ...activeSession, vidas_restantes: 0 }] };
      if (sql.includes('SELECT monedas')) return { rows: [{ monedas: 8 }] };
      return { rows: [] };
    });
    const result = await createService(client).comprarVidaExtra('user-1', activeSession.id);
    expect(result).toEqual({ vidas: 1, saldo_monedas: 3, vida_extra_comprada: true });
    expect(client.query).toHaveBeenCalledWith('UPDATE public.profiles SET monedas = $1 WHERE id = $2;', [3, 'user-1']);
  });

  it('rechaza comprar una vida cuando todavía quedan vidas', async () => {
    const client = createClient((sql) => sql.includes('FROM public.trivia_sessions') ? { rows: [activeSession] } : { rows: [] });
    await expect(createService(client).comprarVidaExtra('user-1', activeSession.id)).rejects.toBeInstanceOf(TriviaConflictError);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('finaliza y acredita XP y monedas una sola vez', async () => {
    vi.spyOn(StreakService, 'actualizarRachaDiaria').mockResolvedValue({ racha_dias: 1, ultima_actividad: new Date() });
    const session = { ...activeSession, correctas: 7, incorrectas: 3, xp_acumulada: 300 };
    const finished = {
      ...session,
      estado: 'finalizada', recompensa_acreditada: true, monedas_ganadas: 1,
      xp_total_resultado: 1200, saldo_monedas_resultado: 11, nivel_resultado: 3, level_up_resultado: true,
    };
    const client = createClient((sql) => {
      if (sql.includes('FROM public.trivia_sessions')) return { rows: [session] };
      if (sql.includes('SELECT xp, monedas, nivel')) return { rows: [{ xp: 900, monedas: 10, nivel: 2 }] };
      if (sql.includes('obtener_nivel_usuario')) return { rows: [{ nivel: 3 }] };
      if (sql.includes('UPDATE public.trivia_sessions')) return { rows: [finished] };
      return { rows: [] };
    });
    const result = await createService(client).finalizar('user-1', activeSession.id);
    expect(result.monedas_ganadas).toBe(1);
    expect(result.xp_ganada).toBe(300);
    expect(result.level_up).toBe(true);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("VALUES ($1, 'trivia', $2, $3)"), ['user-1', 1, 300]);
  });
});
