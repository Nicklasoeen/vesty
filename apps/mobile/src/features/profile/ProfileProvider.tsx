import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { ImageSourcePropType } from 'react-native';

import { useAuth } from '@/features/auth/useAuth';
import { initialsFromIdentity } from '@/features/clubs/initials';

import * as profileApi from './api';
import { profileIsOnboarded } from './api';
import type { CurrentProfile } from './types';

interface ProfileContextValue {
  profile: CurrentProfile | null;
  isOnboarded: boolean;
  isLoading: boolean;
  error: string | null;
  avatarSource?: ImageSourcePropType;
  initials: string;
  refresh: () => Promise<CurrentProfile | null>;
}

interface LoadedProfile {
  userId: string;
  profile: CurrentProfile | null;
  avatarSource?: ImageSourcePropType;
  error: string | null;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

async function resolveAvatarSource(avatarPath: string | null): Promise<ImageSourcePropType | undefined> {
  if (!avatarPath) {
    return undefined;
  }

  const signed = await profileApi.signAvatarUrls([avatarPath]);
  const url = signed.get(avatarPath);
  return url ? { uri: url, cache: 'reload' } : undefined;
}

export function ProfileProvider({ children }: PropsWithChildren) {
  const { user, isInitializing } = useAuth();
  const userId = user?.id ?? null;
  const [loaded, setLoaded] = useState<LoadedProfile | null>(null);

  const applyProfile = useCallback(async (id: string): Promise<CurrentProfile | null> => {
    const next = await profileApi.fetchOwnProfile(id);
    const source = await resolveAvatarSource(next?.avatarPath ?? null);
    setLoaded({
      userId: id,
      profile: next,
      avatarSource: source,
      error: null,
    });
    return next;
  }, []);

  const refresh = useCallback(async (): Promise<CurrentProfile | null> => {
    if (!userId) {
      return null;
    }

    try {
      return await applyProfile(userId);
    } catch {
      setLoaded((current) => ({
        userId,
        profile: current?.userId === userId ? current.profile : null,
        avatarSource: current?.userId === userId ? current.avatarSource : undefined,
        error: 'Unable to load your profile right now',
      }));
      return null;
    }
  }, [applyProfile, userId]);

  useEffect(() => {
    if (isInitializing || !userId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const next = await profileApi.fetchOwnProfile(userId);
        const source = await resolveAvatarSource(next?.avatarPath ?? null);
        if (!cancelled) {
          setLoaded({
            userId,
            profile: next,
            avatarSource: source,
            error: null,
          });
        }
      } catch {
        if (!cancelled) {
          setLoaded({
            userId,
            profile: null,
            error: 'Unable to load your profile right now',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isInitializing, userId]);

  const active = loaded?.userId === userId ? loaded : null;
  const profile = userId ? (active?.profile ?? null) : null;
  const hasResolved = !isInitializing && (!userId || active !== null);

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      isOnboarded: profileIsOnboarded(profile),
      isLoading: !hasResolved,
      error: userId ? (active?.error ?? null) : null,
      avatarSource: userId ? active?.avatarSource : undefined,
      initials: initialsFromIdentity(profile?.displayName, user?.email ?? null),
      refresh,
    }),
    [active, hasResolved, profile, refresh, user?.email, userId],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const value = useContext(ProfileContext);
  if (!value) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return value;
}
