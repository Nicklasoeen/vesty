import { initialsFromIdentity } from '@/features/clubs/initials';
import { firstRpcRow } from '@/features/clubs/types';
import { signAvatarUrls } from '@/features/profile/api';
import { supabase } from '@/lib/supabase/client';

export interface InvestmentDayParticipationMember {
  membershipId: string;
  profileId: string;
  displayName: string | null;
  initials: string;
  imageSource?: { uri: string; cache: 'reload' };
  completed: boolean;
  completedAt: string | null;
  verificationLevel: 'member_reported' | null;
  currentStreak: number;
}

export interface InvestmentDayParticipation {
  cycleId: string;
  completedCount: number;
  totalCount: number;
  pendingCount: number;
  allCompleted: boolean;
  members: InvestmentDayParticipationMember[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  return null;
}

export async function fetchInvestmentDayParticipation(
  clubId: string,
  cycleId: string,
): Promise<InvestmentDayParticipation> {
  const result = await supabase.rpc('club_investment_day_participation_v1', {
    p_club_id: clubId,
    p_cycle_id: cycleId,
  });

  if (result.error) {
    throw new Error('Unable to load Investment Day progress');
  }

  const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
  const summary = firstRpcRow(result.data);
  const avatarPaths = rows.flatMap((item) => {
    const row = asRecord(item);
    const path = typeof row?.avatar_path === 'string' ? row.avatar_path : null;
    return path ? [path] : [];
  });
  const signedAvatars = await signAvatarUrls(avatarPaths);

  const members = rows.flatMap((item) => {
    const row = asRecord(item);
    const membershipId = typeof row?.membership_id === 'string' ? row.membership_id : null;
    const profileId = typeof row?.profile_id === 'string' ? row.profile_id : null;
    const completed = asBoolean(row?.completed);
    const currentStreak = asInteger(row?.current_streak);
    if (!membershipId || !profileId || completed == null || currentStreak == null) {
      return [];
    }

    const displayName = typeof row?.display_name === 'string' ? row.display_name : null;
    const avatarPath = typeof row?.avatar_path === 'string' ? row.avatar_path : null;
    const signedUrl = avatarPath ? signedAvatars.get(avatarPath) : undefined;
    const verificationLevel: 'member_reported' | null =
      row?.verification_level === 'member_reported' ? 'member_reported' : null;

    return [
      {
        membershipId,
        profileId,
        displayName,
        initials: initialsFromIdentity(displayName, null),
        imageSource: signedUrl ? { uri: signedUrl, cache: 'reload' as const } : undefined,
        completed,
        completedAt: typeof row?.completed_at === 'string' ? row.completed_at : null,
        verificationLevel,
        currentStreak,
      },
    ];
  });

  const completedCount = asInteger(summary?.completed_count) ?? members.filter((member) => member.completed).length;
  const totalCount = asInteger(summary?.member_count) ?? members.length;

  return {
    cycleId: typeof summary?.cycle_id === 'string' ? summary.cycle_id : cycleId,
    completedCount,
    totalCount,
    pendingCount: asInteger(summary?.pending_count) ?? Math.max(0, totalCount - completedCount),
    allCompleted: asBoolean(summary?.all_completed) ?? (totalCount > 0 && completedCount === totalCount),
    members,
  };
}
