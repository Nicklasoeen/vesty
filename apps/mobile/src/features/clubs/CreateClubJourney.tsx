import { ActivityIndicator, Linking, Pressable, View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText, Button, SelectableOptionCard, Surface, TextField } from '@/ui';

import { CreateClubStepHeader } from './CreateClubStepHeader';
import {
  advanceCreateClubStep,
  canContinueCreateClub,
  previousCreateClubStep,
  selectCreateClubMode,
  type CreateClubDraft,
} from './createClubWizard';
import { CLUB_NAME_MAX_LENGTH } from './genesisStrategy';
import { presentCreateClubAmountPreview, presentCreateClubCatalogPanel, presentCreateClubContinue, presentCreateClubContributionOptions, presentCreateClubGovernanceOptions } from './presentCreateClub';
import {
  presentCreateClubReviewAgreement,
  presentGroupTypeOptions,
  presentSingleFundCard,
  presentSingleFundDetails,
} from './presentSingleFund';
import { presentCreateClubConflict, presentCreateClubSubmit, type CreateClubSubmitState } from './createClubSubmission';
import {
  findSingleFundProduct,
  type CatalogLoadState,
  type SingleFundProduct,
} from './singleFundCatalog';
import { isAllowedSingleFundSourceUrl } from './singleFundSourceUrl';

export interface CreateClubJourneyProps {
  draft: CreateClubDraft;
  onDraftChange: (draft: CreateClubDraft) => void;
  products: readonly SingleFundProduct[];
  catalogState: CatalogLoadState;
  catalogMessage?: string | null;
  onRetryCatalog?: () => void;
  submitState: CreateClubSubmitState;
  submitMessage?: string | null;
  onSubmit: () => void;
  onGoToClubs?: () => void;
  onStartNewSetup?: () => void;
  onDiscardSetup?: () => void;
  fundDetailOpen?: boolean;
  onFundDetailOpenChange?: (open: boolean) => void;
  onLeave: () => void;
  compact?: boolean;
  largeText?: boolean;
}

export function CreateClubJourney({
  draft,
  onDraftChange,
  products,
  catalogState,
  catalogMessage,
  onRetryCatalog,
  submitState,
  submitMessage,
  onSubmit,
  onGoToClubs,
  onStartNewSetup,
  onDiscardSetup,
  fundDetailOpen = false,
  onFundDetailOpenChange,
  onLeave,
  compact = false,
  largeText = false,
}: CreateClubJourneyProps) {
  const { spacing } = useTheme();
  const continueState = presentCreateClubContinue(draft, products);
  const submit = presentCreateClubSubmit(submitState);
  const selectedProduct = findSingleFundProduct(products, draft.catalogProductId);
  const review =
    draft.step === 'review' && selectedProduct && draft.contributionMode
      ? presentCreateClubReviewAgreement(draft, selectedProduct)
      : null;
  const busy = submitState === 'loading';

  const goBack = () => {
    if (busy) {
      return;
    }
    const previous = previousCreateClubStep(draft.step);
    if (previous) {
      onDraftChange({ ...draft, step: previous });
      return;
    }
    onLeave();
  };

  const goNext = () => {
    if (!canContinueCreateClub(draft, products) || busy) {
      return;
    }
    onDraftChange({ ...draft, step: advanceCreateClubStep(draft.step) });
  };

  return (
    <View style={{ width: '100%', maxWidth: compact ? 375 : undefined, alignSelf: compact ? 'center' : undefined }}>
      <CreateClubStepHeader
        step={draft.step}
        onBack={goBack}
        backDisabled={busy}
        supporting={review?.clubName}
        supportingEmphasis={draft.step === 'review'}
      />

      {draft.step === 'name' ? (
        <View style={{ marginTop: spacing.xl }}>
          <TextField
            label="Club name"
            value={draft.name}
            onChangeText={(name) => onDraftChange({ ...draft, name })}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={CLUB_NAME_MAX_LENGTH}
            editable={!busy}
            accessibilityLabel="Club name"
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={goNext}
          />
          <PrimaryContinue label={continueState.label} enabled={continueState.enabled && !busy} onPress={goNext} />
        </View>
      ) : null}

      {draft.step === 'mode' ? (
        <View style={{ marginTop: spacing.lg }}>
          {presentGroupTypeOptions(draft.mode).map((option, index) => (
            <View key={option.value} style={{ marginTop: index === 0 ? 0 : spacing.sm }}>
              <SelectableOptionCard
                title={option.title}
                description={option.description}
                caption={option.locked ? null : option.lockReason}
                selected={option.selected}
                disabled={option.locked || busy}
                locked={option.locked}
                lockReason={option.lockReason}
                accessibilityLabel={option.accessibilityLabel}
                onPress={() => onDraftChange(selectCreateClubMode(draft, option.value))}
              >
                <View style={{ gap: 4 }}>
                  {option.facts.map((fact) => (
                    <AppText key={fact} variant="supporting">{`• ${fact}`}</AppText>
                  ))}
                  {option.selected && option.expanded ? (
                    <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
                      {option.expanded}
                    </AppText>
                  ) : null}
                </View>
              </SelectableOptionCard>
            </View>
          ))}
          <PrimaryContinue label={continueState.label} enabled={continueState.enabled && !busy} onPress={goNext} />
        </View>
      ) : null}

      {draft.step === 'fund' ? (
        <View style={{ marginTop: spacing.lg }}>
          <CatalogPanel state={catalogState} message={catalogMessage} onRetry={onRetryCatalog} />
          {catalogState === 'ready'
            ? products.map((product) => {
                const card = presentSingleFundCard(product, product.id === draft.catalogProductId);
                const details = presentSingleFundDetails(product);
                const selected = product.id === draft.catalogProductId;
                return (
                  <View key={product.id} style={{ marginBottom: spacing.sm }}>
                    <SelectableOptionCard
                      title={card.title}
                      description={card.description}
                      selected={card.selected}
                      disabled={busy || product.status !== 'active'}
                      accessibilityLabel={card.title}
                      onPress={() =>
                        onDraftChange({
                          ...draft,
                          catalogProductId: product.id === draft.catalogProductId ? null : product.id,
                        })
                      }
                    >
                      <View style={{ gap: 4 }}>
                        {card.facts.map((fact) => (
                          <AppText key={fact} variant="supporting">{`• ${fact}`}</AppText>
                        ))}
                      </View>
                      {selected ? (
                        <View style={{ marginTop: spacing.md }}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={fundDetailOpen ? 'Hide fund details' : 'View fund details'}
                            onPress={() => onFundDetailOpenChange?.(!fundDetailOpen)}
                          >
                            <AppText variant="bodyStrong" color="accent">
                              {fundDetailOpen ? 'Hide fund details' : 'View fund details'}
                            </AppText>
                          </Pressable>
                          {fundDetailOpen ? <FundDetails details={details} largeText={largeText} /> : null}
                        </View>
                      ) : null}
                    </SelectableOptionCard>
                  </View>
                );
              })
            : null}
          <PrimaryContinue label={continueState.label} enabled={continueState.enabled && !busy} onPress={goNext} />
        </View>
      ) : null}

      {draft.step === 'contribution' ? (
        <ContributionStep draft={draft} onDraftChange={onDraftChange} busy={busy} onContinue={goNext} />
      ) : null}

      {draft.step === 'governance' ? (
        <View style={{ marginTop: spacing.lg }}>
          {presentCreateClubGovernanceOptions().map((option, index) => (
            <View key={option.value} style={{ marginTop: index === 0 ? 0 : spacing.sm }}>
              <SelectableOptionCard
                title={option.title}
                description={option.description}
                caption={option.guidance}
                selected={option.value === draft.governance}
                disabled={busy}
                accessibilityLabel={option.title}
                onPress={() => onDraftChange({ ...draft, governance: option.value })}
              />
            </View>
          ))}
          <PrimaryContinue label={continueState.label} enabled={!busy} onPress={goNext} />
        </View>
      ) : null}

      {draft.step === 'review' && review ? (
        <View style={{ marginTop: spacing.lg }}>
          <ReviewBlock label={review.groupTypeLabel} value={review.groupTypeName} details={[review.groupTypeDetail]} />
          <ReviewDivider />
          <ReviewBlock
            label={review.investmentLabel}
            value={review.investmentName}
            details={review.investmentDetails}
          />
          <ReviewDivider />
          <ReviewBlock
            label={review.contributionStyleLabel}
            value={review.contributionName}
            details={[review.contributionDetail, review.contributionPrivacy].filter(
              (line): line is string => Boolean(line),
            )}
          />
          <ReviewDivider />
          <ReviewBlock label={review.governanceLabel} value={review.governanceName} />
          <Surface bordered style={{ padding: spacing.md, marginTop: spacing.lg }}>
            <AppText variant="bodyStrong">{review.ownership}</AppText>
          </Surface>
          {submitMessage || submit.message ? (
            <AppText
              variant="meta"
              color="negative"
              style={{ marginTop: spacing.md }}
              accessibilityLiveRegion="polite"
            >
              {submitMessage ?? submit.message}
            </AppText>
          ) : null}
          {submit.showConflictActions ? (
            <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
              <Button
                label={presentCreateClubConflict().goToClubsLabel}
                variant="primary"
                block
                disabled={busy}
                onPress={onGoToClubs}
              />
              <Button
                label={presentCreateClubConflict().startNewSetupLabel}
                variant="secondary"
                block
                disabled={busy}
                onPress={onStartNewSetup}
              />
            </View>
          ) : (
            <View style={{ marginTop: spacing.xl }}>
              <Button
                label={submit.label}
                variant="primary"
                block
                busy={submit.busy}
                disabled={submit.disabled || !continueState.enabled}
                onPress={onSubmit}
              />
              {onDiscardSetup && submitState === 'idle' ? (
                <View style={{ marginTop: spacing.sm }}>
                  <Button
                    label="Discard setup"
                    variant="secondary"
                    block
                    disabled={busy}
                    onPress={onDiscardSetup}
                  />
                </View>
              ) : null}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

function PrimaryContinue({
  label,
  enabled,
  onPress,
}: {
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  const { spacing } = useTheme();
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Button label={label} variant="primary" block disabled={!enabled} onPress={onPress} />
    </View>
  );
}

function CatalogPanel({
  state,
  message,
  onRetry,
}: {
  state: CatalogLoadState;
  message?: string | null;
  onRetry?: () => void;
}) {
  const { colors, spacing } = useTheme();
  if (state === 'ready' && !message) {
    return null;
  }
  if (state === 'loading' || state === 'idle') {
    const loading = presentCreateClubCatalogPanel(state);
    return (
      <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
        <ActivityIndicator accessibilityLabel="Loading funds" color={colors.accent} />
        <AppText variant="supporting" style={{ marginTop: spacing.sm }}>
          {loading.title}
        </AppText>
      </View>
    );
  }
  const copy = presentCreateClubCatalogPanel(state === 'ready' ? 'unavailable' : state);
  return (
    <Surface bordered style={{ padding: spacing.md, marginBottom: spacing.md }}>
      <AppText variant="bodyStrong">{copy.title}</AppText>
      <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
        {message ?? copy.body}
      </AppText>
      {state === 'error' && onRetry ? (
        <View style={{ marginTop: spacing.md }}>
          <Button label="Try again" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </Surface>
  );
}

function FundDetails({
  details,
  largeText,
}: {
  details: ReturnType<typeof presentSingleFundDetails>;
  largeText: boolean;
}) {
  const { colors, spacing } = useTheme();
  return (
    <Surface style={{ padding: spacing.md, marginTop: spacing.sm, backgroundColor: colors.surfaceSecondary }}>
      <AppText variant="label" style={largeText ? { fontSize: 18 } : undefined}>
        {details.legalName}
      </AppText>
      <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
        {`ISIN ${details.isin}`}
      </AppText>
      <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
        {`Manager ${details.managerName}`}
      </AppText>
      {details.costs.map((cost) => (
        <View key={cost.broker} style={{ marginTop: spacing.sm }}>
          <AppText variant="bodyStrong">{cost.label}</AppText>
          <AppText variant="supporting">{cost.source}</AppText>
          {cost.minimumNote ? <AppText variant="supporting">{cost.minimumNote}</AppText> : null}
        </View>
      ))}
      {details.links.map((link) => (
        <Pressable
          key={link.url}
          accessibilityRole="link"
          accessibilityLabel={link.label}
          onPress={() => {
            if (!isAllowedSingleFundSourceUrl(link.url)) {
              return;
            }
            void Linking.openURL(link.url);
          }}
          style={{ marginTop: spacing.sm }}
        >
          <AppText variant="bodyStrong" color="accent">
            {link.label}
          </AppText>
        </Pressable>
      ))}
      {details.notes.map((note) => (
        <AppText key={note} variant="supporting" style={{ marginTop: spacing.xs }}>
          {note}
        </AppText>
      ))}
    </Surface>
  );
}

function ContributionStep({
  draft,
  onDraftChange,
  busy,
  onContinue,
}: {
  draft: CreateClubDraft;
  onDraftChange: (draft: CreateClubDraft) => void;
  busy: boolean;
  onContinue: () => void;
}) {
  const { spacing } = useTheme();
  const continueState = presentCreateClubContinue(draft);
  return (
    <View style={{ marginTop: spacing.lg }}>
      {presentCreateClubContributionOptions().map((option, index) => {
        const selected = option.value === draft.contributionMode;
        const value = option.value === 'equal' ? draft.equalAmountInput : draft.creatorFlexibleAmountInput;
        const preview =
          option.value === 'equal'
            ? presentCreateClubAmountPreview(draft.equalAmountInput)
            : presentCreateClubAmountPreview(draft.creatorFlexibleAmountInput);
        return (
          <View key={option.value} style={{ marginTop: index === 0 ? 0 : spacing.sm }}>
            <SelectableOptionCard
              title={option.title}
              description={option.description}
              selected={selected}
              disabled={busy}
              accessibilityLabel={option.title}
              onPress={() => onDraftChange({ ...draft, contributionMode: option.value })}
            >
              {selected ? (
                <View>
                  <TextField
                    label={option.amountLabel}
                    value={value}
                    onChangeText={(next) =>
                      onDraftChange(
                        option.value === 'equal'
                          ? { ...draft, equalAmountInput: next }
                          : { ...draft, creatorFlexibleAmountInput: next },
                      )
                    }
                    keyboardType="number-pad"
                    inputMode="numeric"
                    editable={!busy}
                    accessibilityLabel={option.value === 'equal' ? 'Club amount in kroner' : 'Your amount in kroner'}
                  />
                  <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
                    {preview && option.amountHint ? `${preview} ${option.amountHint}` : preview ?? option.privacy ?? option.amountHint}
                  </AppText>
                  {option.privacy && preview ? (
                    <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
                      {option.privacy}
                    </AppText>
                  ) : null}
                </View>
              ) : null}
            </SelectableOptionCard>
          </View>
        );
      })}
      <PrimaryContinue label={continueState.label} enabled={continueState.enabled && !busy} onPress={onContinue} />
    </View>
  );
}

function ReviewBlock({
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
