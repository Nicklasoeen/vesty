import { formatNokFromMinor } from '../../lib/currency.ts';

import {
  VERIFIED_NORDNET_MONTHLY_SAVING_URL,
  VERIFIED_NORDNET_PRODUCT_PAGE_URL,
} from './nordnetHandoffUrl.ts';
import type {
  InvestAttestationIssue,
  InvestJourneyInput,
  InvestJourneySurface,
  InvestLocalBranch,
  InvestReportStage,
  OneTimeHandoffPhase,
} from './presentInvestJourney.ts';
import { presentInvestJourneySurface } from './presentInvestJourney.ts';
import type {
  MonthlySavingPhase,
  MonthlySavingSetup,
  MonthlySavingView,
} from './presentMonthlySavingSetup.ts';
import type { InvestmentDayPlan } from './types.ts';

export interface MonthlySavingGalleryScenario {
  id: string;
  label: string;
  setup: MonthlySavingSetup | null;
  phase: MonthlySavingPhase;
  view: MonthlySavingView;
  introDismissed?: boolean;
  localBranch?: InvestLocalBranch;
  attested?: boolean;
  attestationSaved?: boolean;
  attestationIssue?: InvestAttestationIssue;
  oneTimePhase?: OneTimeHandoffPhase;
  setupError?: string | null;
  setupLoading?: boolean;
  plan?: InvestmentDayPlan | null;
  reportStage?: InvestReportStage;
  largeText?: boolean;
  viewport?: 375 | 402;
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

function currentSetup(overrides: Partial<MonthlySavingSetup> = {}): MonthlySavingSetup {
  return setup({
    status: 'current',
    attestedAt: '2026-09-08T08:00:00.000Z',
    attestedAmountMinor: AMOUNT,
    attestedFundName: DNB_GLOBAL,
    attestedScheduleDayOfMonth: 5,
    ...overrides,
  });
}

function plan(overrides: Partial<InvestmentDayPlan> = {}): InvestmentDayPlan {
  return {
    clubId: 'club',
    clubName: 'Investorgroup',
    membershipId: 'member',
    cycleId: 'cycle',
    investmentDayAt: '2026-10-05T10:00:00.000Z',
    cycleStatus: 'upcoming',
    viewerState: 'upcoming',
    reportingAllowed: false,
    reportingOpensAt: '2026-10-05T10:00:00.000Z',
    reportingClosesAt: '2026-10-06T10:00:00.000Z',
    participationId: null,
    participationOutcome: 'expected',
    expectedAmountMinor: AMOUNT,
    currency: 'NOK',
    allocations: [],
    transactions: [],
    isCompleted: false,
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
  scenario('intro', 'Intro'),
  scenario('not-set-up', 'Not set up', { introDismissed: true, localBranch: 'choose' }),
  scenario('choose', 'Choose rhythm', { introDismissed: true, localBranch: 'choose' }),
  scenario('setup', 'Monthly setup', { introDismissed: true, localBranch: 'monthly' }),
  scenario('returned', 'Return from Nordnet', { phase: 'returned', introDismissed: true, localBranch: 'monthly' }),
  scenario('returned-checked', 'Return · checkbox', {
    phase: 'returned',
    attested: true,
    introDismissed: true,
    localBranch: 'monthly',
  }),
  scenario('confirming', 'Attestation submitting', {
    phase: 'confirming',
    introDismissed: true,
    localBranch: 'monthly',
  }),
  scenario('attestation-timeout', 'Attestation timeout', {
    phase: 'returned',
    attestationIssue: 'timeout',
    attested: true,
    introDismissed: true,
    localBranch: 'monthly',
  }),
  scenario('attestation-error', 'Attestation error', {
    phase: 'returned',
    attestationIssue: 'error',
    attested: true,
    introDismissed: true,
    localBranch: 'monthly',
  }),
  scenario('attestation-conflict', 'Attestation conflict', {
    phase: 'returned',
    attestationIssue: 'conflict',
    attested: true,
    introDismissed: true,
    localBranch: 'monthly',
  }),
  scenario('attestation-saved', 'Attestation saved', {
    setup: currentSetup(),
    attestationSaved: true,
  }),
  scenario('current', 'Current', { setup: currentSetup(), plan: plan() }),
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
  scenario('loading', 'Loading', { setup: null, setupLoading: true, phase: 'idle' }),
  scenario('error', 'Error and retry', { setup: null, setupError: 'Unable to load monthly saving', phase: 'error' }),
  scenario('opening', 'Opening Nordnet', { phase: 'loading', introDismissed: true, localBranch: 'monthly' }),
  scenario('ended', 'Ended setup', { setup: setup({ status: 'not_set_up' }), introDismissed: true }),
  scenario('one-time', 'One-time purchase', { view: 'one_time', localBranch: 'one_time' }),
  scenario('one-time-outside-window', 'One-time · outside window', {
    view: 'one_time',
    oneTimePhase: 'returned',
    plan: plan({ viewerState: 'upcoming', reportingAllowed: false }),
  }),
  scenario('one-time-inside-window', 'One-time · reporting open', {
    view: 'one_time',
    oneTimePhase: 'returned',
    plan: plan({
      viewerState: 'open',
      cycleStatus: 'open',
      reportingAllowed: true,
    }),
  }),
  scenario('investment-day-open', 'Investment Day open', {
    setup: currentSetup(),
    plan: plan({ viewerState: 'open', cycleStatus: 'open', reportingAllowed: true }),
  }),
  scenario('investment-day-report', 'Investment Day · amount', {
    setup: currentSetup(),
    plan: plan({ viewerState: 'open', cycleStatus: 'open', reportingAllowed: true }),
    reportStage: 'choices',
  }),
  scenario('investment-day-upcoming', 'Investment Day upcoming', {
    setup: currentSetup(),
    plan: plan({ viewerState: 'upcoming' }),
  }),
  scenario('reporting-closed', 'Reporting closed', {
    setup: currentSetup(),
    plan: plan({ viewerState: 'closed', cycleStatus: 'closed' }),
  }),
  scenario('long-fund-name', 'Long fund name', {
    introDismissed: true,
    localBranch: 'monthly',
    setup: setup({
      fundName: `${DNB_GLOBAL} — exceptionally long fund name for visual QA of wrapping on monthly saving`,
    }),
  }),
  scenario('long-club-name', 'Long club name', {
    setup: currentSetup(),
    plan: plan({
      clubName: 'The Friday Morning Global Index Habit Club with an extra long name',
    }),
  }),
  scenario('large-text', 'Large text', {
    largeText: true,
    phase: 'returned',
    introDismissed: true,
    localBranch: 'monthly',
  }),
  scenario('iphone-17', 'iPhone 17 Pro width', {
    viewport: 402,
    introDismissed: true,
    localBranch: 'choose',
  }),
  scenario('reduce-motion', 'Reduced motion', {
    introDismissed: false,
  }),
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

export function galleryMonthlySavingUsesProductionJourney(): true {
  return true;
}

export function galleryMonthlySavingAmountLabel(): string {
  return formatNokFromMinor(AMOUNT);
}

export function presentGalleryInvestJourneyInput(
  scenario: MonthlySavingGalleryScenario,
): InvestJourneyInput {
  return {
    hasClub: true,
    clubsLoading: false,
    setup: scenario.setup,
    setupLoading: scenario.setupLoading === true,
    setupError: scenario.setupError ?? null,
    monthlyPhase: scenario.phase,
    oneTimePhase: scenario.oneTimePhase ?? 'idle',
    introDismissed: scenario.introDismissed === true,
    localBranch: scenario.localBranch ?? (scenario.view === 'one_time' ? 'one_time' : null),
    attested: scenario.attested === true,
    attestationSaved: scenario.attestationSaved === true,
    attestationIssue: scenario.attestationIssue ?? null,
    openedMonthlyUrl: scenario.phase === 'returned' || Boolean(scenario.attestationIssue),
    plan: scenario.plan ?? null,
    planLoading: false,
    planError: null,
    planSetupRequired: scenario.setup?.status === 'setup_required',
    reportStage: scenario.reportStage ?? 'idle',
    reportCompleted: false,
  };
}

export function presentGalleryInvestJourneySurface(
  scenario: MonthlySavingGalleryScenario,
): InvestJourneySurface {
  return presentInvestJourneySurface(presentGalleryInvestJourneyInput(scenario));
}
