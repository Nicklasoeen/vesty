import {
  fetchClubContributionPolicyProposals,
  finalizeContributionPolicyProposal,
} from '@/features/clubs/api';
import type { GovernanceThresholdKind } from '@/features/clubs/governance';
import { isGovernanceThresholdKind } from '@/features/clubs/types';
import { supabase } from '@/lib/supabase/client';

import { mergeClubProposalFeed } from './presentContributionProposal';
import {
  isTerminalProposalStatus,
  isVisibleProposalStatus,
  mapVoteWriteError,
  type StrategyProposalStatus,
  type VoteChoice,
} from './presentProposal';
import type { ClubProposalRecord, ProposalAllocationRecord, ProposalVoteRecord } from './types';

interface ProposalRow {
  id: string;
  club_id: string;
  proposer_membership_id: string;
  status: string;
  reason: string | null;
  voting_threshold_kind: string | null;
  electorate_size: number | null;
  required_yes_count: number | null;
  intended_effective_at: string | null;
  deadline_at: string | null;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string | null;
}

interface AllocationRow {
  proposal_id: string;
  allocation_bps: number;
  position: number;
  target_name: string;
  target_ticker: string | null;
}

interface ElectorateRow {
  proposal_id: string;
  membership_id: string;
}

interface VoteRow {
  proposal_id: string;
  membership_id: string;
  choice: string;
}

interface ContributionMetaRow {
  id: string;
  created_at: string | null;
  intended_effective_at: string | null;
}

function isProposalStatus(value: string): value is StrategyProposalStatus {
  return (
    value === 'draft'
    || value === 'open'
    || value === 'approved'
    || value === 'rejected'
    || value === 'expired'
    || value === 'cancelled'
  );
}

function isVoteChoice(value: string): value is VoteChoice {
  return value === 'yes' || value === 'no';
}

async function fetchProposalGovernance(ids: readonly string[]): Promise<{
  electorateByProposal: Map<string, string[]>;
  votesByProposal: Map<string, ProposalVoteRecord[]>;
}> {
  const electorateByProposal = new Map<string, string[]>();
  const votesByProposal = new Map<string, ProposalVoteRecord[]>();

  if (ids.length === 0) {
    return { electorateByProposal, votesByProposal };
  }

  const [electorateResult, votesResult] = await Promise.all([
    supabase
      .from('proposal_electorate_members')
      .select('proposal_id, membership_id')
      .in('proposal_id', [...ids]),
    supabase.from('votes').select('proposal_id, membership_id, choice').in('proposal_id', [...ids]),
  ]);

  if (electorateResult.error) {
    throw electorateResult.error;
  }
  if (votesResult.error) {
    throw votesResult.error;
  }

  for (const row of (electorateResult.data ?? []) as ElectorateRow[]) {
    const list = electorateByProposal.get(row.proposal_id) ?? [];
    list.push(row.membership_id);
    electorateByProposal.set(row.proposal_id, list);
  }

  for (const row of (votesResult.data ?? []) as VoteRow[]) {
    if (!isVoteChoice(row.choice)) {
      continue;
    }
    const list = votesByProposal.get(row.proposal_id) ?? [];
    list.push({ membershipId: row.membership_id, choice: row.choice });
    votesByProposal.set(row.proposal_id, list);
  }

  return { electorateByProposal, votesByProposal };
}

async function fetchStrategyProposals(clubId: string): Promise<ClubProposalRecord[]> {
  const proposalsResult = await supabase
    .from('strategy_proposals')
    .select(
      'id, club_id, proposer_membership_id, status, reason, voting_threshold_kind, electorate_size, required_yes_count, intended_effective_at, deadline_at, opened_at, closed_at, created_at',
    )
    .eq('club_id', clubId)
    .order('created_at', { ascending: false });

  if (proposalsResult.error) {
    throw proposalsResult.error;
  }

  const rows = (proposalsResult.data ?? []) as ProposalRow[];
  const visible = rows.filter((row) => isProposalStatus(row.status) && isVisibleProposalStatus(row.status));
  const ids = visible.map((row) => row.id);

  if (ids.length === 0) {
    return [];
  }

  const [allocationsResult, governance] = await Promise.all([
    supabase
      .from('strategy_proposal_allocations')
      .select('proposal_id, allocation_bps, position, target_name, target_ticker')
      .in('proposal_id', ids),
    fetchProposalGovernance(ids),
  ]);

  if (allocationsResult.error) {
    throw allocationsResult.error;
  }

  const allocationsByProposal = new Map<string, ProposalAllocationRecord[]>();
  for (const row of (allocationsResult.data ?? []) as AllocationRow[]) {
    const list = allocationsByProposal.get(row.proposal_id) ?? [];
    list.push({
      targetName: row.target_name,
      ticker: row.target_ticker,
      allocationBps: row.allocation_bps,
      position: row.position,
    });
    allocationsByProposal.set(row.proposal_id, list);
  }

  return visible.map((row) => {
    const status = row.status as StrategyProposalStatus;
    const threshold: GovernanceThresholdKind | null = isGovernanceThresholdKind(row.voting_threshold_kind)
      ? row.voting_threshold_kind
      : null;
    const allocations = [...(allocationsByProposal.get(row.id) ?? [])].sort(
      (left, right) => left.position - right.position,
    );
    const votes = isTerminalProposalStatus(status) ? (governance.votesByProposal.get(row.id) ?? []) : [];

    return {
      id: row.id,
      kind: 'strategy' as const,
      clubId: row.club_id,
      proposerMembershipId: row.proposer_membership_id,
      status,
      resolutionReason: null,
      reason: row.reason,
      votingThresholdKind: threshold,
      electorateSize: row.electorate_size ?? governance.electorateByProposal.get(row.id)?.length ?? 0,
      requiredYesCount: row.required_yes_count,
      intendedEffectiveAt: row.intended_effective_at,
      deadlineAt: row.deadline_at,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      createdAt: row.created_at,
      allocations,
      contribution: null,
      electorateMembershipIds: governance.electorateByProposal.get(row.id) ?? [],
      votes,
      votesVisible: isTerminalProposalStatus(status),
    };
  });
}

async function fetchContributionProposals(clubId: string): Promise<ClubProposalRecord[]> {
  const proposals = await fetchClubContributionPolicyProposals(clubId);
  const ids = proposals.map((proposal) => proposal.id);
  const [governance, metaResult] = await Promise.all([
    fetchProposalGovernance(ids),
    ids.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from('contribution_policy_proposals')
          .select('id, created_at, intended_effective_at')
          .in('id', ids),
  ]);

  if (metaResult.error) {
    throw metaResult.error;
  }

  const metaById = new Map<string, ContributionMetaRow>();
  for (const row of (metaResult.data ?? []) as ContributionMetaRow[]) {
    metaById.set(row.id, row);
  }

  return proposals.map((proposal) => {
    const votes = isTerminalProposalStatus(proposal.status)
      ? (governance.votesByProposal.get(proposal.id) ?? [])
      : [];
    const votesVisible = isTerminalProposalStatus(proposal.status);
    const meta = metaById.get(proposal.id);
    const requiredYesCount = proposal.requiredYesCount;

    return {
      id: proposal.id,
      kind: 'contribution' as const,
      clubId: proposal.clubId,
      proposerMembershipId: proposal.proposerMembershipId,
      status: proposal.status,
      resolutionReason: proposal.resolutionReason,
      reason: null,
      votingThresholdKind: proposal.votingThresholdKind,
      electorateSize: proposal.electorateSize ?? governance.electorateByProposal.get(proposal.id)?.length ?? 0,
      requiredYesCount,
      intendedEffectiveAt: meta?.intended_effective_at ?? proposal.intendedEffectiveAt,
      deadlineAt: proposal.deadlineAt,
      openedAt: proposal.openedAt,
      closedAt: proposal.closedAt,
      createdAt: meta?.created_at ?? proposal.createdAt,
      allocations: [],
      contribution: {
        basePolicyVersionId: proposal.basePolicyVersionId,
        baseMode: proposal.baseMode,
        baseEqualAmountMinor: proposal.baseEqualAmountMinor,
        proposedMode: proposal.proposedMode,
        proposedEqualAmountMinor: proposal.proposedEqualAmountMinor,
      },
      electorateMembershipIds: governance.electorateByProposal.get(proposal.id) ?? [],
      votes,
      votesVisible,
    };
  });
}

/**
 * Club-scoped proposal read. Relies on RLS:
 * - members can read proposals and allocations
 * - votes on open proposals are hidden until the proposal is terminal
 */
export async function fetchClubProposals(clubId: string): Promise<ClubProposalRecord[]> {
  const [strategy, contribution] = await Promise.all([
    fetchStrategyProposals(clubId),
    fetchContributionProposals(clubId),
  ]);

  return mergeClubProposalFeed([...strategy, ...contribution]);
}

export async function castProposalVote(input: {
  proposalId: string;
  membershipId: string;
  choice: VoteChoice;
}): Promise<void> {
  const result = await supabase.from('votes').insert({
    proposal_id: input.proposalId,
    membership_id: input.membershipId,
    choice: input.choice,
  });

  if (result.error) {
    throw mapVoteWriteError(result.error.code);
  }
}

export { finalizeContributionPolicyProposal };
