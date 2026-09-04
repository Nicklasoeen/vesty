export function formatInviteToken(token: string): string {
  const normalized = token.replace(/[^0-9a-f]/gi, '').toLowerCase();
  const groups: string[] = [];
  for (let index = 0; index < normalized.length; index += 4) {
    groups.push(normalized.slice(index, index + 4));
  }
  return groups.join('-').toUpperCase();
}

export function normalizeInviteTokenInput(token: string): string {
  return token.replace(/[^0-9a-f]/gi, '').toLowerCase();
}
