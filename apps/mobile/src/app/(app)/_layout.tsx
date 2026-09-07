import { Redirect, Slot, usePathname } from 'expo-router';

import { useAuth } from '@/features/auth/useAuth';
import { ClubsProvider } from '@/features/clubs/ClubsProvider';
import { useProfile } from '@/features/profile/useProfile';
import { isDevGalleryPath } from '@/navigation/presentRootSessionIsolation';

/**
 * Authenticated + onboarded app boundary. Profile setup stays outside this group.
 */
export default function AppGroupLayout() {
  const pathname = usePathname();
  const { session, isInitializing, profileError } = useAuth();
  const { isOnboarded, isLoading } = useProfile();

  if (__DEV__ && isDevGalleryPath(pathname)) {
    return null;
  }

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
