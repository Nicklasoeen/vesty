import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { VERIFIED_NORDNET_MONTHLY_SAVING_URL, VERIFIED_NORDNET_PRODUCT_PAGE_URL } from './nordnetHandoffUrl.ts';
import {
  presentInvestCanConfirm,
  presentInvestJourneyProgress,
  presentInvestJourneySurface,
  presentInvestShowsIntro,
  presentInvestUsesMintIntro,
  type InvestJourneyInput,
} from './presentInvestJourney.ts';
import {
  presentInvestAttestationConflictCopy,
  presentInvestAttestationErrorCopy,
  presentInvestAttestationTimeoutCopy,
  presentInvestChooseCopy,
  presentInvestIntroCopy,
  presentInvestReturnedCopy,
} from './presentInvestJourneyCopy.ts';
import type { MonthlySavingSetup } from './presentMonthlySavingSetup.ts';
import type { InvestmentDayPlan } from './types.ts';

function setup(overrides: Partial<MonthlySavingSetup> = {}): MonthlySavingSetup {
  return {
    status: 'not_set_up',
    provenance: 'member_attested',
    broker: 'nordnet',
    fundName: 'DNB Global Indeks A',
    isin: 'NO0010582984',
    recommendedAmountMinor: 200000,
    currency: 'NOK',
    recommendedInvestmentDayAt: '2026-10-05T10:00:00.000Z',
    scheduleDayOfMonth: 5,
    monthlySetupUrl: VERIFIED_NORDNET_MONTHLY_SAVING_URL,
    oneTimeProductUrl: VERIFIED_NORDNET_PRODUCT_PAGE_URL,
    attestedAt: null,
    attestedAmountMinor: null,
    attestedFundName: null,
    attestedScheduleDayOfMonth: null,
    amountChanged: false,
    fundChanged: false,
    scheduleChanged: false,
    oneTimeAvailable: true,
    rejectedMonthlyUrl: false,
    rejectedOneTimeUrl: false,
    ...overrides,
  };
}

function plan(overrides: Partial<InvestmentDayPlan> = {}): InvestmentDayPlan {
  return {
    clubId: 'club',
    clubName: 'Investorgroup',
    membershipId: 'member',
    cycleId: 'cycle',
    investmentDayAt: '2026-10-05T10:00:00.000Z',
    cycleStatus: 'upcoming',
    viewerState: 'upcoming',
    reportingAllowed: false,
    reportingOpensAt: '2026-10-05T10:00:00.000Z',
    reportingClosesAt: '2026-10-06T10:00:00.000Z',
    participationId: null,
    participationOutcome: 'expected',
    expectedAmountMinor: 200000,
    currency: 'NOK',
    allocations: [],
    transactions: [],
    isCompleted: false,
    ...overrides,
  };
}

function input(overrides: Partial<InvestJourneyInput> = {}): InvestJourneyInput {
  return {
    hasClub: true,
    clubsLoading: false,
    setup: setup(),
    setupLoading: false,
    setupError: null,
    monthlyPhase: 'idle',
    oneTimePhase: 'idle',
    introDismissed: false,
    localBranch: null,
    attested: false,
    attestationSaved: false,
    attestationIssue: null,
    openedMonthlyUrl: false,
    plan: plan(),
    planLoading: false,
    planError: null,
    planSetupRequired: false,
    reportStage: 'idle',
    reportCompleted: false,
    ...overrides,
  };
}

describe('presentInvestJourneySurface', () => {
  it('maps loading, error, no club, and intro for not_set_up', () => {
    assert.equal(presentInvestJourneySurface(input({ hasClub: false, setup: null })), 'no_club');
    assert.equal(presentInvestJourneySurface(input({ setup: null, setupLoading: true })), 'loading');
    assert.equal(
      presentInvestJourneySurface(input({ setup: null, setupError: 'Unable to load monthly saving' })),
      'request_error',
    );
    assert.equal(presentInvestJourneySurface(input()), 'intro');
    assert.equal(presentInvestShowsIntro(input()), true);
    assert.equal(presentInvestUsesMintIntro('intro'), true);
  });

  it('hides intro after dismissal and after an attested current setup', () => {
    assert.equal(presentInvestJourneySurface(input({ introDismissed: true })), 'choose');
    assert.equal(
      presentInvestJourneySurface(input({
        setup: setup({
          status: 'current',
          attestedAt: '2026-09-08T08:00:00.000Z',
          attestedAmountMinor: 200000,
          attestedFundName: 'DNB Global Indeks A',
          attestedScheduleDayOfMonth: 5,
        }),
        introDismissed: false,
      })),
      'investment_day_upcoming',
    );
  });

  it('keeps monthly, one-time, update, required, and unavailable distinct', () => {
    assert.equal(presentInvestJourneySurface(input({ introDismissed: true, localBranch: 'monthly' })), 'setup');
    assert.equal(presentInvestJourneySurface(input({ localBranch: 'one_time' })), 'one_time');
    assert.equal(
      presentInvestJourneySurface(input({ setup: setup({ status: 'needs_update', amountChanged: true }) })),
      'needs_update',
    );
    assert.equal(
      presentInvestJourneySurface(input({ setup: setup({ status: 'setup_required', recommendedAmountMinor: null }) })),
      'setup_required',
    );
    assert.equal(
      presentInvestJourneySurface(input({ setup: setup({ status: 'unavailable' }) })),
      'unavailable',
    );
  });

  it('enters returned and confirming only from monthly attestation phases', () => {
    assert.equal(presentInvestJourneySurface(input({ monthlyPhase: 'loading' })), 'opening_nordnet');
    assert.equal(presentInvestJourneySurface(input({ monthlyPhase: 'returned' })), 'returned');
    assert.equal(presentInvestJourneySurface(input({ monthlyPhase: 'confirming' })), 'confirming');
    assert.equal(presentInvestJourneySurface(input({ attestationSaved: true })), 'attestation_saved');
  });

  it('keeps timeout, ordinary save error, conflict, and saved attestation states distinct', () => {
    const timeout = presentInvestJourneySurface(input({
      monthlyPhase: 'returned',
      openedMonthlyUrl: true,
      attested: true,
      attestationIssue: 'timeout',
    }));
    const ordinary = presentInvestJourneySurface(input({
      monthlyPhase: 'returned',
      openedMonthlyUrl: true,
      attested: true,
      attestationIssue: 'error',
    }));
    const conflict = presentInvestJourneySurface(input({
      monthlyPhase: 'returned',
      openedMonthlyUrl: true,
      attested: true,
      attestationIssue: 'conflict',
    }));
    const saved = presentInvestJourneySurface(input({
      attestationSaved: true,
      monthlyPhase: 'idle',
    }));
    const loadError = presentInvestJourneySurface(input({
      monthlyPhase: 'error',
      attestationIssue: null,
    }));

    assert.equal(timeout, 'attestation_timeout');
    assert.equal(ordinary, 'attestation_error');
    assert.equal(conflict, 'attestation_conflict');
    assert.equal(saved, 'attestation_saved');
    assert.equal(loadError, 'request_error');
    assert.notEqual(timeout, ordinary);
    assert.notEqual(ordinary, conflict);
    assert.notEqual(timeout, saved);
    assert.notEqual(ordinary, loadError);

    const timeoutCopy = presentInvestAttestationTimeoutCopy();
    const errorCopy = presentInvestAttestationErrorCopy();
    const conflictCopy = presentInvestAttestationConflictCopy();
    assert.match(timeoutCopy.body, /could not confirm whether this confirmation was received/);
    assert.equal(timeoutCopy.body.includes('not saved'), false);
    assert.equal(timeoutCopy.body.toLowerCase().includes('timed out'), false);
    assert.match(errorCopy.body, /Unable to save this monthly saving confirmation/);
    assert.equal(errorCopy.body.toLowerCase().includes('timeout'), false);
    assert.equal(errorCopy.body.toLowerCase().includes('timed out'), false);
    assert.match(conflictCopy.body, /already saved with different details/);
    assert.notEqual(timeoutCopy.body, errorCopy.body);
    assert.notEqual(errorCopy.body, conflictCopy.body);
    assert.equal(presentInvestJourneyProgress('attestation_timeout').current, 4);
    assert.equal(presentInvestJourneyProgress('attestation_error').current, 4);
    assert.equal(presentInvestJourneyProgress('attestation_conflict').current, 4);
    assert.equal(presentInvestJourneyProgress('attestation_saved').finished, true);
  });

  it('gates one-time return on the reporting window without weakening it', () => {
    const openPlan = plan({
      viewerState: 'open',
      cycleStatus: 'open',
      reportingAllowed: true,
    });
    assert.equal(
      presentInvestJourneySurface(input({ oneTimePhase: 'returned', plan: openPlan })),
      'one_time_returned_reportable',
    );
    assert.equal(
      presentInvestJourneySurface(input({ oneTimePhase: 'returned', plan: plan({ viewerState: 'upcoming' }) })),
      'one_time_returned_outside_window',
    );
    assert.equal(
      presentInvestJourneySurface(input({
        oneTimePhase: 'returned',
        plan: plan({ viewerState: 'open', reportingAllowed: false }),
      })),
      'one_time_returned_outside_window',
    );
  });

  it('maps Investment Day open, upcoming, closed, and completed', () => {
    const current = setup({
      status: 'current',
      attestedAt: '2026-09-08T08:00:00.000Z',
      attestedAmountMinor: 200000,
      attestedFundName: 'DNB Global Indeks A',
      attestedScheduleDayOfMonth: 5,
    });
    assert.equal(
      presentInvestJourneySurface(input({
        setup: current,
        plan: plan({ viewerState: 'open', cycleStatus: 'open', reportingAllowed: true }),
      })),
      'investment_day_open',
    );
    assert.equal(
      presentInvestJourneySurface(input({
        setup: current,
        plan: plan({ viewerState: 'open', cycleStatus: 'open', reportingAllowed: true }),
        reportStage: 'choices',
      })),
      'investment_day_report',
    );
    assert.equal(
      presentInvestJourneySurface(input({
        setup: current,
        plan: plan({ viewerState: 'open', cycleStatus: 'open', reportingAllowed: true }),
        reportStage: 'review',
      })),
      'investment_day_review',
    );
    assert.equal(
      presentInvestJourneySurface(input({
        setup: current,
        plan: plan({ viewerState: 'closed', cycleStatus: 'closed' }),
      })),
      'investment_day_closed',
    );
    assert.equal(
      presentInvestJourneySurface(input({
        setup: current,
        plan: plan({ isCompleted: true, viewerState: 'open' }),
      })),
      'investment_day_completed',
    );
  });
});

describe('presentInvestCanConfirm', () => {
  it('requires a real monthly return and the member checkbox', () => {
    assert.equal(
      presentInvestCanConfirm(input({ monthlyPhase: 'returned', openedMonthlyUrl: true, attested: false })),
      false,
    );
    assert.equal(
      presentInvestCanConfirm(input({ monthlyPhase: 'returned', openedMonthlyUrl: true, attested: true })),
      true,
    );
    assert.equal(
      presentInvestCanConfirm(input({ monthlyPhase: 'idle', openedMonthlyUrl: true, attested: true })),
      false,
    );
    assert.equal(
      presentInvestCanConfirm(input({
        monthlyPhase: 'returned',
        openedMonthlyUrl: true,
        attested: true,
        attestationIssue: 'timeout',
      })),
      true,
    );
    assert.equal(
      presentInvestCanConfirm(input({
        monthlyPhase: 'returned',
        openedMonthlyUrl: true,
        attested: true,
        attestationIssue: 'error',
      })),
      true,
    );
    assert.equal(
      presentInvestCanConfirm(input({
        monthlyPhase: 'returned',
        openedMonthlyUrl: true,
        attested: true,
        attestationIssue: 'conflict',
      })),
      false,
    );
  });
});

describe('presentInvestJourneyProgress', () => {
  it('hides intro and ready chrome, and uses four setup steps', () => {
    assert.equal(presentInvestJourneyProgress('intro').hidden, true);
    assert.equal(presentInvestJourneyProgress('choose').current, 1);
    assert.equal(presentInvestJourneyProgress('setup').current, 2);
    assert.equal(presentInvestJourneyProgress('returned').current, 3);
    assert.equal(presentInvestJourneyProgress('attestation_saved').finished, true);
    assert.equal(presentInvestJourneyProgress('investment_day_open').total, 2);
  });
});

describe('invest journey copy', () => {
  it('keeps the approved English intro and confirmation language', () => {
    const intro = presentInvestIntroCopy();
    assert.equal(intro.eyebrow, 'Your next small step');
    assert.equal(intro.titleLead, 'Small steps.');
    assert.equal(intro.titleEmphasis, 'A lasting habit.');
    assert.match(intro.body, /Make room for your future/);
    assert.equal(intro.startLabel, 'Find your saving rhythm');
    assert.equal(presentInvestChooseCopy().monthlyBadge, 'Recommended');
    const returned = presentInvestReturnedCopy(false);
    assert.match(returned.checkboxLabel ?? '', /I've set up monthly saving/);
    assert.match(returned.note, /cannot verify/);
  });
});
