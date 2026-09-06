/**
 * Maps trusted club RPC / query failures to product copy.
 * Does not surface Postgres internals.
 */

const PRODUCT_MESSAGES: Record<string, string> = {
  'vesty.unauthenticated': 'Sign in to continue',
  'vesty.profile_required': 'Unable to create club right now',
  'vesty.club_name_invalid': 'Enter a club name',
  'vesty.base_currency_unsupported': 'Unable to create club right now',
  'vesty.invalid_allocations': 'Unable to create club right now',
  'vesty.invalid_allocation_sum': 'Unable to create club right now',
  'vesty.invalid_package': 'Unable to create club right now',
  'vesty.invalid_target': 'Unable to create club right now',
  'vesty.invite_forbidden': "You don't have permission to invite members",
  'vesty.club_rename_forbidden': "You don't have permission to rename this club",
  'vesty.invite_invalid': 'Invite is invalid or expired',
  'vesty.invite_expired': 'Invite is invalid or expired',
  'vesty.invite_not_recipient': 'Invite is invalid or expired',
  'vesty.already_member': "You're already a member of this club",
  'vesty.contribution_policy_invalid': 'Enter a contribution amount',
  'vesty.contribution_commitment_invalid': 'Enter how much you want to contribute',
  'vesty.contribution_commitment_required': 'Set your contribution to continue',
  'vesty.contribution_commitment_not_applicable': 'This club uses the same amount for everyone',
  'vesty.contribution_policy_missing': 'Unable to load contribution settings',
  'vesty.not_club_member': "You don't have permission to view this club",
};

function logClubIssue(context: string, error: { code?: string; message?: string } | unknown): void {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: string }).code;
    console.warn(`[clubs] ${context}`, code ?? 'unknown');
    return;
  }

  console.warn(`[clubs] ${context}`);
}

export function extractClubErrorCode(error: { message?: string } | unknown): string | null {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return null;
  }

  const message = typeof error.message === 'string' ? error.message : '';
  const match = /vesty\.[a-z_]+/.exec(message);
  return match?.[0] ?? null;
}

export function mapClubError(
  error: { message?: string; code?: string } | unknown,
  fallback: string,
  context: string,
): string {
  logClubIssue(context, error);
  const code = extractClubErrorCode(error);
  if (code && PRODUCT_MESSAGES[code]) {
    return PRODUCT_MESSAGES[code];
  }
  return fallback;
}
