/**
 * REAL club identity on Home, with DEMO financial presentation isolated
 * until portfolio aggregation exists. Demo numbers are not queried from
 * the database and must not be treated as authoritative.
 */
import { clubDashboardDemoData, type PortfolioHistoryPoint } from '@/demo/clubDemoData';
import { homeClubs } from '@/demo/homeDemoData';
import type { ClubSummary } from '@/features/clubs/types';
import type { AvatarPerson } from '@/ui';

export interface HomeClubRow {
  clubId: string;
  name: string;
  members: readonly AvatarPerson[];
  memberCount: number;
  /** DEMO — not loaded from the database. */
  demoPortfolioValueNok: number;
  /** DEMO — not loaded from the database. */
  demoReturnPercentage: number;
  /** DEMO — not loaded from the database. */
  demoHistory: PortfolioHistoryPoint[];
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

export function presentHomeClubs(clubs: readonly ClubSummary[]): HomeClubRow[] {
  return clubs.map((club) => {
    const demo = demoPaletteFor(club.clubId);
    return {
      clubId: club.clubId,
      name: club.name,
      members: club.members,
      memberCount: club.members.length,
      demoPortfolioValueNok: demo.portfolioValueNok,
      demoReturnPercentage: demo.returnPercentage,
      demoHistory: demo.history,
    };
  });
}

/** DEMO Investment Day date/amount — not a real schedule yet. */
export const homeInvestmentDayDemo = {
  investmentDayLabel: clubDashboardDemoData.nextInvestmentDayLabel,
  investmentDayShortLabel: clubDashboardDemoData.nextInvestmentDayShortLabel,
  expectedContributionNok: clubDashboardDemoData.expectedContributionNok,
};
