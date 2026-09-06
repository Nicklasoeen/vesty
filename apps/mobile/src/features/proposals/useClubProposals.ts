import { useCallback, useEffect, useState } from 'react';

import { castProposalVote, fetchClubProposals } from './api';
import { ProposalVoteError, type VoteChoice } from './presentProposal';
import type { ClubProposalRecord } from './types';

export interface SessionVoteState {
  choice: VoteChoice | null;
}

export function useClubProposals(clubId: string): {
  proposals: ClubProposalRecord[];
  isLoading: boolean;
  error: string | null;
  sessionVotes: Record<string, SessionVoteState>;
  refresh: () => Promise<void>;
  castVote: (proposalId: string, membershipId: string, choice: VoteChoice) => Promise<void>;
} {
  const [proposals, setProposals] = useState<ClubProposalRecord[]>([]);
  const [loadedClubId, setLoadedClubId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionVotes, setSessionVotes] = useState<Record<string, SessionVoteState>>({});

  const refresh = useCallback(async () => {
    try {
      const next = await fetchClubProposals(clubId);
      setProposals(next);
      setLoadedClubId(clubId);
      setError(null);
    } catch (caught) {
      setProposals([]);
      setLoadedClubId(clubId);
      setError(caught instanceof Error ? caught.message : 'Unable to load proposals');
    }
  }, [clubId]);

  useEffect(() => {
    let cancelled = false;
    void fetchClubProposals(clubId)
      .then((next) => {
        if (!cancelled) {
          setProposals(next);
          setLoadedClubId(clubId);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setProposals([]);
          setLoadedClubId(clubId);
          setError(caught instanceof Error ? caught.message : 'Unable to load proposals');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const castVote = useCallback(
    async (proposalId: string, membershipId: string, choice: VoteChoice) => {
      try {
        await castProposalVote({ proposalId, membershipId, choice });
        setSessionVotes((current) => ({ ...current, [proposalId]: { choice } }));
      } catch (caught) {
        if (caught instanceof ProposalVoteError && caught.kind === 'already_voted') {
          setSessionVotes((current) => ({
            ...current,
            [proposalId]: { choice: current[proposalId]?.choice ?? null },
          }));
          return;
        }
        throw caught;
      }
      await refresh();
    },
    [refresh],
  );

  return {
    proposals: loadedClubId === clubId ? proposals : [],
    isLoading: loadedClubId !== clubId,
    error: loadedClubId === clubId ? error : null,
    sessionVotes,
    refresh,
    castVote,
  };
}
