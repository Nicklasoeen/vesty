import {
  clearCreateClubDraft,
  removeLegacyCreateClubDraft,
  type CreateClubDraftStore,
} from '../clubs/createClubDraftStorage.ts';

/**
 * Auth-owned cleanup boundary. Clears only the signed-out profile's
 * Create Club draft and the legacy device-global key. Does not import
 * ClubsProvider or club APIs.
 */
export async function clearSignedOutUserStorage(
  store: CreateClubDraftStore,
  profileId: string | null,
): Promise<void> {
  await removeLegacyCreateClubDraft(store);
  if (profileId) {
    await clearCreateClubDraft(store, profileId);
  }
}
