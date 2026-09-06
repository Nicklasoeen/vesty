import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/theme';
import { AppText, Screen } from '@/ui';

import { contributionKronerFromMinor } from './contributionAmount';
import { FlexibleContributionForm } from './FlexibleContributionForm';
import { useClubContribution } from './useClubContribution';

export function ContributionSetupScreen() {
  const { colorScheme, colors, spacing } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ clubId?: string | string[] }>();
  const clubId = useMemo(() => {
    const value = params.clubId;
    return Array.isArray(value) ? value[0] ?? null : value ?? null;
  }, [params.clubId]);
  const contribution = useClubContribution(clubId);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/club');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={goBack}
            hitSlop={10}
            style={({ pressed }) => ({ marginTop: spacing.md, opacity: pressed ? 0.7 : 1, alignSelf: 'flex-start' })}
          >
            <Feather name="chevron-left" size={24} color={colors.textPrimary} />
          </Pressable>

          <View style={{ marginTop: spacing.xl }}>
            <AppText variant="title" accessibilityRole="header">
              Set your contribution
            </AppText>
            {clubId ? (
              <View style={{ marginTop: spacing.lg }}>
                <FlexibleContributionForm
                  initialKroner={
                    contribution.commitment
                      ? contributionKronerFromMinor(contribution.commitment.amountMinor)
                      : ''
                  }
                  submitLabel="Set amount"
                  showAppliesNext={Boolean(contribution.commitment)}
                  onSubmit={async (amountMinor) => {
                    await contribution.saveFlexibleAmount(amountMinor);
                    if (router.canGoBack()) {
                      router.back();
                      return;
                    }
                    router.replace('/club');
                  }}
                />
              </View>
            ) : (
              <AppText variant="body" color="secondary" style={{ marginTop: spacing.lg }}>
                Unable to load contribution settings
              </AppText>
            )}
          </View>
        </Screen>
      </KeyboardAvoidingView>
    </View>
  );
}
