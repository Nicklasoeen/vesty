import { parseContributionKronerInput } from '../clubs/contributionAmount.ts';

import { generateClientReportId } from './generateClientReportId.ts';
import { supportsExactHoldings, type QuantityFieldState } from './investmentDayReporting.ts';

export const INVESTMENT_DAY_REPORT_CHOICES = [
  'as_planned',
  'with_changes',
  'pending',
  'skipped',
] as const;

export type InvestmentDayReportChoice = (typeof INVESTMENT_DAY_REPORT_CHOICES)[number];

export type InvestmentDayReportMode = 'as_planned' | 'with_changes';
export type InvestmentDayReportOutcome = 'confirmed' | 'skipped' | 'failed';

export interface InvestmentDayPurchaseLine {
  investmentTargetId: string;
  amountMinor?: number;
  quantity?: string;
  executionUnitPrice?: string;
}

export interface InvestmentDayReportRequest {
  clubId: string;
  cycleId: string;
  clientReportId: string;
  reportMode: InvestmentDayReportMode;
  outcome: InvestmentDayReportOutcome;
  purchaseLines: InvestmentDayPurchaseLine[];
}

export interface ReportedAmountField {
  raw: string;
  error: string | null;
  amountMinor: number | null;
}

export function isInvestmentDayClosed(outcome: string): boolean {
  return outcome === 'confirmed' || outcome === 'skipped' || outcome === 'failed';
}

export const CLIENT_REPORT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createClientReportId(): string {
  return generateClientReportId();
}

export function clientReportIdForCycle(
  store: Record<string, string>,
  cycleId: string,
): string {
  const existing = store[cycleId];
  if (existing) {
    return existing;
  }
  const next = createClientReportId();
  store[cycleId] = next;
  return next;
}

export function parseReportedPurchaseKronerInput(raw: string): ReportedAmountField {
  const trimmed = raw.trim().replace(/\s/g, '');
  if (trimmed === '' || trimmed === '0') {
    return { raw, error: null, amountMinor: 0 };
  }

  const amountMinor = parseContributionKronerInput(raw);
  if (amountMinor == null) {
    return { raw, error: 'Enter a whole-krone amount, or 0 if you skipped this one', amountMinor: null };
  }

  return { raw, error: null, amountMinor };
}

export function reportedAmountFieldFromMinor(amountMinor: number): ReportedAmountField {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return { raw: '', error: null, amountMinor: 0 };
  }
  return { raw: String(Math.trunc(amountMinor / 100)), error: null, amountMinor };
}

export function sumReportedAmountMinor(
  fields: Readonly<Record<string, ReportedAmountField>>,
  targetIds: readonly string[],
): number {
  return targetIds.reduce((sum, id) => sum + (fields[id]?.amountMinor ?? 0), 0);
}

export function optionalExecutionIsValid(
  targetIds: readonly string[],
  quantityFields: Readonly<Record<string, QuantityFieldState>>,
  priceFields: Readonly<Record<string, QuantityFieldState>>,
): boolean {
  return targetIds.every((id) => {
    const quantity = quantityFields[id];
    const price = priceFields[id];
    if (quantity?.error) {
      return false;
    }
    if (price?.error) {
      return false;
    }
    if (price?.canonical && !quantity?.canonical) {
      return false;
    }
    return true;
  });
}

function optionalExecutionLine(
  targetId: string,
  quantityFields: Readonly<Record<string, QuantityFieldState>>,
  priceFields: Readonly<Record<string, QuantityFieldState>>,
): Pick<InvestmentDayPurchaseLine, 'quantity' | 'executionUnitPrice'> {
  const quantity = quantityFields[targetId]?.canonical;
  const executionUnitPrice = priceFields[targetId]?.canonical;
  return {
    ...(quantity ? { quantity } : {}),
    ...(quantity && executionUnitPrice ? { executionUnitPrice } : {}),
  };
}

export function buildAsPlannedPurchaseLines(
  targetIds: readonly string[],
  quantityFields: Readonly<Record<string, QuantityFieldState>>,
  priceFields: Readonly<Record<string, QuantityFieldState>>,
): InvestmentDayPurchaseLine[] {
  return targetIds.flatMap((investmentTargetId) => {
    const extras = optionalExecutionLine(investmentTargetId, quantityFields, priceFields);
    if (!extras.quantity && !extras.executionUnitPrice) {
      return [];
    }
    return [{ investmentTargetId, ...extras }];
  });
}

export function buildWithChangesPurchaseLines(
  targetIds: readonly string[],
  amountFields: Readonly<Record<string, ReportedAmountField>>,
  quantityFields: Readonly<Record<string, QuantityFieldState>>,
  priceFields: Readonly<Record<string, QuantityFieldState>>,
): InvestmentDayPurchaseLine[] {
  return targetIds.flatMap((investmentTargetId) => {
    const amountMinor = amountFields[investmentTargetId]?.amountMinor;
    if (amountMinor == null || amountMinor <= 0) {
      return [];
    }
    return [
      {
        investmentTargetId,
        amountMinor,
        ...optionalExecutionLine(investmentTargetId, quantityFields, priceFields),
      },
    ];
  });
}

export function canSubmitAsPlanned(
  targetIds: readonly string[],
  quantityFields: Readonly<Record<string, QuantityFieldState>>,
  priceFields: Readonly<Record<string, QuantityFieldState>>,
): boolean {
  return optionalExecutionIsValid(targetIds, quantityFields, priceFields);
}

export function canSubmitWithChanges(
  targetIds: readonly string[],
  amountFields: Readonly<Record<string, ReportedAmountField>>,
  quantityFields: Readonly<Record<string, QuantityFieldState>>,
  priceFields: Readonly<Record<string, QuantityFieldState>>,
): boolean {
  if (targetIds.some((id) => amountFields[id]?.error)) {
    return false;
  }
  if (!optionalExecutionIsValid(targetIds, quantityFields, priceFields)) {
    return false;
  }
  return sumReportedAmountMinor(amountFields, targetIds) > 0;
}

export function showOptionalExecutionFields(targetIds: readonly string[]): boolean {
  return supportsExactHoldings(targetIds);
}

export function toRpcPurchaseLines(lines: readonly InvestmentDayPurchaseLine[]): Record<string, unknown>[] {
  return lines.map((line) => ({
    investment_target_id: line.investmentTargetId,
    ...(line.amountMinor != null ? { amount_minor: line.amountMinor } : {}),
    ...(line.quantity ? { quantity: line.quantity } : {}),
    ...(line.executionUnitPrice ? { execution_unit_price: line.executionUnitPrice } : {}),
  }));
}
