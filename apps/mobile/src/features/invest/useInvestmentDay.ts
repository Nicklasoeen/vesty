import { useCallback, useEffect, useRef, useState } from 'react';

import { isContributionSetupRequiredError } from '@/features/clubs/contributionPolicy';

import { isReportConflictError } from './investErrors';
import { fetchCurrentInvestmentDay, reportInvestmentDay } from './api';
import { clientReportIdForCycle, type InvestmentDayReportRequest } from './investmentDayReport';
import type { InvestmentDayPlan } from './types';

export function useInvestmentDay(clubId: string | null): {
  plan: InvestmentDayPlan | null;
  isLoading: boolean;
  error: string | null;
  setupRequired: boolean;
  isReporting: boolean;
  refresh: () => Promise<InvestmentDayPlan | null>;
  report: (
    input: Omit<InvestmentDayReportRequest, 'clubId' | 'cycleId' | 'clientReportId'>,
  ) => Promise<InvestmentDayPlan>;
} {
  const [plan, setPlan] = useState<InvestmentDayPlan | null>(null);
  const [loadedClubId, setLoadedClubId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const clientReportIds = useRef<Record<string, string>>({});

  const clientReportIdFor = useCallback((cycleId: string): string => {
    return clientReportIdForCycle(clientReportIds.current, cycleId);
  }, []);

  const refresh = useCallback(async (): Promise<InvestmentDayPlan | null> => {
    if (!clubId) {
      return null;
    }

    try {
      const next = await fetchCurrentInvestmentDay(clubId);
      setPlan(next);
      setLoadedClubId(clubId);
      setError(null);
      setSetupRequired(next.viewerState === 'setup_required');
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
    void fetchCurrentInvestmentDay(clubId)
      .then((next) => {
        if (!cancelled) {
          setPlan(next);
          setLoadedClubId(clubId);
          setError(null);
          setSetupRequired(next.viewerState === 'setup_required');
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

  const report = useCallback(async (
    input: Omit<InvestmentDayReportRequest, 'clubId' | 'cycleId' | 'clientReportId'>,
  ): Promise<InvestmentDayPlan> => {
    if (!plan || !clubId || !plan.cycleId) {
      throw new Error('Unable to save this Investment Day report');
    }

    setIsReporting(true);
    setError(null);

    try {
      const next = await reportInvestmentDay({
        clubId: plan.clubId,
        cycleId: plan.cycleId,
        clientReportId: clientReportIdFor(plan.cycleId),
        reportMode: input.reportMode,
        outcome: input.outcome,
        purchaseLines: input.purchaseLines,
      });
      setPlan(next);
      setLoadedClubId(clubId);
      setIsReporting(false);
      return next;
    } catch (caught) {
      if (!isReportConflictError(caught)) {
        const reconciled = await fetchCurrentInvestmentDay(plan.clubId).catch(() => null);
        if (reconciled?.isCompleted && reconciled.cycleId === plan.cycleId) {
          setPlan(reconciled);
          setLoadedClubId(clubId);
          setIsReporting(false);
          setError(null);
          return reconciled;
        }
      }

      setIsReporting(false);
      const message = caught instanceof Error ? caught.message : 'Unable to save this Investment Day report';
      setError(message);
      throw new Error(message);
    }
  }, [clientReportIdFor, clubId, plan]);

  const visiblePlan = clubId && loadedClubId === clubId ? plan : null;
  const visibleError = clubId && loadedClubId === clubId ? error : null;
  const visibleSetupRequired = clubId && loadedClubId === clubId ? setupRequired : false;
  const isLoading = Boolean(clubId) && loadedClubId !== clubId;

  return {
    plan: visiblePlan,
    isLoading,
    error: visibleError,
    setupRequired: visibleSetupRequired,
    isReporting,
    refresh,
    report,
  };
}
