import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/theme';
import { AppText, Button, Screen, SelectableOptionCard, TextField } from '@/ui';

import { CreateClubStepHeader } from './CreateClubStepHeader';
import { InvestmentStylePicker } from './InvestmentStylePicker';
import { CURATED_INVESTMENT_PACKAGES, type CuratedPackageId } from './curatedInvestmentPackages';
import type { ContributionPolicyMode } from './contributionPolicy';
import {
  advanceCreateClubStep,
  canContinueCreateClub,
  canSubmitCreateClub,
  createClubRequest,
  previousCreateClubStep,
  type CreateClubStep,
} from './createClubWizard';
import { CLUB_NAME_MAX_LENGTH } from './genesisStrategy';
import type { GovernanceThresholdKind } from './governance';
import {
  presentCreateClubAmountPreview,
  presentCreateClubContributionOptions,
  presentCreateClubContinue,
  presentCreateClubGovernanceOptions,
  presentCreateClubReview,
} from './presentCreateClub';
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
  const [showReviewHoldings, setShowReviewHoldings] = useState(false);
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
  const continueState = presentCreateClubContinue(draft);
  const review = step === 'review' && packageId && contributionMode ? presentCreateClubReview(draft) : null;
  const contributionOptions = presentCreateClubContributionOptions();
  const governanceOptions = presentCreateClubGovernanceOptions();
  const equalAmountPreview = presentCreateClubAmountPreview(equalAmountInput);
  const flexibleAmountPreview = presentCreateClubAmountPreview(creatorFlexibleAmountInput);

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

  const goNext = () => {
    if (!canContinueCreateClub(draft)) {
      return;
    }
    setError(null);
    setStep(advanceCreateClubStep(step));
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
          <CreateClubStepHeader
            step={step}
            onBack={goBack}
            backDisabled={isSubmitting}
            supporting={review?.clubName}
            supportingEmphasis={step === 'review'}
          />

          {step === 'name' ? (
            <View style={{ marginTop: spacing.xl }}>
              <TextField
                label="Club name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={CLUB_NAME_MAX_LENGTH}
                error={Boolean(error)}
                editable={!isSubmitting}
                accessibilityLabel="Club name"
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={goNext}
              />
              {error ? (
                <AppText variant="meta" color="negative" style={{ marginTop: spacing.sm }}>
                  {error}
                </AppText>
              ) : null}
              <View style={{ marginTop: spacing.xl }}>
                <Button
                  label={continueState.label}
                  variant="primary"
                  block
                  disabled={!continueState.enabled}
                  onPress={goNext}
                />
              </View>
            </View>
          ) : null}

          {step === 'governance' ? (
            <View style={{ marginTop: spacing.lg }}>
              {governanceOptions.map((option, index) => (
                <View key={option.value} style={{ marginTop: index === 0 ? 0 : spacing.sm }}>
                  <SelectableOptionCard
                    title={option.title}
                    description={option.description}
                    caption={option.guidance}
                    selected={option.value === governance}
                    accessibilityLabel={option.title}
                    onPress={() => {
                      setError(null);
                      setGovernance(option.value);
                    }}
                  />
                </View>
              ))}
              <View style={{ marginTop: spacing.xl }}>
                <Button label={continueState.label} variant="primary" block onPress={goNext} />
              </View>
            </View>
          ) : null}

          {step === 'style' ? (
            <View style={{ marginTop: spacing.lg }}>
              <InvestmentStylePicker
                packages={CURATED_INVESTMENT_PACKAGES}
                selectedId={packageId}
                onSelect={(id) => {
                  setError(null);
                  setPackageId(id);
                }}
                disabled={isSubmitting}
              />
              <View style={{ marginTop: spacing.xl }}>
                <Button
                  label={continueState.label}
                  variant="primary"
                  block
                  disabled={!continueState.enabled}
                  onPress={goNext}
                />
              </View>
            </View>
          ) : null}

          {step === 'contribution' ? (
            <View style={{ marginTop: spacing.lg }}>
              {contributionOptions.map((option, index) => {
                const selected = option.value === contributionMode;
                return (
                  <View key={option.value} style={{ marginTop: index === 0 ? 0 : spacing.sm }}>
                    <SelectableOptionCard
                      title={option.title}
                      description={option.description}
                      selected={selected}
                      accessibilityLabel={option.title}
                      onPress={() => {
                        setError(null);
                        setContributionMode(option.value);
                      }}
                    >
                      {selected && option.value === 'equal' ? (
                        <View>
                          <TextField
                            label={option.amountLabel}
                            value={equalAmountInput}
                            onChangeText={setEqualAmountInput}
                            keyboardType="number-pad"
                            inputMode="numeric"
                            autoCorrect={false}
                            editable={!isSubmitting}
                            error={Boolean(error)}
                            accessibilityLabel="Club amount in kroner"
                          />
                          <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
                            {equalAmountPreview
                              ? `${equalAmountPreview} ${option.amountHint}`
                              : option.amountHint}
                          </AppText>
                        </View>
                      ) : null}
                      {selected && option.value === 'flexible' ? (
                        <View>
                          <TextField
                            label={option.amountLabel}
                            value={creatorFlexibleAmountInput}
                            onChangeText={setCreatorFlexibleAmountInput}
                            keyboardType="number-pad"
                            inputMode="numeric"
                            autoCorrect={false}
                            editable={!isSubmitting}
                            error={Boolean(error)}
                            accessibilityLabel="Your amount in kroner"
                          />
                          {flexibleAmountPreview ? (
                            <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
                              {flexibleAmountPreview}
                            </AppText>
                          ) : null}
                          <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
                            {option.privacy}
                          </AppText>
                        </View>
                      ) : null}
                    </SelectableOptionCard>
                  </View>
                );
              })}

              {error ? (
                <AppText variant="meta" color="negative" style={{ marginTop: spacing.sm }}>
                  {error}
                </AppText>
              ) : null}

              <View style={{ marginTop: spacing.xl }}>
                <Button
                  label={continueState.label}
                  variant="primary"
                  block
                  disabled={!continueState.enabled}
                  onPress={goNext}
                />
              </View>
            </View>
          ) : null}

          {step === 'review' && review ? (
            <View style={{ marginTop: spacing.lg }}>
              <ReviewSection
                label={review.investmentStyleLabel}
                value={review.investmentName}
                details={review.exposureLines}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showReviewHoldings ? 'Hide investments' : 'View investments'}
                onPress={() => setShowReviewHoldings((open) => !open)}
                hitSlop={8}
                style={({ pressed }) => ({
                  marginTop: spacing.sm,
                  alignSelf: 'flex-start',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <AppText variant="meta" color="accent">
                  {showReviewHoldings ? 'Hide investments' : 'View investments'}
                </AppText>
              </Pressable>
              {showReviewHoldings
                ? review.holdings.map((holding) => (
                    <AppText key={holding.ticker} variant="supporting" style={{ marginTop: 4 }}>
                      {holding.line}
                    </AppText>
                  ))
                : null}

              <ReviewDivider />

              <ReviewSection
                label={review.contributionStyleLabel}
                value={review.contributionName}
                details={[review.contributionDetail, review.contributionPrivacy].filter(
                  (line): line is string => Boolean(line),
                )}
              />

              <ReviewDivider />

              <ReviewSection label={review.governanceLabel} value={review.governanceName} />

              {error ? (
                <AppText
                  variant="meta"
                  color="negative"
                  style={{ marginTop: spacing.md }}
                  accessibilityLiveRegion="polite"
                >
                  {error}
                </AppText>
              ) : null}
              <View style={{ marginTop: spacing.xl }}>
                <Button
                  label={isSubmitting ? 'Creating…' : continueState.label}
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

function ReviewSection({
  label,
  value,
  details = [],
}: {
  label: string;
  value: string;
  details?: readonly string[];
}) {
  const { spacing } = useTheme();

  return (
    <View>
      <AppText variant="label">{label}</AppText>
      <AppText variant="subtitle" style={{ marginTop: 4 }}>
        {value}
      </AppText>
      {details.map((line) => (
        <AppText key={line} variant="supporting" style={{ marginTop: spacing.xs }}>
          {line}
        </AppText>
      ))}
    </View>
  );
}

function ReviewDivider() {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={{
        height: 1,
        backgroundColor: colors.border,
        marginVertical: spacing.lg,
      }}
    />
  );
}
