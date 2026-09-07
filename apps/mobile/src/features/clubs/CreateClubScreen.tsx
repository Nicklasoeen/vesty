import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/theme';
import { Screen } from '@/ui';

import { CreateClubJourney } from './CreateClubJourney';
import {
  clearCreateClubDraft,
  loadCreateClubDraft,
  saveCreateClubDraft,
} from './createClubDraftStorage';
import { createClubRequest, type CreateClubDraft } from './createClubWizard';
import {
  classifyCreateClubSubmitError,
  presentCreateClubGoToClubsNavigation,
  presentCreateClubSuccessNavigation,
  resetCreateClubSubmitAfterNewSetup,
  startNewCreateClubSetup,
  type CreateClubSubmitState,
} from './createClubSubmission';
import { generateClientCreationId } from './generateClientCreationId';
import { mapClubError } from './clubErrors';
import {
  reconcileCatalogSelection,
  type CatalogLoadState,
  type SingleFundProduct,
} from './singleFundCatalog';
import { attachClub, createSingleFundClub, fetchSingleFundCatalog, useClubs } from './useClubs';

export function CreateClubScreen() {
  const { colorScheme, colors, spacing } = useTheme();
  const { user } = useAuth();
  const profileId = user?.id ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
          {profileId ? <CreateClubSession key={profileId} profileId={profileId} /> : null}
        </Screen>
      </KeyboardAvoidingView>
    </View>
  );
}

function CreateClubSession({ profileId }: { profileId: string }) {
  const router = useRouter();
  const { refresh, selectClub } = useClubs();
  const [draft, setDraft] = useState<CreateClubDraft | null>(null);
  const [products, setProducts] = useState<SingleFundProduct[]>([]);
  const [catalogState, setCatalogState] = useState<CatalogLoadState>('idle');
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<CreateClubSubmitState>('idle');
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [fundDetailOpen, setFundDetailOpen] = useState(false);
  const createdClubIdRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);
  const catalogLoadedForDraftRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadCreateClubDraft(AsyncStorage, profileId, generateClientCreationId).then((loaded) => {
      if (!cancelled) {
        setDraft(loaded);
        hydratedRef.current = true;
      }
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
    if (submitState === 'loading') {
      return;
    }
    if (submitState !== 'conflict') {
      setSubmitState('idle');
      setSubmitMessage(null);
    }
    setDraft(next);
  };

  const finishCreatedClub = async (clubId: string) => {
    await clearCreateClubDraft(AsyncStorage, profileId);
    hydratedRef.current = false;
    setDraft(null);
    await attachClub(refresh, selectClub, clubId);
    setSubmitState('success');
    const navigation = presentCreateClubSuccessNavigation();
    router.replace(navigation.href);
  };

  const onCreate = async () => {
    if (!draft || submitState === 'loading' || createdClubIdRef.current) {
      if (createdClubIdRef.current) {
        await finishCreatedClub(createdClubIdRef.current);
      }
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

    try {
      const created = await createSingleFundClub(request);
      createdClubIdRef.current = created.clubId;
      await finishCreatedClub(created.clubId);
    } catch (error) {
      const nextState = classifyCreateClubSubmitError(error);
      setSubmitState(nextState);
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
    setDraft(next);
  };

  const leave = () => {
    if (submitState === 'loading') {
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/club');
  };

  if (!draft) {
    return null;
  }

  return (
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
      onDiscardSetup={() => {
        void onStartNewSetup();
      }}
      fundDetailOpen={fundDetailOpen}
      onFundDetailOpenChange={setFundDetailOpen}
      onLeave={leave}
    />
  );
}
