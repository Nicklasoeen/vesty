import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/theme';
import { AppText, Button, VestyMark } from '@/ui';

interface AuthLoadingScreenProps {
  error?: string | null;
  onRetry?: () => void;
}

/**
 * Calm session-restore / profile-setup state. Shown instead of auth or Home
 * so the first paint does not flash the wrong experience.
 */
export function AuthLoadingScreen({ error, onRetry }: AuthLoadingScreenProps) {
  const { colorScheme, colors, spacing } = useTheme();

  return (
    <View style={[styles.fill, styles.center, { backgroundColor: colors.background, paddingHorizontal: spacing.lg }]}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <VestyMark color={colors.textPrimary} height={28} />
      {error ? (
        <View style={[styles.center, { marginTop: spacing.xl }]}>
          <AppText variant="body" color="secondary" style={styles.message}>
            {error}
          </AppText>
          {onRetry ? (
            <View style={{ marginTop: spacing.lg }}>
              <Button label="Try again" variant="secondary" onPress={onRetry} accessibilityLabel="Try again" />
            </View>
          ) : null}
        </View>
      ) : (
        <ActivityIndicator
          accessibilityLabel="Loading"
          color={colors.accent}
          style={{ marginTop: spacing.xl }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
  },
});
