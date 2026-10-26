import { BillFilters, BillRecord, CreateBillInput } from '../models/bill';
import { BillsRepository, billsRepository } from '../repositories/billsRepository';
import { validateBillFilters, validateCreateBill } from './billValidation';

export class BillPermissionError extends Error {}
export class BillFamilyConflictError extends Error {}
export class BillNotFoundError extends Error {}

export class BillsService {
  constructor(private readonly repository: BillsRepository = billsRepository) {}

  private async familyFor(userId: string, mustBeAdmin: boolean): Promise<string> {
    const profile = await this.repository.getCurrentProfile(userId);
    if (!profile?.family_id) throw new BillFamilyConflictError('El usuario no pertenece a un hogar.');
    const role = profile.rol?.toLowerCase();
    if (mustBeAdmin && role !== 'jefe' && role !== 'admin') {
      throw new BillPermissionError('Solo el Jefe de Hogar puede administrar boletas.');
    }
    return profile.family_id;
  }

  async create(userId: string, body: unknown): Promise<BillRecord> {
    const input = validateCreateBill(body);
    const familyId = await this.familyFor(userId, true);
    return this.repository.create(familyId, input);
  }

  async list(userId: string, query: unknown): Promise<BillRecord[]> {
    const filters = validateBillFilters(query);
    const familyId = await this.familyFor(userId, false);
    return this.repository.list(familyId, filters);
  }

  async remove(userId: string, billId: string): Promise<void> {
    const familyId = await this.familyFor(userId, true);
    const removed = await this.repository.remove(familyId, billId);
    if (!removed) throw new BillNotFoundError('Boleta no encontrada.');
  }

  async findLatest(userId: string, serviceType: CreateBillInput['service_type']): Promise<BillRecord | null> {
    const familyId = await this.familyFor(userId, false);
    return this.repository.findLatest(familyId, serviceType);
  }
}

export const billsService = new BillsService();
