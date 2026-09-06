import {
  portfolioValueCaption,
  portfolioValueChartLabel,
  type PortfolioValuationConfidence,
} from '../portfolio/valuationLabels.ts';

export type HomePortfolioRangeKey = '1M' | '3M' | '6M' | '1Y' | 'ALL';

export const HOME_PORTFOLIO_RANGE_OPTIONS: readonly HomePortfolioRangeKey[] = ['1M', '3M', '6M', '1Y', 'ALL'];
export const HOME_PORTFOLIO_RANGE_LABELS: Partial<Record<HomePortfolioRangeKey, string>> = {
  ALL: 'All',
};
export const HOME_PORTFOLIO_DEFAULT_RANGE: HomePortfolioRangeKey = '6M';

export interface HomePortfolioSummaryInput {
  clubId?: string | null;
  modellingScope: 'curated_etf' | 'legacy' | 'none';
  investedMinor: number;
  estimatedCurrentValueMinor: number | null;
  gainLossMinor: number | null;
  gainLossBps: number | null;
  valuationConfidence: PortfolioValuationConfidence;
}

export interface HomePortfolioPresentation {
  usesDemo: false;
  available: boolean;
  valueMinor: number;
  investedMinor: number;
  gainLossMinor: number | null;
  gainLossBps: number | null;
  caption: string | null;
  chartLabel: string;
  activeClubs: number;
}

export interface HomeClubFinance {
  presentation: 'estimated' | 'unavailable';
  portfolioValueNok: number | null;
  returnPercentage: number | null;
  valuationConfidence: PortfolioValuationConfidence | null;
  yourStakeMinor: number | null;
}

/**
 * Home portfolio numbers. Curated ETF totals only. Never demo series.
 */
export function presentHomePortfolio(
  summary: HomePortfolioSummaryInput | null,
  clubCount: number,
): HomePortfolioPresentation {
  if (!summary || summary.modellingScope !== 'curated_etf') {
    return {
      usesDemo: false,
      available: false,
      valueMinor: 0,
      investedMinor: 0,
      gainLossMinor: null,
      gainLossBps: null,
      caption: null,
      chartLabel: 'Value',
      activeClubs: clubCount,
    };
  }

  return {
    usesDemo: false,
    available: true,
    valueMinor: summary.estimatedCurrentValueMinor ?? summary.investedMinor,
    investedMinor: summary.investedMinor,
    gainLossMinor: summary.gainLossMinor,
    gainLossBps: summary.gainLossBps,
    caption: portfolioValueCaption(summary.valuationConfidence),
    chartLabel: portfolioValueChartLabel(summary.valuationConfidence),
    activeClubs: clubCount,
  };
}

export function presentHomeClubFinance(summary: HomePortfolioSummaryInput | undefined): HomeClubFinance {
  if (summary?.modellingScope !== 'curated_etf') {
    return {
      presentation: 'unavailable',
      portfolioValueNok: null,
      returnPercentage: null,
      valuationConfidence: null,
      yourStakeMinor: null,
    };
  }

  const valueMinor = summary.estimatedCurrentValueMinor ?? summary.investedMinor;
  return {
    presentation: 'estimated',
    portfolioValueNok: Math.trunc(valueMinor / 100),
    returnPercentage: summary.gainLossBps != null ? summary.gainLossBps / 100 : null,
    valuationConfidence: summary.valuationConfidence,
    yourStakeMinor: valueMinor,
  };
}

export function homeGreeting(displayName: string | null | undefined): string {
  const first = displayName?.trim().split(/\s+/).filter(Boolean)[0];
  return first ? `Hei, ${first} 👋` : 'Hei 👋';
}

export function formatHomeInvestmentDayDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(date);
}

export function selectPortfolioRange(
  _current: HomePortfolioRangeKey,
  next: HomePortfolioRangeKey,
): HomePortfolioRangeKey {
  return next;
}
