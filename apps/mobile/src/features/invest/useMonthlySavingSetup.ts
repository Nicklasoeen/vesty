import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { copyText } from '@/features/clubs/copyText';

import { generateClientAttestationId } from './generateClientAttestationId';
import {
  confirmMonthlySavingSetup,
  fetchMonthlySavingSetup,
} from './monthlySavingSetup';
import { openNordnetHandoffUrl } from './openNordnetHandoffUrl';
import {
  canSubmitMonthlySavingAttestation,
  openMonthlySavingSetupUrl,
  openOneTimePurchaseUrl,
  presentAppStateMonthlySavingReturn,
  presentCopyAmountValue,
  presentMonthlySavingAttestationClientId,
  presentMonthlySavingAttestationIssue,
  presentMonthlySavingOpenIntent,
  type MonthlySavingHandoffIntent,
  type MonthlySavingPhase,
  type MonthlySavingSetup,
  type MonthlySavingView,
} from './presentMonthlySavingSetup';
import type { InvestAttestationIssue, OneTimeHandoffPhase } from './presentInvestJourney';

interface MonthlySavingClientState {
  phase: MonthlySavingPhase;
  view: MonthlySavingView;
  awaitingReturn: boolean;
  openedMonthlyUrl: boolean;
  oneTimePhase: OneTimeHandoffPhase;
  awaitingOneTimeReturn: boolean;
  introDismissed: boolean;
  attestationSaved: boolean;
  attestationIssue: InvestAttestationIssue;
  clientAttestationId: string | null;
  setup: MonthlySavingSetup | null;
  error: string | null;
}

const INITIAL_STATE: MonthlySavingClientState = {
  phase: 'idle',
  view: 'monthly',
  awaitingReturn: false,
  openedMonthlyUrl: false,
  oneTimePhase: 'idle',
  awaitingOneTimeReturn: false,
  introDismissed: false,
  attestationSaved: false,
  attestationIssue: null,
  clientAttestationId: null,
  setup: null,
  error: null,
};

export function useMonthlySavingSetup(clubId: string | null) {
  const [stateByClub, setStateByClub] = useState<Readonly<Record<string, MonthlySavingClientState>>>({});
  const state = (clubId ? stateByClub[clubId] : undefined) ?? INITIAL_STATE;

  const patch = useCallback(
    (club: string, next: Partial<MonthlySavingClientState>) => {
      setStateByClub((current) => ({
        ...current,
        [club]: { ...(current[club] ?? INITIAL_STATE), ...next },
      }));
    },
    [],
  );

  const load = useCallback(async (club: string) => {
    try {
      const setup = await fetchMonthlySavingSetup(club);
      patch(club, { setup, phase: 'idle', error: null, attestationIssue: null });
      return setup;
    } catch (error: unknown) {
      patch(club, {
        phase: 'error',
        error: error instanceof Error ? error.message : 'Unable to load monthly saving',
        attestationIssue: null,
      });
      return null;
    }
  }, [patch]);

  useEffect(() => {
    if (!clubId) {
      return;
    }
    let cancelled = false;
    void fetchMonthlySavingSetup(clubId)
      .then((setup) => {
        if (cancelled) {
          return;
        }
        patch(clubId, { setup, phase: 'idle', error: null, attestationIssue: null });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        patch(clubId, {
          phase: 'error',
          error: error instanceof Error ? error.message : 'Unable to load monthly saving',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [clubId, patch]);

  useEffect(() => {
    if (!clubId) {
      return;
    }
    const subscription = AppState.addEventListener('change', (appState) => {
      setStateByClub((current) => {
        const active = current[clubId] ?? INITIAL_STATE;
        const monthly = presentAppStateMonthlySavingReturn({
          phase: active.phase,
          awaitingReturn: active.awaitingReturn,
          appState,
        });
        const oneTime = presentAppStateMonthlySavingReturn({
          phase: active.oneTimePhase,
          awaitingReturn: active.awaitingOneTimeReturn,
          appState,
        });
        const oneTimePhase: OneTimeHandoffPhase = oneTime.phase === 'confirming' ? 'idle' : oneTime.phase;
        if (
          monthly.phase === active.phase
          && monthly.awaitingReturn === active.awaitingReturn
          && oneTime.phase === active.oneTimePhase
          && oneTime.awaitingReturn === active.awaitingOneTimeReturn
        ) {
          return current;
        }
        return {
          ...current,
          [clubId]: {
            ...active,
            phase: monthly.phase,
            awaitingReturn: monthly.awaitingReturn,
            oneTimePhase,
            awaitingOneTimeReturn: oneTime.awaitingReturn,
          },
        };
      });
    });
    return () => subscription.remove();
  }, [clubId]);

  const openMonthly = useCallback(async (intent: MonthlySavingHandoffIntent = 'attest') => {
    if (!clubId || !state.setup) {
      return;
    }
    const awaitsAttestationReturn = presentMonthlySavingOpenIntent(intent).awaitsAttestationReturn;
    if (awaitsAttestationReturn) {
      patch(clubId, { phase: 'loading', error: null, attestationIssue: null });
    } else {
      patch(clubId, { error: null, attestationIssue: null });
    }
    const result = await openMonthlySavingSetupUrl({
      setup: state.setup,
      openUrl: openNordnetHandoffUrl,
    });
    if (!awaitsAttestationReturn) {
      patch(clubId, {
        phase: result.phase === 'error' ? 'error' : 'idle',
        awaitingReturn: false,
        openedMonthlyUrl: false,
        error: result.phase === 'error' ? 'Unable to open Nordnet' : null,
      });
      return;
    }
    patch(clubId, {
      phase: result.phase,
      awaitingReturn: result.awaitingReturn,
      openedMonthlyUrl: result.phase === 'opened',
      error: result.phase === 'error' ? 'Unable to open Nordnet' : null,
    });
  }, [clubId, patch, state.setup]);

  const confirm = useCallback(async (attested: boolean) => {
    if (!clubId || !state.setup) {
      return;
    }
    if (!canSubmitMonthlySavingAttestation({
      phase: state.phase,
      openedMonthlyUrl: state.openedMonthlyUrl,
      attested,
      attestationIssue: state.attestationIssue,
      clientAttestationId: state.clientAttestationId,
    })) {
      return;
    }
    const clientAttestationId = presentMonthlySavingAttestationClientId(
      state.clientAttestationId,
      generateClientAttestationId,
    );
    patch(clubId, {
      clientAttestationId,
      phase: 'confirming',
      error: null,
      attestationIssue: null,
    });
    try {
      const next = await confirmMonthlySavingSetup({
        clubId,
        clientAttestationId,
      });
      patch(clubId, {
        setup: next,
        phase: 'idle',
        view: 'monthly',
        awaitingReturn: false,
        openedMonthlyUrl: false,
        clientAttestationId: null,
        error: null,
        attestationSaved: true,
        attestationIssue: null,
      });
    } catch (error) {
      patch(clubId, {
        phase: 'returned',
        error: error instanceof Error ? error.message : 'Unable to save monthly saving confirmation',
        attestationIssue: presentMonthlySavingAttestationIssue(error),
      });
    }
  }, [clubId, patch, state.attestationIssue, state.clientAttestationId, state.openedMonthlyUrl, state.phase, state.setup]);

  const openOneTime = useCallback(async () => {
    if (!clubId || !state.setup) {
      return;
    }
    patch(clubId, { oneTimePhase: 'loading', error: null });
    try {
      const result = await openOneTimePurchaseUrl({
        setup: state.setup,
        openUrl: openNordnetHandoffUrl,
      });
      patch(clubId, {
        oneTimePhase: result.openedUrl ? 'opened' : 'error',
        awaitingOneTimeReturn: Boolean(result.openedUrl),
        view: 'one_time',
        error: result.openedUrl ? null : 'Unable to open Nordnet',
      });
    } catch {
      patch(clubId, {
        oneTimePhase: 'error',
        awaitingOneTimeReturn: false,
        error: 'Unable to open Nordnet',
      });
    }
  }, [clubId, patch, state.setup]);

  const copyAmount = useCallback(async () => {
    const value = presentCopyAmountValue(state.setup?.recommendedAmountMinor ?? null);
    if (!value) {
      return;
    }
    await copyText(value);
  }, [state.setup]);

  return {
    setup: state.setup,
    phase: state.phase,
    view: state.view,
    oneTimePhase: state.oneTimePhase,
    introDismissed: state.introDismissed,
    attestationSaved: state.attestationSaved,
    attestationIssue: state.attestationIssue,
    openedMonthlyUrl: state.openedMonthlyUrl,
    error: state.error,
    isLoading: Boolean(clubId) && state.setup == null && state.error == null && state.phase === 'idle',
    openMonthly,
    openOneTime,
    confirm,
    copyAmount,
    refresh: () => {
      if (clubId) {
        return load(clubId);
      }
      return Promise.resolve(null);
    },
    restoreIntro: () => {
      if (clubId) {
        patch(clubId, { introDismissed: false });
      }
    },
    dismissIntro: () => {
      if (clubId) {
        patch(clubId, { introDismissed: true });
      }
    },
    dismissSaved: () => {
      if (clubId) {
        patch(clubId, { attestationSaved: false });
      }
    },
    buyOnce: () => {
      if (clubId) {
        patch(clubId, {
          view: 'one_time',
          phase: 'idle',
          awaitingReturn: false,
          oneTimePhase: 'idle',
          awaitingOneTimeReturn: false,
        });
      }
    },
    notYet: () => {
      if (clubId) {
        patch(clubId, {
          phase: 'idle',
          awaitingReturn: false,
          openedMonthlyUrl: false,
          attestationIssue: null,
          error: null,
        });
      }
    },
    retry: () => {
      if (clubId) {
        if (state.attestationIssue) {
          void confirm(true);
          return;
        }
        if (state.view === 'one_time' || state.oneTimePhase === 'error') {
          void openOneTime();
          return;
        }
        if (state.setup == null) {
          void load(clubId);
          return;
        }
        void openMonthly('attest');
      }
    },
    retryLoad: () => {
      if (clubId) {
        void load(clubId);
      }
    },
    showMonthly: () => {
      if (clubId) {
        patch(clubId, {
          view: 'monthly',
          oneTimePhase: 'idle',
          awaitingOneTimeReturn: false,
        });
      }
    },
    clearOneTimeReturn: () => {
      if (clubId) {
        patch(clubId, {
          oneTimePhase: 'idle',
          awaitingOneTimeReturn: false,
        });
      }
    },
  };
}
