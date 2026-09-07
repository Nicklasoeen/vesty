import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  classifyCreateClubSubmitError,
  presentCreateClubConflict,
  presentCreateClubGoToClubsNavigation,
  presentCreateClubSubmit,
  presentCreateClubSuccessNavigation,
  resetCreateClubSubmitAfterNewSetup,
  runCreateClubSubmission,
  startNewCreateClubSetup,
} from './createClubSubmission.ts';
import { createClubDraftStorageKey } from './createClubDraftStorage.ts';
import { createEmptyCreateClubDraft } from './createClubWizard.ts';
import { DNB_GLOBAL_INDEKS_A_PRODUCT_ID } from './singleFundCatalog.ts';

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    async getItem(key: string) {
      return data[key] ?? null;
    },
    async setItem(key: string, value: string) {
      data[key] = value;
    },
    async removeItem(key: string) {
      delete data[key];
    },
  };
}

const PROFILE_A = '11000000-0000-4000-8000-000000000001';
const CREATION_A = '86000000-0000-4000-8000-000000000001';
const CREATION_B = '86000000-0000-4000-8000-000000000002';

describe('create club submit states', () => {
  it('disables the button while the request is in flight', () => {
    const loading = presentCreateClubSubmit('loading');
    assert.equal(loading.label, 'Creating…');
    assert.equal(loading.busy, true);
    assert.equal(loading.disabled, true);
    assert.equal(loading.showConflictActions, false);
  });

  it('classifies timeout, conflict, and catalog deactivation', () => {
    assert.equal(classifyCreateClubSubmitError(new Error('vesty.creation_conflict')), 'conflict');
    assert.equal(classifyCreateClubSubmitError(new Error('vesty.catalog_product_unavailable')), 'catalog_unavailable');
    assert.equal(classifyCreateClubSubmitError(new Error('Request timed out')), 'timeout');
    assert.equal(presentCreateClubSubmit('timeout').disabled, false);
    assert.equal(presentCreateClubSubmit('conflict').disabled, true);
    assert.equal(presentCreateClubSubmit('conflict').showConflictActions, true);
    assert.match(presentCreateClubSubmit('catalog_unavailable').message ?? '', /no longer available/);
  });

  it('keeps timeout retryable without treating it as a local-only success', async () => {
    const timedOut = await runCreateClubSubmission({
      create: async () => {
        throw new Error('Request timed out');
      },
    });
    assert.equal(timedOut.ok, false);
    if (!timedOut.ok) {
      assert.equal(timedOut.state, 'timeout');
    }
    assert.equal(presentCreateClubSubmit('timeout').disabled, false);
  });

  it('classifies a changed payload as a conflict with two recovery actions', () => {
    const conflict = presentCreateClubConflict();
    const presented = presentCreateClubSubmit('conflict');
    assert.equal(classifyCreateClubSubmitError(new Error('vesty.creation_conflict')), 'conflict');
    assert.match(conflict.message, /already have created this club/);
    assert.equal(conflict.goToClubsLabel, 'Go to clubs');
    assert.equal(conflict.startNewSetupLabel, 'Start a new setup');
    assert.equal(presented.showConflictActions, true);
    assert.equal(presented.disabled, true);
  });

  it('Go to clubs refreshes by replacing into the club list', () => {
    assert.deepEqual(presentCreateClubGoToClubsNavigation(), {
      href: '/club',
      replace: true,
    });
  });

  it('Start a new setup clears the old draft, issues a new UUID, and does not submit', async () => {
    const store = memoryStore();
    const previous = {
      ...createEmptyCreateClubDraft(CREATION_A),
      name: 'Conflicted Club',
      mode: 'single_fund' as const,
      catalogProductId: DNB_GLOBAL_INDEKS_A_PRODUCT_ID,
      contributionMode: 'equal' as const,
      equalAmountInput: '2000',
      step: 'review' as const,
    };
    await store.setItem(createClubDraftStorageKey(PROFILE_A), JSON.stringify(previous));

    let created = false;
    const next = await startNewCreateClubSetup({
      store,
      profileId: PROFILE_A,
      generateId: () => CREATION_B,
    });
    const submit = resetCreateClubSubmitAfterNewSetup();

    assert.equal(next.clientCreationId, CREATION_B);
    assert.notEqual(next.clientCreationId, CREATION_A);
    assert.equal(next.name, '');
    assert.equal(next.step, 'name');
    assert.equal(next.equalAmountInput, '');
    assert.equal(submit.submitState, 'idle');
    assert.equal(submit.createdClubId, null);
    assert.equal(created, false);
    assert.equal(store.data[createClubDraftStorageKey(PROFILE_A)]?.includes(CREATION_A), false);
    assert.equal(store.data[createClubDraftStorageKey(PROFILE_A)]?.includes(CREATION_B), true);
  });

  it('retries an idempotent create without treating success as a local-only state', async () => {
    const first = await runCreateClubSubmission({
      create: async () => ({ clubId: 'club-1' }),
    });
    assert.equal(first.ok, true);
    if (first.ok) {
      assert.equal(first.value.clubId, 'club-1');
    }

    const retry = await runCreateClubSubmission({
      create: async () => ({ clubId: 'club-1' }),
    });
    assert.equal(retry.ok, true);
    if (retry.ok) {
      assert.equal(retry.value.clubId, 'club-1');
    }
  });

  it('navigates to the created club with replace so back cannot resubmit', () => {
    assert.deepEqual(presentCreateClubSuccessNavigation(), {
      href: '/club',
      replace: true,
    });
  });
});
