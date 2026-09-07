import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SAME_AMOUNT_REQUIRED_ERROR,
  SAME_AMOUNT_UNCHANGED_ERROR,
  availableContributionProposalActions,
  canContinueContributionProposalDraft,
  contributionProposalActionLabel,
  currentEqualAmountLabel,
  equalToFlexibleTransitionCopy,
  validateContributionProposalDraft,
} from './createContributionProposal.ts';

describe('create contribution proposal from Same amount', () => {
  it('allows a new shared amount and switching to Flexible', () => {
    assert.deepEqual(availableContributionProposalActions('equal'), [
      'change_amount',
      'switch_to_flexible',
    ]);
    assert.equal(contributionProposalActionLabel('change_amount'), 'Change the amount');
    assert.equal(contributionProposalActionLabel('switch_to_flexible'), 'Switch to Flexible amounts');

    const changed = validateContributionProposalDraft({
      currentMode: 'equal',
      currentEqualAmountMinor: 200000,
      action: 'change_amount',
      amountInput: '3000',
    });
    assert.deepEqual(changed, {
      ok: true,
      value: { proposedMode: 'equal', proposedEqualAmountMinor: 300000 },
    });

    const flexible = validateContributionProposalDraft({
      currentMode: 'equal',
      currentEqualAmountMinor: 200000,
      action: 'switch_to_flexible',
      amountInput: '',
    });
    assert.deepEqual(flexible, {
      ok: true,
      value: { proposedMode: 'flexible', proposedEqualAmountMinor: null },
    });
  });

  it('rejects the same shared amount in the UI domain', () => {
    const same = validateContributionProposalDraft({
      currentMode: 'equal',
      currentEqualAmountMinor: 200000,
      action: 'change_amount',
      amountInput: '2000',
    });
    assert.deepEqual(same, { ok: false, error: SAME_AMOUNT_UNCHANGED_ERROR });
    assert.equal(
      canContinueContributionProposalDraft({
        currentMode: 'equal',
        currentEqualAmountMinor: 200000,
        action: 'change_amount',
        amountInput: '2000',
      }),
      false,
    );
    assert.equal(
      canContinueContributionProposalDraft({
        currentMode: 'equal',
        currentEqualAmountMinor: 200000,
        action: 'change_amount',
        amountInput: '',
      }),
      false,
    );
  });
});

describe('create contribution proposal from Flexible amounts', () => {
  it('only offers Switch to Same amount and requires a shared amount', () => {
    assert.deepEqual(availableContributionProposalActions('flexible'), ['switch_to_equal']);
    assert.equal(contributionProposalActionLabel('switch_to_equal'), 'Switch to Same amount');
    assert.equal(
      validateContributionProposalDraft({
        currentMode: 'flexible',
        currentEqualAmountMinor: null,
        action: 'switch_to_flexible',
        amountInput: '',
      }).ok,
      false,
    );
    assert.deepEqual(
      validateContributionProposalDraft({
        currentMode: 'flexible',
        currentEqualAmountMinor: null,
        action: 'switch_to_equal',
        amountInput: '',
      }),
      { ok: false, error: SAME_AMOUNT_REQUIRED_ERROR },
    );
    assert.deepEqual(
      validateContributionProposalDraft({
        currentMode: 'flexible',
        currentEqualAmountMinor: 999999,
        action: 'switch_to_equal',
        amountInput: '2500',
      }),
      { ok: true, value: { proposedMode: 'equal', proposedEqualAmountMinor: 250000 } },
    );
  });

  it('never invents a current Flexible amount for the form', () => {
    assert.equal(currentEqualAmountLabel(null), null);
    assert.match(currentEqualAmountLabel(200000) ?? '', /2\s?000 kr/);
    assert.match(equalToFlexibleTransitionCopy().toLowerCase(), /current amount/);
    assert.doesNotMatch(equalToFlexibleTransitionCopy(), /average|total|range|commitment/i);
  });
});
