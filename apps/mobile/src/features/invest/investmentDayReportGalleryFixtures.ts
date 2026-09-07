import { CORE_V1_TARGET_IDS } from '../clubs/curatedInvestmentPackages.ts';

import {
  parseReportedPurchaseKronerInput,
  type InvestmentDayReportChoice,
  type ReportedAmountField,
} from './investmentDayReport.ts';
import {
  parseOptionalExecutionPriceInput,
  parseOptionalQuantityInput,
  type QuantityFieldState,
} from './investmentDayReporting.ts';
import type { InvestmentDayReportSubmitState } from './presentInvestmentDayReport.ts';
import type { InvestTargetRow } from './types.ts';

export interface InvestmentDayReportGalleryScenario {
  id: string;
  label: string;
  view: 'report' | 'pending' | 'completed' | 'legacy';
  choice: InvestmentDayReportChoice;
  submitState: InvestmentDayReportSubmitState;
  error: string | null;
  expectedAmountMinor: number;
  reportedTotalMinor: number;
  outcome: 'expected' | 'confirmed' | 'skipped';
  amountProvenance: 'member_attested_plan' | 'member_reported_actual' | 'legacy_plan_assumed' | null;
  compact?: boolean;
}

const WORLD_MIX_TARGETS: readonly InvestTargetRow[] = [
  {
    id: CORE_V1_TARGET_IDS.vwce,
    label: 'FTSE All-World',
    exposureLabel: 'World',
    ticker: 'VWCE',
    secondaryLabel: 'World',
    allocationBps: 6000,
    amountMinor: 120000,
    quantity: null,
    executionUnitPrice: null,
  },
  {
    id: CORE_V1_TARGET_IDS.eunk,
    label: 'MSCI Europe',
    exposureLabel: 'Europe',
    ticker: 'EUNK',
    secondaryLabel: 'Europe',
    allocationBps: 2500,
    amountMinor: 50000,
    quantity: null,
    executionUnitPrice: null,
  },
  {
    id: CORE_V1_TARGET_IDS.is3n,
    label: 'MSCI EM IMI',
    exposureLabel: 'Emerging Markets',
    ticker: 'IS3N',
    secondaryLabel: 'Emerging Markets',
    allocationBps: 1500,
    amountMinor: 30000,
    quantity: null,
    executionUnitPrice: null,
  },
];

export function galleryPlanTargets(): readonly InvestTargetRow[] {
  return WORLD_MIX_TARGETS;
}

function emptyAmounts(): Record<string, ReportedAmountField> {
  return {
    [CORE_V1_TARGET_IDS.vwce]: parseReportedPurchaseKronerInput(''),
    [CORE_V1_TARGET_IDS.eunk]: parseReportedPurchaseKronerInput(''),
    [CORE_V1_TARGET_IDS.is3n]: parseReportedPurchaseKronerInput(''),
  };
}

function emptyQuantity(): Record<string, QuantityFieldState> {
  return {
    [CORE_V1_TARGET_IDS.vwce]: parseOptionalQuantityInput(''),
    [CORE_V1_TARGET_IDS.eunk]: parseOptionalQuantityInput(''),
    [CORE_V1_TARGET_IDS.is3n]: parseOptionalQuantityInput(''),
  };
}

function emptyPrices(): Record<string, QuantityFieldState> {
  return {
    [CORE_V1_TARGET_IDS.vwce]: parseOptionalExecutionPriceInput(''),
    [CORE_V1_TARGET_IDS.eunk]: parseOptionalExecutionPriceInput(''),
    [CORE_V1_TARGET_IDS.is3n]: parseOptionalExecutionPriceInput(''),
  };
}

export function galleryAmountFields(scenario: InvestmentDayReportGalleryScenario): Record<string, ReportedAmountField> {
  if (scenario.id === 'partial' || scenario.id === 'different-total') {
    return {
      [CORE_V1_TARGET_IDS.vwce]: parseReportedPurchaseKronerInput('800'),
      [CORE_V1_TARGET_IDS.eunk]: parseReportedPurchaseKronerInput('600'),
      [CORE_V1_TARGET_IDS.is3n]: parseReportedPurchaseKronerInput(scenario.id === 'partial' ? '0' : '200'),
    };
  }
  return emptyAmounts();
}

export function galleryQuantityFields(): Record<string, QuantityFieldState> {
  return emptyQuantity();
}

export function galleryPriceFields(): Record<string, QuantityFieldState> {
  return emptyPrices();
}

function scenario(
  id: string,
  label: string,
  view: InvestmentDayReportGalleryScenario['view'],
  overrides: Partial<Omit<InvestmentDayReportGalleryScenario, 'id' | 'label' | 'view'>> = {},
): InvestmentDayReportGalleryScenario {
  return {
    id,
    label,
    view,
    choice: 'as_planned',
    submitState: 'idle',
    error: null,
    expectedAmountMinor: 200000,
    reportedTotalMinor: 200000,
    outcome: 'expected',
    amountProvenance: null,
    ...overrides,
  };
}

export const INVESTMENT_DAY_REPORT_GALLERY_SCENARIOS: readonly InvestmentDayReportGalleryScenario[] = [
  scenario('as-planned', 'Plan attestation', 'report'),
  scenario('partial', 'Partial purchase', 'report', {
    choice: 'with_changes',
    reportedTotalMinor: 140000,
  }),
  scenario('different-total', 'Different total', 'report', {
    choice: 'with_changes',
    reportedTotalMinor: 160000,
  }),
  scenario('skipped', 'Skipped', 'completed', {
    choice: 'skipped',
    reportedTotalMinor: 0,
    outcome: 'skipped',
  }),
  scenario('pending', 'Pending order', 'pending', { choice: 'pending', reportedTotalMinor: 0 }),
  scenario('loading', 'Loading', 'report', { submitState: 'loading' }),
  scenario('timeout', 'Timeout / retry', 'report', { submitState: 'timeout' }),
  scenario('idempotent', 'Idempotent retry', 'report', { submitState: 'idempotent' }),
  scenario('conflict', 'Conflict', 'report', { submitState: 'conflict' }),
  scenario('legacy', 'Older plan history', 'legacy', {
    outcome: 'confirmed',
    amountProvenance: 'legacy_plan_assumed',
  }),
  scenario('compact', 'Compact phone', 'report', { compact: true }),
];

export function getInvestmentDayReportGalleryScenario(id: string): InvestmentDayReportGalleryScenario {
  return INVESTMENT_DAY_REPORT_GALLERY_SCENARIOS.find((item) => item.id === id)
    ?? INVESTMENT_DAY_REPORT_GALLERY_SCENARIOS[0]!;
}

export function galleryFixtureSendsServerCall(_scenario: InvestmentDayReportGalleryScenario): false {
  return false;
}
