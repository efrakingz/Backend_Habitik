import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../app';

describe('Flujo de Recuperación de Contraseña — /auth', () => {
  it('rechaza solicitud de código con correo inválido o vacío (400)', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'correo-invalido' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Ingresa un correo electrónico válido');
  });

  it('rechaza solicitud para un correo que no existe en el sistema (404)', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'usuario_inexistente_9999@test.com' });

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('No existe ninguna cuenta registrada');
  });

  it('rechaza verificación sin código o correo (400)', async () => {
    const res = await request(app)
      .post('/auth/verify-reset-code')
      .send({ email: 'test@test.com' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('requeridos');
  });

  it('rechaza verificación con código erróneo (400)', async () => {
    const res = await request(app)
      .post('/auth/verify-reset-code')
      .send({ email: 'test@test.com', code: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Código incorrecto');
  });

  it('rechaza restablecer contraseña con menos de 6 caracteres (400)', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({
        email: 'test@test.com',
        code: '123456',
        newPassword: '123'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('al menos 6 caracteres');
  });
});
