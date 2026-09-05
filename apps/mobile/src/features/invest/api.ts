import { firstRpcRow, requireString } from '@/features/clubs/types';
import { supabase } from '@/lib/supabase/client';

import { mapInvestError } from './investErrors';
import type {
  InvestmentDayAllocation,
  InvestmentDayPlan,
  InvestmentDayTransaction,
} from './types';

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
        },
      ];
    } catch {
      return [];
    }
  });
}

function parsePlan(data: unknown): InvestmentDayPlan {
  const row = firstRpcRow(data);
  if (!row) {
    throw new Error('Unable to load this Investment Day');
  }

  const participationOutcome = requireString(row, 'participation_outcome');

  return {
    clubId: requireString(row, 'club_id'),
    clubName: requireString(row, 'club_name'),
    membershipId: requireString(row, 'membership_id'),
    cycleId: requireString(row, 'cycle_id'),
    investmentDayAt: requireString(row, 'investment_day_at'),
    cycleStatus: requireString(row, 'cycle_status'),
    participationId: requireString(row, 'participation_id'),
    participationOutcome,
    expectedAmountMinor: requireNumber(row, 'expected_amount_minor'),
    currency: requireString(row, 'currency'),
    allocations: parseAllocations(row.allocations),
    transactions: parseTransactions(row.transactions),
    isCompleted: participationOutcome === 'confirmed',
  };
}

export async function ensureOpenInvestmentDay(clubId: string): Promise<InvestmentDayPlan> {
  const result = await supabase.rpc('ensure_open_investment_day_v1', {
    p_club_id: clubId,
  });

  if (result.error) {
    throw new Error(mapInvestError(result.error, 'Unable to load this Investment Day', 'ensure_open_investment_day_v1'));
  }

  try {
    return parsePlan(result.data);
  } catch {
    throw new Error('Unable to load this Investment Day');
  }
}

export async function confirmInvestmentDay(
  clubId: string,
  cycleId: string,
): Promise<InvestmentDayPlan> {
  const result = await supabase.rpc('confirm_investment_day_v1', {
    p_club_id: clubId,
    p_cycle_id: cycleId,
  });

  if (result.error) {
    throw new Error(
      mapInvestError(result.error, 'Unable to confirm investments right now', 'confirm_investment_day_v1'),
    );
  }

  try {
    const plan = parsePlan(result.data);
    if (!plan.isCompleted) {
      throw new Error('Unable to confirm investments right now');
    }
    return plan;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unable to')) {
      throw error;
    }
    throw new Error('Unable to confirm investments right now');
  }
}

export interface OwnPosition {
  investmentTargetId: string;
  name: string;
  kind: string;
  currency: string;
  totalInvestedMinor: number;
  totalQuantity: number | null;
}

export async function fetchOwnPositions(clubId: string): Promise<OwnPosition[]> {
  const positionsResult = await supabase
    .from('member_investment_positions')
    .select('investment_target_id, currency, total_invested_minor, total_quantity')
    .eq('club_id', clubId);

  if (positionsResult.error) {
    throw positionsResult.error;
  }

  const rows = positionsResult.data ?? [];
  if (rows.length === 0) {
    return [];
  }

  const targetIds = rows.map((row) => row.investment_target_id as string);
  const targetsResult = await supabase
    .from('investment_targets')
    .select('id, name, kind')
    .in('id', targetIds);

  if (targetsResult.error) {
    throw targetsResult.error;
  }

  const targets = new Map(
    (targetsResult.data ?? []).map((target) => [
      target.id as string,
      { name: target.name as string, kind: target.kind as string },
    ]),
  );

  return rows.flatMap((row) => {
    const targetId = row.investment_target_id as string;
    const target = targets.get(targetId);
    const totalInvestedMinor = asNumber(row.total_invested_minor);
    if (!target || totalInvestedMinor === null) {
      return [];
    }

    return [
      {
        investmentTargetId: targetId,
        name: target.name,
        kind: target.kind,
        currency: typeof row.currency === 'string' ? row.currency : 'NOK',
        totalInvestedMinor,
        totalQuantity: asNumber(row.total_quantity),
      },
    ];
  });
}
