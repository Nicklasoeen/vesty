import { Redirect, Slot } from 'expo-router';

import { useAuth } from '@/features/auth/useAuth';
import { ClubsProvider } from '@/features/clubs/ClubsProvider';
import { useProfile } from '@/features/profile/useProfile';

/**
 * Authenticated + onboarded app boundary. Profile setup stays outside this group.
 */
export default function AppGroupLayout() {
  const { session, isInitializing, profileError } = useAuth();
  const { isOnboarded, isLoading } = useProfile();

  if (isInitializing || profileError || (session && isLoading)) {
    return null;
  }

  if (!session) {
    return <Redirect href="/auth" />;
  }

  if (!isOnboarded) {
    return <Redirect href="/profile-setup" />;
  }

  return (
    <ClubsProvider>
      <Slot />
    </ClubsProvider>
  );
}
