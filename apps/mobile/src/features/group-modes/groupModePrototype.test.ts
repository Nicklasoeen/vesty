import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CORE_V1_TARGETS } from '../clubs/curatedInvestmentPackages.ts';
import {
  INITIAL_GROUP_MODE_DRAFT,
  nextGroupModeStep,
  previousGroupModeStep,
  prototypeCanContinue,
  prototypeSubmitHasServerOperation,
  selectGroupMode,
  setCustomAllocationPercent,
  toggleCustomTarget,
  validateCustomAllocations,
} from './groupModePrototype.ts';
import {
  presentFundBroker,
  presentGroupModeOptions,
  presentPrototypeReview,
} from './presentGroupModePrototype.ts';

describe('group-mode prototype navigation', () => {
  it('follows the contract order and preserves compatible choices', () => {
    assert.equal(nextGroupModeStep('name'), 'mode');
    assert.equal(nextGroupModeStep('investment'), 'contribution');
    assert.equal(nextGroupModeStep('contribution'), 'governance');
    assert.equal(previousGroupModeStep('review'), 'governance');

    const selected = selectGroupMode(
      { ...INITIAL_GROUP_MODE_DRAFT, clubName: 'Langsiktig sammen' },
      'simple_saving',
    );
    assert.equal(selected.clubName, 'Langsiktig sammen');
    assert.equal(selected.mode, 'simple_saving');
  });

  it('clears incompatible investment choices when the mode changes', () => {
    const changed = selectGroupMode(
      {
        ...INITIAL_GROUP_MODE_DRAFT,
        mode: 'simple_saving',
        simpleFundSelected: true,
        customAllocations: [{ targetId: CORE_V1_TARGETS[0]!.id, percent: 100 }],
      },
      'custom_strategy',
    );
    assert.equal(changed.simpleFundSelected, false);
    assert.deepEqual(changed.customAllocations, []);
  });
});

describe('custom allocation validation', () => {
  it('distinguishes empty, under, valid, and over 100 percent', () => {
    assert.equal(validateCustomAllocations([]).status, 'empty');
    assert.equal(
      validateCustomAllocations([{ targetId: 'a', percent: 80 }]).status,
      'under',
    );
    assert.equal(
      validateCustomAllocations([{ targetId: 'a', percent: 100 }]).status,
      'valid',
    );
    assert.equal(
      validateCustomAllocations([{ targetId: 'a', percent: 120 }]).status,
      'over',
    );
  });

  it('limits selection to five controlled targets', () => {
    const all = CORE_V1_TARGETS.reduce(
      (items, target) => toggleCustomTarget(items, target.id),
      [] as { targetId: string; percent: number }[],
    );
    assert.equal(all.length, 5);
    assert.deepEqual(toggleCustomTarget(all, 'not-in-catalog'), all);
    assert.equal(setCustomAllocationPercent(all, all[0]!.targetId, 40)[0]!.percent, 40);
  });
});

describe('prototype presentation and safety', () => {
  it('presents equal group modes without ranking either option', () => {
    const options = presentGroupModeOptions(null);
    assert.deepEqual(options.map((item) => item.title), [
      'Simple saving',
      'Build your strategy',
    ]);
    assert.doesNotMatch(JSON.stringify(options), /best|better|return|profit/i);
  });

  it('shows controlled broker facts and an honest unknown state', () => {
    assert.match(presentFundBroker('dnb').cost, /0\.20%/);
    assert.match(presentFundBroker('nordnet').cost, /0\.25%/);
    assert.match(presentFundBroker('unknown').availability, /Confirm/);
  });

  it('builds a confirmation-style review but has no server operation', () => {
    const review = presentPrototypeReview({
      ...INITIAL_GROUP_MODE_DRAFT,
      step: 'review',
      clubName: 'Familiefondet',
      mode: 'simple_saving',
      simpleFundSelected: true,
      contributionMode: 'flexible',
      flexibleAmountInput: '1000',
    });
    assert.match(review.ownership, /owns their investments/);
    assert.match(review.contribution.privacy, /private/);
    assert.match(review.prototypeNotice, /cannot create a real club/);
    assert.equal(prototypeSubmitHasServerOperation(), false);
  });

  it('blocks investment continuation for unavailable catalogs or invalid allocations', () => {
    assert.equal(
      prototypeCanContinue(
        {
          ...INITIAL_GROUP_MODE_DRAFT,
          step: 'investment',
          mode: 'simple_saving',
          simpleFundSelected: true,
        },
        'unavailable',
      ),
      false,
    );
    assert.equal(
      prototypeCanContinue(
        {
          ...INITIAL_GROUP_MODE_DRAFT,
          step: 'investment',
          mode: 'custom_strategy',
          customAllocations: [{ targetId: CORE_V1_TARGETS[0]!.id, percent: 90 }],
        },
        'ready',
      ),
      false,
    );
  });
});
