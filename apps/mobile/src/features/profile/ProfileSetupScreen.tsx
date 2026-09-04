import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';

import { useTheme } from '@/theme';
import { AppText, Screen, VestyWordmark } from '@/ui';

import { ProfileForm } from './ProfileForm';

interface ProfileSetupScreenProps {
  mode: 'onboarding' | 'edit';
}

export function ProfileSetupScreen({ mode }: ProfileSetupScreenProps) {
  const { colorScheme, colors, spacing } = useTheme();
  const router = useRouter();

  const leaveWithoutSaving = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/home');
  };

  const leaveAfterSuccessfulSave = () => {
    if (mode === 'edit' && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/home');
  };

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
          {mode === 'edit' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={leaveWithoutSaving}
              hitSlop={8}
              style={{ marginBottom: spacing.md, alignSelf: 'flex-start' }}
            >
              <AppText variant="bodyStrong" color="accent">
                Back
              </AppText>
            </Pressable>
          ) : null}
          <ProfileForm mode={mode} onCompleted={leaveAfterSuccessfulSave} />
        </Screen>
      </KeyboardAvoidingView>
    </View>
  );
}
