import { useEffect, useState } from 'react';

import {
  fetchEstimatedPositions,
  fetchMemberPortfolio,
  fetchMemberPortfolioHistory,
  fetchMemberPortfolios,
  type EstimatedPosition,
  type MemberPortfolioSummary,
  type PortfolioHistoryPoint,
} from './portfolioApi';

function isoDateUtc(value: Date, shiftDays = 0): string {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + shiftDays);
  return date.toISOString().slice(0, 10);
}

export function useMemberPortfolio(clubId?: string | null): {
  summary: MemberPortfolioSummary | null;
  history: PortfolioHistoryPoint[];
  positions: EstimatedPosition[];
  clubSummaries: MemberPortfolioSummary[];
  isLoading: boolean;
} {
  const [summary, setSummary] = useState<MemberPortfolioSummary | null>(null);
  const [history, setHistory] = useState<PortfolioHistoryPoint[]>([]);
  const [positions, setPositions] = useState<EstimatedPosition[]>([]);
  const [clubSummaries, setClubSummaries] = useState<MemberPortfolioSummary[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const key = clubId ?? 'home';

  useEffect(() => {
    let cancelled = false;
    const today = new Date();

    void Promise.all([
      fetchMemberPortfolio(clubId ?? null),
      fetchMemberPortfolioHistory({
        clubId: clubId ?? null,
        from: isoDateUtc(today, -400),
        to: isoDateUtc(today),
        stepDays: 7,
      }),
      clubId ? fetchEstimatedPositions(clubId) : Promise.resolve([]),
      clubId ? Promise.resolve([]) : fetchMemberPortfolios(),
    ])
      .then(([nextSummary, nextHistory, nextPositions, nextClubSummaries]) => {
        if (!cancelled) {
          setSummary(nextSummary);
          setHistory(nextHistory);
          setPositions(nextPositions);
          setClubSummaries(nextClubSummaries);
          setLoadedKey(key);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(null);
          setHistory([]);
          setPositions([]);
          setClubSummaries([]);
          setLoadedKey(key);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clubId, key]);

  return {
    summary: loadedKey === key ? summary : null,
    history: loadedKey === key ? history : [],
    positions: loadedKey === key ? positions : [],
    clubSummaries: loadedKey === key ? clubSummaries : [],
    isLoading: loadedKey !== key,
  };
}
