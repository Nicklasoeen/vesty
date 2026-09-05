const PRODUCT_MESSAGES: Record<string, string> = {
  'vesty.unauthenticated': 'Sign in to continue',
  'vesty.profile_required': 'Unable to record investments right now',
  'vesty.not_club_member': 'Unable to load this Investment Day',
  'vesty.cycle_invalid': 'Unable to confirm investments right now',
  'vesty.cycle_not_open': 'This Investment Day is no longer open',
  'vesty.strategy_missing': 'Unable to confirm investments right now',
  'vesty.amount_invalid': 'Unable to confirm investments right now',
  'vesty.invalid_target': 'Unable to confirm investments right now',
  'vesty.invalid_allocations': 'Unable to confirm investments right now',
};

function logInvestIssue(context: string, error: { code?: string } | unknown): void {
  if (error && typeof error === 'object' && 'code' in error) {
    console.warn(`[invest] ${context}`, (error as { code?: string }).code ?? 'unknown');
    return;
  }

  console.warn(`[invest] ${context}`);
}

function extractErrorCode(error: { message?: string } | unknown): string | null {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return null;
  }

  const message = typeof error.message === 'string' ? error.message : '';
  const match = /vesty\.[a-z_]+/.exec(message);
  return match?.[0] ?? null;
}

export function mapInvestError(
  error: { message?: string; code?: string } | unknown,
  fallback: string,
  context: string,
): string {
  logInvestIssue(context, error);
  const code = extractErrorCode(error);
  if (code && PRODUCT_MESSAGES[code]) {
    return PRODUCT_MESSAGES[code];
  }
  return fallback;
}
