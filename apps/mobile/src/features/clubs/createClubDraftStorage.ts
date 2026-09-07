import { createEmptyCreateClubDraft, type CreateClubDraft, type CreateClubStep } from './createClubWizard.ts';
import type { ContributionPolicyMode } from './contributionPolicy.ts';
import type { GovernanceThresholdKind } from './governance.ts';

export const LEGACY_CREATE_CLUB_DRAFT_STORAGE_KEY = 'vesty.createClub.draft.v1';
export const CREATE_CLUB_DRAFT_STORAGE_PREFIX = 'vesty.createClub.draft.v2.';

export interface CreateClubDraftStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const STEPS: readonly CreateClubStep[] = [
  'name',
  'mode',
  'fund',
  'contribution',
  'governance',
  'review',
];

function isStep(value: unknown): value is CreateClubStep {
  return typeof value === 'string' && (STEPS as readonly string[]).includes(value);
}

function isMode(value: unknown): value is CreateClubDraft['mode'] {
  return value === null || value === 'single_fund' || value === 'custom_portfolio';
}

function isContributionMode(value: unknown): value is ContributionPolicyMode | null {
  return value === null || value === 'equal' || value === 'flexible';
}

function isGovernance(value: unknown): value is GovernanceThresholdKind {
  return value === 'simple_majority' || value === 'supermajority' || value === 'unanimous';
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export function createClubDraftStorageKey(profileId: string): string {
  return `${CREATE_CLUB_DRAFT_STORAGE_PREFIX}${profileId}`;
}

export function parseStoredCreateClubDraft(value: string | null): CreateClubDraft | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    const row =
      parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    if (!row || !isStep(row.step) || !isUuid(row.clientCreationId) || !isMode(row.mode)) {
      return null;
    }
    if (!isContributionMode(row.contributionMode) || !isGovernance(row.governance)) {
      return null;
    }
    if (typeof row.name !== 'string') {
      return null;
    }

    return {
      step: row.step,
      name: row.name,
      mode: row.mode === 'custom_portfolio' ? null : row.mode,
      catalogProductId: typeof row.catalogProductId === 'string' ? row.catalogProductId : null,
      contributionMode: row.contributionMode,
      equalAmountInput: typeof row.equalAmountInput === 'string' ? row.equalAmountInput : '',
      creatorFlexibleAmountInput:
        typeof row.creatorFlexibleAmountInput === 'string' ? row.creatorFlexibleAmountInput : '',
      governance: row.governance,
      clientCreationId: row.clientCreationId,
    };
  } catch {
    return null;
  }
}

export async function removeLegacyCreateClubDraft(store: CreateClubDraftStore): Promise<void> {
  await store.removeItem(LEGACY_CREATE_CLUB_DRAFT_STORAGE_KEY);
}

export async function loadCreateClubDraft(
  store: CreateClubDraftStore,
  profileId: string,
  generateId: () => string,
): Promise<CreateClubDraft> {
  await removeLegacyCreateClubDraft(store);
  if (!isUuid(profileId)) {
    return createEmptyCreateClubDraft(generateId());
  }

  const stored = parseStoredCreateClubDraft(await store.getItem(createClubDraftStorageKey(profileId)));
  if (!stored) {
    await store.removeItem(createClubDraftStorageKey(profileId));
    return createEmptyCreateClubDraft(generateId());
  }
  return stored;
}

export async function saveCreateClubDraft(
  store: CreateClubDraftStore,
  profileId: string,
  draft: CreateClubDraft,
): Promise<void> {
  await removeLegacyCreateClubDraft(store);
  if (!isUuid(profileId)) {
    return;
  }
  await store.setItem(createClubDraftStorageKey(profileId), JSON.stringify(draft));
}

export async function clearCreateClubDraft(
  store: CreateClubDraftStore,
  profileId: string,
): Promise<void> {
  await removeLegacyCreateClubDraft(store);
  if (!isUuid(profileId)) {
    return;
  }
  await store.removeItem(createClubDraftStorageKey(profileId));
}

export function startNewCreateClubDraft(generateId: () => string): CreateClubDraft {
  return createEmptyCreateClubDraft(generateId());
}

export async function discardCreateClubDraft(
  store: CreateClubDraftStore,
  profileId: string,
  generateId: () => string,
): Promise<CreateClubDraft> {
  await clearCreateClubDraft(store, profileId);
  const next = startNewCreateClubDraft(generateId);
  await saveCreateClubDraft(store, profileId, next);
  return next;
}

export type CreateClubLeaveStorageChoice = 'save_and_leave' | 'discard_setup' | 'keep_creating';

export async function applyCreateClubLeaveChoice(
  store: CreateClubDraftStore,
  profileId: string,
  draft: CreateClubDraft,
  choice: CreateClubLeaveStorageChoice,
): Promise<void> {
  if (choice === 'keep_creating') {
    return;
  }
  if (choice === 'save_and_leave') {
    await saveCreateClubDraft(store, profileId, draft);
    return;
  }
  await clearCreateClubDraft(store, profileId);
}
