import { describe, expect, it } from 'vitest';
import { WordleService } from '../services/wordleService';

interface MockWord {
  id: number;
  palabra: string;
  pista: string;
}

interface MockAttempt {
  id: string;
  user_id: string;
  fecha: string;
  intentos: string[];
  estado: string;
  pista_revelada: boolean;
  word_id: number | null;
  created_at: number;
}

class InMemoryWordlePool {
  words: MockWord[];
  attempts: MockAttempt[] = [];
  profiles = new Map<string, { id: string; nombre: string; xp: number; monedas: number; nivel: number; racha_dias: number; ultima_actividad: string | null }>();
  historial: Array<{ user_id: string; origen_actividad: string; monedas_otorgadas: number; xp_otorgada: number }> = [];
  executedSql: string[] = [];
  private seq = 1;
  private today = '2026-11-12';

  constructor(words: MockWord[], userId: string, monedas = 10) {
    this.words = words;
    this.profiles.set(userId, {
      id: userId,
      nombre: 'Tester',
      xp: 0,
      monedas,
      nivel: 1,
      racha_dias: 0,
      ultima_actividad: null,
    });
  }

  async connect() {
    return {
      query: (sql: string, params?: any[]) => this.query(sql, params),
      release: () => undefined,
    };
  }

  async query(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    this.executedSql.push(normalized);

    if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
      return { rows: [] };
    }
    if (normalized.startsWith('ALTER TABLE') || normalized.startsWith('CREATE UNIQUE INDEX') || normalized.startsWith('CREATE INDEX')) {
      return { rows: [] };
    }

    if (normalized.includes('FROM public.ecological_words') && normalized.includes('OFFSET')) {
      const idx = 0;
      const w = this.words[idx];
      return {
        rows: w ? [{ id: w.id, palabra: w.palabra.trim().toUpperCase(), pista: w.pista }] : [],
      };
    }

    if (normalized.includes('FROM public.ecological_words WHERE id = $1')) {
      const id = Number(params[0]);
      const found = this.words.find((w) => w.id === id);
      return {
        rows: found ? [{ id: found.id, palabra: found.palabra.trim().toUpperCase(), pista: found.pista }] : [],
      };
    }

    if (normalized.includes('FROM public.ecological_words')) {
      return {
        rows: this.words.map((w) => ({
          id: w.id,
          palabra: w.palabra.trim().toUpperCase(),
          pista: w.pista,
        })),
      };
    }

    if (normalized.startsWith('SELECT word_id FROM public.wordle_attempts')) {
      const userId = params[0];
      const rows = this.attempts
        .filter((a) => a.user_id === userId && a.fecha === this.today)
        .sort((a, b) => b.created_at - a.created_at)
        .map((a) => ({ word_id: a.word_id }));
      return { rows };
    }

    if (normalized.includes('FROM public.wordle_attempts') && normalized.includes("estado = 'en_proceso'")) {
      const userId = params[0];
      const active = this.attempts
        .filter((a) => a.user_id === userId && a.fecha === this.today && a.estado === 'en_proceso')
        .sort((a, b) => b.created_at - a.created_at)[0];
      return { rows: active ? [{ ...active, intentos: [...active.intentos] }] : [] };
    }

    if (normalized.includes('FROM public.wordle_attempts WHERE id = $1 AND user_id = $2')) {
      const [id, userId] = params;
      const row = this.attempts.find((a) => a.id === id && a.user_id === userId);
      return { rows: row ? [{ ...row, intentos: [...row.intentos] }] : [] };
    }

    if (normalized.startsWith('INSERT INTO public.wordle_attempts')) {
      const [userId, wordId] = params;
      const conflictActive = this.attempts.some(
        (a) => a.user_id === userId && a.fecha === this.today && a.estado === 'en_proceso'
      );
      if (conflictActive) {
        return { rows: [] };
      }
      const created: MockAttempt = {
        id: `sess-${this.seq++}`,
        user_id: userId,
        fecha: this.today,
        intentos: [],
        estado: 'en_proceso',
        pista_revelada: false,
        word_id: wordId,
        created_at: Date.now() + this.seq,
      };
      this.attempts.push(created);
      return { rows: [{ ...created, intentos: [] }] };
    }

    if (normalized.includes('AS completadas_hoy')) {
      const userId = params[0];
      const count = this.attempts.filter(
        (a) => a.user_id === userId && a.fecha === this.today && a.estado === 'ganado'
      ).length;
      return { rows: [{ completadas_hoy: count }] };
    }

    if (normalized.startsWith('UPDATE public.wordle_attempts SET word_id = $1')) {
      const [wordId, id] = params;
      const row = this.attempts.find((a) => a.id === id);
      if (row) row.word_id = wordId;
      return { rows: [] };
    }

    if (normalized.startsWith('UPDATE public.wordle_attempts SET intentos = $1, estado = $2')) {
      const [intentosJson, estado, id] = params;
      const row = this.attempts.find((a) => a.id === id);
      if (row) {
        row.intentos = JSON.parse(intentosJson);
        row.estado = estado;
      }
      return { rows: [] };
    }

    if (normalized.startsWith('UPDATE public.wordle_attempts SET pista_revelada = TRUE')) {
      const [id] = params;
      const row = this.attempts.find((a) => a.id === id);
      if (row) row.pista_revelada = true;
      return { rows: [] };
    }

    if (normalized.includes('WITH prev AS') && normalized.includes('UPDATE public.profiles p')) {
      const [userId, xpGanada, monedasGanadas, actualizarRacha] = params;
      const prof = this.profiles.get(userId);
      if (!prof) return { rows: [] };
      const oldNivel = prof.nivel;
      prof.xp += Number(xpGanada);
      prof.monedas += Number(monedasGanadas);
      prof.nivel = Math.min(99, Math.floor(prof.xp / 500) + 1);
      if (actualizarRacha) {
        prof.racha_dias = prof.ultima_actividad === this.today ? Math.max(prof.racha_dias, 1) : 1;
        prof.ultima_actividad = this.today;
      }
      return {
        rows: [
          {
            user_id: prof.id,
            nombre: prof.nombre,
            total_xp: prof.xp,
            saldo_monedas: prof.monedas,
            nivel_actual: prof.nivel,
            racha_dias: prof.racha_dias,
            level_up: prof.nivel > oldNivel,
          },
        ],
      };
    }

    if (normalized.startsWith('INSERT INTO public.historial_gamificacion')) {
      const [userId, origen, monedas, xp] = params;
      this.historial.push({
        user_id: userId,
        origen_actividad: origen,
        monedas_otorgadas: Number(monedas),
        xp_otorgada: Number(xp),
      });
      return { rows: [] };
    }

    if (normalized.startsWith('SELECT monedas FROM public.profiles')) {
      const prof = this.profiles.get(params[0]);
      return { rows: prof ? [{ monedas: prof.monedas }] : [] };
    }

    if (normalized.startsWith('UPDATE public.profiles SET monedas = monedas - 3')) {
      const prof = this.profiles.get(params[0]);
      if (prof) prof.monedas -= 3;
      return { rows: [] };
    }

    throw new Error(`Consulta SQL no manejada en test: ${normalized}`);
  }
}

describe('WordleService multi-partidas por día', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  const catalog: MockWord[] = [
    { id: 1, palabra: 'SOLAR', pista: 'Energía del sol.' },
    { id: 2, palabra: 'FLORA', pista: 'Plantas de una región.' },
    { id: 3, palabra: 'FAUNA', pista: 'Animales silvestres.' },
    { id: 4, palabra: 'FAUNA', pista: 'Duplicada en catálogo.' },
  ];

  it('mantiene la misma palabra si está en proceso y entrega palabras distintas al completarla', async () => {
    const db = new InMemoryWordlePool(catalog, userId);
    const service = new WordleService(db as any);

    const first = await service.getTodayGame(userId);
    expect(first.estado).toBe('en_proceso');
    expect(first.completado_hoy).toBe(false);

    // Si aún no se completa, al reabrir sigue la misma sesión y palabra
    const resumed = await service.getTodayGame(userId);
    expect(resumed.sesion_id).toBe(first.sesion_id);

    const activeRow1 = db.attempts.find((a) => a.id === first.sesion_id)!;
    const word1 = catalog.find((w) => w.id === activeRow1.word_id)!;

    // Completar ganando
    const winRes = await service.submitGuess(userId, word1.palabra, first.sesion_id);
    expect(winRes.estado).toBe('ganado');
    expect(winRes.recompensas).toMatchObject({ xp: 100, monedas: 4, racha_dias: 1 });
    expect(winRes.palabra_correcta).toBe(word1.palabra);

    // Iniciar segunda partida en el mismo día: no bloquea y elige palabra distinta
    const second = await service.startNewGame(userId);
    expect(second.sesion_id).not.toBe(first.sesion_id);
    expect(second.estado).toBe('en_proceso');
    expect(second.completado_hoy).toBe(true);
    expect(second.partidas_completadas_hoy).toBe(1);

    const activeRow2 = db.attempts.find((a) => a.id === second.sesion_id)!;
    const word2 = catalog.find((w) => w.id === activeRow2.word_id)!;
    expect(word2.palabra).not.toBe(word1.palabra);

    // Perder segunda partida: revela palabra correcta y la 3ra tampoco repite (ni FAUNA duplicada)
    for (let i = 0; i < 6; i++) {
      const guessRes = await service.submitGuess(userId, 'AAAAA', second.sesion_id);
      if (i === 5) {
        expect(guessRes.estado).toBe('perdido');
        expect(guessRes.palabra_correcta).toBe(word2.palabra);
        expect(guessRes.recompensas).toBeNull();
      }
    }

    const third = await service.getTodayGame(userId);
    const activeRow3 = db.attempts.find((a) => a.id === third.sesion_id)!;
    const word3 = catalog.find((w) => w.id === activeRow3.word_id)!;
    expect(word3.palabra).not.toBe(word1.palabra);
    expect(word3.palabra).not.toBe(word2.palabra);

    // Ganar tercera partida (el catálogo único ya tiene 3 palabras: SOLAR, FLORA, FAUNA)
    await service.submitGuess(userId, word3.palabra, third.sesion_id);

    // Cuarta partida en el mismo día reinicia ciclo sin repetir la inmediatamente anterior (word3)
    const fourth = await service.startNewGame(userId);
    const activeRow4 = db.attempts.find((a) => a.id === fourth.sesion_id)!;
    const word4 = catalog.find((w) => w.id === activeRow4.word_id)!;
    expect(word4.palabra).not.toBe(word3.palabra);
  });

  it('aísla pistas compradas por partida y respeta filas legacy sin word_id', async () => {
    const db = new InMemoryWordlePool(
      [
        { id: 1, palabra: 'SOLAR', pista: 'Pista 1' },
        { id: 2, palabra: 'BOSQUE', pista: 'Pista 2' },
      ],
      userId,
      10
    );

    // Fila legacy pre-migración completada hoy con word_id = null (correspondía a id 1 SOLAR)
    db.attempts.push({
      id: 'legacy-1',
      user_id: userId,
      fecha: '2026-11-12',
      intentos: ['SOLAR'],
      estado: 'ganado',
      pista_revelada: true,
      word_id: null,
      created_at: 1,
    });

    const service = new WordleService(db as any);
    const nextGame = await service.getTodayGame(userId);
    const createdRow = db.attempts.find((a) => a.id === nextGame.sesion_id)!;

    // No debe repetir SOLAR del registro legacy sin word_id
    expect(createdRow.word_id).toBe(2);
    expect(nextGame.largo_palabra).toBe(6);
    expect(nextGame.pista_revelada).toBe(false);
    expect(nextGame.completado_hoy).toBe(true);

    // Desbloquear pista en esta partida descuenta 3 monedas
    const hintRes = await service.unlockHint(userId, nextGame.sesion_id);
    expect(hintRes.pista).toBe('Pista 2');
    expect(db.profiles.get(userId)?.monedas).toBe(7);

    // Ganar y abrir otra partida: pista vuelve a false
    await service.submitGuess(userId, 'BOSQUE', nextGame.sesion_id);
    const afterWin = await service.startNewGame(userId);
    expect(afterWin.pista_revelada).toBe(false);
    expect(afterWin.partidas_completadas_hoy).toBe(2);
  });
});
