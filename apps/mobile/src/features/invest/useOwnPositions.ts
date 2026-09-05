import { useEffect, useState } from 'react';

import { fetchOwnPositions, type OwnPosition } from './api';

export function useOwnPositions(clubId: string | null): {
  positions: OwnPosition[];
  isLoading: boolean;
} {
  const [positions, setPositions] = useState<OwnPosition[]>([]);
  const [loadedClubId, setLoadedClubId] = useState<string | null>(null);

  useEffect(() => {
    if (!clubId) {
      return;
    }

    let cancelled = false;
    void fetchOwnPositions(clubId)
      .then((next) => {
        if (!cancelled) {
          setPositions(next);
          setLoadedClubId(clubId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPositions([]);
          setLoadedClubId(clubId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clubId]);

  return {
    positions: clubId && loadedClubId === clubId ? positions : [],
    isLoading: Boolean(clubId) && loadedClubId !== clubId,
  };
}
