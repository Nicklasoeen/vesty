import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isReportableInvestmentDay,
  presentInvestmentDayCycleCopy,
} from './presentInvestmentDayCycle.ts';
import type { InvestmentDayPlan } from './types.ts';

describe('presentInvestmentDayCycleCopy', () => {
  it('describes upcoming reporting with local open time', () => {
    const copy = presentInvestmentDayCycleCopy({
      viewerState: 'upcoming',
      investmentDayAt: '2026-09-05T10:00:00.000Z',
      reportingOpensAt: '2026-09-05T10:00:00.000Z',
    });
    assert.equal(copy.showReportActions, false);
    assert.match(copy.body, /Reporting opens/);
  });

  it('explains that setup_next applies from the next Investment Day', () => {
    const copy = presentInvestmentDayCycleCopy({ viewerState: 'setup_next' });
    assert.equal(copy.showContributionSetup, true);
    assert.equal(copy.setupAppliesNext, true);
    assert.match(copy.body, /next Investment Day/);
  });

  it('keeps missing as retryable and never creating', () => {
    const copy = presentInvestmentDayCycleCopy({ viewerState: 'missing' });
    assert.equal(copy.retryLabel, 'Try again');
    assert.match(copy.body, /never creates/);
  });

  it('hides report actions when reporting is closed', () => {
    const copy = presentInvestmentDayCycleCopy({ viewerState: 'closed' });
    assert.equal(copy.showReportActions, false);
    assert.match(copy.body, /closed/);
  });

  it('explains that a late Flexible setup is not in this snapshot', () => {
    const copy = presentInvestmentDayCycleCopy({ viewerState: 'not_in_snapshot' });
    assert.equal(copy.showReportActions, false);
    assert.match(copy.body, /not part of this Investment Day/);
  });
});

describe('isReportableInvestmentDay', () => {
  it('requires an open server-allowed cycle', () => {
    const plan = {
      viewerState: 'open',
      reportingAllowed: true,
      cycleId: 'cycle',
    } as InvestmentDayPlan;
    assert.equal(isReportableInvestmentDay(plan), true);
    assert.equal(isReportableInvestmentDay({ ...plan, reportingAllowed: false }), false);
    assert.equal(isReportableInvestmentDay({ ...plan, viewerState: 'upcoming' }), false);
  });
});
