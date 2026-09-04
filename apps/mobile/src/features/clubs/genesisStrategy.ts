import type { AllocationSlice } from '@/ui';

/** Default genesis mix shown in Create Club review. 10000 bps total. */
export const GENESIS_STRATEGY_SPEC = [
  { name: 'Global Index', allocationBps: 4000, position: 1 },
  { name: 'Technology', allocationBps: 3000, position: 2 },
  { name: 'Norway', allocationBps: 1500, position: 3 },
  { name: 'Emerging Markets', allocationBps: 1500, position: 4 },
] as const;

export const GENESIS_STRATEGY_SLICES: AllocationSlice[] = GENESIS_STRATEGY_SPEC.map((item) => ({
  id: item.name,
  label: item.name,
  percentage: item.allocationBps / 100,
}));

export const CLUB_NAME_MAX_LENGTH = 80;

export const V1_BASE_CURRENCY = 'NOK';

export interface GenesisAllocationInput {
  investment_target_id: string;
  allocation_bps: number;
  position: number;
}
