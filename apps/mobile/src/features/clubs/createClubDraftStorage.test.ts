import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { clearSignedOutUserStorage } from '../auth/clearSignedOutUserStorage.ts';
import {
  CREATE_CLUB_DRAFT_STORAGE_PREFIX,
  LEGACY_CREATE_CLUB_DRAFT_STORAGE_KEY,
  applyCreateClubLeaveChoice,
  clearCreateClubDraft,
  createClubDraftStorageKey,
  discardCreateClubDraft,
  loadCreateClubDraft,
  parseStoredCreateClubDraft,
  saveCreateClubDraft,
  startNewCreateClubDraft,
} from './createClubDraftStorage.ts';
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
const PROFILE_B = '11000000-0000-4000-8000-000000000002';
const CREATION_A = '86000000-0000-4000-8000-000000000001';
const CREATION_B = '86000000-0000-4000-8000-000000000002';

function flexibleDraft(creationId: string, name: string) {
  return {
    ...createEmptyCreateClubDraft(creationId),
    name,
    mode: 'single_fund' as const,
    catalogProductId: DNB_GLOBAL_INDEKS_A_PRODUCT_ID,
    contributionMode: 'flexible' as const,
    creatorFlexibleAmountInput: '1500',
    step: 'review' as const,
  };
}

describe('create club draft storage', () => {
  it('scopes the storage key to the authenticated profile', () => {
    assert.equal(
      createClubDraftStorageKey(PROFILE_A),
      `${CREATE_CLUB_DRAFT_STORAGE_PREFIX}${PROFILE_A}`,
    );
    assert.notEqual(createClubDraftStorageKey(PROFILE_A), createClubDraftStorageKey(PROFILE_B));
  });

  it('restores the same profile draft and creation id after an app restart', async () => {
    const store = memoryStore();
    await saveCreateClubDraft(store, PROFILE_A, flexibleDraft(CREATION_A, 'Restart Club'));

    const loaded = await loadCreateClubDraft(store, PROFILE_A, () => '86000000-0000-4000-8000-000000000099');
    assert.equal(loaded.clientCreationId, CREATION_A);
    assert.equal(loaded.name, 'Restart Club');
    assert.equal(loaded.creatorFlexibleAmountInput, '1500');
    assert.equal(store.data[createClubDraftStorageKey(PROFILE_A)]?.includes(CREATION_A), true);
  });

  it('never lets profile B load profile A draft, flexible amount, or creation id', async () => {
    const store = memoryStore();
    await saveCreateClubDraft(store, PROFILE_A, flexibleDraft(CREATION_A, 'Private Club'));

    const loadedB = await loadCreateClubDraft(store, PROFILE_B, () => CREATION_B);
    assert.equal(loadedB.clientCreationId, CREATION_B);
    assert.equal(loadedB.name, '');
    assert.equal(loadedB.creatorFlexibleAmountInput, '');
    assert.equal(store.data[createClubDraftStorageKey(PROFILE_A)]?.includes('1500'), true);
  });

  it('gives each profile its own creation UUID', async () => {
    const store = memoryStore();
    const draftA = await loadCreateClubDraft(store, PROFILE_A, () => CREATION_A);
    const draftB = await loadCreateClubDraft(store, PROFILE_B, () => CREATION_B);
    await saveCreateClubDraft(store, PROFILE_A, { ...draftA, name: 'A' });
    await saveCreateClubDraft(store, PROFILE_B, { ...draftB, name: 'B' });

    const nextA = await loadCreateClubDraft(store, PROFILE_A, () => '86000000-0000-4000-8000-000000000099');
    const nextB = await loadCreateClubDraft(store, PROFILE_B, () => '86000000-0000-4000-8000-000000000098');
    assert.equal(nextA.clientCreationId, CREATION_A);
    assert.equal(nextB.clientCreationId, CREATION_B);
    assert.notEqual(nextA.clientCreationId, nextB.clientCreationId);
  });

  it('clears profile A on sign-out so profile B cannot see the flexible amount', async () => {
    const store = memoryStore();
    await saveCreateClubDraft(store, PROFILE_A, flexibleDraft(CREATION_A, 'Leaving'));
    store.data[LEGACY_CREATE_CLUB_DRAFT_STORAGE_KEY] = JSON.stringify(flexibleDraft(CREATION_A, 'Legacy leak'));

    await clearSignedOutUserStorage(store, PROFILE_A);

    assert.equal(store.data[createClubDraftStorageKey(PROFILE_A)], undefined);
    assert.equal(store.data[LEGACY_CREATE_CLUB_DRAFT_STORAGE_KEY], undefined);

    const loadedB = await loadCreateClubDraft(store, PROFILE_B, () => CREATION_B);
    assert.equal(loadedB.creatorFlexibleAmountInput, '');
    assert.doesNotMatch(JSON.stringify(store.data), /1500|Leaving|Legacy leak/);
  });

  it('switches in-memory profile by loading the next profile key', async () => {
    const store = memoryStore();
    await saveCreateClubDraft(store, PROFILE_A, flexibleDraft(CREATION_A, 'Still A'));
    const mountedAsB = await loadCreateClubDraft(store, PROFILE_B, () => CREATION_B);
    assert.equal(mountedAsB.name, '');
    assert.equal(mountedAsB.clientCreationId, CREATION_B);
    assert.notEqual(mountedAsB.clientCreationId, CREATION_A);
  });

  it('clears the active profile key after success', async () => {
    const store = memoryStore();
    await saveCreateClubDraft(store, PROFILE_A, flexibleDraft(CREATION_A, 'Created'));
    await clearCreateClubDraft(store, PROFILE_A);
    assert.equal(store.data[createClubDraftStorageKey(PROFILE_A)], undefined);
    const next = await loadCreateClubDraft(store, PROFILE_A, () => CREATION_B);
    assert.equal(next.clientCreationId, CREATION_B);
  });

  it('discard setup clears the profile key and starts a new UUID', async () => {
    const store = memoryStore();
    await saveCreateClubDraft(store, PROFILE_A, flexibleDraft(CREATION_A, 'Old setup'));
    const next = await discardCreateClubDraft(store, PROFILE_A, () => CREATION_B);
    assert.equal(next.clientCreationId, CREATION_B);
    assert.equal(next.name, '');
    assert.equal(next.creatorFlexibleAmountInput, '');
    assert.equal(store.data[createClubDraftStorageKey(PROFILE_A)]?.includes(CREATION_A), false);
    assert.equal(store.data[createClubDraftStorageKey(PROFILE_A)]?.includes(CREATION_B), true);
  });

  it('removes the legacy global key and never shows it to a new user', async () => {
    const store = memoryStore({
      [LEGACY_CREATE_CLUB_DRAFT_STORAGE_KEY]: JSON.stringify(flexibleDraft(CREATION_A, 'Old global')),
    });
    const loaded = await loadCreateClubDraft(store, PROFILE_B, () => CREATION_B);
    assert.equal(loaded.clientCreationId, CREATION_B);
    assert.equal(loaded.name, '');
    assert.equal(store.data[LEGACY_CREATE_CLUB_DRAFT_STORAGE_KEY], undefined);
  });

  it('discards corrupt or outdated stored data', async () => {
    const store = memoryStore();
    await store.setItem(createClubDraftStorageKey(PROFILE_A), '{not-json');
    const loaded = await loadCreateClubDraft(store, PROFILE_A, () => CREATION_B);
    assert.equal(loaded.clientCreationId, CREATION_B);
    assert.equal(parseStoredCreateClubDraft('{"step":"review"}'), null);
    assert.equal(
      parseStoredCreateClubDraft(
        JSON.stringify({
          ...createEmptyCreateClubDraft(CREATION_A),
          mode: 'custom_portfolio',
        }),
      )?.mode,
      null,
    );
  });

  it('keeps an explicit new start empty', () => {
    const next = startNewCreateClubDraft(() => CREATION_B);
    assert.equal(next.clientCreationId, CREATION_B);
    assert.equal(next.name, '');
    assert.equal(next.creatorFlexibleAmountInput, '');
  });

  it('save and leave keeps the same profile draft and creation id', async () => {
    const store = memoryStore();
    const draftA = flexibleDraft(CREATION_A, 'Keep A');
    await saveCreateClubDraft(store, PROFILE_A, draftA);
    await applyCreateClubLeaveChoice(store, PROFILE_A, draftA, 'save_and_leave');

    const loaded = await loadCreateClubDraft(store, PROFILE_A, () => CREATION_B);
    assert.equal(loaded.clientCreationId, CREATION_A);
    assert.equal(loaded.name, 'Keep A');
    assert.equal(loaded.creatorFlexibleAmountInput, '1500');
    assert.equal(store.data[createClubDraftStorageKey(PROFILE_A)]?.includes(CREATION_A), true);
    assert.equal(store.data[createClubDraftStorageKey(PROFILE_A)]?.includes(CREATION_B), false);
  });

  it('discard setup clears the active profile draft without minting a new request id', async () => {
    const store = memoryStore();
    await saveCreateClubDraft(store, PROFILE_A, flexibleDraft(CREATION_A, 'Throw away'));
    await saveCreateClubDraft(store, PROFILE_B, flexibleDraft(CREATION_B, 'Keep B'));
    await applyCreateClubLeaveChoice(store, PROFILE_A, flexibleDraft(CREATION_A, 'Throw away'), 'discard_setup');

    assert.equal(store.data[createClubDraftStorageKey(PROFILE_A)], undefined);
    assert.doesNotMatch(store.data[createClubDraftStorageKey(PROFILE_A)] ?? '', /Throw away|86000000-0000-4000-8000-000000000001/);
    const keptB = await loadCreateClubDraft(store, PROFILE_B, () => '86000000-0000-4000-8000-000000000099');
    assert.equal(keptB.clientCreationId, CREATION_B);
    assert.equal(keptB.name, 'Keep B');
    assert.equal(JSON.stringify(store.data).includes(CREATION_B), true);
    assert.equal(JSON.stringify(store.data).includes(CREATION_A), false);
  });

  it('keep creating leaves both profile drafts unchanged', async () => {
    const store = memoryStore();
    const draftA = flexibleDraft(CREATION_A, 'Still here');
    const draftB = flexibleDraft(CREATION_B, 'Also B');
    await saveCreateClubDraft(store, PROFILE_A, draftA);
    await saveCreateClubDraft(store, PROFILE_B, draftB);
    await applyCreateClubLeaveChoice(store, PROFILE_A, { ...draftA, name: 'Changed in memory' }, 'keep_creating');

    const loadedA = await loadCreateClubDraft(store, PROFILE_A, () => '86000000-0000-4000-8000-000000000099');
    const loadedB = await loadCreateClubDraft(store, PROFILE_B, () => '86000000-0000-4000-8000-000000000098');
    assert.equal(loadedA.name, 'Still here');
    assert.equal(loadedA.clientCreationId, CREATION_A);
    assert.equal(loadedB.name, 'Also B');
    assert.equal(loadedB.clientCreationId, CREATION_B);
  });
});
