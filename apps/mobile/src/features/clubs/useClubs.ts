import * as clubsApi from './api';
import type { ContributionPolicyMode } from './contributionPolicy';
import type { CuratedPackageId } from './curatedInvestmentPackages';
import type { ClubSummary, CreatedInvitationResult, UpdatedClubNameResult } from './types';

export { ClubsProvider, useClubs } from './ClubsProvider';

export async function createClub(input: {
  name: string;
  governanceThresholdKind: ClubSummary['governanceThresholdKind'];
  packageId: CuratedPackageId;
  contributionMode: ContributionPolicyMode;
  equalAmountMinor?: number | null;
  creatorFlexibleAmountMinor?: number | null;
}) {
  return clubsApi.createClub(input);
}

export async function createSingleFundClub(input: Parameters<typeof clubsApi.createSingleFundClub>[0]) {
  return clubsApi.createSingleFundClub(input);
}

export async function fetchSingleFundCatalog() {
  return clubsApi.fetchSingleFundCatalog();
}

export async function joinClub(token: string) {
  return clubsApi.joinClub(token);
}

export async function getClubContributionPolicy(clubId: string) {
  return clubsApi.getClubContributionPolicy(clubId);
}

export async function getMyContributionCommitment(clubId: string) {
  return clubsApi.getMyContributionCommitment(clubId);
}

export async function setMyFlexibleContribution(clubId: string, amountMinor: number) {
  return clubsApi.setMyFlexibleContribution(clubId, amountMinor);
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

export async function renameClub(
  refresh: (preferredClubId?: string) => Promise<ClubSummary[]>,
  clubId: string,
  name: string,
): Promise<UpdatedClubNameResult> {
  const updated = await clubsApi.updateClubName(clubId, name);
  await refresh(clubId);
  return updated;
}
