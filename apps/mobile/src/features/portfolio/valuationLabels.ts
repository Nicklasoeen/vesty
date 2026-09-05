export const PORTFOLIO_VALUATION_CONFIDENCE = ['exact', 'mixed', 'estimated', 'unavailable'] as const;

export type PortfolioValuationConfidence = (typeof PORTFOLIO_VALUATION_CONFIDENCE)[number];

export const ESTIMATED_VALUATION_INFO =
  'Estimated values are based on your reported contributions, market prices and reference exchange rates. Your broker balance may differ.';

export function portfolioValueCaption(confidence: PortfolioValuationConfidence): string | null {
  if (confidence === 'estimated') {
    return 'Estimated';
  }
  if (confidence === 'exact') {
    return 'Based on reported holdings';
  }
  if (confidence === 'mixed') {
    return 'Partly estimated';
  }
  return null;
}

export function portfolioValueChartLabel(confidence: PortfolioValuationConfidence): string {
  if (confidence === 'estimated' || confidence === 'mixed') {
    return 'Estimated value';
  }
  return 'Value';
}

export function isEstimatedPortfolioConfidence(
  value: string | null | undefined,
): value is PortfolioValuationConfidence {
  return (
    value === 'exact' || value === 'mixed' || value === 'estimated' || value === 'unavailable'
  );
}
