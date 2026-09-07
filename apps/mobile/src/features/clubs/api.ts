import { signAvatarUrls } from '@/features/profile/api';
import { supabase } from '@/lib/supabase/client';

import { mapClubError } from './clubErrors';
import {
  isContributionPolicyMode,
  presentClubContributionPolicy,
  type ClubContributionPolicy,
  type ContributionPolicyMode,
  type MyContributionCommitment,
} from './contributionPolicy';
import {
  isContributionPolicyProposalStatus,
  isContributionProposalResolutionReason,
  presentContributionPolicyProposalChange,
  type ContributionPolicyProposal,
} from './contributionPolicyProposal';
import { isVisibleProposalStatus } from '../proposals/presentProposal';
import { isCuratedPackageId, type CuratedPackageId } from './curatedInvestmentPackages';
import { V1_BASE_CURRENCY } from './genesisStrategy';
import type { GovernanceThresholdKind } from './governance';
import { initialsFromIdentity } from './initials';
import {
  allocationsToSlices,
  firstRpcRow,
  isGovernanceThresholdKind,
  requireString,
  type AcceptedInvitationResult,
  type ClubMemberIdentity,
  type ClubSummary,
  type CreatedClubResult,
  type CreatedInvitationResult,
  type UpdatedClubNameResult,
} from './types';

interface MembershipClubRow {
  id: string;
  club_id: string;
  profile_id: string;
  status: string;
  clubs:
    | {
        id: string;
        name: string;
        base_currency: string;
        governance_threshold_kind: string;
        current_owner_membership_id: string;
        status: string;
      }
    | {
        id: string;
        name: string;
        base_currency: string;
        governance_threshold_kind: string;
        current_owner_membership_id: string;
        status: string;
      }[]
    | null;
}

interface RosterRow {
  id: string;
  club_id: string;
  profile_id: string;
  profiles:
    | { id: string; display_name: string | null; avatar_path: string | null }
    | { id: string; display_name: string | null; avatar_path: string | null }[]
    | null;
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export async function fetchActiveClubs(userId: string, userEmail: string | null): Promise<ClubSummary[]> {
  const membershipsResult = await supabase
    .from('club_memberships')
    .select(
      `
        id,
        club_id,
        profile_id,
        status,
        clubs!club_memberships_club_id_fkey (
          id,
          name,
          base_currency,
          governance_threshold_kind,
          current_owner_membership_id,
          status
        )
      `,
    )
    .eq('status', 'active')
    .eq('profile_id', userId);

  if (membershipsResult.error) {
    throw membershipsResult.error;
  }

  const memberships = (membershipsResult.data ?? []) as unknown as MembershipClubRow[];
  const clubIds = memberships.map((row) => row.club_id);

  if (clubIds.length === 0) {
    return [];
  }

  const rosterResult = await supabase
    .from('club_memberships')
    .select(
      `
        id,
        club_id,
        profile_id,
        profiles (
          id,
          display_name,
          avatar_path
        )
      `,
    )
    .eq('status', 'active')
    .in('club_id', clubIds);

  if (rosterResult.error) {
    throw rosterResult.error;
  }

  const roster = (rosterResult.data ?? []) as unknown as RosterRow[];
  const avatarPaths = roster
    .map((row) => unwrapRelation(row.profiles)?.avatar_path)
    .filter((path): path is string => Boolean(path));
  const signedAvatars = await signAvatarUrls(avatarPaths);
  const membersByClub = new Map<string, ClubMemberIdentity[]>();

  for (const row of roster) {
    const profile = unwrapRelation(row.profiles);
    const isCurrentUser = row.profile_id === userId;
    const displayName = profile?.display_name ?? null;
    const avatarPath = profile?.avatar_path ?? null;
    const signedUrl = avatarPath ? signedAvatars.get(avatarPath) : undefined;
    const member: ClubMemberIdentity = {
      id: row.profile_id,
      membershipId: row.id,
      displayName,
      imageSource: signedUrl ? { uri: signedUrl, cache: 'reload' } : undefined,
      // Other members' auth emails are not readable under current RLS.
      initials: initialsFromIdentity(displayName, isCurrentUser ? userEmail : null),
    };
    const existing = membersByClub.get(row.club_id) ?? [];
    existing.push(member);
    membersByClub.set(row.club_id, existing);
  }

  return memberships.flatMap((row) => {
    const club = unwrapRelation(row.clubs);
    if (!club || club.status !== 'active' || !isGovernanceThresholdKind(club.governance_threshold_kind)) {
      return [];
    }

    const members = [...(membersByClub.get(row.club_id) ?? [])].sort((left, right) => {
      if (left.membershipId === club.current_owner_membership_id) {
        return -1;
      }
      if (right.membershipId === club.current_owner_membership_id) {
        return 1;
      }
      return 0;
    });

    return [
      {
        clubId: club.id,
        membershipId: row.id,
        name: club.name,
        baseCurrency: club.base_currency,
        governanceThresholdKind: club.governance_threshold_kind,
        currentOwnerMembershipId: club.current_owner_membership_id,
        isOwner: row.id === club.current_owner_membership_id,
        members,
      },
    ];
  });
}

export async function fetchClubStrategySlices(clubId: string) {
  const result = await supabase
    .from('strategy_versions')
    .select(
      `
        id,
        version_number,
        strategy_allocations (
          id,
          allocation_bps,
          position,
          target_name,
          target_kind,
          target_ticker,
          investment_targets ( currency )
        )
      `,
    )
    .eq('club_id', clubId)
    .eq('version_number', 1)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  const allocations = (result.data?.strategy_allocations ?? []) as {
    id: string;
    allocation_bps: number;
    position: number;
    target_name: string;
    target_kind: string;
    target_ticker: string | null;
    investment_targets: { currency: string } | { currency: string }[] | null;
  }[];

  return allocationsToSlices(
    allocations.map((allocation) => ({
      id: allocation.id,
      allocation_bps: allocation.allocation_bps,
      position: allocation.position,
      target_name: allocation.target_name,
      target_kind: allocation.target_kind,
      target_ticker: allocation.target_ticker,
      instrument_currency: unwrapRelation(allocation.investment_targets)?.currency ?? null,
    })),
  );
}

function requireInteger(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  throw new Error(`Missing ${key}`);
}

function optionalInteger(row: Record<string, unknown>, key: string): number | null {
  if (row[key] == null) {
    return null;
  }

  try {
    return requireInteger(row, key);
  } catch {
    return null;
  }
}

export async function createClub(input: {
  name: string;
  governanceThresholdKind: GovernanceThresholdKind;
  packageId: CuratedPackageId;
  contributionMode: ContributionPolicyMode;
  equalAmountMinor?: number | null;
  creatorFlexibleAmountMinor?: number | null;
}): Promise<CreatedClubResult> {
  if (!isCuratedPackageId(input.packageId)) {
    throw new Error('Unable to create club right now');
  }

  const result = await supabase.rpc('create_club_v2', {
    p_name: input.name,
    p_governance_threshold_kind: input.governanceThresholdKind,
    p_package_id: input.packageId,
    p_contribution_mode: input.contributionMode,
    p_equal_amount_minor: input.equalAmountMinor ?? null,
    p_creator_flexible_amount_minor: input.creatorFlexibleAmountMinor ?? null,
    p_base_currency: V1_BASE_CURRENCY,
  });

  if (result.error) {
    throw new Error(mapClubError(result.error, 'Unable to create club right now', 'create_club_v2'));
  }

  const row = firstRpcRow(result.data);
  if (!row) {
    throw new Error('Unable to create club right now');
  }

  try {
    return {
      clubId: requireString(row, 'club_id'),
      membershipId: requireString(row, 'membership_id'),
      strategyVersionId: requireString(row, 'strategy_version_id'),
    };
  } catch {
    throw new Error('Unable to create club right now');
  }
}

export async function getClubContributionPolicy(clubId: string): Promise<ClubContributionPolicy> {
  const result = await supabase.rpc('club_contribution_policy_v1', { p_club_id: clubId });

  if (result.error) {
    throw new Error(mapClubError(result.error, 'Unable to load contribution settings', 'club_contribution_policy_v1'));
  }

  const row = firstRpcRow(result.data);
  if (!row) {
    throw new Error('Unable to load contribution settings');
  }

  try {
    const mode = row.mode;
    if (!isContributionPolicyMode(mode)) {
      throw new Error('Unable to load contribution settings');
    }

    const equalAmount = row.equal_amount_minor;
    return presentClubContributionPolicy({
      clubId: requireString(row, 'club_id'),
      policyVersionId: requireString(row, 'policy_version_id'),
      mode,
      currency: requireString(row, 'currency'),
      equalAmountMinor:
        equalAmount == null ? null : requireInteger({ equal_amount_minor: equalAmount }, 'equal_amount_minor'),
    });
  } catch {
    throw new Error('Unable to load contribution settings');
  }
}

export async function fetchClubContributionPolicyProposals(
  clubId: string,
): Promise<ContributionPolicyProposal[]> {
  const result = await supabase.rpc('club_contribution_policy_proposals_v1', {
    p_club_id: clubId,
  });

  if (result.error) {
    throw new Error(
      mapClubError(result.error, 'Unable to load contribution proposals', 'club_contribution_policy_proposals_v1'),
    );
  }

  const rows = (result.data ?? []) as Record<string, unknown>[];
  return rows.flatMap((row) => {
    const status = row.status;
    const baseMode = row.base_mode;
    const proposedMode = row.proposed_mode;
    if (!isContributionPolicyProposalStatus(status)) {
      return [];
    }
    if (!isContributionPolicyMode(baseMode) || !isContributionPolicyMode(proposedMode)) {
      return [];
    }
    if (!isVisibleProposalStatus(status)) {
      return [];
    }

    const change = presentContributionPolicyProposalChange({
      baseMode,
      baseEqualAmountMinor:
        row.base_equal_amount_minor == null
          ? null
          : requireInteger({ base_equal_amount_minor: row.base_equal_amount_minor }, 'base_equal_amount_minor'),
      proposedMode,
      proposedEqualAmountMinor:
        row.proposed_equal_amount_minor == null
          ? null
          : requireInteger(
              { proposed_equal_amount_minor: row.proposed_equal_amount_minor },
              'proposed_equal_amount_minor',
            ),
    });

    return [{
      id: requireString(row, 'proposal_id'),
      clubId: requireString(row, 'club_id'),
      proposerMembershipId: requireString(row, 'proposer_membership_id'),
      status,
      resolutionReason: isContributionProposalResolutionReason(row.resolution_reason)
        ? row.resolution_reason
        : null,
      deadlineAt: typeof row.deadline_at === 'string' ? row.deadline_at : null,
      openedAt: typeof row.opened_at === 'string' ? row.opened_at : null,
      closedAt: typeof row.closed_at === 'string' ? row.closed_at : null,
      approvedAt: typeof row.approved_at === 'string' ? row.approved_at : null,
      createdAt: typeof row.created_at === 'string' ? row.created_at : null,
      intendedEffectiveAt: typeof row.intended_effective_at === 'string' ? row.intended_effective_at : null,
      electorateSize: optionalInteger(row, 'electorate_size'),
      requiredYesCount: optionalInteger(row, 'required_yes_count'),
      votingThresholdKind: isGovernanceThresholdKind(row.voting_threshold_kind)
        ? row.voting_threshold_kind
        : null,
      basePolicyVersionId: requireString(row, 'base_contribution_policy_version_id'),
      baseMode: change.fromStyle,
      baseEqualAmountMinor: change.fromEqualAmountMinor,
      proposedMode: change.toStyle,
      proposedEqualAmountMinor: change.toEqualAmountMinor,
    }];
  });
}

export async function createContributionPolicyProposal(input: {
  clubId: string;
  basePolicyVersionId: string;
  proposedMode: ContributionPolicyMode;
  proposedEqualAmountMinor: number | null;
}): Promise<{ proposalId: string }> {
  const result = await supabase.rpc('create_contribution_policy_proposal_v1', {
    p_club_id: input.clubId,
    p_base_contribution_policy_version_id: input.basePolicyVersionId,
    p_proposed_mode: input.proposedMode,
    p_proposed_equal_amount_minor: input.proposedEqualAmountMinor,
  });

  if (result.error) {
    throw new Error(
      mapClubError(result.error, 'Unable to create this proposal', 'create_contribution_policy_proposal_v1'),
    );
  }

  const row = firstRpcRow(result.data);
  if (!row) {
    throw new Error('Unable to create this proposal');
  }

  return { proposalId: requireString(row, 'proposal_id') };
}

export async function openContributionPolicyProposal(proposalId: string): Promise<{ proposalId: string }> {
  const result = await supabase.rpc('open_contribution_policy_proposal_v1', {
    p_proposal_id: proposalId,
  });

  if (result.error) {
    throw new Error(
      mapClubError(result.error, 'Unable to open this proposal', 'open_contribution_policy_proposal_v1'),
    );
  }

  const row = firstRpcRow(result.data);
  if (!row) {
    throw new Error('Unable to open this proposal');
  }

  return { proposalId: requireString(row, 'proposal_id') };
}

export async function finalizeContributionPolicyProposal(proposalId: string): Promise<{
  proposalId: string;
  status: string;
  policyVersionId: string | null;
}> {
  const result = await supabase.rpc('finalize_contribution_policy_proposal_v1', {
    p_proposal_id: proposalId,
  });

  if (result.error) {
    throw new Error(
      mapClubError(result.error, 'Unable to update this proposal', 'finalize_contribution_policy_proposal_v1'),
    );
  }

  const row = firstRpcRow(result.data);
  if (!row) {
    throw new Error('Unable to update this proposal');
  }

  return {
    proposalId: requireString(row, 'proposal_id'),
    status: requireString(row, 'status'),
    policyVersionId: typeof row.policy_version_id === 'string' ? row.policy_version_id : null,
  };
}

export async function getMyContributionCommitment(clubId: string): Promise<MyContributionCommitment | null> {
  const result = await supabase.rpc('my_contribution_commitment_v1', { p_club_id: clubId });

  if (result.error) {
    throw new Error(mapClubError(result.error, 'Unable to load your contribution', 'my_contribution_commitment_v1'));
  }

  const row = firstRpcRow(result.data);
  if (!row) {
    return null;
  }

  try {
    return {
      clubId: requireString(row, 'club_id'),
      membershipId: requireString(row, 'membership_id'),
      commitmentVersionId: requireString(row, 'commitment_version_id'),
      versionNumber: requireInteger(row, 'version_number'),
      amountMinor: requireInteger(row, 'amount_minor'),
      currency: requireString(row, 'currency'),
      createdAt: requireString(row, 'created_at'),
    };
  } catch {
    throw new Error('Unable to load your contribution');
  }
}

export async function setMyFlexibleContribution(
  clubId: string,
  amountMinor: number,
): Promise<MyContributionCommitment> {
  const result = await supabase.rpc('create_member_contribution_commitment_v1', {
    p_club_id: clubId,
    p_amount_minor: amountMinor,
  });

  if (result.error) {
    throw new Error(
      mapClubError(result.error, 'Unable to save your contribution', 'create_member_contribution_commitment_v1'),
    );
  }

  const row = firstRpcRow(result.data);
  if (!row) {
    throw new Error('Unable to save your contribution');
  }

  const saved = await getMyContributionCommitment(clubId);
  if (!saved) {
    throw new Error('Unable to save your contribution');
  }

  return saved;
}

export async function joinClub(token: string): Promise<AcceptedInvitationResult> {
  const result = await supabase.rpc('accept_club_invitation', { p_token: token });

  if (result.error) {
    throw new Error(mapClubError(result.error, 'Invite is invalid or expired', 'accept_club_invitation'));
  }

  const row = firstRpcRow(result.data);
  if (!row) {
    throw new Error('Invite is invalid or expired');
  }

  try {
    return {
      clubId: requireString(row, 'club_id'),
      membershipId: requireString(row, 'membership_id'),
    };
  } catch {
    throw new Error('Invite is invalid or expired');
  }
}

export async function updateClubName(clubId: string, name: string): Promise<UpdatedClubNameResult> {
  const result = await supabase.rpc('update_club_name', {
    p_club_id: clubId,
    p_name: name,
  });

  if (result.error) {
    throw new Error(mapClubError(result.error, "You don't have permission to rename this club", 'update_club_name'));
  }

  const row = firstRpcRow(result.data);
  if (!row) {
    throw new Error("You don't have permission to rename this club");
  }

  try {
    return {
      clubId: requireString(row, 'club_id'),
      name: requireString(row, 'name'),
    };
  } catch {
    throw new Error("You don't have permission to rename this club");
  }
}

export async function createClubInvitation(clubId: string): Promise<CreatedInvitationResult> {
  const result = await supabase.rpc('create_club_invitation', { p_club_id: clubId });

  if (result.error) {
    throw new Error(mapClubError(result.error, "You don't have permission to invite members", 'create_club_invitation'));
  }

  const row = firstRpcRow(result.data);
  if (!row) {
    throw new Error("You don't have permission to invite members");
  }

  try {
    return {
      invitationId: requireString(row, 'invitation_id'),
      inviteToken: requireString(row, 'invite_token'),
      expiresAt: requireString(row, 'expires_at'),
      clubName: requireString(row, 'club_name'),
    };
  } catch {
    throw new Error("You don't have permission to invite members");
  }
}
