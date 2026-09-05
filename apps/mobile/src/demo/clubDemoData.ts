/**
 * DEMO DATA — Vesty design spikes only (Home + Club Dashboard).
 *
 * This module is intentionally isolated from any real data source. It does
 * not query Supabase, does not model the actual domain schema, and must not
 * be imported by production business logic. Portfolio current-value charts
 * and estimated returns here remain demo-only and must not be mixed with
 * member-reported transaction cost basis. It exists purely so the
 * presentational screens have plausible, typed, shared content to render —
 * kept in one place so the demo WRIC club values aren't duplicated across
 * screens.
 */

import type { ImageSourcePropType } from 'react-native';

const nicklasPhoto: ImageSourcePropType = require('../../assets/images/nicklas-profile.png');
const espenPhoto: ImageSourcePropType = require('../../assets/images/espen-profile.jpg');
const jonasPhoto: ImageSourcePropType = require('../../assets/images/jonas-profile.jpg');

/** Canonical demo person — one identity, reused everywhere that person appears. */
export interface DemoPerson {
  id: string;
  name: string;
  initials: string;
  imageSource?: ImageSourcePropType;
}

export const demoPeople = {
  nicklas: { id: 'nicklas', name: 'Nicklas', initials: 'N', imageSource: nicklasPhoto },
  espen: { id: 'espen', name: 'Espen', initials: 'E', imageSource: espenPhoto },
  ingrid: { id: 'ingrid', name: 'Ingrid', initials: 'I' },
  marte: { id: 'marte', name: 'Marte', initials: 'M' },
  jonas: { id: 'jonas', name: 'Jonas', initials: 'J', imageSource: jonasPhoto },
  anne: { id: 'anne', name: 'Anne', initials: 'A' },
  ole: { id: 'ole', name: 'Ole', initials: 'O' },
  kari: { id: 'kari', name: 'Kari', initials: 'K' },
} as const satisfies Record<string, DemoPerson>;

export interface ClubMemberDemo extends DemoPerson {
  isCurrentUser: boolean;
  isReadyForNextInvestmentDay: boolean;
}

function asClubMember(
  person: DemoPerson,
  options: { isCurrentUser?: boolean; isReadyForNextInvestmentDay?: boolean } = {},
): ClubMemberDemo {
  return {
    ...person,
    isCurrentUser: options.isCurrentUser ?? false,
    isReadyForNextInvestmentDay: options.isReadyForNextInvestmentDay ?? true,
  };
}

export interface StrategyAllocationDemo {
  id: string;
  label: string;
  percentage: number;
}

export interface StrategyAllocationChangeDemo {
  id: string;
  label: string;
  fromPercentage: number;
  toPercentage: number;
}

export interface ActiveProposalDemo {
  proposedBy: DemoPerson;
  changes: StrategyAllocationChangeDemo[];
  votesCast: number;
  votesTotal: number;
}

export type PortfolioRangeKey = '1M' | '3M' | '6M' | '1Y' | 'ALL';

export interface PortfolioHistoryPoint {
  /** ISO calendar date (YYYY-MM-DD). */
  date: string;
  /** Portfolio estimate in integer NOK kroner. */
  valueNok: number;
}

export interface ClubDashboardDemoData {
  clubName: string;
  members: ClubMemberDemo[];
  currentUserName: string;
  portfolioValueNok: number;
  totalContributedNok: number;
  estimatedReturnNok: number;
  estimatedReturnPercentage: number;
  nextInvestmentDayLabel: string;
  /** Compact date form for Home's quieter upcoming state (e.g. "5 Oct"). */
  nextInvestmentDayShortLabel: string;
  expectedContributionNok: number;
  currentStrategy: StrategyAllocationDemo[];
  activeProposal: ActiveProposalDemo;
  /** Deterministic portfolio value history by range selector. */
  portfolioHistoryByRange: Record<PortfolioRangeKey, PortfolioHistoryPoint[]>;
  defaultPortfolioRange: PortfolioRangeKey;
}

export const PORTFOLIO_RANGE_OPTIONS: readonly PortfolioRangeKey[] = [
  '1M',
  '3M',
  '6M',
  '1Y',
  'ALL',
] as const;

/**
 * ~30 daily points for the 1M demo view.
 * Starts near 87k with believable day-to-day variation and ends at 92,480
 * so the chart final value matches the displayed portfolio figure.
 */
const portfolioHistory1M: PortfolioHistoryPoint[] = [
  { date: '2026-08-05', valueNok: 87_240 },
  { date: '2026-08-06', valueNok: 87_610 },
  { date: '2026-08-07', valueNok: 87_180 },
  { date: '2026-08-08', valueNok: 86_920 },
  { date: '2026-08-09', valueNok: 87_450 },
  { date: '2026-08-10', valueNok: 87_980 },
  { date: '2026-08-11', valueNok: 88_320 },
  { date: '2026-08-12', valueNok: 88_050 },
  { date: '2026-08-13', valueNok: 88_670 },
  { date: '2026-08-14', valueNok: 88_410 },
  { date: '2026-08-15', valueNok: 89_020 },
  { date: '2026-08-16', valueNok: 89_480 },
  { date: '2026-08-17', valueNok: 89_150 },
  { date: '2026-08-18', valueNok: 88_760 },
  { date: '2026-08-19', valueNok: 89_310 },
  { date: '2026-08-20', valueNok: 89_870 },
  { date: '2026-08-21', valueNok: 90_240 },
  { date: '2026-08-22', valueNok: 89_960 },
  { date: '2026-08-23', valueNok: 90_510 },
  { date: '2026-08-24', valueNok: 90_180 },
  { date: '2026-08-25', valueNok: 90_740 },
  { date: '2026-08-26', valueNok: 91_120 },
  { date: '2026-08-27', valueNok: 90_860 },
  { date: '2026-08-28', valueNok: 91_390 },
  { date: '2026-08-29', valueNok: 91_780 },
  { date: '2026-08-30', valueNok: 91_520 },
  { date: '2026-08-31', valueNok: 92_010 },
  { date: '2026-09-01', valueNok: 91_840 },
  { date: '2026-09-02', valueNok: 92_260 },
  { date: '2026-09-03', valueNok: 92_480 },
];

/** Sparse weekly-ish points for longer ranges — still ends at 92,480. */
const portfolioHistory3M: PortfolioHistoryPoint[] = [
  { date: '2026-06-05', valueNok: 84_620 },
  { date: '2026-06-12', valueNok: 85_110 },
  { date: '2026-06-19', valueNok: 84_780 },
  { date: '2026-06-26', valueNok: 85_640 },
  { date: '2026-07-03', valueNok: 85_290 },
  { date: '2026-07-10', valueNok: 86_180 },
  { date: '2026-07-17', valueNok: 86_740 },
  { date: '2026-07-24', valueNok: 86_410 },
  { date: '2026-07-31', valueNok: 87_050 },
  { date: '2026-08-07', valueNok: 87_180 },
  { date: '2026-08-14', valueNok: 88_410 },
  { date: '2026-08-21', valueNok: 90_240 },
  { date: '2026-08-28', valueNok: 91_390 },
  { date: '2026-09-03', valueNok: 92_480 },
];

const portfolioHistory6M: PortfolioHistoryPoint[] = [
  { date: '2026-03-05', valueNok: 81_340 },
  { date: '2026-03-19', valueNok: 82_180 },
  { date: '2026-04-02', valueNok: 81_760 },
  { date: '2026-04-16', valueNok: 83_050 },
  { date: '2026-04-30', valueNok: 82_640 },
  { date: '2026-05-14', valueNok: 83_920 },
  { date: '2026-05-28', valueNok: 84_410 },
  { date: '2026-06-11', valueNok: 84_980 },
  { date: '2026-06-25', valueNok: 85_520 },
  { date: '2026-07-09', valueNok: 86_010 },
  { date: '2026-07-23', valueNok: 86_480 },
  { date: '2026-08-06', valueNok: 87_610 },
  { date: '2026-08-20', valueNok: 89_870 },
  { date: '2026-09-03', valueNok: 92_480 },
];

const portfolioHistory1Y: PortfolioHistoryPoint[] = [
  { date: '2025-09-03', valueNok: 76_820 },
  { date: '2025-10-03', valueNok: 78_140 },
  { date: '2025-11-03', valueNok: 77_560 },
  { date: '2025-12-03', valueNok: 79_280 },
  { date: '2026-01-03', valueNok: 80_150 },
  { date: '2026-02-03', valueNok: 79_640 },
  { date: '2026-03-03', valueNok: 81_420 },
  { date: '2026-04-03', valueNok: 82_380 },
  { date: '2026-05-03', valueNok: 83_210 },
  { date: '2026-06-03', valueNok: 84_580 },
  { date: '2026-07-03', valueNok: 85_290 },
  { date: '2026-08-03', valueNok: 86_910 },
  { date: '2026-09-03', valueNok: 92_480 },
];

const portfolioHistoryAll: PortfolioHistoryPoint[] = [
  { date: '2025-03-01', valueNok: 68_400 },
  { date: '2025-05-01', valueNok: 71_220 },
  { date: '2025-07-01', valueNok: 73_850 },
  { date: '2025-09-01', valueNok: 76_480 },
  { date: '2025-11-01', valueNok: 77_920 },
  { date: '2026-01-01', valueNok: 79_860 },
  { date: '2026-03-01', valueNok: 81_280 },
  { date: '2026-05-01', valueNok: 83_410 },
  { date: '2026-07-01', valueNok: 85_180 },
  { date: '2026-09-03', valueNok: 92_480 },
];

export const clubDashboardDemoData: ClubDashboardDemoData = {
  clubName: 'WRIC',
  currentUserName: 'Nicklas',
  members: [
    asClubMember(demoPeople.nicklas, { isCurrentUser: true }),
    asClubMember(demoPeople.espen),
    asClubMember(demoPeople.ingrid),
    asClubMember(demoPeople.marte),
  ],
  portfolioValueNok: 92_480,
  totalContributedNok: 84_000,
  estimatedReturnNok: 8_480,
  estimatedReturnPercentage: 10.1,
  nextInvestmentDayLabel: '5 October',
  nextInvestmentDayShortLabel: '5 Oct',
  expectedContributionNok: 7_000,
  currentStrategy: [
    { id: 'klp-global', label: 'KLP AksjeGlobal Indeks P', percentage: 40 },
    { id: 'dnb-teknologi', label: 'DNB Teknologi A', percentage: 30 },
    { id: 'klp-norge', label: 'KLP AksjeNorge Indeks P', percentage: 15 },
    { id: 'klp-em', label: 'KLP AksjeFremvoksende Markeder P', percentage: 15 },
  ],
  activeProposal: {
    proposedBy: demoPeople.espen,
    changes: [
      { id: 'dnb-teknologi', label: 'DNB Teknologi A', fromPercentage: 30, toPercentage: 35 },
      { id: 'klp-global', label: 'KLP AksjeGlobal Indeks P', fromPercentage: 40, toPercentage: 35 },
    ],
    votesCast: 2,
    votesTotal: 4,
  },
  defaultPortfolioRange: '1M',
  portfolioHistoryByRange: {
    '1M': portfolioHistory1M,
    '3M': portfolioHistory3M,
    '6M': portfolioHistory6M,
    '1Y': portfolioHistory1Y,
    ALL: portfolioHistoryAll,
  },
};
