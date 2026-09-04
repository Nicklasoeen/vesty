import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthLoadingScreen } from '@/features/auth/AuthLoadingScreen';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { ProfileProvider, useProfile } from '@/features/profile/ProfileProvider';
import { ThemeProvider } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ProfileProvider>
            <RootNavigation />
          </ProfileProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootNavigation() {
  const { isInitializing, profileError, retryProfileSetup, session } = useAuth();
  const { isLoading: profileLoading, error: profileLoadError, profile, refresh } = useProfile();
  const identityBlocked = Boolean(session) && !profileLoading && Boolean(profileLoadError) && !profile;
  const blocking =
    isInitializing || Boolean(profileError) || (Boolean(session) && profileLoading) || identityBlocked;
  const error = profileError ?? (identityBlocked ? profileLoadError : null);

  return (
    <View style={styles.fill}>
      <Stack screenOptions={{ headerShown: false }} />
      {blocking ? (
        <View style={styles.overlay} pointerEvents="auto">
          <AuthLoadingScreen
            error={error}
            onRetry={
              profileError
                ? () => void retryProfileSetup()
                : identityBlocked
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
