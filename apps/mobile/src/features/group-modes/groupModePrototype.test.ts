import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createEmptyCreateClubDraft } from '../clubs/createClubWizard.ts';
import { DNB_GLOBAL_INDEKS_A_PRODUCT_ID } from '../clubs/singleFundCatalog.ts';
import { presentGroupModeOptions, presentPrototypeReview } from './presentGroupModePrototype.ts';
import {
  INITIAL_GROUP_MODE_DRAFT,
  prototypeSubmitHasServerOperation,
  selectGroupMode,
} from './groupModePrototype.ts';

describe('group-mode production presentation', () => {
  it('keeps Build your strategy visible and locked', () => {
    const options = presentGroupModeOptions(null);
    assert.deepEqual(options.map((item) => item.title), ['Simple saving', 'Build your strategy']);
    assert.equal(options[0]?.locked, false);
    assert.equal(options[1]?.locked, true);
    assert.equal(options[1]?.lockReason, 'Available after initial testing');
    assert.match(options[1]?.accessibilityLabel ?? '', /Available after initial testing/);
    assert.doesNotMatch(JSON.stringify(options), /best|better|return|profit|recommended for you/i);
  });

  it('ignores a manipulated custom-mode selection', () => {
    const selected = selectGroupMode(
      { ...INITIAL_GROUP_MODE_DRAFT, clubName: 'Langsiktig sammen' },
      'custom_strategy',
    );
    assert.equal(selected.mode, null);
  });

  it('builds a Simple saving review without prototype notices', () => {
    const review = presentPrototypeReview({
      ...createEmptyCreateClubDraft('86000000-0000-4000-8000-000000000001'),
      step: 'review',
      name: 'Familiefondet',
      mode: 'single_fund',
      catalogProductId: DNB_GLOBAL_INDEKS_A_PRODUCT_ID,
      contributionMode: 'flexible',
      creatorFlexibleAmountInput: '1000',
    });
    assert.match(review.groupTypeDetail, /DNB Global Indeks A/);
    assert.match(review.contributionPrivacy ?? '', /Other members will not see it/);
    assert.match(review.ownership, /does not hold money/);
    assert.equal('customLocked' in review, false);
    assert.equal(prototypeSubmitHasServerOperation(), false);
  });
});
