import { BillServiceType } from '../models/bill';

const providers: Record<BillServiceType, readonly string[]> = {
  electricity: ['cge', 'enel_distribucion', 'chilquinta', 'saesa'],
  water: ['aguas_andinas', 'essbio', 'esval', 'suralis'],
};

export function isProviderForService(providerCode: string, serviceType: BillServiceType): boolean {
  return providers[serviceType].includes(providerCode);
}
