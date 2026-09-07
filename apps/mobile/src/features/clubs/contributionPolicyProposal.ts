import type { GovernanceThresholdKind } from './governance.ts';
import type { StrategyProposalStatus } from '../proposals/presentProposal';

import { type ContributionPolicyMode } from './contributionPolicy.ts';

export const CONTRIBUTION_PROPOSAL_RESOLUTION_REASONS = [
  'vote_approved',
  'vote_rejected',
  'stale_base',
  'expired',
  'cancelled',
] as const;

export type ContributionProposalResolutionReason =
  (typeof CONTRIBUTION_PROPOSAL_RESOLUTION_REASONS)[number];

export interface ContributionPolicyProposal {
  id: string;
  clubId: string;
  proposerMembershipId: string;
  status: StrategyProposalStatus;
  resolutionReason: ContributionProposalResolutionReason | null;
  deadlineAt: string | null;
  openedAt: string | null;
  closedAt: string | null;
  approvedAt: string | null;
  createdAt: string | null;
  intendedEffectiveAt: string | null;
  electorateSize: number | null;
  requiredYesCount: number | null;
  votingThresholdKind: GovernanceThresholdKind | null;
  basePolicyVersionId: string;
  baseMode: ContributionPolicyMode;
  baseEqualAmountMinor: number | null;
  proposedMode: ContributionPolicyMode;
  proposedEqualAmountMinor: number | null;
}

export interface ContributionPolicyProposalChange {
  fromStyle: ContributionPolicyMode;
  toStyle: ContributionPolicyMode;
  fromEqualAmountMinor: number | null;
  toEqualAmountMinor: number | null;
}

const PROPOSAL_STATUSES: readonly StrategyProposalStatus[] = [
  'draft',
  'open',
  'approved',
  'rejected',
  'expired',
  'cancelled',
];

export function presentContributionPolicyProposalChange(input: {
  baseMode: ContributionPolicyMode;
  baseEqualAmountMinor: number | null;
  proposedMode: ContributionPolicyMode;
  proposedEqualAmountMinor: number | null;
}): ContributionPolicyProposalChange {
  return {
    fromStyle: input.baseMode,
    toStyle: input.proposedMode,
    fromEqualAmountMinor: input.baseMode === 'equal' ? input.baseEqualAmountMinor : null,
    toEqualAmountMinor: input.proposedMode === 'equal' ? input.proposedEqualAmountMinor : null,
  };
}

export function isContributionPolicyProposalStatus(
  value: unknown,
): value is StrategyProposalStatus {
  return typeof value === 'string' && (PROPOSAL_STATUSES as readonly string[]).includes(value);
}

export function isContributionProposalResolutionReason(
  value: unknown,
): value is ContributionProposalResolutionReason {
  return (
    typeof value === 'string'
    && (CONTRIBUTION_PROPOSAL_RESOLUTION_REASONS as readonly string[]).includes(value)
  );
}
