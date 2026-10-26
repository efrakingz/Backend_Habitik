export const billServiceTypes = ['electricity', 'water'] as const;
export const billEntrySources = ['ocr_confirmed', 'manual'] as const;

export type BillServiceType = typeof billServiceTypes[number];
export type BillEntrySource = typeof billEntrySources[number];
export type BillConsumptionUnit = 'kWh' | 'm3';

export interface CreateBillInput {
  service_type: BillServiceType;
  provider_code: string;
  period_start: string;
  period_end: string;
  consumption: number;
  amount_clp: number;
  due_date: string;
  entry_source: BillEntrySource;
}

export interface BillFilters {
  service_type?: BillServiceType;
  from?: string;
  to?: string;
}

export interface BillRecord extends CreateBillInput {
  id: string;
  family_id: string;
  consumption_unit: BillConsumptionUnit;
  created_at: string;
  updated_at: string;
}

export interface CurrentBillProfile {
  family_id: string | null;
  rol: string | null;
}
