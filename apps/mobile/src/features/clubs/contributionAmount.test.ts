import assert from 'node:assert/strict';
import test from 'node:test';

import {
  contributionKronerFromMinor,
  isValidContributionAmountMinor,
  parseContributionKronerInput,
} from './contributionAmount.ts';

test('parses whole kroner into minor units', () => {
  assert.equal(parseContributionKronerInput('2000'), 200000);
  assert.equal(parseContributionKronerInput(' 1500 '), 150000);
  assert.equal(parseContributionKronerInput('1'), 100);
});

test('rejects invented or invalid contribution amounts', () => {
  assert.equal(parseContributionKronerInput(''), null);
  assert.equal(parseContributionKronerInput('0'), null);
  assert.equal(parseContributionKronerInput('2000.5'), null);
  assert.equal(parseContributionKronerInput('abc'), null);
  assert.equal(isValidContributionAmountMinor(0), false);
  assert.equal(isValidContributionAmountMinor(null), false);
});

test('formats minor units back to whole kroner for editing', () => {
  assert.equal(contributionKronerFromMinor(200000), '2000');
  assert.equal(contributionKronerFromMinor(0), '');
});
