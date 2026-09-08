import { formatNokFromMinor } from '../../lib/currency.ts';

import {
  VERIFIED_NORDNET_MONTHLY_SAVING_URL,
  VERIFIED_NORDNET_PRODUCT_PAGE_URL,
} from './nordnetHandoffUrl.ts';
import type {
  MonthlySavingPhase,
  MonthlySavingSetup,
  MonthlySavingView,
} from './presentMonthlySavingSetup.ts';

export interface MonthlySavingGalleryScenario {
  id: string;
  label: string;
  setup: MonthlySavingSetup;
  phase: MonthlySavingPhase;
  view: MonthlySavingView;
  largeText?: boolean;
}

const DNB_GLOBAL = 'DNB Global Indeks A';
const DNB_ISIN = 'NO0010582984';
const AMOUNT = 200000;

function setup(overrides: Partial<MonthlySavingSetup> = {}): MonthlySavingSetup {
  return {
    status: 'not_set_up',
    provenance: 'member_attested',
    broker: 'nordnet',
    fundName: DNB_GLOBAL,
    isin: DNB_ISIN,
    recommendedAmountMinor: AMOUNT,
    currency: 'NOK',
    recommendedInvestmentDayAt: '2026-10-05T10:00:00.000Z',
    scheduleDayOfMonth: 5,
    monthlySetupUrl: VERIFIED_NORDNET_MONTHLY_SAVING_URL,
    oneTimeProductUrl: VERIFIED_NORDNET_PRODUCT_PAGE_URL,
    attestedAt: null,
    attestedAmountMinor: null,
    attestedFundName: null,
    attestedScheduleDayOfMonth: null,
    amountChanged: false,
    fundChanged: false,
    scheduleChanged: false,
    oneTimeAvailable: true,
    rejectedMonthlyUrl: false,
    rejectedOneTimeUrl: false,
    ...overrides,
  };
}

function scenario(
  id: string,
  label: string,
  overrides: Partial<Omit<MonthlySavingGalleryScenario, 'id' | 'label'>> = {},
): MonthlySavingGalleryScenario {
  return {
    id,
    label,
    setup: setup(),
    phase: 'idle',
    view: 'monthly',
    ...overrides,
  };
}

export const MONTHLY_SAVING_GALLERY_SCENARIOS: readonly MonthlySavingGalleryScenario[] = [
  scenario('not-set-up', 'Not set up'),
  scenario('returned', 'Return from Nordnet', { phase: 'returned' }),
  scenario('current', 'Current', {
    setup: setup({
      status: 'current',
      attestedAt: '2026-09-08T08:00:00.000Z',
      attestedAmountMinor: AMOUNT,
      attestedFundName: DNB_GLOBAL,
      attestedScheduleDayOfMonth: 5,
    }),
  }),
  scenario('needs-update-amount', 'Needs update · amount', {
    setup: setup({
      status: 'needs_update',
      recommendedAmountMinor: 350000,
      attestedAmountMinor: AMOUNT,
      attestedFundName: DNB_GLOBAL,
      attestedScheduleDayOfMonth: 5,
      attestedAt: '2026-09-01T08:00:00.000Z',
      amountChanged: true,
    }),
  }),
  scenario('needs-update-schedule', 'Needs update · schedule', {
    setup: setup({
      status: 'needs_update',
      scheduleDayOfMonth: 12,
      attestedAmountMinor: AMOUNT,
      attestedFundName: DNB_GLOBAL,
      attestedScheduleDayOfMonth: 5,
      attestedAt: '2026-09-01T08:00:00.000Z',
      scheduleChanged: true,
    }),
  }),
  scenario('setup-required', 'Setup required', {
    setup: setup({
      status: 'setup_required',
      recommendedAmountMinor: null,
      monthlySetupUrl: VERIFIED_NORDNET_MONTHLY_SAVING_URL,
    }),
  }),
  scenario('unavailable', 'Unavailable', {
    setup: setup({
      status: 'unavailable',
      broker: null,
      monthlySetupUrl: null,
      oneTimeProductUrl: null,
      oneTimeAvailable: false,
    }),
  }),
  scenario('loading', 'Loading', { phase: 'loading' }),
  scenario('error', 'Error and retry', { phase: 'error' }),
  scenario('ended', 'Ended setup', {
    setup: setup({
      status: 'not_set_up',
    }),
  }),
  scenario('one-time', 'One-time purchase', { view: 'one_time' }),
  scenario('long-fund-name', 'Long fund name', {
    setup: setup({
      fundName: `${DNB_GLOBAL} — exceptionally long fund name for visual QA of wrapping on monthly saving`,
    }),
  }),
  scenario('large-text', 'Large text', { largeText: true, phase: 'returned' }),
];

export function getMonthlySavingGalleryScenario(id: string): MonthlySavingGalleryScenario {
  return MONTHLY_SAVING_GALLERY_SCENARIOS.find((item) => item.id === id)
    ?? MONTHLY_SAVING_GALLERY_SCENARIOS[0]!;
}

export function galleryMonthlySavingSendsServerCall(_scenario?: MonthlySavingGalleryScenario): false {
  return false;
}

export function galleryMonthlySavingUsesProductionCards(): true {
  return true;
}

export function galleryMonthlySavingAmountLabel(): string {
  return formatNokFromMinor(AMOUNT);
}
