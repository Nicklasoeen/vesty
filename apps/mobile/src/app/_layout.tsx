import { Stack, useSegments } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthLoadingScreen } from '@/features/auth/AuthLoadingScreen';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { presentAuthBootGate } from '@/features/auth/restoreAuthSession';
import { ProfileProvider, useProfile } from '@/features/profile/ProfileProvider';
import { ThemeProvider } from '@/theme';

export default function RootLayout() {
  const segments = useSegments();
  const isDevelopmentGallery = __DEV__ && segments[0] === 'dev';

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {isDevelopmentGallery ? (
          <Stack screenOptions={{ headerShown: false }} />
        ) : (
          <AuthProvider>
            <ProfileProvider>
              <RootNavigation />
            </ProfileProvider>
          </AuthProvider>
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootNavigation() {
  const { isInitializing, profileError, retryProfileSetup, session } = useAuth();
  const { isLoading: profileLoading, error: profileLoadError, profile, refresh } = useProfile();
  const gate = presentAuthBootGate({
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
