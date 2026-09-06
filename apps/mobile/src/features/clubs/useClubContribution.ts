import { useCallback, useEffect, useState } from 'react';

import { getClubContributionPolicy, getMyContributionCommitment, setMyFlexibleContribution } from './api';
import type { ClubContributionPolicy, MyContributionCommitment } from './contributionPolicy';
import { needsFlexibleContributionSetup } from './presentContribution';

export function useClubContribution(clubId: string | null): {
  policy: ClubContributionPolicy | null;
  commitment: MyContributionCommitment | null;
  setupRequired: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveFlexibleAmount: (amountMinor: number) => Promise<MyContributionCommitment>;
} {
  const [policy, setPolicy] = useState<ClubContributionPolicy | null>(null);
  const [commitment, setCommitment] = useState<MyContributionCommitment | null>(null);
  const [loadedClubId, setLoadedClubId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (targetClubId: string): Promise<void> => {
    try {
      const [nextPolicy, nextCommitment] = await Promise.all([
        getClubContributionPolicy(targetClubId),
        getMyContributionCommitment(targetClubId),
      ]);
      setPolicy(nextPolicy);
      setCommitment(nextCommitment);
      setLoadedClubId(targetClubId);
      setError(null);
    } catch (caught) {
      setPolicy(null);
      setCommitment(null);
      setLoadedClubId(targetClubId);
      setError(caught instanceof Error ? caught.message : 'Unable to load contribution settings');
    }
  }, []);

  useEffect(() => {
    if (!clubId) {
      return;
    }

    let cancelled = false;
    void Promise.all([
      getClubContributionPolicy(clubId),
      getMyContributionCommitment(clubId),
    ])
      .then(([nextPolicy, nextCommitment]) => {
        if (!cancelled) {
          setPolicy(nextPolicy);
          setCommitment(nextCommitment);
          setLoadedClubId(clubId);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setPolicy(null);
          setCommitment(null);
          setLoadedClubId(clubId);
          setError(caught instanceof Error ? caught.message : 'Unable to load contribution settings');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const refresh = useCallback(async (): Promise<void> => {
    if (!clubId) {
      return;
    }
    await load(clubId);
  }, [clubId, load]);

  const saveFlexibleAmount = useCallback(async (amountMinor: number): Promise<MyContributionCommitment> => {
    if (!clubId) {
      throw new Error('Unable to save your contribution');
    }

    const saved = await setMyFlexibleContribution(clubId, amountMinor);
    await load(clubId);
    return saved;
  }, [clubId, load]);

  const visiblePolicy = clubId && loadedClubId === clubId ? policy : null;
  const visibleCommitment = clubId && loadedClubId === clubId ? commitment : null;

  return {
    policy: visiblePolicy,
    commitment: visibleCommitment,
    setupRequired: needsFlexibleContributionSetup(visiblePolicy, visibleCommitment),
    isLoading: Boolean(clubId) && loadedClubId !== clubId,
    error: clubId && loadedClubId === clubId ? error : null,
    refresh,
    saveFlexibleAmount,
  };
}
