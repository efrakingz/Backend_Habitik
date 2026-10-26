import { describe, expect, it, vi } from 'vitest';
import { BillsService, BillFamilyConflictError, BillPermissionError } from './billsService';

const input = {
  service_type: 'water', provider_code: 'esval', period_start: '2026-10-01', period_end: '2026-10-31',
  consumption: 18, amount_clp: 12000, due_date: '2026-11-08', entry_source: 'manual',
};

function repository(profile: unknown) {
  return {
    getCurrentProfile: vi.fn().mockResolvedValue(profile), create: vi.fn().mockResolvedValue({ id: 'bill-1' }),
    list: vi.fn().mockResolvedValue([]), remove: vi.fn().mockResolvedValue(true), findLatest: vi.fn(),
  };
}

describe('BillsService', () => {
  it('resuelve la familia vigente desde profiles al crear', async () => {
    const repo = repository({ family_id: 'family-db', rol: 'Jefe' });
    const service = new BillsService(repo as never);
    await service.create('user-1', input);
    expect(repo.create).toHaveBeenCalledWith('family-db', input);
  });

  it('permite listar a un miembro, pero no crear', async () => {
    const repo = repository({ family_id: 'family-db', rol: 'Miembro' });
    const service = new BillsService(repo as never);
    await expect(service.list('user-1', {})).resolves.toEqual([]);
    await expect(service.create('user-1', input)).rejects.toBeInstanceOf(BillPermissionError);
  });

  it('reporta conflicto cuando no hay hogar', async () => {
    const service = new BillsService(repository({ family_id: null, rol: 'Jefe' }) as never);
    await expect(service.list('user-1', {})).rejects.toBeInstanceOf(BillFamilyConflictError);
  });
});
