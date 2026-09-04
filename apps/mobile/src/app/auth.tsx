import { Redirect } from 'expo-router';

import { AuthScreen } from '@/features/auth/AuthScreen';
import { useAuth } from '@/features/auth/useAuth';
import { useProfile } from '@/features/profile/useProfile';

export default function AuthRoute() {
  const { session, isInitializing, profileError } = useAuth();
  const { isOnboarded, isLoading } = useProfile();

  if (isInitializing || profileError || (session && isLoading)) {
    return null;
  }

  if (session) {
    return <Redirect href={isOnboarded ? '/home' : '/profile-setup'} />;
  }

  return <AuthScreen />;
}
