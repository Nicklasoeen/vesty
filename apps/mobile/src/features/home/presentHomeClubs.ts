/**
 * REAL club identity on Home, with DEMO financial presentation isolated
 * until portfolio aggregation exists. Demo numbers are not queried from
 * the database and must not be treated as authoritative.
 */
import { clubDashboardDemoData, type PortfolioHistoryPoint } from '@/demo/clubDemoData';
import { homeClubs } from '@/demo/homeDemoData';
import type { ClubSummary } from '@/features/clubs/types';
import type { MemberPortfolioSummary, PortfolioHistoryPoint as EstimatedHistoryPoint } from '@/features/portfolio/portfolioApi';
import { toChartPoints } from '@/features/portfolio/buildPortfolioChartSeries';
import type { AvatarPerson } from '@/ui';

export interface HomeClubRow {
  clubId: string;
  name: string;
  members: readonly AvatarPerson[];
  memberCount: number;
  portfolioValueNok: number | null;
  returnPercentage: number | null;
  history: PortfolioHistoryPoint[];
  presentation: 'estimated' | 'demo';
}

const DEMO_FINANCIAL_PALETTES = homeClubs.map((club) => ({
  portfolioValueNok: club.portfolioValueNok,
  returnPercentage: club.returnPercentage,
  history: club.history,
}));

function demoPaletteFor(clubId: string) {
  let hash = 0;
  for (let index = 0; index < clubId.length; index += 1) {
    hash = (hash + clubId.charCodeAt(index) * (index + 1)) % 997;
  }
  return DEMO_FINANCIAL_PALETTES[hash % DEMO_FINANCIAL_PALETTES.length] ?? DEMO_FINANCIAL_PALETTES[0]!;
}

export function presentHomeClubs(
  clubs: readonly ClubSummary[],
  portfolios: readonly MemberPortfolioSummary[] = [],
  historyByClub: Record<string, EstimatedHistoryPoint[]> = {},
): HomeClubRow[] {
  return clubs.map((club) => {
    const estimated = portfolios.find((row) => row.clubId === club.clubId);
    if (estimated?.modellingScope === 'curated_etf') {
      const valueMinor = estimated.estimatedCurrentValueMinor ?? estimated.investedMinor;
      return {
        clubId: club.clubId,
        name: club.name,
        members: club.members,
        memberCount: club.members.length,
        portfolioValueNok: Math.trunc(valueMinor / 100),
        returnPercentage: estimated.gainLossBps != null ? estimated.gainLossBps / 100 : null,
        history: toChartPoints(historyByClub[club.clubId] ?? []).map((point) => ({
          date: point.date,
          valueNok: point.portfolioValueNok,
        })),
        presentation: 'estimated',
      };
    }

    const demo = demoPaletteFor(club.clubId);
    return {
      clubId: club.clubId,
      name: club.name,
      members: club.members,
      memberCount: club.members.length,
      portfolioValueNok: demo.portfolioValueNok,
      returnPercentage: demo.returnPercentage,
      history: demo.history,
      presentation: 'demo',
    };
  });
}

/** DEMO Investment Day date/amount — not a real schedule yet. */
export const homeInvestmentDayDemo = {
  investmentDayLabel: clubDashboardDemoData.nextInvestmentDayLabel,
  investmentDayShortLabel: clubDashboardDemoData.nextInvestmentDayShortLabel,
  expectedContributionNok: clubDashboardDemoData.expectedContributionNok,
};
