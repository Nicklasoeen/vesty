import { Redirect, Slot } from 'expo-router';

import { useAuth } from '@/features/auth/useAuth';

/**
 * Authenticated app boundary. Future screens in this group inherit the gate.
 */
export default function AppGroupLayout() {
  const { session, isInitializing, profileError } = useAuth();

  if (isInitializing || profileError) {
    return null;
  }

  if (!session) {
    return <Redirect href="/auth" />;
  }

  return <Slot />;
}
