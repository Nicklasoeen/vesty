import { formatNokFromMinor } from '../../lib/currency.ts';

import type { BrokerHandoffAvailability, BrokerHandoffPhase } from './presentInvestmentDayBrokerHandoff.ts';

export interface InvestmentDayHandoffGalleryScenario {
  id: string;
  label: string;
  availability: BrokerHandoffAvailability;
  phase: BrokerHandoffPhase;
  fundName: string | null;
  isin: string | null;
  plannedAmountLabel: string;
  largeText?: boolean;
}

const DNB_GLOBAL = 'DNB Global Indeks A';
const DNB_ISIN = 'NO0010582984';
const PLANNED = formatNokFromMinor(200000);

function scenario(
  id: string,
  label: string,
  overrides: Partial<Omit<InvestmentDayHandoffGalleryScenario, 'id' | 'label'>> = {},
): InvestmentDayHandoffGalleryScenario {
  return {
    id,
    label,
    availability: 'nordnet',
    phase: 'idle',
    fundName: DNB_GLOBAL,
    isin: DNB_ISIN,
    plannedAmountLabel: PLANNED,
    ...overrides,
  };
}

export const INVESTMENT_DAY_HANDOFF_GALLERY_SCENARIOS: readonly InvestmentDayHandoffGalleryScenario[] = [
  scenario('ready', 'Ready for Nordnet'),
  scenario('opening', 'Opening', { phase: 'loading' }),
  scenario('returned', 'Returned', { phase: 'returned' }),
  scenario('link-error', 'Link error', { phase: 'error' }),
  scenario('listing-unavailable', 'Listing unavailable', { phase: 'unavailable' }),
  scenario('other-broker', 'Other broker', {
    availability: 'other',
    phase: 'idle',
  }),
  scenario('long-fund-name', 'Long fund name', {
    fundName: 'DNB Global Indeks A — exceptionally long fund name for visual QA of wrapping on Investment Day',
  }),
  scenario('large-text', 'Large text', { largeText: true, phase: 'returned' }),
];

export function getInvestmentDayHandoffGalleryScenario(id: string): InvestmentDayHandoffGalleryScenario {
  return INVESTMENT_DAY_HANDOFF_GALLERY_SCENARIOS.find((item) => item.id === id)
    ?? INVESTMENT_DAY_HANDOFF_GALLERY_SCENARIOS[0]!;
}

export function galleryHandoffSendsServerCall(_scenario?: InvestmentDayHandoffGalleryScenario): false {
  return false;
}

export function galleryHandoffUsesProductionCard(): true {
  return true;
}
