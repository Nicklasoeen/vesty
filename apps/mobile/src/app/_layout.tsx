import { Stack, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthLoadingScreen } from '@/features/auth/AuthLoadingScreen';
import { AuthProvider, InertAuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { presentAuthBootGate } from '@/features/auth/restoreAuthSession';
import { InertProfileProvider, ProfileProvider, useProfile } from '@/features/profile/ProfileProvider';
import { shouldMountAuthenticatedAppProviders } from '@/navigation/presentRootSessionIsolation';
import { ThemeProvider } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootProviders>
          <RootNavigation />
        </RootProviders>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (
    !shouldMountAuthenticatedAppProviders({
      isDev: __DEV__,
      pathname,
    })
  ) {
    return (
      <InertAuthProvider>
        <InertProfileProvider>{children}</InertProfileProvider>
      </InertAuthProvider>
    );
  }

  return (
    <AuthProvider>
      <ProfileProvider>{children}</ProfileProvider>
    </AuthProvider>
  );
}

function RootNavigation() {
  const pathname = usePathname();
  const isolated = !shouldMountAuthenticatedAppProviders({
    isDev: __DEV__,
    pathname,
  });
  const { isInitializing, profileError, retryProfileSetup, session } = useAuth();
  const { isLoading: profileLoading, error: profileLoadError, profile, refresh } = useProfile();
  const gate = isolated
    ? { blocking: false, error: null, identityBlocked: false }
    : presentAuthBootGate({
        isInitializing,
        profileError,
        hasSession: Boolean(session),
        profileLoading,
        profileLoadError,
        hasProfile: Boolean(profile),
      });

  return (
    <View style={styles.fill}>
      <Stack screenOptions={{ headerShown: false }} />
      {gate.blocking ? (
        <View style={styles.overlay} pointerEvents="auto">
          <AuthLoadingScreen
            error={gate.error}
            onRetry={
              profileError
                ? () => void retryProfileSetup()
                : gate.identityBlocked
                  ? () => void refresh()
                  : undefined
            }
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
  },
});
