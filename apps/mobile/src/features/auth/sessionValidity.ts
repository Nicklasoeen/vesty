/**
 * Distinguishes invalid cached identity from retryable transport failures.
 * Never logs tokens or secrets.
 */

export function isRetryableAuthTransportError(
  error: { name?: string; message?: string; code?: string } | null | undefined,
): boolean {
  if (!error) {
    return false;
  }

  if (error.name === 'AuthRetryableFetchError') {
    return true;
  }

  const message = (error.message ?? '').toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror')
  );
}

export function isInvalidAuthIdentityError(
  error: { code?: string; status?: number; name?: string; message?: string } | null | undefined,
): boolean {
  if (!error || isRetryableAuthTransportError(error)) {
    return false;
  }

  const code = error.code ?? '';
  if (
    code === 'user_not_found' ||
    code === 'session_not_found' ||
    code === 'refresh_token_not_found' ||
    code === 'bad_jwt' ||
    code === 'invalid_jwt' ||
    code === 'session_expired'
  ) {
    return true;
  }

  return error.status === 401 || error.status === 403;
}

export function isInvalidProfileIdentityError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false;
  }

  const code = (error as { code?: string }).code;
  // profiles.id → auth.users(id). Happens when a cached JWT outlives the user row
  // (local db reset) even though PostgREST still accepts the JWT signature.
  return code === '23503';
}
