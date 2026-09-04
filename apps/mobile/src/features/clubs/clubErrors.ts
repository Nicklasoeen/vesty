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
  'vesty.invalid_target': 'Unable to create club right now',
  'vesty.invite_forbidden': "You don't have permission to invite members",
  'vesty.invite_invalid': 'Invite is invalid or expired',
  'vesty.invite_expired': 'Invite is invalid or expired',
  'vesty.invite_not_recipient': 'Invite is invalid or expired',
  'vesty.already_member': "You're already a member of this club",
};

function logClubIssue(context: string, error: { code?: string; message?: string } | unknown): void {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: string }).code;
    console.warn(`[clubs] ${context}`, code ?? 'unknown');
    return;
  }

  console.warn(`[clubs] ${context}`);
}

function extractErrorCode(error: { message?: string } | unknown): string | null {
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
  const code = extractErrorCode(error);
  if (code && PRODUCT_MESSAGES[code]) {
    return PRODUCT_MESSAGES[code];
  }
  return fallback;
}
