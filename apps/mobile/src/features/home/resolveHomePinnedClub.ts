export interface HomePinnedClubInput {
  clubId: string;
}

/**
 * Presentation-only Home featured club.
 *
 * Backend pinning does not exist yet. `pinnedClubId` is the future Club-screen
 * pin. Until then Home falls back to the current selected/default club, and
 * a single club is always featured.
 */
export function resolveHomePinnedClub<T extends HomePinnedClubInput>(input: {
  clubs: readonly T[];
  selectedClubId: string | null;
  pinnedClubId?: string | null;
}): T | null {
  const { clubs, selectedClubId, pinnedClubId = null } = input;
  if (clubs.length === 0) {
    return null;
  }
  if (clubs.length === 1) {
    return clubs[0] ?? null;
  }
  if (pinnedClubId) {
    const pinned = clubs.find((club) => club.clubId === pinnedClubId);
    if (pinned) {
      return pinned;
    }
  }
  if (selectedClubId) {
    const selected = clubs.find((club) => club.clubId === selectedClubId);
    if (selected) {
      return selected;
    }
  }
  return clubs[0] ?? null;
}

export function nextLockedHomePinnedClubId<T extends HomePinnedClubInput>(input: {
  clubs: readonly T[];
  selectedClubId: string | null;
  lockedClubId: string | null;
}): string | null {
  if (input.clubs.length === 0) {
    return null;
  }
  if (input.clubs.length === 1) {
    return input.clubs[0]?.clubId ?? null;
  }
  if (input.lockedClubId && input.clubs.some((club) => club.clubId === input.lockedClubId)) {
    return input.lockedClubId;
  }
  return resolveHomePinnedClub({
    clubs: input.clubs,
    selectedClubId: input.selectedClubId,
    pinnedClubId: null,
  })?.clubId ?? null;
}

export function filterYourClubs<T extends HomePinnedClubInput>(
  clubs: readonly T[],
  pinnedClubId: string | null,
): T[] {
  if (!pinnedClubId) {
    return [...clubs];
  }
  return clubs.filter((club) => club.clubId !== pinnedClubId);
}

export const HOME_CLUB_CARD_TINT_COUNT = 3;

export function clubCardTintIndex(clubId: string, tintCount: number = HOME_CLUB_CARD_TINT_COUNT): number {
  if (tintCount <= 0) {
    return 0;
  }
  let hash = 0;
  for (let index = 0; index < clubId.length; index += 1) {
    hash = (hash + clubId.charCodeAt(index) * (index + 1)) % 997;
  }
  return hash % tintCount;
}
