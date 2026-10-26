import { describe, expect, it } from 'vitest';
import { BillValidationError, consumptionUnitFor, validateBillFilters, validateCreateBill } from './billValidation';

const valid = {
  service_type: 'electricity', provider_code: 'enel_distribucion', period_start: '2026-10-01', period_end: '2026-10-31',
  consumption: 185.4, amount_clp: 27800, due_date: '2026-11-15', entry_source: 'ocr_confirmed',
};

describe('billValidation', () => {
  it('acepta una boleta estructurada confirmada', () => {
    expect(validateCreateBill(valid)).toEqual(valid);
    expect(consumptionUnitFor('electricity')).toBe('kWh');
    expect(consumptionUnitFor('water')).toBe('m3');
  });

  it.each(['image', 'pdf', 'file', 'raw_text', 'ocr_result', 'image_url', 'customer_number', 'meter_number', 'coordinates', 'confidence'])('rechaza %s', (key) => {
    expect(() => validateCreateBill({ ...valid, [key]: 'privado' })).toThrow(BillValidationError);
  });

  it('rechaza proveedor, fechas y montos inválidos', () => {
    expect(() => validateCreateBill({ ...valid, provider_code: 'esval' })).toThrow(BillValidationError);
    expect(() => validateCreateBill({ ...valid, period_start: '2026-02-30' })).toThrow(BillValidationError);
    expect(() => validateCreateBill({ ...valid, period_start: '2026-11-01' })).toThrow(BillValidationError);
    expect(() => validateCreateBill({ ...valid, amount_clp: 12.5 })).toThrow(BillValidationError);
  });

  it('valida los filtros del historial', () => {
    expect(validateBillFilters({ service_type: 'water', from: '2026-01-01', to: '2026-12-31' })).toEqual({ service_type: 'water', from: '2026-01-01', to: '2026-12-31' });
    expect(() => validateBillFilters({ raw_text: 'no' })).toThrow(BillValidationError);
    expect(() => validateBillFilters({ from: '2026-12-31', to: '2026-01-01' })).toThrow(BillValidationError);
  });
});
