import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceCreateClubStep,
  canContinueCreateClub,
  canContinueFromContribution,
  canSubmitClubRename,
  canSubmitCreateClub,
  createClubRequest,
  createEmptyCreateClubDraft,
  previousCreateClubStep,
  selectCreateClubMode,
  type CreateClubDraft,
} from './createClubWizard.ts';
import { DNB_GLOBAL_INDEKS_A, DNB_GLOBAL_INDEKS_A_PRODUCT_ID } from './singleFundCatalog.ts';

const CREATION_ID = '86000000-0000-4000-8000-000000000001';

function completeDraft(overrides: Partial<CreateClubDraft> = {}): CreateClubDraft {
  return {
    ...createEmptyCreateClubDraft(CREATION_ID),
    name: 'Friday Club',
    mode: 'single_fund',
    catalogProductId: DNB_GLOBAL_INDEKS_A_PRODUCT_ID,
    contributionMode: 'equal',
    equalAmountInput: '2000',
    step: 'review',
    ...overrides,
  };
}

test('locked Build your strategy cannot change the draft', () => {
  const draft = completeDraft({ step: 'mode', mode: 'single_fund' });
  const ignored = selectCreateClubMode(draft, 'custom_portfolio');
  assert.equal(ignored.mode, 'single_fund');
  assert.equal(ignored.catalogProductId, draft.catalogProductId);
  assert.equal(selectCreateClubMode(completeDraft({ step: 'mode', mode: null }), 'custom_portfolio').mode, null);
});

test('back and forward keep the same draft choices', () => {
  const draft = completeDraft({ step: 'governance' });
  const previous = { ...draft, step: previousCreateClubStep(draft.step) ?? draft.step };
  const again = { ...previous, step: advanceCreateClubStep(previous.step) };
  assert.equal(previous.step, 'contribution');
  assert.equal(again.step, 'governance');
  assert.equal(again.name, draft.name);
  assert.equal(again.mode, draft.mode);
  assert.equal(again.catalogProductId, draft.catalogProductId);
  assert.equal(again.equalAmountInput, draft.equalAmountInput);
  assert.equal(again.governance, draft.governance);
});

test('user cannot continue from mode without Simple saving', () => {
  const draft = completeDraft({ step: 'mode', mode: null, catalogProductId: null });
  assert.equal(canContinueCreateClub(draft, [DNB_GLOBAL_INDEKS_A]), false);
  assert.equal(selectCreateClubMode(draft, 'custom_portfolio').mode, null);
  assert.equal(canSubmitCreateClub(createEmptyCreateClubDraft(CREATION_ID), [DNB_GLOBAL_INDEKS_A]), false);
});

test('steps follow name, mode, fund, contribution, governance, review', () => {
  let draft = completeDraft({ step: 'name', mode: null, catalogProductId: null });
  assert.equal(canContinueCreateClub(draft, [DNB_GLOBAL_INDEKS_A]), true);
  draft = { ...draft, step: advanceCreateClubStep(draft.step), mode: 'single_fund' };
  assert.equal(draft.step, 'mode');
  assert.equal(canContinueCreateClub(draft, [DNB_GLOBAL_INDEKS_A]), true);
  draft = { ...draft, step: advanceCreateClubStep(draft.step), catalogProductId: DNB_GLOBAL_INDEKS_A_PRODUCT_ID };
  assert.equal(draft.step, 'fund');
  assert.equal(canContinueCreateClub(draft, [DNB_GLOBAL_INDEKS_A]), true);
  draft = { ...draft, step: advanceCreateClubStep(draft.step) };
  assert.equal(draft.step, 'contribution');
  draft = { ...draft, step: advanceCreateClubStep(draft.step) };
  assert.equal(draft.step, 'governance');
  draft = { ...draft, step: advanceCreateClubStep(draft.step) };
  assert.equal(draft.step, 'review');
  assert.equal(previousCreateClubStep(draft.step), 'governance');
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

test('rename requires a changed, valid club name', () => {
  assert.equal(canSubmitClubRename('Friday Club', 'Friday Club'), false);
  assert.equal(canSubmitClubRename('Friday Club', 'Saturday Club'), true);
});

test('create request sends catalog id, no basis points, and the stored creation id', () => {
  const equalRequest = createClubRequest(
    completeDraft({
      name: '  Friday Club  ',
      governance: 'unanimous',
    }),
    [DNB_GLOBAL_INDEKS_A],
  );

  assert.deepEqual(equalRequest, {
    name: 'Friday Club',
    investmentMode: 'single_fund',
    catalogProductId: DNB_GLOBAL_INDEKS_A_PRODUCT_ID,
    governanceThresholdKind: 'unanimous',
    contributionMode: 'equal',
    equalAmountMinor: 200000,
    creatorFlexibleAmountMinor: null,
    baseCurrency: 'NOK',
    clientCreationId: CREATION_ID,
  });
  assert.equal('allocationBps' in equalRequest, false);

  const flexibleRequest = createClubRequest(
    completeDraft({
      contributionMode: 'flexible',
      creatorFlexibleAmountInput: '1500',
    }),
    [DNB_GLOBAL_INDEKS_A],
  );
  assert.equal(flexibleRequest.equalAmountMinor, null);
  assert.equal(flexibleRequest.creatorFlexibleAmountMinor, 150000);
});
