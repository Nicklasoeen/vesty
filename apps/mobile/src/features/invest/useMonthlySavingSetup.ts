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
  canConfirmMonthlySavingSetup,
  openMonthlySavingSetupUrl,
  openOneTimePurchaseUrl,
  presentAppStateMonthlySavingReturn,
  presentCopyAmountValue,
  type MonthlySavingPhase,
  type MonthlySavingSetup,
  type MonthlySavingView,
} from './presentMonthlySavingSetup';

interface MonthlySavingClientState {
  phase: MonthlySavingPhase;
  view: MonthlySavingView;
  awaitingReturn: boolean;
  openedMonthlyUrl: boolean;
  clientAttestationId: string | null;
  setup: MonthlySavingSetup | null;
  error: string | null;
}

const INITIAL_STATE: MonthlySavingClientState = {
  phase: 'idle',
  view: 'monthly',
  awaitingReturn: false,
  openedMonthlyUrl: false,
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
        patch(clubId, { setup, phase: 'idle', error: null });
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
        const next = presentAppStateMonthlySavingReturn({
          phase: active.phase,
          awaitingReturn: active.awaitingReturn,
          appState,
        });
        if (next.phase === active.phase && next.awaitingReturn === active.awaitingReturn) {
          return current;
        }
        return {
          ...current,
          [clubId]: { ...active, ...next },
        };
      });
    });
    return () => subscription.remove();
  }, [clubId]);

  const openMonthly = useCallback(async () => {
    if (!clubId || !state.setup) {
      return;
    }
    patch(clubId, { phase: 'loading', error: null });
    const result = await openMonthlySavingSetupUrl({
      setup: state.setup,
      openUrl: openNordnetHandoffUrl,
    });
    patch(clubId, {
      phase: result.phase,
      awaitingReturn: result.awaitingReturn,
      openedMonthlyUrl: result.phase === 'opened',
    });
  }, [clubId, patch, state.setup]);

  const confirm = useCallback(async () => {
    if (!clubId || !state.setup) {
      return;
    }
    if (!canConfirmMonthlySavingSetup({
      phase: state.phase,
      openedMonthlyUrl: state.openedMonthlyUrl,
    })) {
      return;
    }
    const clientAttestationId = state.clientAttestationId ?? generateClientAttestationId();
    patch(clubId, { clientAttestationId, phase: 'confirming', error: null });
    try {
      const setup = await confirmMonthlySavingSetup({
        clubId,
        clientAttestationId,
      });
      patch(clubId, {
        setup,
        phase: 'idle',
        view: 'monthly',
        awaitingReturn: false,
        openedMonthlyUrl: false,
        clientAttestationId: null,
        error: null,
      });
    } catch (error) {
      patch(clubId, {
        phase: 'error',
        error: error instanceof Error ? error.message : 'Unable to save monthly saving confirmation',
      });
    }
  }, [clubId, patch, state.clientAttestationId, state.openedMonthlyUrl, state.phase, state.setup]);

  const openOneTime = useCallback(async () => {
    if (!clubId || !state.setup) {
      return;
    }
    await openOneTimePurchaseUrl({
      setup: state.setup,
      openUrl: openNordnetHandoffUrl,
    });
  }, [clubId, state.setup]);

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
    error: state.error,
    isLoading: Boolean(clubId) && state.setup == null && state.error == null && state.phase === 'idle',
    openMonthly,
    openOneTime,
    confirm,
    copyAmount,
    buyOnce: () => {
      if (clubId) {
        patch(clubId, { view: 'one_time', phase: 'idle', awaitingReturn: false });
      }
    },
    notYet: () => {
      if (clubId) {
        patch(clubId, { phase: 'idle', awaitingReturn: false, openedMonthlyUrl: false });
      }
    },
    retry: () => {
      if (clubId) {
        void openMonthly();
      }
    },
    showMonthly: () => {
      if (clubId) {
        patch(clubId, { view: 'monthly' });
      }
    },
  };
}
