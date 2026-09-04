/**
 * Presentation initials for real memberships.
 * Avatar stays generic — this layer turns authorized identity into initials.
 * Never hashes, invents letters, or maps real users onto demo photos.
 */

function firstLetter(value: string): string | null {
  const match = value.match(/\p{L}/u);
  return match ? match[0].toUpperCase() : null;
}

function initialsFromDisplayName(displayName: string): string | null {
  const parts = displayName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  if (parts.length === 1) {
    return firstLetter(parts[0] ?? '');
  }

  const first = firstLetter(parts[0] ?? '');
  const last = firstLetter(parts[parts.length - 1] ?? '');
  if (first && last) {
    return `${first}${last}`;
  }

  return first ?? last;
}

function initialFromEmail(email: string): string | null {
  const localPart = email.split('@', 1)[0] ?? '';
  return firstLetter(localPart);
}

export function initialsFromIdentity(
  displayName: string | null | undefined,
  email: string | null | undefined,
): string {
  const name = displayName?.trim();
  if (name) {
    return initialsFromDisplayName(name) ?? '?';
  }

  const address = email?.trim();
  if (address) {
    return initialFromEmail(address) ?? '?';
  }

  return '?';
}
