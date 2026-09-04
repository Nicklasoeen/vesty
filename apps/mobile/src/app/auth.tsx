import { Redirect } from 'expo-router';

import { AuthScreen } from '@/features/auth/AuthScreen';
import { useAuth } from '@/features/auth/useAuth';

export default function AuthRoute() {
  const { session, isInitializing, profileError } = useAuth();

  if (isInitializing || profileError) {
    return null;
  }

  if (session) {
    return <Redirect href="/home" />;
  }

  return <AuthScreen />;
}
