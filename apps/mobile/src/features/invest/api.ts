import { ContributionSetupRequiredError } from '@/features/clubs/contributionPolicy';
import { firstRpcRow, requireString } from '@/features/clubs/types';
import { supabase } from '@/lib/supabase/client';

import { asAmountProvenance, type AmountProvenance } from './amountProvenance';
import { extractInvestErrorCode, mapInvestError } from './investErrors';
import { isInvestmentDayClosed, toRpcPurchaseLines, type InvestmentDayReportRequest } from './investmentDayReport';
import type {
  InvestmentDayAllocation,
  InvestmentDayPlan,
  InvestmentDayTransaction,
  InvestmentDayViewerState,
} from './types';
import { INVESTMENT_DAY_VIEWER_STATES } from './types';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  return null;
}

function requireNumber(row: Record<string, unknown>, key: string): number {
  const value = asNumber(row[key]);
  if (value === null || !Number.isInteger(value)) {
    throw new Error(`Missing ${key}`);
  }
  return value;
}

function asDecimalString(value: unknown): string | null {
  if (typeof value === 'string' && /^(0|[1-9]\d*)(\.\d+)?$/.test(value.trim())) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const display = value.toFixed(8).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    return /^(0|[1-9]\d*)(\.\d+)?$/.test(display) ? display : null;
  }
  return null;
}

function parseAllocations(value: unknown): InvestmentDayAllocation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row) {
      return [];
    }

    try {
      return [
        {
          investmentTargetId: requireString(row, 'investment_target_id'),
          name: requireString(row, 'name'),
          kind: requireString(row, 'kind'),
          ticker: typeof row.ticker === 'string' && row.ticker.trim() !== '' ? row.ticker : null,
          instrumentCurrency:
            typeof row.instrument_currency === 'string' ? row.instrument_currency : null,
          allocationBps: requireNumber(row, 'allocation_bps'),
          position: requireNumber(row, 'position'),
          amountMinor: requireNumber(row, 'amount_minor'),
        },
      ];
    } catch {
      return [];
    }
  });
}

function parseTransactions(value: unknown): InvestmentDayTransaction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row) {
      return [];
    }

    try {
      return [
        {
          id: requireString(row, 'id'),
          investmentTargetId: requireString(row, 'investment_target_id'),
          amountMinor: requireNumber(row, 'amount_minor'),
          currency: requireString(row, 'currency'),
          transactionType: requireString(row, 'transaction_type'),
          source: requireString(row, 'source'),
          verificationStatus: requireString(row, 'verification_status'),
          amountProvenance: typeof row.amount_provenance === 'string' ? row.amount_provenance : null,
          quantity: asDecimalString(row.quantity),
          executionUnitPrice: asDecimalString(row.execution_unit_price),
          executionUnitPriceCurrency:
            typeof row.execution_unit_price_currency === 'string'
              ? row.execution_unit_price_currency
              : null,
        },
      ];
    } catch {
      return [];
    }
  });
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  return null;
}

function asViewerState(value: unknown, cycleStatus: string | null): InvestmentDayViewerState {
  if (typeof value === 'string' && (INVESTMENT_DAY_VIEWER_STATES as readonly string[]).includes(value)) {
    return value as InvestmentDayViewerState;
  }
  if (cycleStatus === 'open') {
    return 'open';
  }
  if (cycleStatus === 'upcoming') {
    return 'upcoming';
  }
  if (cycleStatus === 'completed' || cycleStatus === 'cancelled') {
    return 'closed';
  }
  return 'unavailable';
}

function parsePlan(data: unknown): InvestmentDayPlan {
  const row = firstRpcRow(data);
  if (!row) {
    throw new Error('Unable to load this Investment Day');
  }

  const participationOutcome = typeof row.participation_outcome === 'string'
    ? row.participation_outcome
    : '';
  const cycleStatus = typeof row.cycle_status === 'string' ? row.cycle_status : null;
  const viewerState = asViewerState(row.viewer_state, cycleStatus);
  const expectedAmountMinor = asNumber(row.expected_amount_minor);
  const cycleId = typeof row.cycle_id === 'string' ? row.cycle_id : null;
  const reportingAllowed = asBoolean(row.reporting_allowed)
    ?? (viewerState === 'open' && participationOutcome === 'expected');

  return {
    clubId: requireString(row, 'club_id'),
    clubName: requireString(row, 'club_name'),
    membershipId: requireString(row, 'membership_id'),
    cycleId,
    investmentDayAt: typeof row.investment_day_at === 'string' ? row.investment_day_at : null,
    cycleStatus,
    viewerState,
    reportingAllowed,
    reportingOpensAt: typeof row.reporting_opens_at === 'string' ? row.reporting_opens_at : null,
    reportingClosesAt: typeof row.reporting_closes_at === 'string' ? row.reporting_closes_at : null,
    participationId: typeof row.participation_id === 'string' ? row.participation_id : null,
    participationOutcome,
    expectedAmountMinor,
    currency: typeof row.currency === 'string' ? row.currency : null,
    allocations: parseAllocations(row.allocations),
    transactions: parseTransactions(row.transactions),
    isCompleted: isInvestmentDayClosed(participationOutcome),
  };
}

export async function fetchCurrentInvestmentDay(clubId: string): Promise<InvestmentDayPlan> {
  const result = await supabase.rpc('current_investment_day_v1', {
    p_club_id: clubId,
  });

  if (result.error) {
    if (extractInvestErrorCode(result.error) === 'vesty.contribution_commitment_required') {
      throw new ContributionSetupRequiredError();
    }
    throw new Error(mapInvestError(result.error, 'Unable to load this Investment Day', 'current_investment_day_v1'));
  }

  try {
    return parsePlan(result.data);
  } catch {
    throw new Error('Unable to load this Investment Day');
  }
}

export async function reportInvestmentDay(
  input: InvestmentDayReportRequest,
): Promise<InvestmentDayPlan> {
  const result = await supabase.rpc('report_investment_day_v1', {
    p_club_id: input.clubId,
    p_cycle_id: input.cycleId,
    p_client_report_id: input.clientReportId,
    p_report_mode: input.reportMode,
    p_outcome: input.outcome,
    p_purchase_lines: toRpcPurchaseLines(input.purchaseLines),
  });

  if (result.error) {
    throw new Error(
      mapInvestError(result.error, 'Unable to save this Investment Day report', 'report_investment_day_v1'),
    );
  }

  try {
    const plan = parsePlan(result.data);
    if (input.outcome === 'confirmed' && plan.participationOutcome !== 'confirmed') {
      throw new Error('Unable to save this Investment Day report');
    }
    if (input.outcome === 'skipped' && plan.participationOutcome !== 'skipped') {
      throw new Error('Unable to save this Investment Day report');
    }
    if (input.outcome === 'failed' && plan.participationOutcome !== 'failed') {
      throw new Error('Unable to save this Investment Day report');
    }
    return plan;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unable to')) {
      throw error;
    }
    throw new Error('Unable to save this Investment Day report');
  }
}

export type QuantityStatus = 'complete' | 'partial' | 'unavailable';

export interface OwnPosition {
  investmentTargetId: string;
  name: string;
  kind: string;
  ticker: string | null;
  contributionCurrency: string;
  instrumentCurrency: string | null;
  totalInvestedMinor: number;
  amountProvenance: AmountProvenance | null;
  totalQuantity: string | null;
  quantityStatus: QuantityStatus;
  latestPrice: string | null;
  latestPriceCurrency: string | null;
  currentValue: string | null;
  currentValueCurrency: string | null;
  valuationStatus: string;
}

function asQuantityStatus(value: unknown): QuantityStatus {
  if (value === 'complete' || value === 'partial' || value === 'unavailable') {
    return value;
  }
  return 'unavailable';
}

export async function fetchOwnPositions(clubId: string): Promise<OwnPosition[]> {
  const valuationsResult = await supabase
    .from('member_position_valuations_v1')
    .select(
      'investment_target_id, target_name, target_kind, target_ticker, contribution_currency, instrument_currency, total_invested_minor, amount_provenance, total_quantity, quantity_status, latest_price, latest_price_currency, current_value, current_value_currency, valuation_status',
    )
    .eq('club_id', clubId);

  if (valuationsResult.error) {
    throw valuationsResult.error;
  }

  return (valuationsResult.data ?? []).flatMap((row) => {
    const record = row as Record<string, unknown>;
    const targetId = typeof record.investment_target_id === 'string' ? record.investment_target_id : null;
    const name = typeof record.target_name === 'string' ? record.target_name : null;
    const kind = typeof record.target_kind === 'string' ? record.target_kind : null;
    const totalInvestedMinor = asNumber(record.total_invested_minor);
    if (!targetId || !name || !kind || totalInvestedMinor === null) {
      return [];
    }

    return [
      {
        investmentTargetId: targetId,
        name,
        kind,
        ticker: typeof record.target_ticker === 'string' ? record.target_ticker : null,
        contributionCurrency:
          typeof record.contribution_currency === 'string' ? record.contribution_currency : 'NOK',
        instrumentCurrency:
          typeof record.instrument_currency === 'string' ? record.instrument_currency : null,
        totalInvestedMinor,
        amountProvenance: asAmountProvenance(record.amount_provenance),
        totalQuantity: asDecimalString(record.total_quantity),
        quantityStatus: asQuantityStatus(record.quantity_status),
        latestPrice: asDecimalString(record.latest_price),
        latestPriceCurrency:
          typeof record.latest_price_currency === 'string' ? record.latest_price_currency : null,
        currentValue: asDecimalString(record.current_value),
        currentValueCurrency:
          typeof record.current_value_currency === 'string' ? record.current_value_currency : null,
        valuationStatus: typeof record.valuation_status === 'string' ? record.valuation_status : 'unavailable',
      },
    ];
  });
}
