import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createEmptyCreateClubDraft, type CreateClubDraft } from './createClubWizard.ts';
import {
  applyCreateClubAmountPreset,
  canReplayCreateClubSubmit,
  createClubContributionTitle,
  createClubGovernanceLabel,
  initialCreateClubIntroVisible,
  isFreshCreateClubDraft,
  presentCreateClubAmountPresets,
  presentCreateClubCelebration,
  presentCreateClubCloseAction,
  presentCreateClubCloseControl,
  presentCreateClubConfirmedCreation,
  presentCreateClubIntro,
  presentCreateClubLeaveCopy,
  presentCreateClubLeaveResult,
  presentCreateClubNameBackTarget,
  presentCreateClubPhase,
  presentCreateClubSuccess,
  presentCreateClubSuccessActions,
} from './presentCreateClubFlow.ts';
import { DNB_GLOBAL_INDEKS_A_PRODUCT_ID } from './singleFundCatalog.ts';

const CREATION_ID = '86000000-0000-4000-8000-000000000001';

function storedDraft(overrides: Partial<CreateClubDraft> = {}): CreateClubDraft {
  return {
    ...createEmptyCreateClubDraft(CREATION_ID),
    name: 'Friday Club',
    mode: 'single_fund',
    catalogProductId: DNB_GLOBAL_INDEKS_A_PRODUCT_ID,
    contributionMode: 'equal',
    equalAmountInput: '2000',
    step: 'fund',
    ...overrides,
  };
}

describe('create club intro and resume', () => {
  it('shows intro for a new empty setup', () => {
    const draft = createEmptyCreateClubDraft(CREATION_ID);
    assert.equal(isFreshCreateClubDraft(draft), true);
    assert.equal(initialCreateClubIntroVisible(draft), true);
    assert.equal(
      presentCreateClubPhase({
        introVisible: true,
        draft,
        success: null,
        submitState: 'idle',
      }),
      'intro',
    );
    assert.equal(
      presentCreateClubPhase({
        introDismissed: false,
        draft,
        success: null,
        submitState: 'idle',
      }),
      'intro',
    );
    assert.equal(presentCreateClubIntro().titleEmphasis, 'Together.');
    assert.match(presentCreateClubIntro().startLabel, /Start a club/);
  });

  it('skips intro when a saved draft has progress', () => {
    const draft = storedDraft();
    assert.equal(isFreshCreateClubDraft(draft), false);
    assert.equal(initialCreateClubIntroVisible(draft), false);
    assert.equal(
      presentCreateClubPhase({
        introVisible: false,
        draft,
        success: null,
        submitState: 'idle',
      }),
      'wizard',
    );
    assert.equal(
      presentCreateClubPhase({
        introDismissed: false,
        draft,
        success: null,
        submitState: 'idle',
      }),
      'wizard',
    );
    assert.equal(draft.clientCreationId, CREATION_ID);
  });
});

describe('create club amount presets', () => {
  it('writes the same authoritative amount input', () => {
    const equal = applyCreateClubAmountPreset(
      storedDraft({ step: 'contribution', equalAmountInput: '' }),
      '1000',
    );
    assert.equal(equal.equalAmountInput, '1000');
    const flexible = applyCreateClubAmountPreset(
      storedDraft({
        step: 'contribution',
        contributionMode: 'flexible',
        equalAmountInput: '',
        creatorFlexibleAmountInput: '',
      }),
      '2000',
    );
    assert.equal(flexible.creatorFlexibleAmountInput, '2000');
    assert.equal(flexible.equalAmountInput, '');
    assert.deepEqual(
      presentCreateClubAmountPresets().map((preset) => preset.input),
      ['500', '1000', '2000'],
    );
  });
});

describe('create club presentation labels', () => {
  it('maps governance values to ordinary English', () => {
    assert.equal(createClubGovernanceLabel('simple_majority'), 'Simple majority');
    assert.equal(createClubGovernanceLabel('supermajority'), 'Two-thirds majority');
    assert.equal(createClubGovernanceLabel('unanimous'), 'Everyone agrees');
  });

  it('names contribution styles without internal catalog language', () => {
    assert.equal(createClubContributionTitle('flexible'), 'Each chooses their own amount');
    assert.equal(createClubContributionTitle('equal'), 'Everyone saves the same amount');
  });
});

describe('create club success and celebration', () => {
  it('shows success only after a confirmed club id', () => {
    const success = presentCreateClubSuccess({
      clubId: 'club-1',
      clubName: 'Friday Club',
      fundName: 'DNB Global Indeks A',
    });
    assert.equal(success.titleLead, 'A strong start.');
    assert.equal(success.goToClub.replace, true);
    assert.equal(success.goToClub.href, '/club');
    assert.equal(
      presentCreateClubPhase({
        introDismissed: true,
        draft: null,
        success: {
          clubId: 'club-1',
          clubName: 'Friday Club',
          fundName: 'DNB Global Indeks A',
        },
        submitState: 'success',
      }),
      'success',
    );
  });

  it('does not celebrate timeout, conflict, loading, or a second confirmation of the same club', () => {
    assert.equal(
      presentCreateClubCelebration({
        submitState: 'timeout',
        confirmedClubId: null,
        celebratedClubId: null,
        reduceMotion: false,
      }).shouldPlay,
      false,
    );
    assert.equal(
      presentCreateClubCelebration({
        submitState: 'conflict',
        confirmedClubId: null,
        celebratedClubId: null,
        reduceMotion: false,
      }).shouldPlay,
      false,
    );
    assert.equal(
      presentCreateClubCelebration({
        submitState: 'loading',
        confirmedClubId: null,
        celebratedClubId: null,
        reduceMotion: false,
      }).shouldPlay,
      false,
    );
    const first = presentCreateClubCelebration({
      submitState: 'success',
      confirmedClubId: 'club-1',
      celebratedClubId: null,
      reduceMotion: false,
    });
    assert.equal(first.shouldPlay, true);
    const retry = presentCreateClubCelebration({
      submitState: 'success',
      confirmedClubId: 'club-1',
      celebratedClubId: 'club-1',
      reduceMotion: false,
    });
    assert.equal(retry.shouldPlay, false);
    assert.equal(
      presentCreateClubCelebration({
        submitState: 'success',
        confirmedClubId: 'club-1',
        celebratedClubId: null,
        reduceMotion: true,
      }).shouldPlay,
      false,
    );
  });

  it('does not treat timeout or conflict as a confirmed success', () => {
    const draft = storedDraft({ step: 'review' });
    assert.equal(
      presentCreateClubPhase({
        introVisible: false,
        draft,
        success: null,
        submitState: 'timeout',
      }),
      'wizard',
    );
    assert.equal(
      presentCreateClubPhase({
        introVisible: false,
        draft,
        success: null,
        submitState: 'conflict',
      }),
      'wizard',
    );
    assert.equal(
      presentCreateClubPhase({
        introVisible: false,
        draft,
        success: {
          clubId: 'club-1',
          clubName: 'Friday Club',
          fundName: 'DNB Global Indeks A',
        },
        submitState: 'timeout',
      }),
      'wizard',
    );
  });

  it('blocks a second create after the server has confirmed a club', () => {
    assert.equal(canReplayCreateClubSubmit('idle', null), true);
    assert.equal(canReplayCreateClubSubmit('loading', null), false);
    assert.equal(canReplayCreateClubSubmit('idle', 'club-1'), false);
    assert.equal(canReplayCreateClubSubmit('success', 'club-1'), false);
  });

  it('returns to intro from name after a new setup, and leaves when resuming a saved draft', () => {
    assert.equal(
      presentCreateClubNameBackTarget({
        introDismissed: true,
        draft: createEmptyCreateClubDraft(CREATION_ID),
      }),
      'intro',
    );
    assert.equal(
      presentCreateClubNameBackTarget({
        introDismissed: false,
        draft: storedDraft({ step: 'name' }),
      }),
      'leave',
    );
    assert.equal(
      presentCreateClubPhase({
        introVisible: false,
        introDismissed: false,
        draft: storedDraft({ step: 'name' }),
        success: null,
        submitState: 'idle',
      }),
      'wizard',
    );
  });

  it('keeps success actions on the confirmed club without creating again', () => {
    const actions = presentCreateClubSuccessActions({
      clubId: 'club-1',
      clubName: 'Friday Club',
      fundName: 'DNB Global Indeks A',
    });
    assert.equal(actions.inviteUsesExistingFlow, true);
    assert.deepEqual(actions.goToClub, { href: '/club', replace: true });
    assert.equal(actions.canCreateAgain, false);
    const confirmed = presentCreateClubConfirmedCreation({
      clubId: 'club-1',
      clubName: 'Friday Club',
      fundName: 'DNB Global Indeks A',
      selectedClubId: 'club-1',
    });
    assert.equal(confirmed.selectedClubMatches, true);
    assert.equal(confirmed.inviteClubId, 'club-1');
    assert.equal(
      presentCreateClubConfirmedCreation({
        clubId: 'club-1',
        clubName: 'Friday Club',
        fundName: 'DNB Global Indeks A',
        selectedClubId: 'other',
      }).selectedClubMatches,
      false,
    );
  });
});

describe('create club leave and close', () => {
  it('lets the intro close immediately and hides close on success', () => {
    assert.equal(
      presentCreateClubCloseAction({ phase: 'intro', submitState: 'idle' }),
      'leave',
    );
    assert.equal(
      presentCreateClubCloseAction({ phase: 'success', submitState: 'success' }),
      'hidden',
    );
    assert.equal(
      presentCreateClubCloseControl({ phase: 'success', submitState: 'success' }).visible,
      false,
    );
  });

  it('asks how to leave after setup has started, and blocks close while creating', () => {
    assert.equal(
      presentCreateClubCloseAction({ phase: 'wizard', submitState: 'idle' }),
      'confirm',
    );
    assert.equal(
      presentCreateClubCloseAction({ phase: 'wizard', submitState: 'loading' }),
      'blocked',
    );
    assert.equal(
      presentCreateClubCloseAction({ phase: 'intro', submitState: 'loading' }),
      'blocked',
    );
    assert.equal(
      presentCreateClubCloseControl({ phase: 'wizard', submitState: 'loading' }).disabled,
      true,
    );
  });

  it('keeps back as step navigation and close as leaving the flow', () => {
    assert.equal(
      presentCreateClubNameBackTarget({
        introDismissed: true,
        draft: createEmptyCreateClubDraft(CREATION_ID),
      }),
      'intro',
    );
    assert.equal(
      presentCreateClubCloseAction({ phase: 'wizard', submitState: 'idle' }),
      'confirm',
    );
    assert.equal(
      presentCreateClubNameBackTarget({
        introDismissed: false,
        draft: storedDraft({ step: 'name' }),
      }),
      'leave',
    );
  });

  it('never writes a club or mints a new draft from leave choices', () => {
    const copy = presentCreateClubLeaveCopy();
    assert.equal(copy.saveAndLeaveLabel, 'Save and leave');
    assert.equal(copy.discardSetupLabel, 'Discard setup');
    assert.equal(copy.keepCreatingLabel, 'Keep creating');
    assert.equal(copy.writesServer, false);
    assert.equal(copy.discardMintsNewDraft, false);
    assert.equal(copy.usesStartNewSetup, false);
    assert.deepEqual(presentCreateClubLeaveResult('save_and_leave'), {
      choice: 'save_and_leave',
      leaves: true,
      persistsDraft: true,
      clearsDraft: false,
      mintsNewDraft: false,
      writesServer: false,
      usesStartNewSetup: false,
    });
    assert.deepEqual(presentCreateClubLeaveResult('discard_setup'), {
      choice: 'discard_setup',
      leaves: true,
      persistsDraft: false,
      clearsDraft: true,
      mintsNewDraft: false,
      writesServer: false,
      usesStartNewSetup: false,
    });
    assert.deepEqual(presentCreateClubLeaveResult('keep_creating'), {
      choice: 'keep_creating',
      leaves: false,
      persistsDraft: false,
      clearsDraft: false,
      mintsNewDraft: false,
      writesServer: false,
      usesStartNewSetup: false,
    });
  });
});
