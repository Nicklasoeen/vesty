import * as clubsApi from './api';
import type { ClubSummary, CreatedInvitationResult } from './types';

export { ClubsProvider, useClubs } from './ClubsProvider';

export async function createClubAndRefresh(
  refresh: (preferredClubId?: string) => Promise<ClubSummary[]>,
  selectClub: (clubId: string) => Promise<void>,
  input: { name: string; governanceThresholdKind: ClubSummary['governanceThresholdKind'] },
): Promise<string> {
  const created = await clubsApi.createClub(input);
  await refresh(created.clubId);
  await selectClub(created.clubId);
  return created.clubId;
}

export async function joinClubAndRefresh(
  refresh: (preferredClubId?: string) => Promise<ClubSummary[]>,
  selectClub: (clubId: string) => Promise<void>,
  token: string,
): Promise<string> {
  const joined = await clubsApi.joinClub(token);
  await refresh(joined.clubId);
  await selectClub(joined.clubId);
  return joined.clubId;
}

export async function createInvitationForClub(clubId: string): Promise<CreatedInvitationResult> {
  return clubsApi.createClubInvitation(clubId);
}
