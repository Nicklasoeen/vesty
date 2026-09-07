import { presentClubStrategy } from '../club-dashboard/presentClubDashboard.ts';
import type { GovernanceThresholdKind } from '../clubs/governance.ts';
import { formatHomeInvestmentDayDate } from '../home/presentHomePortfolio.ts';

export const PROPOSAL_STATUSES = ['draft', 'open', 'approved', 'rejected', 'expired', 'cancelled'] as const;
export type StrategyProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export type VoteChoice = 'yes' | 'no';
export type VoteStateLabel = 'For' | 'Against' | 'Pending';

export const PROPOSAL_EMPTY_TITLE = 'No proposals yet.';
export const PROPOSAL_EMPTY_BODY =
  'When your club makes a decision together,\nproposals will appear here.';

export const FORBIDDEN_PROPOSAL_COPY = [
  'market buy',
  'buying power',
  'shares per member',
  'cost per member',
  'pooled',
  'withdraw',
  'group funds',
  'available group',
  'accept',
  'decline',
] as const;

export interface ProposalAllocationInput {
  targetName: string;
  ticker?: string | null;
  allocationBps: number;
}

export function isVisibleProposalStatus(status: StrategyProposalStatus): boolean {
  return status !== 'draft';
}

export type ClubProposalKind = 'strategy' | 'contribution';

export function presentProposalStatus(status: StrategyProposalStatus): string | null {
  switch (status) {
    case 'open':
      return 'Open';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Not approved';
    case 'expired':
      return 'Expired';
    case 'cancelled':
      return 'Cancelled';
    case 'draft':
      return null;
  }
}

export function isTerminalProposalStatus(status: StrategyProposalStatus): boolean {
  return status === 'approved' || status === 'rejected' || status === 'expired' || status === 'cancelled';
}

export function presentVoteState(choice: VoteChoice | null): VoteStateLabel {
  if (choice === 'yes') {
    return 'For';
  }
  if (choice === 'no') {
    return 'Against';
  }
  return 'Pending';
}

export function presentVotingRule(kind: GovernanceThresholdKind | null): string | null {
  if (kind === 'simple_majority') {
    return 'Majority';
  }
  if (kind === 'supermajority') {
    return '75% majority';
  }
  if (kind === 'unanimous') {
    return 'Unanimous';
  }
  return null;
}

export function proposalFirstName(displayName: string | null | undefined): string {
  const first = displayName?.trim().split(/\s+/).filter(Boolean)[0];
  return first || 'Member';
}

export function presentProposalTitle(allocations: readonly ProposalAllocationInput[]): {
  title: string;
  titleLead: string;
  titleEmphasis: string | null;
  packageName: string | null;
  description: string | null;
  friendlyLines: string[];
} {
  const strategy = presentClubStrategy(
    allocations.map((allocation) => ({
      label: allocation.targetName,
      ticker: allocation.ticker,
      percentage: allocation.allocationBps / 100,
    })),
  );
  const packageName = strategy.packageName;
  const titleEmphasis = packageName;
  const titleLead = packageName ? 'Change strategy to' : 'Strategy change';

  return {
    title: packageName ? `Change strategy to ${packageName}` : 'Strategy change',
    titleLead,
    titleEmphasis,
    packageName,
    description: strategy.description,
    friendlyLines: strategy.lines.map((line) => `${line.percentage}% ${line.friendlyName}`),
  };
}

export function presentVotingProgress(input: {
  electorateSize: number;
  votesCast: number | null;
  votesVisible: boolean;
}): string {
  if (input.votesVisible && input.votesCast != null) {
    return `${input.votesCast} of ${input.electorateSize} voted`;
  }
  if (input.electorateSize === 1) {
    return '1 member votes';
  }
  return `${input.electorateSize} members vote`;
}

export function canCastProposalVote(input: {
  status: StrategyProposalStatus;
  inElectorate: boolean;
  alreadyVoted: boolean;
  deadlineAt: string | null;
  now?: Date;
}): boolean {
  if (input.status !== 'open' || !input.inElectorate || input.alreadyVoted) {
    return false;
  }
  if (!input.deadlineAt) {
    return false;
  }
  return new Date(input.deadlineAt).getTime() > (input.now ?? new Date()).getTime();
}

export function splitProposalGroups<T extends { status: StrategyProposalStatus }>(
  proposals: readonly T[],
): { open: T[]; history: T[] } {
  return {
    open: proposals.filter((proposal) => proposal.status === 'open'),
    history: proposals.filter((proposal) => isTerminalProposalStatus(proposal.status)),
  };
}

export function proposalCopyContainsForbidden(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_PROPOSAL_COPY.some((phrase) => lower.includes(phrase));
}

export const VOTE_FOR_LABEL = 'Vote for';
export const VOTE_AGAINST_LABEL = 'Vote against';

export type VoteAction = 'for' | 'against';
export type ProposalVoteErrorKind = 'already_voted' | 'not_allowed' | 'unknown';

export class ProposalVoteError extends Error {
  readonly kind: ProposalVoteErrorKind;

  constructor(kind: ProposalVoteErrorKind, message: string) {
    super(message);
    this.name = 'ProposalVoteError';
    this.kind = kind;
  }
}

export function voteChoiceFromAction(action: VoteAction): VoteChoice {
  return action === 'for' ? 'yes' : 'no';
}

export function mapVoteWriteError(code: string | undefined): ProposalVoteError {
  if (code === '23505') {
    return new ProposalVoteError('already_voted', 'You have already voted.');
  }
  if (code === '42501') {
    return new ProposalVoteError('not_allowed', 'You cannot vote on this proposal.');
  }
  return new ProposalVoteError('unknown', 'Unable to save your vote right now.');
}

export interface ProposalMemberInput {
  membershipId: string;
  displayName: string | null;
  initials: string;
}

export interface ProposalVoteInput {
  membershipId: string;
  choice: VoteChoice;
}

export function presentProposalEffectiveDate(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  const formatted = formatHomeInvestmentDayDate(iso);
  return formatted === 'Date unavailable' ? null : formatted;
}

export function presentProposalProposedBy(proposer: ProposalMemberInput | null): string {
  return `Proposed by ${proposalFirstName(proposer?.displayName)}`;
}

export function findProposalMember(
  members: readonly ProposalMemberInput[],
  membershipId: string,
): ProposalMemberInput | null {
  return members.find((member) => member.membershipId === membershipId) ?? null;
}

export function orderProposalElectorate(
  electorateMembershipIds: readonly string[],
  members: readonly ProposalMemberInput[],
): string[] {
  const electorate = new Set(electorateMembershipIds);
  const known = members
    .filter((member) => electorate.has(member.membershipId))
    .map((member) => member.membershipId);
  const knownSet = new Set(known);
  const unknown = electorateMembershipIds.filter((id) => !knownSet.has(id));
  return [...known, ...unknown];
}

export function resolveMemberVoteChoice(input: {
  membershipId: string;
  votes: readonly ProposalVoteInput[];
  votesVisible: boolean;
  viewerMembershipId: string;
  sessionChoice: VoteChoice | null | undefined;
}): VoteChoice | null {
  if (input.votesVisible) {
    return input.votes.find((vote) => vote.membershipId === input.membershipId)?.choice ?? null;
  }
  if (input.membershipId === input.viewerMembershipId) {
    return input.sessionChoice ?? null;
  }
  return null;
}

export function presentProposalListRow(input: {
  allocations: readonly ProposalAllocationInput[];
  proposer: ProposalMemberInput | null;
  status: StrategyProposalStatus;
  electorateSize: number;
  votesCast: number | null;
  votesVisible: boolean;
  intendedEffectiveAt: string | null;
}): {
  eyebrow: string;
  title: string;
  proposedBy: string;
  progress: string;
  statusLabel: string | null;
  effectiveLabel: string | null;
} {
  const title = presentProposalTitle(input.allocations);
  const statusLabel = presentProposalStatus(input.status);
  const effective = presentProposalEffectiveDate(input.intendedEffectiveAt);

  return {
    eyebrow: 'Strategy',
    title: title.title,
    proposedBy: presentProposalProposedBy(input.proposer),
    progress: presentVotingProgress({
      electorateSize: input.electorateSize,
      votesCast: input.votesCast,
      votesVisible: input.votesVisible,
    }),
    statusLabel,
    effectiveLabel:
      input.votesVisible && effective ? `Effective from ${effective}` : effective,
  };
}

export interface ProposalVoterPresentation {
  membershipId: string;
  firstName: string;
  initials: string;
  state: VoteStateLabel;
}

export interface ProposalDetailRow {
  label: string;
  value: string;
}

export function presentProposalDetail(input: {
  allocations: readonly ProposalAllocationInput[];
  proposer: ProposalMemberInput | null;
  status: StrategyProposalStatus;
  votingThresholdKind: GovernanceThresholdKind | null;
  electorateSize: number;
  electorateMembershipIds: readonly string[];
  votes: readonly ProposalVoteInput[];
  votesVisible: boolean;
  viewerMembershipId: string;
  sessionChoice: VoteChoice | null | undefined;
  alreadyVotedUnknownChoice: boolean;
  deadlineAt: string | null;
  intendedEffectiveAt: string | null;
  currentStrategyName: string | null;
  members: readonly ProposalMemberInput[];
}): {
  titleLead: string;
  titleEmphasis: string | null;
  title: string;
  description: string | null;
  proposedBy: string;
  statusLabel: string | null;
  votingRule: string | null;
  progress: string;
  currentStrategyName: string | null;
  proposedStrategyName: string | null;
  friendlyLines: string[];
  voters: ProposalVoterPresentation[];
  details: ProposalDetailRow[];
  canVote: boolean;
  voteForLabel: typeof VOTE_FOR_LABEL;
  voteAgainstLabel: typeof VOTE_AGAINST_LABEL;
  viewerVoteCopy: string | null;
} {
  const title = presentProposalTitle(input.allocations);
  const statusLabel = presentProposalStatus(input.status);
  const votingRule = presentVotingRule(input.votingThresholdKind);
  const effective = presentProposalEffectiveDate(input.intendedEffectiveAt);
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
    const member = findProposalMember(input.members, membershipId);
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

  const details: ProposalDetailRow[] = [];
  if (input.currentStrategyName) {
    details.push({ label: 'Current strategy', value: input.currentStrategyName });
  }
  if (title.packageName) {
    details.push({ label: 'Proposed strategy', value: title.packageName });
  }
  if (votingRule) {
    details.push({ label: 'Voting rule', value: votingRule });
  }
  if (statusLabel) {
    details.push({ label: 'Status', value: statusLabel });
  }
  if (effective) {
    details.push({ label: 'Effective', value: effective });
  }

  return {
    titleLead: title.titleLead,
    titleEmphasis: title.titleEmphasis,
    title: title.title,
    description: title.description,
    proposedBy: presentProposalProposedBy(input.proposer),
    statusLabel,
    votingRule,
    progress: presentVotingProgress({
      electorateSize: input.electorateSize,
      votesCast: input.votesVisible ? input.votes.length : null,
      votesVisible: input.votesVisible,
    }),
    currentStrategyName: input.currentStrategyName,
    proposedStrategyName: title.packageName,
    friendlyLines: title.friendlyLines,
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
