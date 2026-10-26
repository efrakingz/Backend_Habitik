import { isProviderForService } from '../data/billProviders';
import { BillConsumptionUnit, BillEntrySource, BillFilters, BillServiceType, CreateBillInput, billEntrySources, billServiceTypes } from '../models/bill';

export class BillValidationError extends Error {}

const bodyKeys = new Set<keyof CreateBillInput>([
  'service_type', 'provider_code', 'period_start', 'period_end', 'consumption', 'amount_clp', 'due_date', 'entry_source',
]);

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validServiceType(value: unknown): value is BillServiceType {
  return typeof value === 'string' && (billServiceTypes as readonly string[]).includes(value);
}

function validEntrySource(value: unknown): value is BillEntrySource {
  return typeof value === 'string' && (billEntrySources as readonly string[]).includes(value);
}

export function consumptionUnitFor(serviceType: BillServiceType): BillConsumptionUnit {
  return serviceType === 'electricity' ? 'kWh' : 'm3';
}

export function validateCreateBill(body: unknown): CreateBillInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BillValidationError('El cuerpo debe ser un objeto con los datos confirmados.');
  }
  const payload = body as Record<string, unknown>;
  const extraKeys = Object.keys(payload).filter((key) => !bodyKeys.has(key as keyof CreateBillInput));
  if (extraKeys.length > 0) {
    throw new BillValidationError(`Campos no permitidos: ${extraKeys.join(', ')}.`);
  }
  if (Object.keys(payload).length !== bodyKeys.size) {
    throw new BillValidationError('Todos los campos de la boleta confirmada son obligatorios.');
  }
  if (!validServiceType(payload.service_type)) {
    throw new BillValidationError('service_type debe ser electricity o water.');
  }
  if (typeof payload.provider_code !== 'string' || !isProviderForService(payload.provider_code, payload.service_type)) {
    throw new BillValidationError('provider_code no corresponde al tipo de servicio.');
  }
  if (!isIsoDate(payload.period_start) || !isIsoDate(payload.period_end) || !isIsoDate(payload.due_date)) {
    throw new BillValidationError('Las fechas deben usar formato ISO YYYY-MM-DD y ser reales.');
  }
  if (payload.period_start > payload.period_end) {
    throw new BillValidationError('period_start no puede ser posterior a period_end.');
  }
  if (payload.due_date < payload.period_end) {
    throw new BillValidationError('due_date no puede ser anterior al fin del período.');
  }
  if (typeof payload.consumption !== 'number' || !Number.isFinite(payload.consumption) || payload.consumption <= 0) {
    throw new BillValidationError('consumption debe ser un número positivo.');
  }
  if (typeof payload.amount_clp !== 'number' || !Number.isSafeInteger(payload.amount_clp) || payload.amount_clp < 0) {
    throw new BillValidationError('amount_clp debe ser un entero no negativo.');
  }
  if (!validEntrySource(payload.entry_source)) {
    throw new BillValidationError('entry_source debe ser ocr_confirmed o manual.');
  }
  return {
    service_type: payload.service_type,
    provider_code: payload.provider_code,
    period_start: payload.period_start,
    period_end: payload.period_end,
    consumption: payload.consumption,
    amount_clp: payload.amount_clp,
    due_date: payload.due_date,
    entry_source: payload.entry_source,
  };
}

export function validateBillFilters(query: unknown): BillFilters {
  const value = query as Record<string, unknown>;
  const allowed = new Set(['service_type', 'from', 'to']);
  const extraKeys = Object.keys(value).filter((key) => !allowed.has(key));
  if (extraKeys.length > 0) throw new BillValidationError(`Filtros no permitidos: ${extraKeys.join(', ')}.`);
  if (value.service_type !== undefined && !validServiceType(value.service_type)) {
    throw new BillValidationError('service_type debe ser electricity o water.');
  }
  if (value.from !== undefined && !isIsoDate(value.from)) throw new BillValidationError('from debe ser una fecha ISO válida.');
  if (value.to !== undefined && !isIsoDate(value.to)) throw new BillValidationError('to debe ser una fecha ISO válida.');
  if (typeof value.from === 'string' && typeof value.to === 'string' && value.from > value.to) {
    throw new BillValidationError('from no puede ser posterior a to.');
  }
  return {
    service_type: value.service_type as BillServiceType | undefined,
    from: value.from as string | undefined,
    to: value.to as string | undefined,
  };
}
