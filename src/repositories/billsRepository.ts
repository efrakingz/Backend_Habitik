import { Pool } from 'pg';
import { pool } from '../config/db';
import { BillFilters, BillRecord, CreateBillInput, CurrentBillProfile } from '../models/bill';
import { consumptionUnitFor } from '../services/billValidation';

export class BillsRepository {
  constructor(private readonly database: Pick<Pool, 'query'> = pool) {}

  async getCurrentProfile(userId: string): Promise<CurrentBillProfile | null> {
    const result = await this.database.query('SELECT family_id, rol FROM public.profiles WHERE id = $1;', [userId]);
    return result.rows[0] ?? null;
  }

  async create(familyId: string, input: CreateBillInput): Promise<BillRecord> {
    const result = await this.database.query(`
      INSERT INTO public.bills (
        family_id, service_type, provider_code, period_start, period_end, consumption,
        consumption_unit, amount_clp, due_date, entry_source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, family_id, service_type, provider_code, period_start, period_end, consumption,
                consumption_unit, amount_clp, due_date, entry_source, created_at, updated_at;
    `, [
      familyId, input.service_type, input.provider_code, input.period_start, input.period_end, input.consumption,
      consumptionUnitFor(input.service_type), input.amount_clp, input.due_date, input.entry_source,
    ]);
    return result.rows[0] as BillRecord;
  }

  async list(familyId: string, filters: BillFilters): Promise<BillRecord[]> {
    const values: unknown[] = [familyId];
    const clauses = ['family_id = $1'];
    if (filters.service_type) {
      values.push(filters.service_type);
      clauses.push(`service_type = $${values.length}`);
    }
    if (filters.from) {
      values.push(filters.from);
      clauses.push(`period_end >= $${values.length}`);
    }
    if (filters.to) {
      values.push(filters.to);
      clauses.push(`period_end <= $${values.length}`);
    }
    const result = await this.database.query(`
      SELECT id, family_id, service_type, provider_code, period_start, period_end, consumption,
             consumption_unit, amount_clp, due_date, entry_source, created_at, updated_at
      FROM public.bills
      WHERE ${clauses.join(' AND ')}
      ORDER BY period_end DESC, created_at DESC;
    `, values);
    return result.rows as BillRecord[];
  }

  async remove(familyId: string, billId: string): Promise<boolean> {
    const result = await this.database.query('DELETE FROM public.bills WHERE id = $1 AND family_id = $2;', [billId, familyId]);
    return (result.rowCount ?? 0) > 0;
  }

  async findLatest(familyId: string, serviceType: CreateBillInput['service_type']): Promise<BillRecord | null> {
    const result = await this.database.query(`
      SELECT id, family_id, service_type, provider_code, period_start, period_end, consumption,
             consumption_unit, amount_clp, due_date, entry_source, created_at, updated_at
      FROM public.bills
      WHERE family_id = $1 AND service_type = $2
      ORDER BY period_end DESC, created_at DESC
      LIMIT 1;
    `, [familyId, serviceType]);
    return result.rows[0] ?? null;
  }
}

export const billsRepository = new BillsRepository();
