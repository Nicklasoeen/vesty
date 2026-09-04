import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/theme';
import { Screen, VestyWordmark } from '@/ui';
import { AuthForm } from './AuthForm';

/**
 * Signed-out experience. Brand + email/password only.
 */
export function AuthScreen() {
  const { colorScheme, colors, spacing } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxl,
            justifyContent: 'center',
          }}
        >
          <View style={{ marginBottom: spacing.xxl }}>
            <VestyWordmark color={colors.textPrimary} height={22} />
          </View>
          <AuthForm />
        </Screen>
      </KeyboardAvoidingView>
    </View>
  );
}
