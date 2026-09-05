import type { AllocationSlice } from '@/ui';

export const CURATED_PACKAGE_IDS = ['world_mix', 'world_america', 'tech_forward'] as const;

export type CuratedPackageId = (typeof CURATED_PACKAGE_IDS)[number];

export type ExposureLabel = 'World' | 'Europe' | 'Emerging Markets' | 'US' | 'Technology';

/**
 * Deterministic catalog IDs seeded in
 * `20260905121758_curated_investment_packages_v1.sql`.
 */
export const CORE_V1_TARGET_IDS = {
  vwce: '31000000-0000-4000-8000-000000000011',
  eunk: '31000000-0000-4000-8000-000000000012',
  is3n: '31000000-0000-4000-8000-000000000013',
  sxr8: '31000000-0000-4000-8000-000000000014',
  sxrv: '31000000-0000-4000-8000-000000000015',
} as const;

export interface CoreV1Target {
  id: string;
  officialName: string;
  shortName: string;
  ticker: string;
  kind: 'etf';
  currency: 'EUR';
  exchange: 'Xetra';
  isin: string;
  exposureLabel: ExposureLabel;
}

export const CORE_V1_TARGETS: readonly CoreV1Target[] = [
  {
    id: CORE_V1_TARGET_IDS.vwce,
    officialName: 'Vanguard FTSE All-World UCITS ETF - (USD) Acc',
    shortName: 'Vanguard FTSE All-World',
    ticker: 'VWCE',
    exposureLabel: 'World',
    kind: 'etf',
    currency: 'EUR',
    exchange: 'Xetra',
    isin: 'IE00BK5BQT80',
  },
  {
    id: CORE_V1_TARGET_IDS.eunk,
    officialName: 'iShares Core MSCI Europe UCITS ETF EUR (Acc)',
    shortName: 'iShares Core MSCI Europe',
    ticker: 'EUNK',
    exposureLabel: 'Europe',
    kind: 'etf',
    currency: 'EUR',
    exchange: 'Xetra',
    isin: 'IE00B4K48X80',
  },
  {
    id: CORE_V1_TARGET_IDS.is3n,
    officialName: 'iShares Core MSCI EM IMI UCITS ETF USD (Acc)',
    shortName: 'iShares Core MSCI EM',
    ticker: 'IS3N',
    exposureLabel: 'Emerging Markets',
    kind: 'etf',
    currency: 'EUR',
    exchange: 'Xetra',
    isin: 'IE00BKM4GZ66',
  },
  {
    id: CORE_V1_TARGET_IDS.sxr8,
    officialName: 'iShares Core S&P 500 UCITS ETF USD (Acc)',
    shortName: 'iShares Core S&P 500',
    ticker: 'SXR8',
    exposureLabel: 'US',
    kind: 'etf',
    currency: 'EUR',
    exchange: 'Xetra',
    isin: 'IE00B5BMR087',
  },
  {
    id: CORE_V1_TARGET_IDS.sxrv,
    officialName: 'iShares NASDAQ 100 UCITS ETF USD (Acc)',
    shortName: 'iShares NASDAQ 100',
    ticker: 'SXRV',
    exposureLabel: 'Technology',
    kind: 'etf',
    currency: 'EUR',
    exchange: 'Xetra',
    isin: 'IE00B53SZB19',
  },
] as const;

export interface PackageAllocation {
  targetId: string;
  allocationBps: number;
  position: number;
  exposureLabel: ExposureLabel;
}

export interface CuratedInvestmentPackage {
  id: CuratedPackageId;
  displayName: string;
  shortDescription: string;
  relativePosition: string;
  allocations: readonly PackageAllocation[];
}

export const CURATED_INVESTMENT_PACKAGES: readonly CuratedInvestmentPackage[] = [
  {
    id: 'world_mix',
    displayName: 'World Mix',
    shortDescription: 'Broad global exposure with added emphasis on Europe and emerging markets.',
    relativePosition: 'Broadest mix',
    allocations: [
      { targetId: CORE_V1_TARGET_IDS.vwce, allocationBps: 6000, position: 1, exposureLabel: 'World' },
      { targetId: CORE_V1_TARGET_IDS.eunk, allocationBps: 2500, position: 2, exposureLabel: 'Europe' },
      { targetId: CORE_V1_TARGET_IDS.is3n, allocationBps: 1500, position: 3, exposureLabel: 'Emerging Markets' },
    ],
  },
  {
    id: 'world_america',
    displayName: 'World + America',
    shortDescription: 'Global exposure with a stronger tilt toward large US companies.',
    relativePosition: 'More US exposure',
    allocations: [
      { targetId: CORE_V1_TARGET_IDS.vwce, allocationBps: 5000, position: 1, exposureLabel: 'World' },
      { targetId: CORE_V1_TARGET_IDS.sxr8, allocationBps: 3000, position: 2, exposureLabel: 'US' },
      { targetId: CORE_V1_TARGET_IDS.eunk, allocationBps: 1000, position: 3, exposureLabel: 'Europe' },
      { targetId: CORE_V1_TARGET_IDS.is3n, allocationBps: 1000, position: 4, exposureLabel: 'Emerging Markets' },
    ],
  },
  {
    id: 'tech_forward',
    displayName: 'Tech Forward',
    shortDescription: 'Global exposure with a larger technology and growth tilt.',
    relativePosition: 'More tech exposure',
    allocations: [
      { targetId: CORE_V1_TARGET_IDS.vwce, allocationBps: 4000, position: 1, exposureLabel: 'World' },
      { targetId: CORE_V1_TARGET_IDS.sxrv, allocationBps: 3500, position: 2, exposureLabel: 'Technology' },
      { targetId: CORE_V1_TARGET_IDS.sxr8, allocationBps: 1500, position: 3, exposureLabel: 'US' },
      { targetId: CORE_V1_TARGET_IDS.is3n, allocationBps: 1000, position: 4, exposureLabel: 'Emerging Markets' },
    ],
  },
] as const;

const TARGETS_BY_ID = new Map(CORE_V1_TARGETS.map((target) => [target.id, target]));
const PACKAGES_BY_ID = new Map(CURATED_INVESTMENT_PACKAGES.map((item) => [item.id, item]));

export function isCuratedPackageId(value: unknown): value is CuratedPackageId {
  return typeof value === 'string' && (CURATED_PACKAGE_IDS as readonly string[]).includes(value);
}

export function getCuratedPackage(id: CuratedPackageId): CuratedInvestmentPackage {
  const selected = PACKAGES_BY_ID.get(id);
  if (!selected) {
    throw new Error('Unknown curated package');
  }
  return selected;
}

export function getCoreV1Target(targetId: string): CoreV1Target {
  const target = TARGETS_BY_ID.get(targetId);
  if (!target) {
    throw new Error('Unknown core V1 target');
  }
  return target;
}

export function findCoreV1Target(targetId: string): CoreV1Target | null {
  return TARGETS_BY_ID.get(targetId) ?? null;
}

export function packageAllocationBpsTotal(item: CuratedInvestmentPackage): number {
  return item.allocations.reduce((sum, allocation) => sum + allocation.allocationBps, 0);
}

export function packageExposureSlices(item: CuratedInvestmentPackage): AllocationSlice[] {
  return item.allocations.map((allocation) => ({
    id: allocation.exposureLabel,
    label: allocation.exposureLabel,
    percentage: allocation.allocationBps / 100,
  }));
}

export function packageHoldingLines(item: CuratedInvestmentPackage): { id: string; name: string; ticker: string }[] {
  return item.allocations.map((allocation) => {
    const target = getCoreV1Target(allocation.targetId);
    return {
      id: target.id,
      name: target.officialName,
      ticker: target.ticker,
    };
  });
}

export function compactAllocationPreview(item: CuratedInvestmentPackage): string {
  return item.allocations
    .map((allocation) => `${allocation.allocationBps / 100}% ${allocation.exposureLabel}`)
    .join(' · ');
}
