import type { OverallPerformancePoint } from '@/demo/homeDemoData';
import type { PortfolioRangeKey } from '@/demo/clubDemoData';

import type { PortfolioHistoryPoint } from './portfolioApi';

const RANGE_DAYS: Record<PortfolioRangeKey, number | null> = {
  '1M': 31,
  '3M': 93,
  '6M': 186,
  '1Y': 366,
  ALL: null,
};

export function toChartPoints(points: PortfolioHistoryPoint[]): OverallPerformancePoint[] {
  return points.flatMap((point) => {
    if (point.pointStatus !== 'available' || point.estimatedValueMinor === null) {
      return [];
    }

    return [
      {
        date: point.date,
        portfolioValueNok: Math.trunc(point.estimatedValueMinor / 100),
        investedCapitalNok: Math.trunc(point.investedMinor / 100),
      },
    ];
  });
}

export function historyByRange(
  points: PortfolioHistoryPoint[],
  today = new Date(),
): Record<PortfolioRangeKey, OverallPerformancePoint[]> {
  const chartPoints = toChartPoints(points);
  const todayIso = today.toISOString().slice(0, 10);

  return {
    '1M': sliceRange(chartPoints, todayIso, RANGE_DAYS['1M']),
    '3M': sliceRange(chartPoints, todayIso, RANGE_DAYS['3M']),
    '6M': sliceRange(chartPoints, todayIso, RANGE_DAYS['6M']),
    '1Y': sliceRange(chartPoints, todayIso, RANGE_DAYS['1Y']),
    ALL: chartPoints,
  };
}

function sliceRange(
  points: OverallPerformancePoint[],
  todayIso: string,
  days: number | null,
): OverallPerformancePoint[] {
  if (days == null) {
    return points;
  }

  const start = shiftIsoDate(todayIso, -days);
  return points.filter((point) => point.date >= start && point.date <= todayIso);
}

function shiftIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
