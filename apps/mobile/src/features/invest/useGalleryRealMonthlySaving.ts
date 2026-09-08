import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  performGalleryMonthlySavingOpen,
  presentGalleryMonthlySavingReturn,
} from './monthlySavingGalleryRealLink';
import { openNordnetHandoffUrl } from './openNordnetHandoffUrl';
import type { MonthlySavingPhase } from './presentMonthlySavingSetup';

interface GalleryRealMonthlySavingState {
  phase: MonthlySavingPhase;
  awaitingReturn: boolean;
}

const INITIAL_STATE: GalleryRealMonthlySavingState = {
  phase: 'idle',
  awaitingReturn: false,
};

export function useGalleryRealMonthlySaving() {
  const [state, setState] = useState<GalleryRealMonthlySavingState>(INITIAL_STATE);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (appState) => {
      setState((current) => {
        const next = presentGalleryMonthlySavingReturn({
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
    const result = await performGalleryMonthlySavingOpen({
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
