import { TRIVIA_CATEGORIES, TriviaDifficulty, TriviaQuestionDraft } from '../models/trivia';
import { normalizarPregunta } from '../services/triviaRules';

export class GeminiUnavailableError extends Error {
  constructor(message = 'La generación de preguntas no está disponible.') {
    super(message);
    this.name = 'GeminiUnavailableError';
  }
}

type Fetcher = typeof fetch;

const prompt = [
  'Genera exactamente 10 preguntas de trivia ambiental para familias chilenas.',
  'Usa lenguaje claro, contexto chileno cuando corresponda y hechos comprobables.',
  'Cada pregunta debe tener cuatro alternativas distintas y una respuesta inequívoca.',
  'La explicación debe enseñar el concepto y tener un máximo de 240 caracteres.',
  'Distribuye las categorías energia, agua, reciclaje, biodiversidad y consumo_responsable.',
  'No incluyas datos personales ni solicites información de usuarios.',
].join(' ');

const schema = {
  type: 'ARRAY',
  minItems: 10,
  maxItems: 10,
  items: {
    type: 'OBJECT',
    required: ['pregunta', 'alternativas', 'correctIndex', 'explicacion', 'categoria', 'dificultad'],
    properties: {
      pregunta: { type: 'STRING' },
      alternativas: { type: 'ARRAY', minItems: 4, maxItems: 4, items: { type: 'STRING' } },
      correctIndex: { type: 'INTEGER', minimum: 0, maximum: 3 },
      explicacion: { type: 'STRING', maxLength: 240 },
      categoria: { type: 'STRING', enum: [...TRIVIA_CATEGORIES] },
      dificultad: { type: 'STRING', enum: ['facil', 'media', 'dificil'] },
    },
  },
};

function isDifficulty(value: unknown): value is TriviaDifficulty {
  return value === 'facil' || value === 'media' || value === 'dificil';
}

function validateQuestion(value: unknown): TriviaQuestionDraft {
  if (!value || typeof value !== 'object') throw new GeminiUnavailableError('Gemini devolvió una pregunta inválida.');
  const item = value as Record<string, unknown>;
  if (typeof item.pregunta !== 'string' || item.pregunta.trim() === '') throw new GeminiUnavailableError('Gemini devolvió una pregunta inválida.');
  if (!Array.isArray(item.alternativas) || item.alternativas.length !== 4 || item.alternativas.some((option) => typeof option !== 'string' || option.trim() === '')) {
    throw new GeminiUnavailableError('Gemini devolvió alternativas inválidas.');
  }
  const alternatives = item.alternativas as string[];
  if (new Set(alternatives.map(normalizarPregunta)).size !== 4) throw new GeminiUnavailableError('Gemini devolvió alternativas repetidas.');
  if (!Number.isInteger(item.correctIndex) || Number(item.correctIndex) < 0 || Number(item.correctIndex) > 3) {
    throw new GeminiUnavailableError('Gemini devolvió un índice inválido.');
  }
  if (typeof item.explicacion !== 'string' || item.explicacion.trim() === '' || item.explicacion.length > 240) {
    throw new GeminiUnavailableError('Gemini devolvió una explicación inválida.');
  }
  if (!TRIVIA_CATEGORIES.includes(item.categoria as never)) throw new GeminiUnavailableError('Gemini devolvió una categoría inválida.');
  if (!isDifficulty(item.dificultad)) throw new GeminiUnavailableError('Gemini devolvió una dificultad inválida.');

  return {
    pregunta: item.pregunta.trim(),
    alternativas: alternatives.map((option) => option.trim()) as [string, string, string, string],
    correctIndex: Number(item.correctIndex),
    explicacion: item.explicacion.trim(),
    categoria: item.categoria as TriviaQuestionDraft['categoria'],
    dificultad: item.dificultad,
  };
}

export class GeminiTriviaClient {
  constructor(private readonly fetcher: Fetcher = fetch) {}

  async generateQuestions(): Promise<TriviaQuestionDraft[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new GeminiUnavailableError();

    const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    try {
      const response = await this.fetcher(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(12_000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: schema,
          },
        }),
      });

      if (!response.ok) throw new GeminiUnavailableError(`Gemini no respondió correctamente (${response.status}).`);
      const body = await response.json() as Record<string, unknown>;
      const text = (((body.candidates as Array<Record<string, unknown>> | undefined)?.[0]?.content as Record<string, unknown> | undefined)?.parts as Array<Record<string, unknown>> | undefined)?.[0]?.text;
      if (typeof text !== 'string') throw new GeminiUnavailableError('Gemini no entregó contenido utilizable.');
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed) || parsed.length !== 10) throw new GeminiUnavailableError('Gemini no entregó diez preguntas.');
      return parsed.map(validateQuestion);
    } catch (error) {
      if (error instanceof GeminiUnavailableError) throw error;
      throw new GeminiUnavailableError();
    }
  }
}

export const geminiTriviaClient = new GeminiTriviaClient();
