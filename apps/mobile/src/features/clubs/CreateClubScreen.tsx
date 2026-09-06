import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/theme';
import { AllocationBar, AppText, Button, Screen, TextField } from '@/ui';

import { InvestmentStylePicker } from './InvestmentStylePicker';
import {
  CURATED_INVESTMENT_PACKAGES,
  getCuratedPackage,
  packageExposureSlices,
  packageHoldingLines,
  type CuratedPackageId,
} from './curatedInvestmentPackages';
import type { ContributionPolicyMode } from './contributionPolicy';
import {
  advanceCreateClubStep,
  canContinueCreateClub,
  canSubmitCreateClub,
  createClubRequest,
  previousCreateClubStep,
  reviewPackageSummary,
  trimmedClubName,
  type CreateClubStep,
} from './createClubWizard';
import { CLUB_NAME_MAX_LENGTH } from './genesisStrategy';
import { GOVERNANCE_OPTIONS, governanceLabel, type GovernanceThresholdKind } from './governance';
import { CONTRIBUTION_STYLE_OPTIONS, contributionStyleLabel } from './presentContribution';
import { attachClub, createClub, useClubs } from './useClubs';

export function CreateClubScreen() {
  const { colorScheme, colors, spacing } = useTheme();
  const router = useRouter();
  const { refresh, selectClub } = useClubs();
  const [step, setStep] = useState<CreateClubStep>('name');
  const [name, setName] = useState('');
  const [governance, setGovernance] = useState<GovernanceThresholdKind>('simple_majority');
  const [packageId, setPackageId] = useState<CuratedPackageId | null>(null);
  const [contributionMode, setContributionMode] = useState<ContributionPolicyMode | null>(null);
  const [equalAmountInput, setEqualAmountInput] = useState('');
  const [creatorFlexibleAmountInput, setCreatorFlexibleAmountInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createdClubIdRef = useRef<string | null>(null);

  const draft = {
    step,
    name,
    governance,
    packageId,
    contributionMode,
    equalAmountInput,
    creatorFlexibleAmountInput,
  };
  const selectedPackage = packageId ? getCuratedPackage(packageId) : null;
  const review = packageId ? reviewPackageSummary(packageId) : null;

  const goBack = () => {
    if (isSubmitting) {
      return;
    }
    const previous = previousCreateClubStep(step);
    if (previous) {
      setStep(previous);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/club');
  };

  const onCreate = async () => {
    if (isSubmitting || !canSubmitCreateClub(draft)) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (!createdClubIdRef.current) {
        const created = await createClub(createClubRequest(draft));
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
                  disabled={!canContinueCreateClub(draft)}
                  onPress={() => {
                    setError(null);
                    setStep(advanceCreateClubStep('name'));
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
                <Button
                  label="Continue"
                  variant="primary"
                  block
                  onPress={() => {
                    setError(null);
                    setStep(advanceCreateClubStep('governance'));
                  }}
                />
              </View>
            </View>
          ) : null}

          {step === 'style' ? (
            <View style={{ marginTop: spacing.xl }}>
              <AppText variant="title" accessibilityRole="header">
                Investment style
              </AppText>
              <AppText variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
                Choose how the group wants to spread its investments. These are all stock-market mixes.
              </AppText>
              <View style={{ marginTop: spacing.xl }}>
                <InvestmentStylePicker
                  packages={CURATED_INVESTMENT_PACKAGES}
                  selectedId={packageId}
                  onSelect={(id) => {
                    setError(null);
                    setPackageId(id);
                  }}
                  disabled={isSubmitting}
                />
              </View>
              <View style={{ marginTop: spacing.xl }}>
                <Button
                  label="Continue"
                  variant="primary"
                  block
                  disabled={!canContinueCreateClub(draft)}
                  onPress={() => {
                    setError(null);
                    setStep(advanceCreateClubStep('style'));
                  }}
                />
              </View>
            </View>
          ) : null}

          {step === 'contribution' ? (
            <View style={{ marginTop: spacing.xl }}>
              <AppText variant="title" accessibilityRole="header">
                Contribution style
              </AppText>
              <AppText variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
                Choose how members contribute on each Investment Day.
              </AppText>
              <View style={{ marginTop: spacing.lg }}>
                {CONTRIBUTION_STYLE_OPTIONS.map((option) => {
                  const selected = option.value === contributionMode;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={option.label}
                      onPress={() => {
                        setError(null);
                        setContributionMode(option.value);
                      }}
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

              {contributionMode === 'equal' ? (
                <View style={{ marginTop: spacing.lg }}>
                  <TextField
                    label="Amount"
                    value={equalAmountInput}
                    onChangeText={setEqualAmountInput}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    autoCorrect={false}
                    editable={!isSubmitting}
                    error={Boolean(error)}
                    accessibilityLabel="Shared amount in kroner"
                    placeholder="2000"
                  />
                  <AppText variant="meta" color="secondary" style={{ marginTop: spacing.xs }}>
                    kroner per Investment Day
                  </AppText>
                </View>
              ) : null}

              {contributionMode === 'flexible' ? (
                <View style={{ marginTop: spacing.lg }}>
                  <TextField
                    label="Your amount"
                    value={creatorFlexibleAmountInput}
                    onChangeText={setCreatorFlexibleAmountInput}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    autoCorrect={false}
                    editable={!isSubmitting}
                    error={Boolean(error)}
                    accessibilityLabel="Your amount in kroner"
                    placeholder="2000"
                  />
                  <AppText variant="meta" color="secondary" style={{ marginTop: spacing.xs }}>
                    Only you can see your amount.
                  </AppText>
                </View>
              ) : null}

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
                  disabled={!canContinueCreateClub(draft)}
                  onPress={() => {
                    setError(null);
                    setStep(advanceCreateClubStep('contribution'));
                  }}
                />
              </View>
            </View>
          ) : null}

          {step === 'review' && selectedPackage && review ? (
            <View style={{ marginTop: spacing.xl }}>
              <AppText variant="title" accessibilityRole="header">
                Review
              </AppText>
              <AppText variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
                {trimmedClubName(name)} · {review.baseCurrency}
              </AppText>

              <View style={{ marginTop: spacing.xl }}>
                <AppText variant="sectionTitle">Governance</AppText>
                <AppText variant="body" style={{ marginTop: spacing.sm }}>
                  {governanceLabel(governance)}
                </AppText>
              </View>

              <View style={{ marginTop: spacing.xl }}>
                <AppText variant="sectionTitle">Contribution style</AppText>
                <AppText variant="bodyStrong" style={{ marginTop: spacing.sm }}>
                  {contributionMode ? contributionStyleLabel(contributionMode) : ''}
                </AppText>
                {contributionMode === 'equal' ? (
                  <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
                    {`${equalAmountInput} kr per Investment Day`}
                  </AppText>
                ) : (
                  <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
                    Your amount: {creatorFlexibleAmountInput} kr. Only you can see this amount.
                  </AppText>
                )}
              </View>

              <View style={{ marginTop: spacing.xl }}>
                <AppText variant="sectionTitle">Investment style</AppText>
                <AppText variant="bodyStrong" style={{ marginTop: spacing.sm }}>
                  {selectedPackage.displayName}
                </AppText>
                <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
                  {selectedPackage.shortDescription}
                </AppText>
                <AppText variant="meta" color="secondary" style={{ marginTop: spacing.sm }}>
                  {review.preview}
                </AppText>
              </View>

              <View style={{ marginTop: spacing.xl }}>
                <AppText variant="sectionTitle">How the money is spread</AppText>
                <View style={{ marginTop: spacing.md }}>
                  <AllocationBar allocations={packageExposureSlices(selectedPackage)} />
                </View>
              </View>

              <View style={{ marginTop: spacing.xl }}>
                <AppText variant="sectionTitle">What you invest in</AppText>
                <View style={{ marginTop: spacing.md }}>
                  {packageHoldingLines(selectedPackage).map((holding) => (
                    <View key={holding.id} style={{ marginBottom: spacing.sm }}>
                      <AppText variant="body">{holding.name}</AppText>
                      <AppText variant="meta" color="secondary">
                        {holding.ticker}
                      </AppText>
                    </View>
                  ))}
                </View>
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
