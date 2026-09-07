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
  status: 'loading' | 'empty' | 'available' | 'unavailable' | 'error';
  available: boolean;
  valueMinor: number | null;
  investedMinor: number | null;
  gainLossMinor: number | null;
  gainLossBps: number | null;
  caption: string | null;
  chartLabel: string;
  activeClubs: number;
  detail: string;
}

export interface HomeClubFinance {
  presentation: 'estimated' | 'unavailable';
  portfolioValueNok: number | null;
  returnPercentage: number | null;
  valuationConfidence: PortfolioValuationConfidence | null;
  yourStakeMinor: number | null;
  investedMinor: number | null;
}

/**
 * Home portfolio numbers. Curated ETF totals only. Never demo series.
 */
export function presentHomePortfolio(
  summary: HomePortfolioSummaryInput | null,
  clubCount: number,
  request: { isLoading: boolean; error: string | null } = { isLoading: false, error: null },
): HomePortfolioPresentation {
  if (request.isLoading) {
    return {
      usesDemo: false,
      status: 'loading',
      available: false,
      valueMinor: null,
      investedMinor: null,
      gainLossMinor: null,
      gainLossBps: null,
      caption: null,
      chartLabel: 'Value',
      activeClubs: clubCount,
      detail: 'Loading portfolio…',
    };
  }

  if (request.error) {
    return {
      usesDemo: false,
      status: 'error',
      available: false,
      valueMinor: null,
      investedMinor: null,
      gainLossMinor: null,
      gainLossBps: null,
      caption: null,
      chartLabel: 'Value',
      activeClubs: clubCount,
      detail: request.error,
    };
  }

  if (summary?.modellingScope === 'curated_etf') {
    if (summary.investedMinor === 0) {
      return {
        usesDemo: false,
        status: 'empty',
        available: true,
        valueMinor: 0,
        investedMinor: 0,
        gainLossMinor: null,
        gainLossBps: null,
        caption: null,
        chartLabel: 'Value',
        activeClubs: clubCount,
        detail: 'No reported investments yet.',
      };
    }

    if (summary.estimatedCurrentValueMinor === null) {
      return {
        usesDemo: false,
        status: 'unavailable',
        available: false,
        valueMinor: null,
        investedMinor: summary.investedMinor,
        gainLossMinor: null,
        gainLossBps: null,
        caption: null,
        chartLabel: 'Value',
        activeClubs: clubCount,
        detail: 'Market value is unavailable. Reported invested is shown separately.',
      };
    }

    return {
      usesDemo: false,
      status: 'available',
      available: true,
      valueMinor: summary.estimatedCurrentValueMinor,
      investedMinor: summary.investedMinor,
      gainLossMinor: summary.gainLossMinor,
      gainLossBps: summary.gainLossBps,
      caption: portfolioValueCaption(summary.valuationConfidence),
      chartLabel: portfolioValueChartLabel(summary.valuationConfidence),
      activeClubs: clubCount,
      detail:
        clubCount === 1
          ? 'Estimated value for your supported ETF club'
          : 'Estimated value across supported ETF clubs',
    };
  }

  return {
    usesDemo: false,
    status: clubCount === 0 ? 'empty' : 'unavailable',
    available: clubCount === 0,
    valueMinor: clubCount === 0 ? 0 : null,
    investedMinor: clubCount === 0 ? 0 : null,
    gainLossMinor: null,
    gainLossBps: null,
    caption: null,
    chartLabel: 'Value',
    activeClubs: clubCount,
    detail:
      clubCount === 0
        ? 'No reported investments yet.'
        : 'Market value is available only for supported ETF clubs.',
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
      investedMinor: null,
    };
  }

  if (summary.estimatedCurrentValueMinor === null) {
    return {
      presentation: 'unavailable',
      portfolioValueNok: null,
      returnPercentage: null,
      valuationConfidence: summary.valuationConfidence,
      yourStakeMinor: null,
      investedMinor: summary.investedMinor,
    };
  }

  return {
    presentation: 'estimated',
    portfolioValueNok: Math.trunc(summary.estimatedCurrentValueMinor / 100),
    returnPercentage: summary.gainLossBps != null ? summary.gainLossBps / 100 : null,
    valuationConfidence: summary.valuationConfidence,
    yourStakeMinor: summary.estimatedCurrentValueMinor,
    investedMinor: summary.investedMinor,
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
