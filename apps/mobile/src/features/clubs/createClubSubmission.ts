import { extractClubErrorCode } from './clubErrors.ts';
import { discardCreateClubDraft, type CreateClubDraftStore } from './createClubDraftStorage.ts';
import type { CreateClubDraft } from './createClubWizard.ts';

export type CreateClubSubmitState =
  | 'idle'
  | 'loading'
  | 'timeout'
  | 'conflict'
  | 'catalog_unavailable'
  | 'error'
  | 'success';

export interface CreateClubSubmitPresentation {
  state: CreateClubSubmitState;
  label: string;
  message: string | null;
  busy: boolean;
  disabled: boolean;
  showConflictActions: boolean;
}

export interface CreateClubConflictPresentation {
  title: string;
  message: string;
  goToClubsLabel: string;
  startNewSetupLabel: string;
}

export function presentCreateClubSubmit(state: CreateClubSubmitState): CreateClubSubmitPresentation {
  if (state === 'loading') {
    return {
      state,
      label: 'Creating…',
      message: null,
      busy: true,
      disabled: true,
      showConflictActions: false,
    };
  }
  if (state === 'timeout') {
    return {
      state,
      label: 'Try again',
      message: 'The request timed out. Your choices are still here, and retry will not create a second club.',
      busy: false,
      disabled: false,
      showConflictActions: false,
    };
  }
  if (state === 'conflict') {
    const conflict = presentCreateClubConflict();
    return {
      state,
      label: 'Create club',
      message: conflict.message,
      busy: false,
      disabled: true,
      showConflictActions: true,
    };
  }
  if (state === 'catalog_unavailable') {
    return {
      state,
      label: 'Choose another fund',
      message: 'This fund is no longer available for new clubs. Nothing was created.',
      busy: false,
      disabled: true,
      showConflictActions: false,
    };
  }
  if (state === 'error') {
    return {
      state,
      label: 'Try again',
      message: 'Unable to create club right now. Your choices are still here.',
      busy: false,
      disabled: false,
      showConflictActions: false,
    };
  }
  if (state === 'success') {
    return {
      state,
      label: 'Club created',
      message: null,
      busy: false,
      disabled: true,
      showConflictActions: false,
    };
  }
  return {
    state,
    label: 'Create club',
    message: null,
    busy: false,
    disabled: false,
    showConflictActions: false,
  };
}

export function presentCreateClubConflict(): CreateClubConflictPresentation {
  return {
    title: 'This club may already exist',
    message: 'A previous request may already have created this club. You can go to your clubs or start a new setup.',
    goToClubsLabel: 'Go to clubs',
    startNewSetupLabel: 'Start a new setup',
  };
}

export function presentCreateClubSuccessNavigation(): { href: '/club'; replace: true } {
  return { href: '/club', replace: true };
}

export function presentCreateClubGoToClubsNavigation(): { href: '/club'; replace: true } {
  return { href: '/club', replace: true };
}

export function classifyCreateClubSubmitError(error: unknown): CreateClubSubmitState {
  const code = extractClubErrorCode(error);
  if (code === 'vesty.creation_conflict') {
    return 'conflict';
  }
  if (code === 'vesty.catalog_product_unavailable') {
    return 'catalog_unavailable';
  }

  const message =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message.toLowerCase()
      : '';
  if (message.includes('timeout') || message.includes('timed out') || message.includes('network')) {
    return 'timeout';
  }
  return 'error';
}

export async function runCreateClubSubmission<T>(input: {
  create: () => Promise<T>;
}): Promise<{ ok: true; value: T } | { ok: false; state: CreateClubSubmitState; error: unknown }> {
  try {
    const value = await input.create();
    return { ok: true, value };
  } catch (error) {
    return {
      ok: false,
      state: classifyCreateClubSubmitError(error),
      error,
    };
  }
}

export async function startNewCreateClubSetup(input: {
  store: CreateClubDraftStore;
  profileId: string;
  generateId: () => string;
}): Promise<CreateClubDraft> {
  return discardCreateClubDraft(input.store, input.profileId, input.generateId);
}

export function resetCreateClubSubmitAfterNewSetup(): {
  submitState: 'idle';
  submitMessage: null;
  createdClubId: null;
} {
  return {
    submitState: 'idle',
    submitMessage: null,
    createdClubId: null,
  };
}
