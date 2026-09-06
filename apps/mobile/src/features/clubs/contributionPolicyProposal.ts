import type { StrategyProposalStatus } from '../proposals/presentProposal';

import { type ContributionPolicyMode } from './contributionPolicy.ts';

export interface ContributionPolicyProposal {
  id: string;
  clubId: string;
  proposerMembershipId: string;
  status: StrategyProposalStatus;
  deadlineAt: string | null;
  openedAt: string | null;
  closedAt: string | null;
  approvedAt: string | null;
  electorateSize: number | null;
  requiredYesCount: number | null;
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
