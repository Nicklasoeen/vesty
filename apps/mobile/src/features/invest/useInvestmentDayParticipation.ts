import { useCallback, useEffect, useState } from 'react';

import {
  fetchInvestmentDayParticipation,
  type InvestmentDayParticipation,
} from './participationApi';

export function useInvestmentDayParticipation(
  clubId: string | null,
  cycleId: string | null,
): {
  participation: InvestmentDayParticipation | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [participation, setParticipation] = useState<InvestmentDayParticipation | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = clubId && cycleId ? `${clubId}:${cycleId}` : null;

  const refresh = useCallback(async () => {
    if (!clubId || !cycleId) {
      return;
    }

    try {
      const next = await fetchInvestmentDayParticipation(clubId, cycleId);
      setParticipation(next);
      setLoadedKey(`${clubId}:${cycleId}`);
      setError(null);
    } catch (caught) {
      setParticipation(null);
      setLoadedKey(`${clubId}:${cycleId}`);
      setError(caught instanceof Error ? caught.message : 'Unable to load Investment Day progress');
    }
  }, [clubId, cycleId]);

  useEffect(() => {
    if (!clubId || !cycleId) {
      return;
    }

    let cancelled = false;
    void fetchInvestmentDayParticipation(clubId, cycleId)
      .then((next) => {
        if (!cancelled) {
          setParticipation(next);
          setLoadedKey(`${clubId}:${cycleId}`);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setParticipation(null);
          setLoadedKey(`${clubId}:${cycleId}`);
          setError(caught instanceof Error ? caught.message : 'Unable to load Investment Day progress');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clubId, cycleId]);

  return {
    participation: key && loadedKey === key ? participation : null,
    isLoading: Boolean(key) && loadedKey !== key,
    error: key && loadedKey === key ? error : null,
    refresh,
  };
}
