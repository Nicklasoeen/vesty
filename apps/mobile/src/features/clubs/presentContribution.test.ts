import assert from 'node:assert/strict';
import test from 'node:test';

import {
  needsFlexibleContributionSetup,
  presentClubContributionSummary,
  presentContributionPolicyTiming,
} from './presentContribution.ts';

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

test('future policy that differs from a frozen cycle amount gets calm timing copy', () => {
  const equal = presentContributionPolicyTiming({
    mode: 'equal',
    policyAmountMinor: 500000,
    frozenCycleAmountMinor: 350000,
  });
  assert.equal(equal.appliesCopy, 'Applies from the next Investment Day.');
  assert.equal(equal.frozenAmountMinor, 350000);
  assert.equal(equal.policyAmountMinor, 500000);

  const matching = presentContributionPolicyTiming({
    mode: 'equal',
    policyAmountMinor: 350000,
    frozenCycleAmountMinor: 350000,
  });
  assert.equal(matching.appliesCopy, null);
  assert.equal(matching.frozenAmountMinor, 350000);

  const flexible = presentContributionPolicyTiming({
    mode: 'flexible',
    policyAmountMinor: 300000,
    frozenCycleAmountMinor: 200000,
  });
  assert.equal(flexible.appliesCopy, 'Applies from your next Investment Day.');
  assert.equal(flexible.frozenAmountMinor, 200000);
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
