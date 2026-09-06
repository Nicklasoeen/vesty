import { useCallback, useEffect, useState } from 'react';

import { isContributionSetupRequiredError } from '@/features/clubs/contributionPolicy';

import { confirmInvestmentDay, ensureOpenInvestmentDay } from './api';
import type { ExecutionReportInput } from './investmentDayReporting';
import type { InvestmentDayPlan } from './types';

export function useInvestmentDay(clubId: string | null): {
  plan: InvestmentDayPlan | null;
  isLoading: boolean;
  error: string | null;
  setupRequired: boolean;
  isConfirming: boolean;
  refresh: () => Promise<InvestmentDayPlan | null>;
  confirm: (executionReports?: ExecutionReportInput[]) => Promise<InvestmentDayPlan>;
} {
  const [plan, setPlan] = useState<InvestmentDayPlan | null>(null);
  const [loadedClubId, setLoadedClubId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
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
      setSetupRequired(false);
      return next;
    } catch (caught) {
      setPlan(null);
      setLoadedClubId(clubId);
      if (isContributionSetupRequiredError(caught)) {
        setSetupRequired(true);
        setError(null);
        return null;
      }
      setSetupRequired(false);
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
          setSetupRequired(false);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setPlan(null);
          setLoadedClubId(clubId);
          if (isContributionSetupRequiredError(caught)) {
            setSetupRequired(true);
            setError(null);
            return;
          }
          setSetupRequired(false);
          setError(caught instanceof Error ? caught.message : 'Unable to load this Investment Day');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const confirm = useCallback(async (
    executionReports?: ExecutionReportInput[],
  ): Promise<InvestmentDayPlan> => {
    if (!plan || !clubId) {
      throw new Error('Unable to confirm investments right now');
    }

    setIsConfirming(true);
    setError(null);

    try {
      const next = await confirmInvestmentDay({
        clubId: plan.clubId,
        cycleId: plan.cycleId,
        executionReports,
      });
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
  const visibleSetupRequired = clubId && loadedClubId === clubId ? setupRequired : false;
  const isLoading = Boolean(clubId) && loadedClubId !== clubId;

  return {
    plan: visiblePlan,
    isLoading,
    error: visibleError,
    setupRequired: visibleSetupRequired,
    isConfirming,
    refresh,
    confirm,
  };
}
