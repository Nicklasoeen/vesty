import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthLoadingScreen } from '@/features/auth/AuthLoadingScreen';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { ThemeProvider } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootNavigation />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootNavigation() {
  const { isInitializing, profileError, retryProfileSetup } = useAuth();
  const blocking = isInitializing || Boolean(profileError);

  return (
    <View style={styles.fill}>
      <Stack screenOptions={{ headerShown: false }} />
      {blocking ? (
        <View style={styles.overlay} pointerEvents="auto">
          <AuthLoadingScreen
            error={profileError}
            onRetry={profileError ? () => void retryProfileSetup() : undefined}
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
