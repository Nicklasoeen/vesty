import assert from 'node:assert/strict';
import test from 'node:test';

import { needsFlexibleContributionSetup, presentClubContributionSummary } from './presentContribution.ts';

test('equal summary shows the shared amount and never an aggregate', () => {
  const presented = presentClubContributionSummary({
    clubId: 'club-a',
    policyVersionId: 'policy-1',
    mode: 'equal',
    currency: 'NOK',
    equalAmountMinor: 200000,
  });

  assert.equal(presented.styleLabel, 'Same amount');
  assert.match(presented.detail, /2\s?000 kr/);
  assert.doesNotMatch(presented.detail.toLowerCase(), /total|average|members contribute/);
});

test('flexible summary never includes another member amount', () => {
  const presented = presentClubContributionSummary({
    clubId: 'club-a',
    policyVersionId: 'policy-1',
    mode: 'flexible',
    currency: 'NOK',
    equalAmountMinor: null,
  });

  assert.equal(presented.styleLabel, 'Flexible amounts');
  assert.equal(presented.detail, 'Each member chooses their amount privately');
  assert.doesNotMatch(presented.detail, /\d/);
});

test('setup is required only for flexible members without a commitment', () => {
  const flexible = {
    clubId: 'club-a',
    policyVersionId: 'policy-1',
    mode: 'flexible' as const,
    currency: 'NOK',
    equalAmountMinor: null,
  };
  const equal = { ...flexible, mode: 'equal' as const, equalAmountMinor: 200000 };

  assert.equal(needsFlexibleContributionSetup(flexible, null), true);
  assert.equal(needsFlexibleContributionSetup(equal, null), false);
  assert.equal(
    needsFlexibleContributionSetup(flexible, {
      clubId: 'club-a',
      membershipId: 'm1',
      commitmentVersionId: 'c1',
      versionNumber: 1,
      amountMinor: 200000,
      currency: 'NOK',
      createdAt: '2026-09-06T00:00:00.000Z',
    }),
    false,
  );
});
