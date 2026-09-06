import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ContributionSetupRequiredError,
  isContributionPolicyMode,
  isContributionSetupRequiredError,
  presentClubContributionPolicy,
} from './contributionPolicy.ts';

test('accepts only equal and flexible contribution modes', () => {
  assert.equal(isContributionPolicyMode('equal'), true);
  assert.equal(isContributionPolicyMode('flexible'), true);
  assert.equal(isContributionPolicyMode('shared'), false);
});

test('public flexible policy presentation never includes a shared amount', () => {
  const presented = presentClubContributionPolicy({
    clubId: 'club-a',
    policyVersionId: 'policy-1',
    mode: 'flexible',
    currency: 'NOK',
    equalAmountMinor: 200000,
  });

  assert.equal(presented.mode, 'flexible');
  assert.equal(presented.equalAmountMinor, null);
});

test('equal policy presentation keeps the shared amount', () => {
  const presented = presentClubContributionPolicy({
    clubId: 'club-a',
    policyVersionId: 'policy-2',
    mode: 'equal',
    currency: 'NOK',
    equalAmountMinor: 250000,
  });

  assert.equal(presented.equalAmountMinor, 250000);
});

test('setup-required is a typed state, not a generic error', () => {
  const error = new ContributionSetupRequiredError();
  assert.equal(isContributionSetupRequiredError(error), true);
  assert.equal(isContributionSetupRequiredError(new Error('Unable to load this Investment Day')), false);
});
