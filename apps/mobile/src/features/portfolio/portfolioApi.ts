import { firstRpcRow } from '@/features/clubs/types';
import { supabase } from '@/lib/supabase/client';

import {
  isEstimatedPortfolioConfidence,
  type PortfolioValuationConfidence,
} from './valuationLabels';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  return null;
}

function asDecimalString(value: unknown): string | null {
  if (typeof value === 'string' && /^-?(0|[1-9]\d*)(\.\d+)?$/.test(value.trim())) {
    return value.trim();
  }
  return null;
}

export type ModellingScope = 'curated_etf' | 'legacy' | 'none';

export interface MemberPortfolioSummary {
  clubId: string | null;
  modellingScope: ModellingScope;
  investedMinor: number;
  estimatedCurrentValueMinor: number | null;
  gainLossMinor: number | null;
  gainLossBps: number | null;
  valuationConfidence: PortfolioValuationConfidence;
  lotCount: number;
}

export interface EstimatedPosition {
  investmentTargetId: string;
  name: string;
  ticker: string | null;
  totalInvestedMinor: number;
  amountProvenance: string | null;
  exactQuantity: string | null;
  quantityStatus: 'complete' | 'partial' | 'unavailable';
  valuationConfidence: PortfolioValuationConfidence;
  estimatedCurrentValueMinor: number | null;
}

export interface PortfolioHistoryPoint {
  date: string;
  investedMinor: number;
  estimatedValueMinor: number | null;
  pointStatus: 'available' | 'unavailable' | 'hidden';
}

function asScope(value: unknown): ModellingScope {
  if (value === 'curated_etf' || value === 'legacy' || value === 'none') {
    return value;
  }
  return 'none';
}

function parseSummary(value: unknown): MemberPortfolioSummary | null {
  const row = firstRpcRow(value);
  if (!row) {
    return null;
  }

  const investedMinor = asInteger(row.invested_minor);
  if (investedMinor === null) {
    return null;
  }

  return {
    clubId: typeof row.club_id === 'string' ? row.club_id : null,
    modellingScope: asScope(row.modelling_scope),
    investedMinor,
    estimatedCurrentValueMinor: asInteger(row.estimated_current_value_minor),
    gainLossMinor: asInteger(row.gain_loss_minor),
    gainLossBps: asInteger(row.gain_loss_bps),
    valuationConfidence: isEstimatedPortfolioConfidence(String(row.valuation_confidence ?? ''))
      ? (row.valuation_confidence as PortfolioValuationConfidence)
      : 'unavailable',
    lotCount: asInteger(row.lot_count) ?? 0,
  };
}

export async function fetchMemberPortfolio(clubId?: string | null): Promise<MemberPortfolioSummary | null> {
  const result = await supabase.rpc('member_estimated_portfolio_v1', {
    p_club_id: clubId ?? null,
  });

  if (result.error) {
    throw result.error;
  }

  return parseSummary(result.data);
}

export async function fetchMemberPortfolios(): Promise<MemberPortfolioSummary[]> {
  const result = await supabase.rpc('member_estimated_portfolios_v1');
  if (result.error) {
    throw result.error;
  }

  return (Array.isArray(result.data) ? result.data : []).flatMap((row) => {
    const parsed = parseSummary(row);
    return parsed ? [parsed] : [];
  });
}

export async function fetchMemberPortfolioHistory(input: {
  clubId?: string | null;
  from: string;
  to: string;
  stepDays?: number;
}): Promise<PortfolioHistoryPoint[]> {
  const result = await supabase.rpc('member_portfolio_history_v1', {
    p_club_id: input.clubId ?? null,
    p_from: input.from,
    p_to: input.to,
    p_step_days: input.stepDays ?? 7,
  });

  if (result.error) {
    throw result.error;
  }

  return (Array.isArray(result.data) ? result.data : []).flatMap((item) => {
    const row = asRecord(item);
    if (!row) {
      return [];
    }

    const date = typeof row.as_of_date === 'string' ? row.as_of_date : null;
    const investedMinor = asInteger(row.invested_minor);
    if (!date || investedMinor === null) {
      return [];
    }

    const pointStatus =
      row.point_status === 'available' || row.point_status === 'unavailable' || row.point_status === 'hidden'
        ? row.point_status
        : 'unavailable';

    return [
      {
        date,
        investedMinor,
        estimatedValueMinor: asInteger(row.estimated_value_minor),
        pointStatus,
      },
    ];
  });
}

export async function fetchEstimatedPositions(clubId: string): Promise<EstimatedPosition[]> {
  const result = await supabase
    .from('member_estimated_positions_v1')
    .select(
      'investment_target_id, target_name, target_ticker, total_invested_minor, amount_provenance, exact_quantity, exact_lot_count, lot_count, valuation_confidence, estimated_current_value_minor',
    )
    .eq('club_id', clubId);

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []).flatMap((item) => {
    const row = item as Record<string, unknown>;
    const investmentTargetId =
      typeof row.investment_target_id === 'string' ? row.investment_target_id : null;
    const name = typeof row.target_name === 'string' ? row.target_name : null;
    const totalInvestedMinor = asInteger(row.total_invested_minor);
    if (!investmentTargetId || !name || totalInvestedMinor === null) {
      return [];
    }

    const exactLotCount = asInteger(row.exact_lot_count) ?? 0;
    const lotCount = asInteger(row.lot_count) ?? 0;
    const quantityStatus =
      exactLotCount === 0 ? 'unavailable' : exactLotCount === lotCount ? 'complete' : 'partial';

    return [
      {
        investmentTargetId,
        name,
        ticker: typeof row.target_ticker === 'string' ? row.target_ticker : null,
        totalInvestedMinor,
        amountProvenance: typeof row.amount_provenance === 'string' ? row.amount_provenance : null,
        exactQuantity: asDecimalString(row.exact_quantity),
        quantityStatus,
        valuationConfidence: isEstimatedPortfolioConfidence(String(row.valuation_confidence ?? ''))
          ? (row.valuation_confidence as PortfolioValuationConfidence)
          : 'unavailable',
        estimatedCurrentValueMinor: asInteger(row.estimated_current_value_minor),
      },
    ];
  });
}
