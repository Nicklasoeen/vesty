import type { GovernanceThresholdKind } from '@/features/clubs/governance';

import type { StrategyProposalStatus, VoteChoice } from './presentProposal';

export interface ProposalAllocationRecord {
  targetName: string;
  ticker: string | null;
  allocationBps: number;
  position: number;
}

export interface ProposalVoteRecord {
  membershipId: string;
  choice: VoteChoice;
}

export interface ClubProposalRecord {
  id: string;
  clubId: string;
  proposerMembershipId: string;
  status: StrategyProposalStatus;
  reason: string | null;
  votingThresholdKind: GovernanceThresholdKind | null;
  electorateSize: number;
  requiredYesCount: number | null;
  intendedEffectiveAt: string | null;
  deadlineAt: string | null;
  openedAt: string | null;
  closedAt: string | null;
  allocations: ProposalAllocationRecord[];
  electorateMembershipIds: string[];
  votes: ProposalVoteRecord[];
  votesVisible: boolean;
}
