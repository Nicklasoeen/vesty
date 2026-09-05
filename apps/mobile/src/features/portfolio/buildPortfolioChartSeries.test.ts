import assert from 'node:assert/strict';
import test from 'node:test';

import { historyByRange, toChartPoints } from './buildPortfolioChartSeries.ts';
import type { PortfolioHistoryPoint } from './portfolioApi.ts';

const points: PortfolioHistoryPoint[] = [
  { date: '2026-01-08', investedMinor: 0, estimatedValueMinor: 0, pointStatus: 'available' },
  { date: '2026-01-15', investedMinor: 200000, estimatedValueMinor: 200000, pointStatus: 'available' },
  { date: '2026-01-22', investedMinor: 200000, estimatedValueMinor: null, pointStatus: 'unavailable' },
  { date: '2026-08-01', investedMinor: 200000, estimatedValueMinor: 229166, pointStatus: 'available' },
];

test('drops unavailable chart points instead of inventing values', () => {
  const chart = toChartPoints(points);
  assert.deepEqual(
    chart.map((point) => point.date),
    ['2026-01-08', '2026-01-15', '2026-08-01'],
  );
  assert.equal(chart[1]?.investedCapitalNok, 2000);
  assert.equal(chart[1]?.portfolioValueNok, 2000);
});

test('range slices do not pull later points into an earlier window', () => {
  const byRange = historyByRange(points, new Date('2026-01-20T12:00:00Z'));
  assert.deepEqual(
    byRange['1M'].map((point) => point.date),
    ['2026-01-08', '2026-01-15'],
  );
  assert.equal(
    byRange['1M'].some((point) => point.date === '2026-08-01'),
    false,
  );
});
