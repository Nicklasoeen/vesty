import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/theme';

import { InviteMemberSheet } from './InviteMemberSheet';
import { CreateClubJourney } from './CreateClubJourney';
import {
  applyCreateClubLeaveChoice,
  clearCreateClubDraft,
  loadCreateClubDraft,
  saveCreateClubDraft,
} from './createClubDraftStorage';
import { createClubRequest, trimmedClubName, type CreateClubDraft } from './createClubWizard';
import {
  classifyCreateClubSubmitError,
  presentCreateClubGoToClubsNavigation,
  resetCreateClubSubmitAfterNewSetup,
  startNewCreateClubSetup,
  type CreateClubSubmitState,
} from './createClubSubmission';
import { generateClientCreationId } from './generateClientCreationId';
import { mapClubError } from './clubErrors';
import {
  canReplayCreateClubSubmit,
  initialCreateClubIntroVisible,
  presentCreateClubCelebration,
  presentCreateClubCloseAction,
  presentCreateClubConfirmedCreation,
  presentCreateClubLeaveResult,
  presentCreateClubPhase,
  type CreateClubLeaveChoice,
  type CreateClubSuccessModel,
} from './presentCreateClubFlow';
import {
  findSingleFundProduct,
  reconcileCatalogSelection,
  type CatalogLoadState,
  type SingleFundProduct,
} from './singleFundCatalog';
import { attachClub, createInvitationForClub, createSingleFundClub, fetchSingleFundCatalog, useClubs } from './useClubs';

export function CreateClubScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const profileId = user?.id ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {profileId ? <CreateClubSession key={profileId} profileId={profileId} /> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

function CreateClubSession({ profileId }: { profileId: string }) {
  const router = useRouter();
  const { colorScheme, colors } = useTheme();
  const { refresh, selectClub, selectedClub } = useClubs();
  const [draft, setDraft] = useState<CreateClubDraft | null>(null);
  const [introVisible, setIntroVisible] = useState(true);
  const [introDismissed, setIntroDismissed] = useState(false);
  const [products, setProducts] = useState<SingleFundProduct[]>([]);
  const [catalogState, setCatalogState] = useState<CatalogLoadState>('idle');
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<CreateClubSubmitState>('idle');
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [fundDetailOpen, setFundDetailOpen] = useState(false);
  const [success, setSuccess] = useState<CreateClubSuccessModel | null>(null);
  const [celebratedClubId, setCelebratedClubId] = useState<string | null>(null);
  const [playCelebration, setPlayCelebration] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const createdClubIdRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);
  const catalogLoadedForDraftRef = useRef(false);

  useEffect(() => {
    const apply = (enabled: boolean) => setReduceMotion(enabled);
    void AccessibilityInfo.isReduceMotionEnabled().then(apply);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', apply);
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadCreateClubDraft(AsyncStorage, profileId, generateClientCreationId).then((loaded) => {
      if (cancelled) {
        return;
      }
      const showIntro = initialCreateClubIntroVisible(loaded);
      setDraft(loaded);
      setIntroVisible(showIntro);
      setIntroDismissed(false);
      hydratedRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  useEffect(() => {
    if (!hydratedRef.current || !draft || submitState === 'success') {
      return;
    }
    void saveCreateClubDraft(AsyncStorage, profileId, draft);
  }, [draft, profileId, submitState]);

  const loadCatalog = useCallback(async (currentDraft: CreateClubDraft | null) => {
    setCatalogState('loading');
    try {
      const nextProducts = await fetchSingleFundCatalog();
      const reconciliation = reconcileCatalogSelection(currentDraft?.catalogProductId ?? null, nextProducts);
      setProducts(nextProducts);
      setCatalogMessage(reconciliation.unavailableMessage);
      setCatalogState(nextProducts.length === 0 ? 'empty' : 'ready');
      if (currentDraft && reconciliation.catalogProductId !== currentDraft.catalogProductId) {
        setDraft({ ...currentDraft, catalogProductId: reconciliation.catalogProductId });
      }
    } catch (error) {
      setCatalogState('error');
      setCatalogMessage(error instanceof Error ? error.message : 'Unable to load funds right now');
    }
  }, []);

  useEffect(() => {
    if (!draft || catalogLoadedForDraftRef.current) {
      return;
    }
    catalogLoadedForDraftRef.current = true;
    void loadCatalog(draft);
  }, [draft, loadCatalog]);

  const onDraftChange = (next: CreateClubDraft) => {
    if (submitState === 'loading' || createdClubIdRef.current) {
      return;
    }
    if (submitState !== 'conflict') {
      setSubmitState('idle');
      setSubmitMessage(null);
    }
    setDraft(next);
  };

  const finishCreatedClub = async (clubId: string, currentDraft: CreateClubDraft) => {
    const product = findSingleFundProduct(products, currentDraft.catalogProductId);
    const nextSuccess = {
      clubId,
      clubName: trimmedClubName(currentDraft.name),
      fundName: product?.displayName ?? product?.legalName ?? 'Fund',
    };
    await clearCreateClubDraft(AsyncStorage, profileId);
    hydratedRef.current = false;
    await attachClub(refresh, selectClub, clubId);
    createdClubIdRef.current = clubId;
    setSuccess(nextSuccess);
    setSubmitState('success');
    setDraft(currentDraft);
    const celebration = presentCreateClubCelebration({
      submitState: 'success',
      confirmedClubId: clubId,
      celebratedClubId,
      reduceMotion,
    });
    setPlayCelebration(celebration.shouldPlay);
    setCelebratedClubId(celebration.nextCelebratedClubId);
  };

  const onCreate = async () => {
    if (!draft || !canReplayCreateClubSubmit(submitState, createdClubIdRef.current)) {
      return;
    }

    let request;
    try {
      request = createClubRequest(draft, products);
    } catch (error) {
      setSubmitState('error');
      setSubmitMessage(error instanceof Error ? error.message : 'Unable to create club right now');
      return;
    }

    setSubmitState('loading');
    setSubmitMessage(null);
    setPlayCelebration(false);

    try {
      const created = await createSingleFundClub(request);
      createdClubIdRef.current = created.clubId;
      await finishCreatedClub(created.clubId, draft);
    } catch (error) {
      const nextState = classifyCreateClubSubmitError(error);
      setSubmitState(nextState);
      setPlayCelebration(false);
      setSuccess(null);
      setSubmitMessage(
        error instanceof Error
          ? error.message
          : mapClubError(error, 'Unable to create club right now', 'create_club_v3'),
      );
    }
  };

  const onGoToClubs = async () => {
    await refresh();
    const navigation = presentCreateClubGoToClubsNavigation();
    router.replace(navigation.href);
  };

  const onStartNewSetup = async () => {
    const next = await startNewCreateClubSetup({
      store: AsyncStorage,
      profileId,
      generateId: generateClientCreationId,
    });
    const reset = resetCreateClubSubmitAfterNewSetup();
    createdClubIdRef.current = reset.createdClubId;
    catalogLoadedForDraftRef.current = false;
    setSubmitState(reset.submitState);
    setSubmitMessage(reset.submitMessage);
    setFundDetailOpen(false);
    setSuccess(null);
    setPlayCelebration(false);
    setCelebratedClubId(null);
    setIntroVisible(true);
    setIntroDismissed(false);
    setDraft(next);
  };

  const leave = () => {
    if (submitState === 'loading' || createdClubIdRef.current) {
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/club');
  };

  const onLeaveChoice = async (choice: CreateClubLeaveChoice) => {
    if (!draft) {
      return;
    }
    const currentPhase = presentCreateClubPhase({
      introVisible,
      draft,
      success,
      submitState,
    });
    const closeAction = presentCreateClubCloseAction({
      phase: currentPhase,
      submitState,
    });
    if (closeAction === 'blocked' || closeAction === 'hidden') {
      return;
    }
    const outcome = presentCreateClubLeaveResult(choice);
    if (!outcome.leaves) {
      return;
    }
    if (outcome.clearsDraft) {
      hydratedRef.current = false;
    }
    await applyCreateClubLeaveChoice(AsyncStorage, profileId, draft, choice);
    leave();
  };

  const onInviteMembers = async () => {
    if (!success || inviteBusy) {
      return;
    }
    setInviteOpen(true);
    setInviteBusy(true);
    setInviteError(null);
    setInviteToken(null);
    try {
      const created = await createInvitationForClub(success.clubId);
      setInviteToken(created.inviteToken);
    } catch (caught) {
      setInviteError(caught instanceof Error ? caught.message : "You don't have permission to invite members");
    } finally {
      setInviteBusy(false);
    }
  };

  const onGoToClub = () => {
    if (!success) {
      return;
    }
    const confirmed = presentCreateClubConfirmedCreation({
      clubId: success.clubId,
      clubName: success.clubName,
      fundName: success.fundName,
      selectedClubId: selectedClub?.clubId ?? success.clubId,
    });
    router.replace(confirmed.goToClub.href);
  };

  if (!draft) {
    return null;
  }

  const phase = presentCreateClubPhase({
    introVisible,
    draft,
    success,
    submitState,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={phase === 'intro' || colorScheme === 'dark' ? 'light' : 'dark'} />
      <CreateClubJourney
        draft={draft}
        onDraftChange={onDraftChange}
        products={products}
        catalogState={catalogState}
        catalogMessage={catalogMessage}
        onRetryCatalog={() => {
          void loadCatalog(draft);
        }}
        submitState={submitState}
        submitMessage={submitMessage}
        onSubmit={() => {
          void onCreate();
        }}
        onGoToClubs={() => {
          void onGoToClubs();
        }}
        onStartNewSetup={() => {
          void onStartNewSetup();
        }}
        onSaveAndLeave={() => {
          void onLeaveChoice('save_and_leave');
        }}
        onDiscardSetup={() => {
          void onLeaveChoice('discard_setup');
        }}
        fundDetailOpen={fundDetailOpen}
        onFundDetailOpenChange={setFundDetailOpen}
        onLeave={leave}
        phase={phase}
        introVisible={introVisible}
        introDismissed={introDismissed}
        onStartClub={() => {
          setIntroVisible(false);
          setIntroDismissed(true);
        }}
        onReturnToIntro={() => {
          setIntroVisible(true);
        }}
        success={success}
        onInviteMembers={() => {
          void onInviteMembers();
        }}
        onGoToClub={onGoToClub}
        reduceMotion={reduceMotion}
        playCelebration={playCelebration}
      />
      {success && inviteOpen ? (
        <InviteMemberSheet
          visible
          clubName={success.clubName}
          inviteToken={inviteToken}
          isGenerating={inviteBusy}
          error={inviteError}
          onClose={() => setInviteOpen(false)}
        />
      ) : null}
    </View>
  );
}
