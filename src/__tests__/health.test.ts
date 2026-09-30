import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../app';

describe('GET /', () => {
  it('informa que la API está disponible', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('online');
    expect(response.body.endpoints.public.login).toBe('POST /auth/login');
    expect(response.body.endpoints.authenticated.ecoPuzzle).toBe('POST /eco/completar');
  });
});
