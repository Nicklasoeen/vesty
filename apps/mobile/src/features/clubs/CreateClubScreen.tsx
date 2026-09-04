import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/theme';
import { AllocationBar, AppText, Button, Screen, TextField } from '@/ui';
import { CLUB_NAME_MAX_LENGTH, GENESIS_STRATEGY_SLICES, V1_BASE_CURRENCY } from './genesisStrategy';
import { GOVERNANCE_OPTIONS, type GovernanceThresholdKind } from './governance';
import { attachClub, createClub, useClubs } from './useClubs';

type CreateStep = 'name' | 'governance' | 'strategy';

export function CreateClubScreen() {
  const { colorScheme, colors, spacing } = useTheme();
  const router = useRouter();
  const { refresh, selectClub } = useClubs();
  const [step, setStep] = useState<CreateStep>('name');
  const [name, setName] = useState('');
  const [governance, setGovernance] = useState<GovernanceThresholdKind>('simple_majority');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createdClubIdRef = useRef<string | null>(null);

  const trimmedName = name.trim();
  const nameValid = trimmedName.length > 0 && trimmedName.length <= CLUB_NAME_MAX_LENGTH;

  const goBack = () => {
    if (isSubmitting) {
      return;
    }
    if (step === 'governance') {
      setStep('name');
      return;
    }
    if (step === 'strategy') {
      setStep('governance');
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/club');
  };

  const onCreate = async () => {
    if (isSubmitting || !nameValid) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (!createdClubIdRef.current) {
        const created = await createClub({
          name: trimmedName,
          governanceThresholdKind: governance,
        });
        createdClubIdRef.current = created.clubId;
      }
      await attachClub(refresh, selectClub, createdClubIdRef.current);
      router.replace('/club');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create club right now');
      setIsSubmitting(false);
    }
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

          {step === 'name' ? (
            <View style={{ marginTop: spacing.xl }}>
              <AppText variant="title" accessibilityRole="header">
                Club name
              </AppText>
              <View style={{ marginTop: spacing.lg }}>
                <TextField
                  label="Name"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={CLUB_NAME_MAX_LENGTH}
                  error={Boolean(error)}
                  editable={!isSubmitting}
                  accessibilityLabel="Club name"
                />
              </View>
              {error ? (
                <AppText variant="meta" color="negative" style={{ marginTop: spacing.sm }}>
                  {error}
                </AppText>
              ) : null}
              <View style={{ marginTop: spacing.xl }}>
                <Button
                  label="Continue"
                  variant="primary"
                  block
                  disabled={!nameValid}
                  onPress={() => {
                    setError(null);
                    setStep('governance');
                  }}
                />
              </View>
            </View>
          ) : null}

          {step === 'governance' ? (
            <View style={{ marginTop: spacing.xl }}>
              <AppText variant="title" accessibilityRole="header">
                Governance
              </AppText>
              <View style={{ marginTop: spacing.lg }}>
                {GOVERNANCE_OPTIONS.map((option) => {
                  const selected = option.value === governance;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={option.label}
                      onPress={() => setGovernance(option.value)}
                      style={({ pressed }) => ({
                        paddingVertical: spacing.md,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <AppText variant="bodyStrong" color={selected ? 'primary' : 'secondary'}>
                        {option.label}
                      </AppText>
                      <AppText variant="meta" color="secondary" style={{ marginTop: 4 }}>
                        {option.description}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ marginTop: spacing.xl }}>
                <Button label="Continue" variant="primary" block onPress={() => setStep('strategy')} />
              </View>
            </View>
          ) : null}

          {step === 'strategy' ? (
            <View style={{ marginTop: spacing.xl }}>
              <AppText variant="title" accessibilityRole="header">
                Initial strategy
              </AppText>
              <AppText variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
                {trimmedName} · {V1_BASE_CURRENCY}
              </AppText>
              <View style={{ marginTop: spacing.xl }}>
                <AllocationBar allocations={GENESIS_STRATEGY_SLICES} />
              </View>
              {error ? (
                <AppText variant="meta" color="negative" style={{ marginTop: spacing.md }} accessibilityLiveRegion="polite">
                  {error}
                </AppText>
              ) : null}
              <View style={{ marginTop: spacing.xl }}>
                <Button
                  label={isSubmitting ? 'Creating…' : 'Create club'}
                  variant="primary"
                  block
                  disabled={isSubmitting}
                  busy={isSubmitting}
                  onPress={() => {
                    void onCreate();
                  }}
                />
              </View>
            </View>
          ) : null}
        </Screen>
      </KeyboardAvoidingView>
    </View>
  );
}
