import type { ContributionProposalResolutionReason } from '../clubs/contributionPolicyProposal.ts';
import type { ContributionPolicyMode } from '../clubs/contributionPolicy.ts';
import { contributionStyleLabel } from '../clubs/presentContribution.ts';
import { formatNokFromMinor } from '../../lib/currency.ts';

import type { ContributionProposalAction } from './createContributionProposal.ts';
import {
  canCastProposalVote,
  orderProposalElectorate,
  presentProposalProposedBy,
  presentProposalStatus,
  presentVoteState,
  presentVotingProgress,
  presentVotingRule,
  proposalFirstName,
  resolveMemberVoteChoice,
  VOTE_AGAINST_LABEL,
  VOTE_FOR_LABEL,
  type ProposalDetailRow,
  type ProposalMemberInput,
  type ProposalVoteInput,
  type ProposalVoterPresentation,
  type StrategyProposalStatus,
  type VoteChoice,
} from './presentProposal.ts';
import type { GovernanceThresholdKind } from '../clubs/governance.ts';

export const CONTRIBUTION_PROPOSAL_EYEBROW = 'Contribution';
export const STRATEGY_PROPOSAL_EYEBROW = 'Strategy';

export const CONTRIBUTION_APPLIES_FUTURE_COPY = 'Applies to future Investment Days.';
export const CONTRIBUTION_REVIEW_APPLIES_COPY =
  "If approved, this applies from the next Investment Day that hasn't started yet.";
export const CONTRIBUTION_OUTDATED_COPY =
  'This proposal was based on an older contribution setting and can no longer be applied.';
export const CONTRIBUTION_OUTDATED_SECONDARY_COPY =
  "Create a new proposal using the club's current contribution style.";
export const CONTRIBUTION_FLEXIBLE_TO_EQUAL_PRIVACY_COPY =
  'Private contribution history stays private. The new shared amount will be used for future Investment Days.';

export const FORBIDDEN_CONTRIBUTION_PROPOSAL_COPY = [
  'contributionpolicyproposal',
  'contribution_policy',
  'stale_base',
  'version 2',
  'your next payment',
  'changes immediately',
  'bank',
  'average',
  'pooled',
] as const;

export function contributionProposalCopyContainsForbidden(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_CONTRIBUTION_PROPOSAL_COPY.some((phrase) => lower.includes(phrase));
}

export function presentContributionStyleLine(
  mode: ContributionPolicyMode,
  equalAmountMinor: number | null,
): { styleLabel: string; amountLabel: string | null; summary: string } {
  const styleLabel = contributionStyleLabel(mode);
  if (mode === 'equal' && equalAmountMinor != null) {
    const amountLabel = formatNokFromMinor(equalAmountMinor);
    return {
      styleLabel,
      amountLabel,
      summary: `${styleLabel} · ${amountLabel}`,
    };
  }

  return {
    styleLabel,
    amountLabel: null,
    summary: styleLabel,
  };
}
export function presentContributionProposalTitle(input: {
  baseMode: ContributionPolicyMode;
  proposedMode: ContributionPolicyMode;
  proposedEqualAmountMinor: number | null;
}): {
  title: string;
  titleLead: string;
  titleEmphasis: string | null;
} {
  if (input.baseMode === 'equal' && input.proposedMode === 'equal' && input.proposedEqualAmountMinor != null) {
    const amount = formatNokFromMinor(input.proposedEqualAmountMinor);
    return {
      title: `Change contribution to ${amount}`,
      titleLead: 'Change contribution to',
      titleEmphasis: amount,
    };
  }

  if (input.proposedMode === 'flexible') {
    return {
      title: 'Switch to flexible contributions',
      titleLead: 'Switch to',
      titleEmphasis: 'flexible contributions',
    };
  }

  if (input.proposedEqualAmountMinor != null) {
    const amount = formatNokFromMinor(input.proposedEqualAmountMinor);
    return {
      title: `Switch to ${amount} for everyone`,
      titleLead: 'Switch to',
      titleEmphasis: `${amount} for everyone`,
    };
  }

  return {
    title: 'Change contribution',
    titleLead: 'Change contribution',
    titleEmphasis: null,
  };
}
export function presentContributionProposalProposer(proposer: ProposalMemberInput | null): string {
  return `${proposalFirstName(proposer?.displayName)} proposes`;
}

export function isOutdatedContributionProposal(
  resolutionReason: ContributionProposalResolutionReason | null | undefined,
): boolean {
  return resolutionReason === 'stale_base';
}

export function presentContributionProposalStatus(input: {
  status: StrategyProposalStatus;
  resolutionReason: ContributionProposalResolutionReason | null;
}): string | null {
  switch (input.resolutionReason) {
    case 'stale_base':
      return 'Outdated';
    case 'vote_rejected':
      return 'Not approved';
    case 'vote_approved':
      return 'Approved';
    case 'expired':
      return 'Expired';
    case 'cancelled':
      return 'Cancelled';
    default:
      return presentProposalStatus(input.status);
  }
}

export function equalToFlexibleReviewCopy(currentEqualAmountMinor: number | null): string {
  if (currentEqualAmountMinor == null) {
    return 'Members will start with the current shared amount privately and can change it for future Investment Days.';
  }

  return `Members will initially keep the current ${formatNokFromMinor(currentEqualAmountMinor)} amount privately and can change it for future Investment Days.`;
}

export function equalToFlexibleDetailCopy(currentEqualAmountMinor: number | null): string {
  if (currentEqualAmountMinor == null) {
    return 'If approved, everyone starts with the current shared amount as their private contribution. Each member can change their own amount for future Investment Days.';
  }

  return `If approved, everyone starts with ${formatNokFromMinor(currentEqualAmountMinor)} as their private contribution. Each member can change their own amount for future Investment Days.`;
}

export function presentContributionProposalReview(input: {
  currentMode: ContributionPolicyMode;
  currentEqualAmountMinor: number | null;
  proposedMode: ContributionPolicyMode;
  proposedEqualAmountMinor: number | null;
}): {
  eyebrow: string;
  currentStyle: string;
  currentAmount: string | null;
  proposedStyle: string;
  proposedAmount: string | null;
  appliesCopy: string;
  transitionCopy: string | null;
} {
  const current = presentContributionStyleLine(input.currentMode, input.currentEqualAmountMinor);
  const proposed = presentContributionStyleLine(input.proposedMode, input.proposedEqualAmountMinor);
  let transitionCopy: string | null = null;
  if (input.currentMode === 'equal' && input.proposedMode === 'flexible') {
    transitionCopy = equalToFlexibleReviewCopy(input.currentEqualAmountMinor);
  } else if (input.currentMode === 'flexible' && input.proposedMode === 'equal') {
    transitionCopy = CONTRIBUTION_FLEXIBLE_TO_EQUAL_PRIVACY_COPY;
  }

  return {
    eyebrow: CONTRIBUTION_PROPOSAL_EYEBROW,
    currentStyle: current.styleLabel,
    currentAmount: current.amountLabel,
    proposedStyle: proposed.styleLabel,
    proposedAmount: proposed.amountLabel,
    appliesCopy: CONTRIBUTION_REVIEW_APPLIES_COPY,
    transitionCopy,
  };
}
export function presentApprovedContributionResult(input: {
  baseMode: ContributionPolicyMode;
  baseEqualAmountMinor: number | null;
  proposedMode: ContributionPolicyMode;
  proposedEqualAmountMinor: number | null;
}): string | null {
  if (input.baseMode === 'equal' && input.proposedMode === 'equal') {
    if (input.baseEqualAmountMinor == null || input.proposedEqualAmountMinor == null) {
      return null;
    }
    return `${formatNokFromMinor(input.baseEqualAmountMinor)} → ${formatNokFromMinor(input.proposedEqualAmountMinor)}`;
  }

  if (input.proposedMode === 'flexible') {
    return 'Flexible amounts';
  }

  if (input.proposedEqualAmountMinor != null) {
    return presentContributionStyleLine('equal', input.proposedEqualAmountMinor).summary;
  }

  return null;
}

export function presentContributionCreateOptions(input: {
  currentMode: ContributionPolicyMode;
  currentEqualAmountMinor: number | null;
}): {
  currentStyle: string;
  currentDetail: string;
  actions: readonly ContributionProposalAction[];
  showsMemberAmounts: false;
} {
  const current = presentContributionStyleLine(input.currentMode, input.currentEqualAmountMinor);
  return {
    currentStyle: current.styleLabel,
    currentDetail:
      input.currentMode === 'equal' && input.currentEqualAmountMinor != null
        ? `${current.amountLabel} per Investment Day`
        : 'Each member chooses their amount privately',
    actions:
      input.currentMode === 'equal' ? ['change_amount', 'switch_to_flexible'] : ['switch_to_equal'],
    showsMemberAmounts: false,
  };
}
export function proposalSortTimestamp(input: {
  openedAt: string | null;
  createdAt: string | null;
  closedAt: string | null;
}): string {
  return input.openedAt ?? input.createdAt ?? input.closedAt ?? '';
}

export function mergeClubProposalFeed<T extends { openedAt: string | null; createdAt: string | null; closedAt: string | null }>(
  proposals: readonly T[],
): T[] {
  return [...proposals].sort((left, right) => {
    const rightTime = proposalSortTimestamp(right);
    const leftTime = proposalSortTimestamp(left);
    return rightTime.localeCompare(leftTime);
  });
}

export function shouldAttemptContributionFinalize(input: {
  kind: 'strategy' | 'contribution';
  status: StrategyProposalStatus;
  deadlineAt: string | null;
  now?: Date;
}): boolean {
  if (input.kind !== 'contribution' || input.status !== 'open' || !input.deadlineAt) {
    return false;
  }

  return new Date(input.deadlineAt).getTime() <= (input.now ?? new Date()).getTime();
}

export function presentContributionProposalDetail(input: {
  baseMode: ContributionPolicyMode;
  baseEqualAmountMinor: number | null;
  proposedMode: ContributionPolicyMode;
  proposedEqualAmountMinor: number | null;
  proposer: ProposalMemberInput | null;
  status: StrategyProposalStatus;
  resolutionReason: ContributionProposalResolutionReason | null;
  votingThresholdKind: GovernanceThresholdKind | null;
  electorateSize: number;
  electorateMembershipIds: readonly string[];
  votes: readonly ProposalVoteInput[];
  votesVisible: boolean;
  viewerMembershipId: string;
  sessionChoice: VoteChoice | null | undefined;
  alreadyVotedUnknownChoice: boolean;
  deadlineAt: string | null;
  members: readonly ProposalMemberInput[];
}): {
  eyebrow: string;
  proposedBy: string;
  titleLead: string;
  titleEmphasis: string | null;
  title: string;
  description: string | null;
  currentStyle: string;
  currentSummary: string;
  proposedStyle: string;
  proposedSummary: string;
  explanation: string;
  appliesCopy: string;
  outdatedCopy: string | null;
  resultSummary: string | null;
  statusLabel: string | null;
  votingRule: string | null;
  progress: string;
  voters: ProposalVoterPresentation[];
  details: ProposalDetailRow[];
  canVote: boolean;
  voteForLabel: typeof VOTE_FOR_LABEL;
  voteAgainstLabel: typeof VOTE_AGAINST_LABEL;
  viewerVoteCopy: string | null;
} {
  const title = presentContributionProposalTitle(input);
  const current = presentContributionStyleLine(input.baseMode, input.baseEqualAmountMinor);
  const proposed = presentContributionStyleLine(input.proposedMode, input.proposedEqualAmountMinor);
  const outdated = isOutdatedContributionProposal(input.resolutionReason);
  const statusLabel = presentContributionProposalStatus({
    status: input.status,
    resolutionReason: input.resolutionReason,
  });
  const votingRule = presentVotingRule(input.votingThresholdKind);
  const viewerChoice = resolveMemberVoteChoice({
    membershipId: input.viewerMembershipId,
    votes: input.votes,
    votesVisible: input.votesVisible,
    viewerMembershipId: input.viewerMembershipId,
    sessionChoice: input.sessionChoice,
  });
  const alreadyVoted = viewerChoice != null || input.alreadyVotedUnknownChoice;
  const inElectorate = input.electorateMembershipIds.includes(input.viewerMembershipId);
  const voters = orderProposalElectorate(input.electorateMembershipIds, input.members).map((membershipId) => {
    const member = input.members.find((item) => item.membershipId === membershipId) ?? null;
    return {
      membershipId,
      firstName: proposalFirstName(member?.displayName),
      initials: member?.initials ?? '?',
      state: presentVoteState(
        resolveMemberVoteChoice({
          membershipId,
          votes: input.votes,
          votesVisible: input.votesVisible,
          viewerMembershipId: input.viewerMembershipId,
          sessionChoice: input.sessionChoice,
        }),
      ),
    };
  });

  let explanation = CONTRIBUTION_APPLIES_FUTURE_COPY;
  if (input.baseMode === 'equal' && input.proposedMode === 'flexible') {
    explanation = equalToFlexibleDetailCopy(input.baseEqualAmountMinor);
  } else if (input.baseMode === 'flexible' && input.proposedMode === 'equal') {
    explanation = CONTRIBUTION_FLEXIBLE_TO_EQUAL_PRIVACY_COPY;
  }

  const details: ProposalDetailRow[] = [];
  if (votingRule) {
    details.push({ label: 'Voting rule', value: votingRule });
  }
  if (statusLabel) {
    details.push({ label: 'Status', value: statusLabel });
  }
  details.push({ label: 'Applies', value: 'Future Investment Days' });

  return {
    eyebrow: CONTRIBUTION_PROPOSAL_EYEBROW,
    proposedBy: presentContributionProposalProposer(input.proposer),
    titleLead: title.titleLead,
    titleEmphasis: title.titleEmphasis,
    title: title.title,
    description: outdated ? CONTRIBUTION_OUTDATED_COPY : null,
    currentStyle: current.styleLabel,
    currentSummary: current.summary,
    proposedStyle: proposed.styleLabel,
    proposedSummary: proposed.summary,
    explanation,
    appliesCopy: CONTRIBUTION_APPLIES_FUTURE_COPY,
    outdatedCopy: outdated ? CONTRIBUTION_OUTDATED_SECONDARY_COPY : null,
    resultSummary:
      input.status === 'approved'
        ? presentApprovedContributionResult(input)
        : null,
    statusLabel,
    votingRule,
    progress: presentVotingProgress({
      electorateSize: input.electorateSize,
      votesCast: input.votesVisible ? input.votes.length : null,
      votesVisible: input.votesVisible,
    }),
    voters,
    details,
    canVote: canCastProposalVote({
      status: input.status,
      inElectorate,
      alreadyVoted,
      deadlineAt: input.deadlineAt,
    }),
    voteForLabel: VOTE_FOR_LABEL,
    voteAgainstLabel: VOTE_AGAINST_LABEL,
    viewerVoteCopy:
      viewerChoice === 'yes'
        ? 'You voted For'
        : viewerChoice === 'no'
          ? 'You voted Against'
          : input.alreadyVotedUnknownChoice
            ? 'You have already voted.'
            : null,
  };
}
export function presentContributionProposalListRow(input: {
  baseMode: ContributionPolicyMode;
  proposedMode: ContributionPolicyMode;
  proposedEqualAmountMinor: number | null;
  proposer: ProposalMemberInput | null;
  status: StrategyProposalStatus;
  resolutionReason: ContributionProposalResolutionReason | null;
  electorateSize: number;
  votesCast: number | null;
  votesVisible: boolean;
}): {
  eyebrow: string;
  title: string;
  proposedBy: string;
  progress: string;
  statusLabel: string | null;
} {
  const title = presentContributionProposalTitle(input);
  return {
    eyebrow: CONTRIBUTION_PROPOSAL_EYEBROW,
    title: title.title,
    proposedBy: presentProposalProposedBy(input.proposer),
    progress: presentVotingProgress({
      electorateSize: input.electorateSize,
      votesCast: input.votesCast,
      votesVisible: input.votesVisible,
    }),
    statusLabel: presentContributionProposalStatus({
      status: input.status,
      resolutionReason: input.resolutionReason,
    }),
  };
}