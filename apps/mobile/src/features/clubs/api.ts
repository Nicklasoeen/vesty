import { signAvatarUrls } from '@/features/profile/api';
import { supabase } from '@/lib/supabase/client';

import { mapClubError } from './clubErrors';
import { GENESIS_STRATEGY_SPEC, V1_BASE_CURRENCY, type GenesisAllocationInput } from './genesisStrategy';
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
} from './types';

interface TargetRow {
  id: string;
  name: string;
  status: string;
}

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
          target_name
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
  }[];

  return allocationsToSlices(allocations);
}

export async function resolveGenesisAllocations(): Promise<GenesisAllocationInput[]> {
  const names = GENESIS_STRATEGY_SPEC.map((item) => item.name);
  const result = await supabase.from('investment_targets').select('id, name, status').eq('status', 'active').in('name', names);

  if (result.error) {
    throw result.error;
  }

  const targets = (result.data ?? []) as TargetRow[];
  const byName = new Map(targets.map((target) => [target.name, target.id]));

  return GENESIS_STRATEGY_SPEC.map((item) => {
    const targetId = byName.get(item.name);
    if (!targetId) {
      throw new Error('Missing genesis target');
    }
    return {
      investment_target_id: targetId,
      allocation_bps: item.allocationBps,
      position: item.position,
    };
  });
}

export async function createClub(input: {
  name: string;
  governanceThresholdKind: GovernanceThresholdKind;
}): Promise<CreatedClubResult> {
  let allocations: GenesisAllocationInput[];
  try {
    allocations = await resolveGenesisAllocations();
  } catch (error) {
    throw new Error(mapClubError(error, 'Unable to create club right now', 'resolve genesis targets'));
  }

  const result = await supabase.rpc('create_club', {
    p_name: input.name,
    p_governance_threshold_kind: input.governanceThresholdKind,
    p_allocations: allocations,
    p_base_currency: V1_BASE_CURRENCY,
  });

  if (result.error) {
    throw new Error(mapClubError(result.error, 'Unable to create club right now', 'create_club'));
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
