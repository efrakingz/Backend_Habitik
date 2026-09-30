import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { TriviaConflictError, TriviaNotFoundError } from '../services/triviaService';
import { createTriviaRouter } from './triviaRoutes';

const sessionId = '11111111-1111-4111-8111-111111111111';
const questionId = '22222222-2222-4222-8222-222222222222';
const token = jwt.sign({ user_id: 'user-from-token', family_id: null, role: 'miembro' }, 'super_secret_jwt_key_12345');

function createTestApp(service: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use('/trivia', createTriviaRouter(service as never));
  return app;
}

function mockService() {
  return {
    iniciar: vi.fn().mockResolvedValue({ created: true, session: { sesion_id: sessionId, vidas: 3 } }),
    obtenerPregunta: vi.fn().mockResolvedValue({
      pregunta_id: questionId, pregunta: 'Pregunta', alternativas: ['A', 'B', 'C', 'D'],
      categoria: 'energia', dificultad: 'facil', limite_segundos: 30,
      iniciada_en: '2026-09-29T10:00:00.000Z', correctIndex: 0, explicacion: 'Privada',
    }),
    responder: vi.fn().mockResolvedValue({ correcta: true }),
    comprarVidaExtra: vi.fn().mockResolvedValue({ vidas: 1 }),
    finalizar: vi.fn().mockResolvedValue({ sesion_id: sessionId }),
  };
}

describe('rutas de trivia', () => {
  it.each([
    ['post', '/trivia/iniciar'],
    ['get', `/trivia/pregunta?sesion_id=${sessionId}`],
    ['post', '/trivia/respuesta'],
    ['post', '/trivia/vida-extra'],
    ['post', '/trivia/finalizar'],
  ] as const)('%s %s requiere JWT', async (method, path) => {
    const response = await request(createTestApp(mockService()))[method](path);
    expect(response.status).toBe(401);
  });

  it('usa la identidad del token y no el user_id del body', async () => {
    const service = mockService();
    const response = await request(createTestApp(service))
      .post('/trivia/iniciar')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: 'usuario-falso' });
    expect(response.status).toBe(201);
    expect(service.iniciar).toHaveBeenCalledWith('user-from-token', null);
  });

  it.each([-1, 4, 1.5, '2', undefined])('rechaza opcion_seleccionada inválida: %s', async (selected) => {
    const response = await request(createTestApp(mockService()))
      .post('/trivia/respuesta')
      .set('Authorization', `Bearer ${token}`)
      .send({ sesion_id: sessionId, pregunta_id: questionId, opcion_seleccionada: selected });
    expect(response.status).toBe(400);
  });

  it('acepta null como timeout', async () => {
    const service = mockService();
    const response = await request(createTestApp(service))
      .post('/trivia/respuesta')
      .set('Authorization', `Bearer ${token}`)
      .send({ sesion_id: sessionId, pregunta_id: questionId, opcion_seleccionada: null });
    expect(response.status).toBe(200);
    expect(service.responder).toHaveBeenCalledWith('user-from-token', sessionId, questionId, null);
  });

  it('rechaza UUID inválido', async () => {
    const response = await request(createTestApp(mockService()))
      .get('/trivia/pregunta?sesion_id=no-es-uuid')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
  });

  it('convierte partida ajena en 404 y conflicto de reglas en 409', async () => {
    const missing = mockService();
    missing.finalizar.mockRejectedValue(new TriviaNotFoundError('Partida no encontrada.'));
    const missingResponse = await request(createTestApp(missing))
      .post('/trivia/finalizar').set('Authorization', `Bearer ${token}`).send({ sesion_id: sessionId });
    expect(missingResponse.status).toBe(404);

    const conflict = mockService();
    conflict.comprarVidaExtra.mockRejectedValue(new TriviaConflictError('Todavía hay vidas.'));
    const conflictResponse = await request(createTestApp(conflict))
      .post('/trivia/vida-extra').set('Authorization', `Bearer ${token}`).send({ sesion_id: sessionId });
    expect(conflictResponse.status).toBe(409);
  });

  it('no expone la respuesta correcta ni la explicación al entregar una pregunta', async () => {
    const response = await request(createTestApp(mockService()))
      .get(`/trivia/pregunta?sesion_id=${sessionId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty('correctIndex');
    expect(response.body).not.toHaveProperty('correct_index');
    expect(response.body).not.toHaveProperty('explicacion');
  });
});
