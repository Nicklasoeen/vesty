import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  performGalleryHandoffOpen,
  presentGalleryHandoffReturn,
} from './investmentDayHandoffGalleryRealLink';
import { openNordnetHandoffUrl } from './openNordnetHandoffUrl';
import type { BrokerHandoffPhase } from './presentInvestmentDayBrokerHandoff';

interface GalleryRealHandoffState {
  phase: BrokerHandoffPhase;
  awaitingReturn: boolean;
}

const INITIAL_STATE: GalleryRealHandoffState = {
  phase: 'idle',
  awaitingReturn: false,
};

export function useGalleryRealNordnetHandoff() {
  const [state, setState] = useState<GalleryRealHandoffState>(INITIAL_STATE);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (appState) => {
      setState((current) => {
        const next = presentGalleryHandoffReturn({
          mode: 'real_nordnet_test',
          phase: current.phase,
          awaitingReturn: current.awaitingReturn,
          appState,
        });
        if (next.phase === current.phase && next.awaitingReturn === current.awaitingReturn) {
          return current;
        }
        return next;
      });
    });
    return () => subscription.remove();
  }, []);

  const open = useCallback(async () => {
    setState({ phase: 'loading', awaitingReturn: false });
    const result = await performGalleryHandoffOpen({
      mode: 'real_nordnet_test',
      openUrl: openNordnetHandoffUrl,
    });
    if ('skipped' in result && result.skipped) {
      setState(INITIAL_STATE);
      return;
    }
    setState({
      phase: result.phase,
      awaitingReturn: result.awaitingReturn,
    });
  }, []);

  return {
    phase: state.phase,
    awaitingReturn: state.awaitingReturn,
    open,
  };
}
