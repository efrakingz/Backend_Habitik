import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiTriviaClient, GeminiUnavailableError } from './geminiTriviaClient';

const question = {
  pregunta: '¿Qué acción ahorra energía en el hogar?',
  alternativas: ['Apagar luces', 'Abrir el horno', 'Usar secadora', 'Dejar equipos encendidos'],
  correctIndex: 0,
  explicacion: 'Apagar luces que no se usan reduce el consumo eléctrico.',
  categoria: 'energia',
  dificultad: 'facil',
};

function successResponse(items = Array.from({ length: 10 }, (_, index) => ({ ...question, pregunta: `${question.pregunta} ${index}` }))) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(items) }] } }] }),
  } as Response;
}

describe('GeminiTriviaClient', () => {
  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    vi.restoreAllMocks();
  });

  it('devuelve diez preguntas válidas y no envía datos personales', async () => {
    process.env.GEMINI_API_KEY = 'clave-secreta';
    const fetcher = vi.fn().mockResolvedValue(successResponse());
    const result = await new GeminiTriviaClient(fetcher).generateQuestions();

    expect(result).toHaveLength(10);
    const request = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    const sentPrompt = request.contents[0].parts[0].text;
    expect(sentPrompt).not.toMatch(/user_id|family_id|correo|nombre del usuario/i);
    expect(request.generationConfig.responseMimeType).toBe('application/json');
  });

  it.each([
    [{ ...question, alternativas: ['A', 'B', 'C'] }, 'alternativas'],
    [{ ...question, alternativas: ['A', 'A', 'B', 'C'] }, 'repetidas'],
    [{ ...question, correctIndex: 4 }, 'índice'],
    [{ ...question, categoria: 'otro' }, 'categoría'],
  ])('rechaza contenido inválido: %s', async (invalid, expected) => {
    process.env.GEMINI_API_KEY = 'clave-secreta';
    const items = Array.from({ length: 10 }, (_, index) => ({ ...question, pregunta: `${question.pregunta} ${index}` }));
    items[0] = invalid;
    const client = new GeminiTriviaClient(vi.fn().mockResolvedValue(successResponse(items)));
    await expect(client.generateQuestions()).rejects.toThrow(expected);
  });

  it.each([429, 500])('convierte el estado %s en un error controlado sin filtrar la clave', async (status) => {
    process.env.GEMINI_API_KEY = 'clave-super-secreta';
    const client = new GeminiTriviaClient(vi.fn().mockResolvedValue({ ok: false, status } as Response));
    await expect(client.generateQuestions()).rejects.toSatisfy((error: Error) => {
      expect(error).toBeInstanceOf(GeminiUnavailableError);
      expect(error.message).not.toContain('clave-super-secreta');
      return true;
    });
  });

  it('controla timeout y clave ausente', async () => {
    const unavailable = new GeminiTriviaClient(vi.fn());
    await expect(unavailable.generateQuestions()).rejects.toBeInstanceOf(GeminiUnavailableError);

    process.env.GEMINI_API_KEY = 'clave-secreta';
    const timeout = new GeminiTriviaClient(vi.fn().mockRejectedValue(new DOMException('Timeout', 'TimeoutError')));
    await expect(timeout.generateQuestions()).rejects.toBeInstanceOf(GeminiUnavailableError);
  });
});
