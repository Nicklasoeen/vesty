import * as clubsApi from './api';
import type { ClubSummary, CreatedInvitationResult } from './types';

export { ClubsProvider, useClubs } from './ClubsProvider';

export async function createClub(input: {
  name: string;
  governanceThresholdKind: ClubSummary['governanceThresholdKind'];
}) {
  return clubsApi.createClub(input);
}

export async function joinClub(token: string) {
  return clubsApi.joinClub(token);
}

export async function attachClub(
  refresh: (preferredClubId?: string) => Promise<ClubSummary[]>,
  selectClub: (clubId: string) => Promise<void>,
  clubId: string,
): Promise<void> {
  await refresh(clubId);
  await selectClub(clubId);
}

export async function createInvitationForClub(clubId: string): Promise<CreatedInvitationResult> {
  return clubsApi.createClubInvitation(clubId);
}
