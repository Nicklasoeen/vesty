/**
 * REAL club identity on Home. Curated ETF clubs use estimated member
 * portfolio numbers. Legacy clubs do not receive demo market values.
 */
import type { ClubSummary } from '@/features/clubs/types';
import type { MemberPortfolioSummary } from '@/features/portfolio/portfolioApi';
import type { PortfolioValuationConfidence } from '@/features/portfolio/valuationLabels';
import type { AvatarPerson } from '@/ui';

import { presentHomeClubFinance } from './presentHomePortfolio';

export interface HomeClubRow {
  clubId: string;
  name: string;
  members: readonly AvatarPerson[];
  memberCount: number;
  /** Member stake / estimated current value. Null when no real figure exists. */
  portfolioValueNok: number | null;
  returnPercentage: number | null;
  presentation: 'estimated' | 'unavailable';
  valuationConfidence: PortfolioValuationConfidence | null;
  yourStakeMinor: number | null;
}

export function presentHomeClubs(
  clubs: readonly ClubSummary[],
  portfolios: readonly MemberPortfolioSummary[] = [],
): HomeClubRow[] {
  return clubs.map((club) => {
    const finance = presentHomeClubFinance(portfolios.find((row) => row.clubId === club.clubId));
    return {
      clubId: club.clubId,
      name: club.name,
      members: club.members,
      memberCount: club.members.length,
      ...finance,
    };
  });
}
