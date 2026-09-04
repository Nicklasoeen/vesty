import type { AuthError } from '@supabase/supabase-js';

type AuthIntent = 'sign-in' | 'sign-up';

/**
 * Maps Auth API failures to short product copy.
 * Never pass the raw error object through to the UI.
 */
export function mapAuthError(error: AuthError, intent: AuthIntent): string {
  const code = error.code ?? '';
  const message = error.message.toLowerCase();

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'Invalid email or password';
  }

  if (
    code === 'email_exists' ||
    code === 'user_already_exists' ||
    message.includes('already registered') ||
    message.includes('user already exists')
  ) {
    return 'Account already exists';
  }

  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Check your email to confirm your account.';
  }

  if (code === 'weak_password' || message.includes('password should be at least')) {
    return 'Password is too short';
  }

  if (code === 'over_request_rate_limit' || message.includes('rate limit')) {
    return 'Too many attempts. Try again in a moment.';
  }

  if (intent === 'sign-in') {
    return 'Unable to sign in right now';
  }

  return 'Unable to create account right now';
}
