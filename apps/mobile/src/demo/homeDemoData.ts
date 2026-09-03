/**
 * DEMO DATA — Home overview only.
 *
 * Isolated from any real data source, same rules as clubDemoData.ts. This
 * module models the aggregate, cross-club view that only Home needs
 * (overall performance across clubs, the multi-club list). WRIC's own
 * numbers are derived from clubDemoData.ts rather than restated, so the
 * single club shown on both Home and the Club Dashboard can never drift.
 */
import { clubDashboardDemoData, type PortfolioHistoryPoint, type PortfolioRangeKey } from './clubDemoData';

export interface OverallPerformancePoint {
  /** ISO calendar date (YYYY-MM-DD). */
  date: string;
  /** Aggregate portfolio estimate across all clubs, integer NOK kroner. */
  portfolioValueNok: number;
  /** Aggregate capital contributed across all clubs, integer NOK kroner. */
  investedCapitalNok: number;
}

export interface HomeClubSummary {
  id: string;
  name: string;
  memberCount: number;
  portfolioValueNok: number;
  returnPercentage: number;
  /** Small deterministic trend dataset for this club's list-row sparkline. */
  history: PortfolioHistoryPoint[];
  /** Whether tapping this row opens a real Club Dashboard (only WRIC does, for now). */
  navigable: boolean;
}

/**
 * ~16 monthly points spanning Jun 2025 - Sep 2026. Monthly cadence is
 * enough for an aggregate "across all your clubs" view — the detailed
 * daily chart is Club's job.
 *
 * Invested capital only changes when money is actually contributed, so it
 * holds flat for a period and then steps up (not every month is an
 * Investment Day for every club) — it never decreases. Portfolio value
 * fluctuates independently with ordinary market movement and dips closer
 * to (and briefly below) invested capital a few times, which is what
 * makes unrealized gain/loss visually legible.
 *
 * The final point intentionally equals the sum of the three demo clubs
 * below (92 480 + 54 620 + 37 220 = 184 320 value; 84 000 + 51 430 +
 * 35 510 = 170 940 invested), so the Home summary and the per-club list
 * stay internally consistent.
 */
const overallPerformanceHistoryAll: OverallPerformancePoint[] = [
  { date: '2025-06-03', investedCapitalNok: 22_000, portfolioValueNok: 21_300 },
  { date: '2025-07-03', investedCapitalNok: 22_000, portfolioValueNok: 23_700 },
  { date: '2025-08-03', investedCapitalNok: 34_000, portfolioValueNok: 32_900 },
  { date: '2025-09-03', investedCapitalNok: 34_000, portfolioValueNok: 36_200 },
  { date: '2025-10-03', investedCapitalNok: 46_000, portfolioValueNok: 44_600 },
  { date: '2025-11-03', investedCapitalNok: 46_000, portfolioValueNok: 48_900 },
  { date: '2025-12-03', investedCapitalNok: 62_000, portfolioValueNok: 64_800 },
  { date: '2026-01-03', investedCapitalNok: 62_000, portfolioValueNok: 66_100 },
  { date: '2026-02-03', investedCapitalNok: 78_000, portfolioValueNok: 75_200 },
  { date: '2026-03-03', investedCapitalNok: 90_000, portfolioValueNok: 94_600 },
  { date: '2026-04-03', investedCapitalNok: 90_000, portfolioValueNok: 98_100 },
  { date: '2026-05-03', investedCapitalNok: 112_000, portfolioValueNok: 116_400 },
  { date: '2026-06-03', investedCapitalNok: 112_000, portfolioValueNok: 121_800 },
  { date: '2026-07-03', investedCapitalNok: 140_000, portfolioValueNok: 147_500 },
  { date: '2026-08-03', investedCapitalNok: 140_000, portfolioValueNok: 158_900 },
  { date: '2026-09-03', investedCapitalNok: 170_940, portfolioValueNok: 184_320 },
];

export const OVERALL_PERFORMANCE_DEFAULT_RANGE: PortfolioRangeKey = '6M';

/** Sliced from the single canonical monthly series above — no duplicated series per range. */
export const overallPerformanceHistoryByRange: Record<PortfolioRangeKey, OverallPerformancePoint[]> = {
  '1M': overallPerformanceHistoryAll.slice(-2),
  '3M': overallPerformanceHistoryAll.slice(-4),
  '6M': overallPerformanceHistoryAll.slice(-7),
  '1Y': overallPerformanceHistoryAll.slice(-13),
  ALL: overallPerformanceHistoryAll,
};

const latestOverallPoint = overallPerformanceHistoryAll[overallPerformanceHistoryAll.length - 1];
const overallGainNok = latestOverallPoint.portfolioValueNok - latestOverallPoint.investedCapitalNok;

/** Derived from the latest history point, not restated, so it can't drift from the chart. */
export const homeOverallPerformanceSummary = {
  totalValueNok: latestOverallPoint.portfolioValueNok,
  totalInvestedNok: latestOverallPoint.investedCapitalNok,
  gainNok: overallGainNok,
  gainPercentage: (overallGainNok / latestOverallPoint.investedCapitalNok) * 100,
};

/**
 * Each club gets its own deterministic 14-day sparkline shape (same date
 * window, for a consistent "recent trend" feel) so the "Your clubs" list
 * doesn't read as three copies of the same line. This is a Home-only
 * glance dataset, independent of Club Dashboard's own chart — WRIC's real
 * chart on the Club Dashboard is untouched by this.
 *
 * WRIC — strongest overall growth, with ordinary volatility.
 */
const wricSparklineHistory: PortfolioHistoryPoint[] = [
  { date: '2026-08-21', valueNok: 89_340 },
  { date: '2026-08-22', valueNok: 89_720 },
  { date: '2026-08-23', valueNok: 89_540 },
  { date: '2026-08-24', valueNok: 90_050 },
  { date: '2026-08-25', valueNok: 90_380 },
  { date: '2026-08-26', valueNok: 90_190 },
  { date: '2026-08-27', valueNok: 90_720 },
  { date: '2026-08-28', valueNok: 91_050 },
  { date: '2026-08-29', valueNok: 90_830 },
  { date: '2026-08-30', valueNok: 91_280 },
  { date: '2026-08-31', valueNok: 91_650 },
  { date: '2026-09-01', valueNok: 91_420 },
  { date: '2026-09-02', valueNok: 91_960 },
  { date: '2026-09-03', valueNok: 92_480 },
];

/** West Coast — mostly sideways/moderate growth, with a small mid-window pullback before recovering. */
const westCoastHistory: PortfolioHistoryPoint[] = [
  { date: '2026-08-21', valueNok: 53_780 },
  { date: '2026-08-22', valueNok: 53_920 },
  { date: '2026-08-23', valueNok: 53_840 },
  { date: '2026-08-24', valueNok: 53_700 },
  { date: '2026-08-25', valueNok: 53_560 },
  { date: '2026-08-26', valueNok: 53_400 },
  { date: '2026-08-27', valueNok: 53_480 },
  { date: '2026-08-28', valueNok: 53_620 },
  { date: '2026-08-29', valueNok: 53_780 },
  { date: '2026-08-30', valueNok: 53_950 },
  { date: '2026-08-31', valueNok: 54_120 },
  { date: '2026-09-01', valueNok: 54_280 },
  { date: '2026-09-02', valueNok: 54_460 },
  { date: '2026-09-03', valueNok: 54_620 },
];

/** Family — a visible early dip, then a sustained recovery to a modest overall gain. */
const familyHistory: PortfolioHistoryPoint[] = [
  { date: '2026-08-21', valueNok: 36_780 },
  { date: '2026-08-22', valueNok: 36_520 },
  { date: '2026-08-23', valueNok: 36_180 },
  { date: '2026-08-24', valueNok: 35_920 },
  { date: '2026-08-25', valueNok: 36_050 },
  { date: '2026-08-26', valueNok: 36_280 },
  { date: '2026-08-27', valueNok: 36_450 },
  { date: '2026-08-28', valueNok: 36_620 },
  { date: '2026-08-29', valueNok: 36_540 },
  { date: '2026-08-30', valueNok: 36_780 },
  { date: '2026-08-31', valueNok: 36_920 },
  { date: '2026-09-01', valueNok: 37_050 },
  { date: '2026-09-02', valueNok: 37_140 },
  { date: '2026-09-03', valueNok: 37_220 },
];

export const homeClubs: HomeClubSummary[] = [
  {
    id: 'wric',
    name: clubDashboardDemoData.clubName,
    memberCount: clubDashboardDemoData.members.length,
    portfolioValueNok: clubDashboardDemoData.portfolioValueNok,
    returnPercentage: clubDashboardDemoData.estimatedReturnPercentage,
    history: wricSparklineHistory,
    navigable: true,
  },
  {
    id: 'west-coast',
    name: 'West Coast',
    memberCount: 5,
    portfolioValueNok: 54_620,
    returnPercentage: 6.2,
    history: westCoastHistory,
    navigable: false,
  },
  {
    id: 'family',
    name: 'Family',
    memberCount: 3,
    portfolioValueNok: 37_220,
    returnPercentage: 4.8,
    history: familyHistory,
    navigable: false,
  },
];
