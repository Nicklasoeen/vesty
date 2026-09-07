import assert from 'node:assert/strict';
import test from 'node:test';

import { CORE_V1_TARGET_IDS } from '../clubs/curatedInvestmentPackages.ts';

import { shouldShowQuantityFieldsOnInvestmentDay } from './holdingConfidence.ts';
import { rowsFromPlan } from './investRows.ts';
import type { InvestmentDayPlan } from './types.ts';

function samplePlan(): InvestmentDayPlan {
  return {
    clubId: 'club',
    clubName: 'Friday Club',
    membershipId: 'member',
    cycleId: 'cycle',
    investmentDayAt: '2026-09-05T08:00:00.000Z',
    cycleStatus: 'open',
    viewerState: 'open',
    reportingAllowed: true,
    reportingOpensAt: '2026-09-05T10:00:00.000Z',
    reportingClosesAt: '2026-09-12T10:00:00.000Z',
    participationId: 'part',
    participationOutcome: 'expected',
    expectedAmountMinor: 200000,
    currency: 'NOK',
    allocations: [
      {
        investmentTargetId: CORE_V1_TARGET_IDS.vwce,
        name: 'Vanguard FTSE All-World UCITS ETF - (USD) Acc',
        kind: 'etf',
        ticker: 'VWCE',
        instrumentCurrency: 'EUR',
        allocationBps: 6000,
        position: 1,
        amountMinor: 120000,
      },
    ],
    transactions: [],
    isCompleted: false,
  };
}

test('default Investment Day rows use exposure and NOK amount, not quantity', () => {
  const [row] = rowsFromPlan(samplePlan());
  assert.ok(row);
  assert.equal(row.exposureLabel, 'World');
  assert.equal(row.ticker, 'VWCE');
  assert.equal(row.amountMinor, 120000);
  assert.equal(row.quantity, null);
  assert.equal(shouldShowQuantityFieldsOnInvestmentDay(), false);
});
