import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/useAuth';
import { useProfile } from '@/features/profile/useProfile';

export default function IndexScreen() {
  const { session, isInitializing, profileError } = useAuth();
  const { isOnboarded, isLoading } = useProfile();

  if (isInitializing || profileError || (session && isLoading)) {
    return null;
  }

  if (!session) {
    return <Redirect href="/auth" />;
  }

  return <Redirect href={isOnboarded ? '/home' : '/profile-setup'} />;
}
