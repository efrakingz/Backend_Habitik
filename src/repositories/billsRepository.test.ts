import { describe, expect, it, vi } from 'vitest';
import { BillsRepository } from './billsRepository';

describe('BillsRepository', () => {
  it('deriva la unidad y lista sin SELECT *', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'bill-1' }], rowCount: 1 });
    const repository = new BillsRepository({ query } as never);
    await repository.create('family-1', {
      service_type: 'electricity', provider_code: 'cge', period_start: '2026-10-01', period_end: '2026-10-31',
      consumption: 12, amount_clp: 1000, due_date: '2026-11-05', entry_source: 'manual',
    });
    expect(query.mock.calls[0][1]).toContain('kWh');

    await repository.list('family-1', { service_type: 'water', from: '2026-01-01' });
    const listSql = String(query.mock.calls[1][0]);
    expect(listSql).toContain('family_id = $1');
    expect(listSql).not.toContain('SELECT *');
    expect(query.mock.calls[1][1]).toEqual(['family-1', 'water', '2026-01-01']);
  });

  it('elimina con id y familia', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const repository = new BillsRepository({ query } as never);
    await expect(repository.remove('family-1', 'bill-1')).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('id = $1 AND family_id = $2'), ['bill-1', 'family-1']);
  });
});
