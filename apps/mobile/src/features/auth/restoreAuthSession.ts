export interface AuthBootGateInput {
  isInitializing: boolean;
  profileError: string | null;
  hasSession: boolean;
  profileLoading: boolean;
  profileLoadError: string | null;
  hasProfile: boolean;
}

export interface AuthBootGate {
  blocking: boolean;
  identityBlocked: boolean;
  error: string | null;
  appearance: 'pass' | 'spinner' | 'error';
}

/**
 * Root overlay until auth/profile startup settles.
 * Spinner only while work is in flight. Failures must surface as error + retry.
 */
export function presentAuthBootGate(input: AuthBootGateInput): AuthBootGate {
  const identityBlocked =
    input.hasSession && !input.profileLoading && Boolean(input.profileLoadError) && !input.hasProfile;
  const error = input.profileError ?? (identityBlocked ? input.profileLoadError : null);
  const blocking =
    input.isInitializing || Boolean(input.profileError) || (input.hasSession && input.profileLoading) || identityBlocked;

  return {
    blocking,
    identityBlocked,
    error,
    appearance: !blocking ? 'pass' : error ? 'error' : 'spinner',
  };
}

export type RestoreAuthSessionResult = { status: 'ready' } | { status: 'failed'; message: string };

/**
 * Session restore must always settle. A rejected getSession used to leave
 * isInitializing true forever because the original .then() had no catch.
 */
export async function restoreAuthSession(input: {
  getSession: () => Promise<{ data: { session: unknown }; error: unknown }>;
  applySession: (session: unknown) => Promise<unknown>;
  onIssue?: (context: string, error: unknown) => void;
}): Promise<RestoreAuthSessionResult> {
  try {
    const { data, error } = await input.getSession();
    if (error) {
      input.onIssue?.('getSession failed', error);
    }
    await input.applySession(data.session);
    return { status: 'ready' };
  } catch (error) {
    input.onIssue?.('session restore failed', error);
    return { status: 'failed', message: 'Unable to reach Vesty right now' };
  }
}
