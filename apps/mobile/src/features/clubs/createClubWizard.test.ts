import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceCreateClubStep,
  canContinueCreateClub,
  canContinueFromStyle,
  canSubmitCreateClub,
  createClubRequest,
  INITIAL_CREATE_CLUB_DRAFT,
  previousCreateClubStep,
  reviewPackageSummary,
  type CreateClubDraft,
} from './createClubWizard.ts';
import { CURATED_INVESTMENT_PACKAGES } from './curatedInvestmentPackages.ts';

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
  assert.equal(canSubmitCreateClub({ name: 'Friday Club', packageId: null }), false);
});

test('selected package persists across back and forward steps', () => {
  let draft: CreateClubDraft = {
    ...INITIAL_CREATE_CLUB_DRAFT,
    name: 'Friday Club',
    packageId: 'tech_forward',
    step: 'style',
  };

  assert.equal(canContinueCreateClub(draft), true);
  draft = { ...draft, step: advanceCreateClubStep(draft.step) };
  assert.equal(draft.step, 'review');
  assert.equal(draft.packageId, 'tech_forward');

  const backToStyle = previousCreateClubStep(draft.step);
  assert.equal(backToStyle, 'style');
  draft = { ...draft, step: backToStyle ?? draft.step };
  assert.equal(draft.packageId, 'tech_forward');

  draft = { ...draft, step: advanceCreateClubStep(draft.step) };
  assert.equal(draft.step, 'review');
  assert.equal(draft.packageId, 'tech_forward');
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

test('create request sends the stable package id, not the display name', () => {
  const request = createClubRequest({
    ...INITIAL_CREATE_CLUB_DRAFT,
    name: '  Friday Club  ',
    governance: 'unanimous',
    packageId: 'world_america',
    step: 'review',
  });

  assert.deepEqual(request, {
    name: 'Friday Club',
    governanceThresholdKind: 'unanimous',
    packageId: 'world_america',
  });
  assert.notEqual(request.packageId, 'World + America');
});
