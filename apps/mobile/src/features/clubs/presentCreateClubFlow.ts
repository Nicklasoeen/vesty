import type { CreateClubSubmitState } from './createClubSubmission.ts';
import type { CreateClubDraft } from './createClubWizard.ts';

export type CreateClubPhase = 'intro' | 'wizard' | 'success';

export interface CreateClubSuccessModel {
  clubId: string;
  clubName: string;
  fundName: string;
}

export interface CreateClubAmountPreset {
  input: string;
  label: string;
  accessibilityLabel: string;
}

export function isFreshCreateClubDraft(draft: CreateClubDraft): boolean {
  return (
    draft.step === 'name'
    && draft.name.trim() === ''
    && draft.mode === null
    && draft.catalogProductId === null
    && draft.contributionMode === null
    && draft.equalAmountInput === ''
    && draft.creatorFlexibleAmountInput === ''
  );
}

export function initialCreateClubIntroVisible(draft: CreateClubDraft): boolean {
  return isFreshCreateClubDraft(draft);
}

export function presentCreateClubPhase(input: {
  introVisible?: boolean;
  introDismissed?: boolean;
  draft: CreateClubDraft | null;
  success: CreateClubSuccessModel | null;
  submitState: CreateClubSubmitState;
}): CreateClubPhase {
  if (input.submitState === 'success' && input.success) {
    return 'success';
  }
  if (input.introVisible === true) {
    return 'intro';
  }
  if (input.introVisible === false) {
    return 'wizard';
  }
  if (input.draft && input.introDismissed === false && isFreshCreateClubDraft(input.draft)) {
    return 'intro';
  }
  return 'wizard';
}

export function presentCreateClubIntro() {
  return {
    titleLead: 'Small steps.',
    titleEmphasis: 'Together.',
    body: 'Start a club and build a steady saving habit together. One shared fund. Each member invests in their own account.',
    startLabel: 'Start a club',
    timeLabel: 'About 2 minutes',
  };
}

export function presentCreateClubSuccess(success: CreateClubSuccessModel) {
  return {
    titleLead: 'A strong start.',
    titleEmphasis: 'Together.',
    body: `${success.clubName} is ready. Invite the people you want to save with.`,
    clubName: success.clubName,
    fundName: success.fundName,
    inviteLabel: 'Invite members',
    goToClubLabel: 'Go to club',
    goToClub: { href: '/club' as const, replace: true as const },
  };
}

export function presentCreateClubCelebration(input: {
  submitState: CreateClubSubmitState;
  confirmedClubId: string | null;
  celebratedClubId: string | null;
  reduceMotion: boolean;
}): { shouldPlay: boolean; nextCelebratedClubId: string | null } {
  if (input.submitState !== 'success' || !input.confirmedClubId) {
    return { shouldPlay: false, nextCelebratedClubId: input.celebratedClubId };
  }
  if (input.celebratedClubId === input.confirmedClubId) {
    return { shouldPlay: false, nextCelebratedClubId: input.celebratedClubId };
  }
  if (input.reduceMotion) {
    return { shouldPlay: false, nextCelebratedClubId: input.confirmedClubId };
  }
  return { shouldPlay: true, nextCelebratedClubId: input.confirmedClubId };
}

export function presentCreateClubAmountPresets(): readonly CreateClubAmountPreset[] {
  return [
    { input: '500', label: '500 kr', accessibilityLabel: '500 kroner' },
    { input: '1000', label: '1,000 kr', accessibilityLabel: '1,000 kroner' },
    { input: '2000', label: '2,000 kr', accessibilityLabel: '2,000 kroner' },
  ];
}

export function applyCreateClubAmountPreset(draft: CreateClubDraft, input: string): CreateClubDraft {
  if (draft.contributionMode === 'equal') {
    return { ...draft, equalAmountInput: input };
  }
  if (draft.contributionMode === 'flexible') {
    return { ...draft, creatorFlexibleAmountInput: input };
  }
  return draft;
}

export function createClubContributionTitle(mode: 'equal' | 'flexible'): string {
  return mode === 'equal' ? 'Everyone saves the same amount' : 'Each chooses their own amount';
}

export function createClubGovernanceLabel(
  kind: CreateClubDraft['governance'],
): string {
  if (kind === 'supermajority') {
    return 'Two-thirds majority';
  }
  if (kind === 'unanimous') {
    return 'Everyone agrees';
  }
  return 'Simple majority';
}

export function presentCreateClubMoneyPlanNote(): string {
  return 'This is your plan. Vesty does not move or withdraw money.';
}

export function canReplayCreateClubSubmit(
  submitState: CreateClubSubmitState,
  createdClubId: string | null,
): boolean {
  return submitState !== 'loading' && createdClubId == null;
}

export function presentCreateClubNameBackTarget(input: {
  introDismissed: boolean;
  draft: CreateClubDraft;
}): 'intro' | 'leave' {
  if (input.introDismissed) {
    return 'intro';
  }
  return isFreshCreateClubDraft(input.draft) ? 'intro' : 'leave';
}

export function presentCreateClubSuccessActions(success: CreateClubSuccessModel) {
  const presented = presentCreateClubSuccess(success);
  return {
    clubId: success.clubId,
    clubName: success.clubName,
    fundName: success.fundName,
    inviteUsesExistingFlow: true as const,
    goToClub: presented.goToClub,
    canCreateAgain: false as const,
  };
}

export function presentCreateClubConfirmedCreation(input: {
  clubId: string;
  clubName: string;
  fundName: string;
  selectedClubId: string | null;
}) {
  const success = {
    clubId: input.clubId,
    clubName: input.clubName,
    fundName: input.fundName,
  };
  const actions = presentCreateClubSuccessActions(success);
  return {
    ...actions,
    selectedClubMatches: input.selectedClubId === input.clubId,
    inviteClubId: input.clubId,
  };
}

export type CreateClubCloseAction = 'leave' | 'confirm' | 'blocked' | 'hidden';
export type CreateClubLeaveChoice = 'save_and_leave' | 'discard_setup' | 'keep_creating';

export function presentCreateClubLeaveCopy() {
  return {
    title: 'Leave club setup?',
    body: "You can keep this profile's draft and come back later, or discard it.",
    saveAndLeaveLabel: 'Save and leave',
    discardSetupLabel: 'Discard setup',
    keepCreatingLabel: 'Keep creating',
    writesServer: false,
    discardMintsNewDraft: false,
    usesStartNewSetup: false,
  };
}

export function presentCreateClubCloseAction(input: {
  phase: CreateClubPhase;
  submitState: CreateClubSubmitState;
}): CreateClubCloseAction {
  if (input.phase === 'success') {
    return 'hidden';
  }
  if (input.submitState === 'loading') {
    return 'blocked';
  }
  if (input.phase === 'intro') {
    return 'leave';
  }
  return 'confirm';
}

export function presentCreateClubCloseControl(input: {
  phase: CreateClubPhase;
  submitState: CreateClubSubmitState;
}) {
  const action = presentCreateClubCloseAction(input);
  return {
    visible: action !== 'hidden',
    disabled: action === 'blocked',
    action,
    accessibilityLabel: 'Close club setup',
    accessibilityHint:
      action === 'blocked'
        ? 'Club is being created'
        : action === 'leave'
          ? 'Leaves club setup'
          : 'Asks how to leave club setup',
  };
}

export function presentCreateClubLeaveResult(choice: CreateClubLeaveChoice) {
  return {
    choice,
    leaves: choice !== 'keep_creating',
    persistsDraft: choice === 'save_and_leave',
    clearsDraft: choice === 'discard_setup',
    mintsNewDraft: false,
    writesServer: false,
    usesStartNewSetup: false,
  };
}
