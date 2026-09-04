import { useEffect, useState } from 'react';

import type { AllocationSlice } from '@/ui';
import { fetchClubStrategySlices } from './api';

export function useClubStrategy(clubId: string): {
  allocations: AllocationSlice[];
  isLoading: boolean;
} {
  const [allocations, setAllocations] = useState<AllocationSlice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void fetchClubStrategySlices(clubId)
      .then((slices) => {
        if (!cancelled) {
          setAllocations(slices);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAllocations([]);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clubId]);

  return { allocations, isLoading };
}
