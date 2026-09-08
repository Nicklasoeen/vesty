import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { PreferredBroker } from '@/features/profile/brokers';

import { performInvestmentDayNordnetHandoff } from './investmentDayBrokerHandoff';
import { openNordnetHandoffUrl } from './openNordnetHandoffUrl';
import {
  presentAppStateHandoffReturn,
  presentBrokerHandoffAvailability,
  type BrokerHandoffListing,
  type BrokerHandoffPhase,
} from './presentInvestmentDayBrokerHandoff';

interface HandoffClientState {
  phase: BrokerHandoffPhase;
  awaitingReturn: boolean;
  listing: BrokerHandoffListing | null;
}

const INITIAL_STATE: HandoffClientState = {
  phase: 'idle',
  awaitingReturn: false,
  listing: null,
};

export function useInvestmentDayBrokerHandoff(input: {
  clubId: string | null;
  cycleId: string | null;
  preferredBroker: PreferredBroker | null;
}) {
  const [stateByCycle, setStateByCycle] = useState<Readonly<Record<string, HandoffClientState>>>({});
  const availability = presentBrokerHandoffAvailability(input.preferredBroker);
  const state = (input.cycleId ? stateByCycle[input.cycleId] : undefined) ?? INITIAL_STATE;

  useEffect(() => {
    const cycleId = input.cycleId;
    if (!cycleId) {
      return;
    }
    const subscription = AppState.addEventListener('change', (nextState) => {
      setStateByCycle((current) => {
        const active = current[cycleId] ?? INITIAL_STATE;
        const next = presentAppStateHandoffReturn({
          phase: active.phase,
          awaitingReturn: active.awaitingReturn,
          appState: nextState,
        });
        if (next.phase === active.phase && next.awaitingReturn === active.awaitingReturn) {
          return current;
        }
        return {
          ...current,
          [cycleId]: { ...active, ...next },
        };
      });
    });
    return () => subscription.remove();
  }, [input.cycleId]);

  const open = useCallback(async () => {
    const clubId = input.clubId;
    const cycleId = input.cycleId;
    if (!clubId || !cycleId || availability !== 'nordnet') {
      return;
    }
    setStateByCycle((current) => ({
      ...current,
      [cycleId]: {
        ...(current[cycleId] ?? INITIAL_STATE),
        phase: 'loading',
      },
    }));
    const result = await performInvestmentDayNordnetHandoff({
      clubId,
      cycleId,
      openUrl: openNordnetHandoffUrl,
    });
    setStateByCycle((current) => ({
      ...current,
      [cycleId]: {
        phase: result.phase,
        awaitingReturn: result.awaitingReturn,
        listing: result.listing ?? current[cycleId]?.listing ?? null,
      },
    }));
  }, [availability, input.clubId, input.cycleId]);

  return {
    availability,
    phase: state.phase,
    listing: state.listing,
    awaitingReturn: state.awaitingReturn,
    open,
  };
}
