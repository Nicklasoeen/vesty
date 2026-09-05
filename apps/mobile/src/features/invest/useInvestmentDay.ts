import { useCallback, useEffect, useState } from 'react';

import { confirmInvestmentDay, ensureOpenInvestmentDay } from './api';
import type { InvestmentDayPlan } from './types';

export function useInvestmentDay(clubId: string | null): {
  plan: InvestmentDayPlan | null;
  isLoading: boolean;
  error: string | null;
  isConfirming: boolean;
  refresh: () => Promise<InvestmentDayPlan | null>;
  confirm: () => Promise<InvestmentDayPlan>;
} {
  const [plan, setPlan] = useState<InvestmentDayPlan | null>(null);
  const [loadedClubId, setLoadedClubId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const refresh = useCallback(async (): Promise<InvestmentDayPlan | null> => {
    if (!clubId) {
      return null;
    }

    try {
      const next = await ensureOpenInvestmentDay(clubId);
      setPlan(next);
      setLoadedClubId(clubId);
      setError(null);
      return next;
    } catch (caught) {
      setPlan(null);
      setLoadedClubId(clubId);
      setError(caught instanceof Error ? caught.message : 'Unable to load this Investment Day');
      return null;
    }
  }, [clubId]);

  useEffect(() => {
    if (!clubId) {
      return;
    }

    let cancelled = false;
    void ensureOpenInvestmentDay(clubId)
      .then((next) => {
        if (!cancelled) {
          setPlan(next);
          setLoadedClubId(clubId);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setPlan(null);
          setLoadedClubId(clubId);
          setError(caught instanceof Error ? caught.message : 'Unable to load this Investment Day');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const confirm = useCallback(async (): Promise<InvestmentDayPlan> => {
    if (!plan || !clubId) {
      throw new Error('Unable to confirm investments right now');
    }

    setIsConfirming(true);
    setError(null);

    try {
      const next = await confirmInvestmentDay(plan.clubId, plan.cycleId);
      setPlan(next);
      setLoadedClubId(clubId);
      setIsConfirming(false);
      return next;
    } catch (caught) {
      const reconciled = await ensureOpenInvestmentDay(plan.clubId).catch(() => null);
      if (reconciled?.isCompleted) {
        setPlan(reconciled);
        setLoadedClubId(clubId);
        setIsConfirming(false);
        setError(null);
        return reconciled;
      }

      setIsConfirming(false);
      const message = caught instanceof Error ? caught.message : 'Unable to confirm investments right now';
      setError(message);
      throw new Error(message);
    }
  }, [clubId, plan]);

  const visiblePlan = clubId && loadedClubId === clubId ? plan : null;
  const visibleError = clubId && loadedClubId === clubId ? error : null;
  const isLoading = Boolean(clubId) && loadedClubId !== clubId;

  return {
    plan: visiblePlan,
    isLoading,
    error: visibleError,
    isConfirming,
    refresh,
    confirm,
  };
}
