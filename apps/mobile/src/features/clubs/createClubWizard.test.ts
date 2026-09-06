import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceCreateClubStep,
  canContinueCreateClub,
  canContinueFromContribution,
  canContinueFromStyle,
  canSubmitClubRename,
  canSubmitCreateClub,
  createClubRequest,
  INITIAL_CREATE_CLUB_DRAFT,
  previousCreateClubStep,
  reviewPackageSummary,
  type CreateClubDraft,
} from './createClubWizard.ts';
import { CURATED_INVESTMENT_PACKAGES } from './curatedInvestmentPackages.ts';

function completeDraft(overrides: Partial<CreateClubDraft> = {}): CreateClubDraft {
  return {
    ...INITIAL_CREATE_CLUB_DRAFT,
    name: 'Friday Club',
    packageId: 'world_america',
    contributionMode: 'equal',
    equalAmountInput: '2000',
    step: 'review',
    ...overrides,
  };
}

test('user cannot continue from investment style without a package', () => {
  assert.equal(canContinueFromStyle(null), false);
  assert.equal(
    canContinueCreateClub({
      ...INITIAL_CREATE_CLUB_DRAFT,
      step: 'style',
      name: 'Friday Club',
    }),
    false,
  );
  assert.equal(canSubmitCreateClub({ ...INITIAL_CREATE_CLUB_DRAFT, name: 'Friday Club' }), false);
});

test('style continues to contribution, then review', () => {
  let draft: CreateClubDraft = {
    ...INITIAL_CREATE_CLUB_DRAFT,
    name: 'Friday Club',
    packageId: 'tech_forward',
    step: 'style',
  };

  assert.equal(canContinueCreateClub(draft), true);
  draft = { ...draft, step: advanceCreateClubStep(draft.step) };
  assert.equal(draft.step, 'contribution');
  assert.equal(canContinueCreateClub(draft), false);

  draft = { ...draft, contributionMode: 'flexible', creatorFlexibleAmountInput: '2000' };
  assert.equal(canContinueFromContribution(draft), true);
  draft = { ...draft, step: advanceCreateClubStep(draft.step) };
  assert.equal(draft.step, 'review');

  const backToContribution = previousCreateClubStep(draft.step);
  assert.equal(backToContribution, 'contribution');
  draft = { ...draft, step: backToContribution ?? draft.step };
  assert.equal(draft.packageId, 'tech_forward');
  assert.equal(draft.contributionMode, 'flexible');
});

test('same amount requires a positive kroner amount', () => {
  assert.equal(
    canContinueFromContribution({
      contributionMode: 'equal',
      equalAmountInput: '',
      creatorFlexibleAmountInput: '',
    }),
    false,
  );
  assert.equal(
    canContinueFromContribution({
      contributionMode: 'equal',
      equalAmountInput: '0',
      creatorFlexibleAmountInput: '',
    }),
    false,
  );
  assert.equal(
    canContinueFromContribution({
      contributionMode: 'equal',
      equalAmountInput: '2000',
      creatorFlexibleAmountInput: '',
    }),
    true,
  );
});

test('flexible amounts require the creator own amount', () => {
  assert.equal(
    canContinueFromContribution({
      contributionMode: 'flexible',
      equalAmountInput: '2000',
      creatorFlexibleAmountInput: '',
    }),
    false,
  );
  assert.equal(
    canContinueFromContribution({
      contributionMode: 'flexible',
      equalAmountInput: '',
      creatorFlexibleAmountInput: '1500',
    }),
    true,
  );
});

test('review reflects the exact chosen package', () => {
  for (const item of CURATED_INVESTMENT_PACKAGES) {
    const summary = reviewPackageSummary(item.id);
    assert.equal(summary.id, item.id);
    assert.equal(summary.displayName, item.displayName);
    assert.equal(summary.shortDescription, item.shortDescription);
    assert.match(summary.preview, /^\d+% /);
    assert.equal(summary.holdings.length, item.allocations.length);
    assert.equal(
      summary.holdings.every((holding) => holding.name.length > 0 && holding.ticker.length > 0),
      true,
    );
  }
});

test('rename requires a changed, valid club name', () => {
  assert.equal(canSubmitClubRename('Friday Club', 'Friday Club'), false);
  assert.equal(canSubmitClubRename('Friday Club', '  Friday Club  '), false);
  assert.equal(canSubmitClubRename('Friday Club', '   '), false);
  assert.equal(canSubmitClubRename('Friday Club', 'Saturday Club'), true);
});

test('create request sends the stable package id and contribution amounts in minor units', () => {
  const equalRequest = createClubRequest(completeDraft({
    name: '  Friday Club  ',
    governance: 'unanimous',
    contributionMode: 'equal',
    equalAmountInput: '2000',
  }));

  assert.deepEqual(equalRequest, {
    name: 'Friday Club',
    governanceThresholdKind: 'unanimous',
    packageId: 'world_america',
    contributionMode: 'equal',
    equalAmountMinor: 200000,
    creatorFlexibleAmountMinor: null,
  });
  assert.notEqual(equalRequest.packageId, 'World + America');

  const flexibleRequest = createClubRequest(completeDraft({
    contributionMode: 'flexible',
    creatorFlexibleAmountInput: '1500',
  }));

  assert.deepEqual(flexibleRequest, {
    name: 'Friday Club',
    governanceThresholdKind: 'simple_majority',
    packageId: 'world_america',
    contributionMode: 'flexible',
    equalAmountMinor: null,
    creatorFlexibleAmountMinor: 150000,
  });
});
