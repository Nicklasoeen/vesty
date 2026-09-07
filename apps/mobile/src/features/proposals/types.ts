import type { ContributionPolicyMode } from '@/features/clubs/contributionPolicy';
import type { ContributionProposalResolutionReason } from '@/features/clubs/contributionPolicyProposal';
import type { GovernanceThresholdKind } from '@/features/clubs/governance';

import type { ClubProposalKind, StrategyProposalStatus, VoteChoice } from './presentProposal';

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

export interface ContributionProposalPayload {
  basePolicyVersionId: string;
  baseMode: ContributionPolicyMode;
  baseEqualAmountMinor: number | null;
  proposedMode: ContributionPolicyMode;
  proposedEqualAmountMinor: number | null;
}

export interface ClubProposalRecord {
  id: string;
  kind: ClubProposalKind;
  clubId: string;
  proposerMembershipId: string;
  status: StrategyProposalStatus;
  resolutionReason: ContributionProposalResolutionReason | null;
  reason: string | null;
  votingThresholdKind: GovernanceThresholdKind | null;
  electorateSize: number;
  requiredYesCount: number | null;
  intendedEffectiveAt: string | null;
  deadlineAt: string | null;
  openedAt: string | null;
  closedAt: string | null;
  createdAt: string | null;
  allocations: ProposalAllocationRecord[];
  contribution: ContributionProposalPayload | null;
  electorateMembershipIds: string[];
  votes: ProposalVoteRecord[];
  votesVisible: boolean;
}
