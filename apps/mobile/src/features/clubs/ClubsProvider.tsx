import AsyncStorage from '@react-native-async-storage/async-storage';
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

import { useAuth } from '@/features/auth/useAuth';
import { useProfile } from '@/features/profile/useProfile';

import * as clubsApi from './api';
import type { ClubSummary } from './types';

const SELECTED_CLUB_STORAGE_KEY = 'vesty.selectedClubId';

interface ClubsContextValue {
  clubs: ClubSummary[];
  selectedClub: ClubSummary | null;
  isLoading: boolean;
  error: string | null;
  refresh: (preferredClubId?: string) => Promise<ClubSummary[]>;
  selectClub: (clubId: string) => Promise<void>;
}

const ClubsContext = createContext<ClubsContextValue | null>(null);

function pickSelectedClub(clubs: ClubSummary[], preferredId: string | null): ClubSummary | null {
  if (clubs.length === 0) {
    return null;
  }
  if (preferredId) {
    const match = clubs.find((club) => club.clubId === preferredId);
    if (match) {
      return match;
    }
  }
  return clubs[0] ?? null;
}

export function ClubsProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedClubIdRef = useRef<string | null>(null);
  const identityKeyRef = useRef<string | null>(null);
  const identityKey = `${profile?.displayName ?? ''}|${profile?.avatarPath ?? ''}`;

  const refresh = useCallback(async (preferredClubId?: string): Promise<ClubSummary[]> => {
    if (!user) {
      setClubs([]);
      setSelectedClubId(null);
      selectedClubIdRef.current = null;
      setIsLoading(false);
      return [];
    }

    setIsLoading(true);

    try {
      const nextClubs = await clubsApi.fetchActiveClubs(user.id, user.email ?? null);
      const stored = await AsyncStorage.getItem(SELECTED_CLUB_STORAGE_KEY);
      const nextSelected = pickSelectedClub(
        nextClubs,
        preferredClubId ?? selectedClubIdRef.current ?? stored,
      );
      setClubs(nextClubs);
      setSelectedClubId(nextSelected?.clubId ?? null);
      selectedClubIdRef.current = nextSelected?.clubId ?? null;
      if (nextSelected) {
        await AsyncStorage.setItem(SELECTED_CLUB_STORAGE_KEY, nextSelected.clubId);
      } else {
        await AsyncStorage.removeItem(SELECTED_CLUB_STORAGE_KEY);
      }
      setError(null);
      setIsLoading(false);
      return nextClubs;
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: string }).code ?? 'unknown')
          : 'unknown';
      console.warn('[clubs] refresh failed', code);
      setError('Unable to load clubs right now');
      setIsLoading(false);
      return [];
    }
  }, [user]);

  useEffect(() => {
    selectedClubIdRef.current = null;
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [refresh]);

  useEffect(() => {
    if (identityKeyRef.current === null) {
      identityKeyRef.current = identityKey;
      return;
    }
    if (identityKeyRef.current === identityKey) {
      return;
    }
    identityKeyRef.current = identityKey;
    void refresh();
  }, [identityKey, refresh]);

  const selectClub = useCallback(async (clubId: string) => {
    selectedClubIdRef.current = clubId;
    setSelectedClubId(clubId);
    await AsyncStorage.setItem(SELECTED_CLUB_STORAGE_KEY, clubId);
  }, []);

  const selectedClub = useMemo(
    () => clubs.find((club) => club.clubId === selectedClubId) ?? null,
    [clubs, selectedClubId],
  );

  const value = useMemo<ClubsContextValue>(
    () => ({
      clubs,
      selectedClub,
      isLoading,
      error,
      refresh,
      selectClub,
    }),
    [clubs, error, isLoading, refresh, selectClub, selectedClub],
  );

  return <ClubsContext.Provider value={value}>{children}</ClubsContext.Provider>;
}

export function useClubs(): ClubsContextValue {
  const value = useContext(ClubsContext);
  if (!value) {
    throw new Error('useClubs must be used within ClubsProvider');
  }
  return value;
}

export function useOptionalClubs(): ClubsContextValue | null {
  return useContext(ClubsContext);
}
