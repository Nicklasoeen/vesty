import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type { AuthError, Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase/client';
import { ensureOwnProfile } from './ensureOwnProfile';
import { mapAuthError } from './mapAuthError';
import { restoreAuthSession } from './restoreAuthSession';
import {
  isInvalidAuthIdentityError,
  isInvalidProfileIdentityError,
  isRetryableAuthTransportError,
} from './sessionValidity';

export type AuthActionResult =
  | { ok: true }
  | { ok: true; needsEmailConfirmation: true }
  | { ok: false; message: string };

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isInitializing: boolean;
  isSubmitting: boolean;
  profileError: string | null;
  retryProfileSetup: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (email: string, password: string) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function logAuthIssue(context: string, error: { code?: string; message?: string } | unknown): void {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: string }).code;
    console.warn(`[auth] ${context}`, code ?? 'unknown');
    return;
  }

  console.warn(`[auth] ${context}`);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const submittingRef = useRef(false);

  const clearInvalidSession = useCallback(async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      logAuthIssue('local signOut after invalid session', error);
    }

    sessionRef.current = null;
    setSession(null);
    setProfileError(null);
  }, []);

  const applyAuthenticatedSession = useCallback(async (next: Session | null): Promise<boolean> => {
    if (!next?.user) {
      sessionRef.current = null;
      setSession(null);
      setProfileError(null);
      return true;
    }

    const { data: userResult, error: getUserError } = await supabase.auth.getUser();

    if (getUserError || !userResult.user) {
      if (isRetryableAuthTransportError(getUserError)) {
        logAuthIssue('getUser transport failed', getUserError);
        sessionRef.current = next;
        setSession(next);
        setProfileError('Unable to set up your account right now');
        return false;
      }

      if (isInvalidAuthIdentityError(getUserError) || !userResult.user) {
        logAuthIssue('getUser rejected cached session', getUserError);
        await clearInvalidSession();
        return true;
      }

      logAuthIssue('getUser failed', getUserError);
      sessionRef.current = next;
      setSession(next);
      setProfileError('Unable to set up your account right now');
      return false;
    }

    try {
      await ensureOwnProfile(userResult.user.id);
      sessionRef.current = next;
      setSession(next);
      setProfileError(null);
      return true;
    } catch (error) {
      if (isInvalidProfileIdentityError(error)) {
        logAuthIssue('profile bootstrap rejected stale identity', error);
        await clearInvalidSession();
        return true;
      }

      logAuthIssue('profile bootstrap failed', error);
      sessionRef.current = next;
      setSession(next);
      setProfileError('Unable to set up your account right now');
      return false;
    }
  }, [clearInvalidSession]);

  const restoreSession = useCallback(async (): Promise<void> => {
    const result = await restoreAuthSession({
      getSession: () => supabase.auth.getSession(),
      applySession: (next) => applyAuthenticatedSession(next as Session | null),
      onIssue: logAuthIssue,
    });

    if (result.status === 'failed') {
      setProfileError(result.message);
    }
  }, [applyAuthenticatedSession]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await restoreSession();
      if (!cancelled) {
        setIsInitializing(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION') {
        return;
      }

      // Defer so we never call other Supabase methods inside this callback.
      setTimeout(() => {
        if (cancelled) {
          return;
        }

        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          sessionRef.current = nextSession;
          setSession(nextSession);
          return;
        }

        void applyAuthenticatedSession(nextSession);
      }, 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [applyAuthenticatedSession, restoreSession]);

  const retryProfileSetup = useCallback(async () => {
    setIsInitializing(true);
    setProfileError(null);
    await restoreSession();
    setIsInitializing(false);
  }, [restoreSession]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      if (submittingRef.current) {
        return { ok: false, message: 'Unable to sign in right now' };
      }

      submittingRef.current = true;
      setIsSubmitting(true);

      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          logAuthIssue('signIn failed', error);
          return { ok: false, message: mapAuthError(error, 'sign-in') };
        }

        if (!data.session) {
          return { ok: false, message: 'Unable to sign in right now' };
        }

        const profileReady = await applyAuthenticatedSession(data.session);
        if (!profileReady) {
          return { ok: false, message: 'Unable to set up your account right now' };
        }

        return { ok: true };
      } catch (error) {
        logAuthIssue('signIn failed', error);
        return { ok: false, message: 'Unable to sign in right now' };
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [applyAuthenticatedSession],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      if (submittingRef.current) {
        return { ok: false, message: 'Unable to create account right now' };
      }

      submittingRef.current = true;
      setIsSubmitting(true);

      try {
        const { data, error } = await supabase.auth.signUp({ email, password });

        if (error) {
          logAuthIssue('signUp failed', error);
          return { ok: false, message: mapAuthError(error as AuthError, 'sign-up') };
        }

        if (data.user && !data.session && (data.user.identities?.length ?? 0) === 0) {
          return { ok: false, message: 'Account already exists' };
        }

        if (data.session) {
          const profileReady = await applyAuthenticatedSession(data.session);
          if (!profileReady) {
            return { ok: false, message: 'Unable to set up your account right now' };
          }

          return { ok: true };
        }

        if (data.user) {
          return { ok: true, needsEmailConfirmation: true };
        }

        return { ok: false, message: 'Unable to create account right now' };
      } catch (error) {
        logAuthIssue('signUp failed', error);
        return { ok: false, message: 'Unable to create account right now' };
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [applyAuthenticatedSession],
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      logAuthIssue('signOut failed', error);
    }

    sessionRef.current = null;
    setSession(null);
    setProfileError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isInitializing,
      isSubmitting,
      profileError,
      retryProfileSetup,
      signIn,
      signUp,
      signOut,
    }),
    [isInitializing, isSubmitting, profileError, retryProfileSetup, session, signIn, signOut, signUp],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return value;
}
