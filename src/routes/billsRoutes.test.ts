import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { BillFamilyConflictError, BillNotFoundError, BillPermissionError } from '../services/billsService';
import { createBillsRouter } from './billsRoutes';

const token = jwt.sign({ user_id: 'user-from-token', family_id: 'stale-family', role: 'admin' }, process.env.JWT_SECRET || 'super_secret_jwt_key_12345');
const billId = '11111111-1111-4111-8111-111111111111';
const body = {
  service_type: 'electricity', provider_code: 'cge', period_start: '2026-10-01', period_end: '2026-10-31',
  consumption: 110, amount_clp: 22000, due_date: '2026-11-12', entry_source: 'manual',
};

function service() {
  return { create: vi.fn().mockResolvedValue({ id: billId }), list: vi.fn().mockResolvedValue([]), remove: vi.fn().mockResolvedValue(undefined) };
}

function appFor(mockService: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use('/bills', createBillsRouter(mockService as never));
  return app;
}

describe('rutas de boletas', () => {
  it.each([['post', '/bills'], ['get', '/bills'], ['delete', `/bills/${billId}`]] as const)('%s requiere JWT', async (method, path) => {
    expect((await request(appFor(service()))[method](path)).status).toBe(401);
  });

  it('usa el usuario del token y no acepta datos de archivo', async () => {
    const mock = service();
    const response = await request(appFor(mock))
      .post('/bills').set('Authorization', `Bearer ${token}`).send({ ...body, image: 'no' });
    expect(response.status).toBe(201);
    expect(mock.create).toHaveBeenCalledWith('user-from-token', { ...body, image: 'no' });
  });

  it('mapea permisos, familia y boleta ajena a códigos seguros', async () => {
    const forbidden = service();
    forbidden.create.mockRejectedValue(new BillPermissionError('No permitido'));
    expect((await request(appFor(forbidden)).post('/bills').set('Authorization', `Bearer ${token}`).send(body)).status).toBe(403);

    const noFamily = service();
    noFamily.list.mockRejectedValue(new BillFamilyConflictError('Sin hogar'));
    expect((await request(appFor(noFamily)).get('/bills').set('Authorization', `Bearer ${token}`)).status).toBe(409);

    const missing = service();
    missing.remove.mockRejectedValue(new BillNotFoundError('No encontrada'));
    expect((await request(appFor(missing)).delete(`/bills/${billId}`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
  });

  it('rechaza id no válido antes de llegar al servicio', async () => {
    const mock = service();
    const response = await request(appFor(mock)).delete('/bills/no-es-uuid').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(400);
    expect(mock.remove).not.toHaveBeenCalled();
  });
});
