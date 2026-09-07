import { formatNokFromMinor } from '../../lib/currency.ts';
import { formatEuroDecimal, formatQuantityLabel } from '../../lib/decimalDisplay.ts';

import {
  portfolioValueCaption,
  type PortfolioValuationConfidence,
} from '../portfolio/valuationLabels.ts';

import { presentReportedAmountLabel, type AmountProvenance } from './amountProvenance.ts';
import {
  confidenceForHolding,
  exactHoldingsBadge,
  missingExactHoldingsLabel,
  type QuantityCoverage,
} from './holdingConfidence.ts';

export interface ClubPositionDisplay {
  title: string;
  subtitle: string | null;
  investedLabel: string;
  quantityLabel: string | null;
  currentValueLabel: string | null;
  badge: string | null;
  missingExactLabel: string | null;
}

export function clubPositionDisplay(input: {
  name: string;
  ticker: string | null;
  totalInvestedMinor: number;
  totalQuantity: string | null;
  quantityStatus: QuantityCoverage;
  currentValue: string | null;
  currentValueCurrency: string | null;
  valuationStatus: string;
  estimatedCurrentValueMinor?: number | null;
  valuationConfidence?: PortfolioValuationConfidence | null;
  amountProvenance?: AmountProvenance | null;
}): ClubPositionDisplay {
  const confidence = confidenceForHolding({ quantityStatus: input.quantityStatus });
  const showExactValue =
    confidence === 'exact_member_reported'
    && input.valuationStatus === 'available'
    && input.currentValue
    && input.currentValueCurrency === 'EUR'
    && input.estimatedCurrentValueMinor == null;
  const estimatedValueLabel =
    input.estimatedCurrentValueMinor != null
      ? `${formatNokFromMinor(input.estimatedCurrentValueMinor)} current value`
      : null;

  return {
    title: input.ticker ?? input.name,
    subtitle: input.ticker ? input.name : null,
    investedLabel: presentReportedAmountLabel(input.totalInvestedMinor, input.amountProvenance),
    quantityLabel:
      confidence === 'exact_member_reported' && input.totalQuantity
        ? formatQuantityLabel(input.totalQuantity)
        : null,
    currentValueLabel: estimatedValueLabel
      ?? (showExactValue && input.currentValue
        ? `${formatEuroDecimal(input.currentValue)} current value`
        : null),
    badge:
      input.valuationConfidence
        ? portfolioValueCaption(input.valuationConfidence)
        : exactHoldingsBadge(confidence),
    missingExactLabel: missingExactHoldingsLabel(confidence),
  };
}
