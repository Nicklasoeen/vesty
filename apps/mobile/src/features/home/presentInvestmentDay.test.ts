import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { presentInvestmentDayHeading } from './presentInvestmentDay.ts';

const noon = new Date('2026-09-06T12:00:00');

describe('presentInvestmentDayHeading', () => {
  it('labels an open cycle as current, not next', () => {
    assert.equal(
      presentInvestmentDayHeading({
        cycleStatus: 'open',
        investmentDayAt: '2026-09-06T08:00:00.000Z',
        now: noon,
      }),
      'Current Investment Day',
    );
  });

  it('keeps Next for a genuinely upcoming cycle', () => {
    assert.equal(
      presentInvestmentDayHeading({
        cycleStatus: 'upcoming',
        investmentDayAt: '2026-09-13T08:00:00.000Z',
        now: noon,
      }),
      'Next Investment Day',
    );
  });

  it('does not call an open cycle Next even when the calendar date is later', () => {
    assert.equal(
      presentInvestmentDayHeading({
        cycleStatus: 'open',
        investmentDayAt: '2026-09-13T08:00:00.000Z',
        now: noon,
      }),
      'Current Investment Day',
    );
  });

  it('uses Next when only a future date is known', () => {
    assert.equal(
      presentInvestmentDayHeading({
        cycleStatus: null,
        investmentDayAt: '2026-09-13T08:00:00.000Z',
        now: noon,
      }),
      'Next Investment Day',
    );
  });

  it('uses a neutral label when the cycle is not current or upcoming', () => {
    assert.equal(
      presentInvestmentDayHeading({
        cycleStatus: 'completed',
        investmentDayAt: '2026-09-01T08:00:00.000Z',
        now: noon,
      }),
      'Investment Day',
    );
  });

  it('keeps the contribution-setup title', () => {
    assert.equal(
      presentInvestmentDayHeading({
        setupRequired: true,
        cycleStatus: 'open',
        investmentDayAt: '2026-09-06T08:00:00.000Z',
        now: noon,
      }),
      'Your contribution',
    );
  });

  it('labels setup_next as contribution, not current', () => {
    assert.equal(
      presentInvestmentDayHeading({
        viewerState: 'setup_next',
        cycleStatus: 'open',
        investmentDayAt: '2026-09-06T08:00:00.000Z',
        now: noon,
      }),
      'Your contribution',
    );
  });

  it('labels closed reporting as Investment Day', () => {
    assert.equal(
      presentInvestmentDayHeading({
        viewerState: 'closed',
        cycleStatus: 'completed',
        investmentDayAt: '2026-09-01T08:00:00.000Z',
        now: noon,
      }),
      'Investment Day',
    );
  });
});
