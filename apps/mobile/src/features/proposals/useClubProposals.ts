import { useCallback, useEffect, useState } from 'react';

import {
  createContributionPolicyProposal,
  openContributionPolicyProposal,
} from '@/features/clubs/api';
import type { ContributionPolicyMode } from '@/features/clubs/contributionPolicy';

import { castProposalVote, fetchClubProposals, finalizeContributionPolicyProposal } from './api';
import { shouldAttemptContributionFinalize } from './presentContributionProposal';
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
  refresh: () => Promise<ClubProposalRecord[]>;
  castVote: (proposalId: string, membershipId: string, choice: VoteChoice) => Promise<void>;
  createAndOpenContributionProposal: (input: {
    basePolicyVersionId: string;
    proposedMode: ContributionPolicyMode;
    proposedEqualAmountMinor: number | null;
  }) => Promise<string>;
  resolveContributionProposal: (proposalId: string) => Promise<void>;
} {
  const [proposals, setProposals] = useState<ClubProposalRecord[]>([]);
  const [loadedClubId, setLoadedClubId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionVotes, setSessionVotes] = useState<Record<string, SessionVoteState>>({});

  const refresh = useCallback(async (): Promise<ClubProposalRecord[]> => {
    try {
      const next = await fetchClubProposals(clubId);
      setProposals(next);
      setLoadedClubId(clubId);
      setError(null);
      return next;
    } catch (caught) {
      setLoadedClubId(clubId);
      setError(caught instanceof Error ? caught.message : 'Unable to load proposals');
      throw caught instanceof Error ? caught : new Error('Unable to load proposals');
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
          const proposal = proposals.find((item) => item.id === proposalId);
          try {
            if (proposal?.kind === 'contribution') {
              await finalizeContributionPolicyProposal(proposalId);
            }
          } finally {
            await refresh();
          }
          return;
        }
        throw caught;
      }

      const proposal = proposals.find((item) => item.id === proposalId);
      try {
        if (proposal?.kind === 'contribution') {
          await finalizeContributionPolicyProposal(proposalId);
        }
      } finally {
        await refresh();
      }
    },
    [proposals, refresh],
  );

  const createAndOpenContributionProposal = useCallback(
    async (input: {
      basePolicyVersionId: string;
      proposedMode: ContributionPolicyMode;
      proposedEqualAmountMinor: number | null;
    }) => {
      const created = await createContributionPolicyProposal({
        clubId,
        basePolicyVersionId: input.basePolicyVersionId,
        proposedMode: input.proposedMode,
        proposedEqualAmountMinor: input.proposedEqualAmountMinor,
      });
      await openContributionPolicyProposal(created.proposalId);
      await refresh();
      return created.proposalId;
    },
    [clubId, refresh],
  );

  const resolveContributionProposal = useCallback(
    async (proposalId: string) => {
      const proposal = proposals.find((item) => item.id === proposalId);
      if (
        !proposal
        || !shouldAttemptContributionFinalize({
          kind: proposal.kind,
          status: proposal.status,
          deadlineAt: proposal.deadlineAt,
        })
      ) {
        return;
      }

      await finalizeContributionPolicyProposal(proposalId);
      await refresh();
    },
    [proposals, refresh],
  );

  return {
    proposals: loadedClubId === clubId ? proposals : [],
    isLoading: loadedClubId !== clubId,
    error: loadedClubId === clubId ? error : null,
    sessionVotes,
    refresh,
    castVote,
    createAndOpenContributionProposal,
    resolveContributionProposal,
  };
}
