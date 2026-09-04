import { useState } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/auth/useAuth';
import { ProfileSetupScreen } from '@/features/profile/ProfileSetupScreen';
import { useProfile } from '@/features/profile/useProfile';

export default function ProfileSetupRoute() {
  const { session, isInitializing, profileError } = useAuth();
  const { isOnboarded, isLoading } = useProfile();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const modeValue = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const mode = modeValue === 'edit' ? 'edit' : 'onboarding';

  if (isInitializing || profileError || (session && isLoading)) {
    return null;
  }

  if (!session) {
    return <Redirect href="/auth" />;
  }

  return <ProfileSetupGate isOnboarded={isOnboarded} mode={mode} />;
}

function ProfileSetupGate({
  isOnboarded,
  mode,
}: {
  isOnboarded: boolean;
  mode: 'onboarding' | 'edit';
}) {
  const [arrivedComplete] = useState(isOnboarded && mode !== 'edit');

  if (arrivedComplete) {
    return <Redirect href="/home" />;
  }

  return <ProfileSetupScreen mode={mode} />;
}
