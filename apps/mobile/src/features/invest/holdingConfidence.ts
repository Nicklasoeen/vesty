/**
 * Valuation confidence for V1 holdings.
 *
 * reported_contribution — member said they invested the planned amount
 * estimated_model — future synthetic/reference holding after FX exists
 * exact_member_reported — member entered actual quantity
 * broker_verified — reserved; not implemented
 *
 * Estimated/modelled quantity is never treated as owned quantity.
 */

export const HOLDING_CONFIDENCE = [
  'reported_contribution',
  'estimated_model',
  'exact_member_reported',
  'broker_verified',
] as const;

export type HoldingConfidence = (typeof HOLDING_CONFIDENCE)[number];

export type QuantityCoverage = 'complete' | 'partial' | 'unavailable';

export function confidenceForHolding(input: {
  quantityStatus: QuantityCoverage;
  verificationStatus?: string | null;
}): HoldingConfidence {
  if (input.verificationStatus === 'broker_verified') {
    return 'broker_verified';
  }
  if (input.quantityStatus === 'complete') {
    return 'exact_member_reported';
  }
  return 'reported_contribution';
}

export function exactHoldingsBadge(confidence: HoldingConfidence): string | null {
  if (confidence === 'exact_member_reported') {
    return 'Exact holdings';
  }
  return null;
}

export function missingExactHoldingsLabel(confidence: HoldingConfidence): string | null {
  if (confidence === 'reported_contribution') {
    return 'Exact holdings not added';
  }
  return null;
}

export function canAddExactHoldings(input: {
  isCompleted: boolean;
  supportsExactHoldings: boolean;
  missingQuantity: boolean;
}): boolean {
  return input.isCompleted && input.supportsExactHoldings && input.missingQuantity;
}

export function shouldShowExactHoldingsForm(input: {
  isCompleted: boolean;
  supportsExactHoldings: boolean;
  missingQuantity: boolean;
  exactHoldingsOpen: boolean;
}): boolean {
  return canAddExactHoldings(input) && input.exactHoldingsOpen;
}

export function shouldShowQuantityFieldsOnInvestmentDay(): boolean {
  return false;
}
