import { useState } from 'react';
import { Keyboard, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { AppText, Button, VestyMark } from '@/ui';

import { CreateClubAmountControl } from './CreateClubAmountControl';
import { CreateClubCatalogPanel } from './CreateClubCatalogPanel';
import { CreateClubChoice } from './CreateClubChoice';
import { CreateClubChrome } from './CreateClubChrome';
import { CreateClubFundCard } from './CreateClubFundCard';
import { CreateClubIntro } from './CreateClubIntro';
import { CreateClubLeaveSheet } from './CreateClubLeaveSheet';
import { CreateClubFooterNote, CreateClubPrimaryBar, CreateClubStickyFooter } from './CreateClubPrimaryBar';
import { CreateClubReviewSummary } from './CreateClubReviewSummary';
import { CreateClubSuccess } from './CreateClubSuccess';
import { presentCreateClubConflict, presentCreateClubSubmit, type CreateClubSubmitState } from './createClubSubmission';
import {
  advanceCreateClubStep,
  canContinueCreateClub,
  previousCreateClubStep,
  selectCreateClubMode,
  type CreateClubDraft,
} from './createClubWizard';
import { CLUB_NAME_MAX_LENGTH } from './genesisStrategy';
import {
  presentCreateClubAmountPreview,
  presentCreateClubContinue,
  presentCreateClubContributionOptions,
  presentCreateClubGovernanceOptions,
} from './presentCreateClub';
import {
  applyCreateClubAmountPreset,
  presentCreateClubCloseControl,
  presentCreateClubMoneyPlanNote,
  presentCreateClubNameBackTarget,
  presentCreateClubPhase,
  type CreateClubPhase,
  type CreateClubSuccessModel,
} from './presentCreateClubFlow';
import { presentCreateClubReviewAgreement, presentGroupTypeOptions } from './presentSingleFund';
import {
  findSingleFundProduct,
  type CatalogLoadState,
  type SingleFundProduct,
} from './singleFundCatalog';

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
  onSaveAndLeave?: () => void;
  fundDetailOpen?: boolean;
  onFundDetailOpenChange?: (open: boolean) => void;
  onLeave: () => void;
  leaveSheetOpen?: boolean;
  compact?: boolean;
  largeText?: boolean;
  phase?: CreateClubPhase;
  introVisible?: boolean;
  introDismissed?: boolean;
  onStartClub?: () => void;
  onReturnToIntro?: () => void;
  success?: CreateClubSuccessModel | null;
  onInviteMembers?: () => void;
  onGoToClub?: () => void;
  reduceMotion?: boolean;
  playCelebration?: boolean;
  embedded?: boolean;
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
  onSaveAndLeave,
  fundDetailOpen = false,
  onFundDetailOpenChange,
  onLeave,
  leaveSheetOpen = false,
  compact = false,
  phase,
  introVisible,
  introDismissed = false,
  onStartClub,
  onReturnToIntro,
  success = null,
  onInviteMembers,
  onGoToClub,
  reduceMotion = false,
  playCelebration = false,
  embedded = false,
}: CreateClubJourneyProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const resolvedPhase =
    phase ??
    presentCreateClubPhase({
      introVisible,
      introDismissed,
      draft,
      success,
      submitState,
    });
  const continueState = presentCreateClubContinue(draft, products, catalogState);
  const submit = presentCreateClubSubmit(submitState);
  const selectedProduct = findSingleFundProduct(products, draft.catalogProductId);
  const review =
    draft.step === 'review' && selectedProduct && draft.contributionMode
      ? presentCreateClubReviewAgreement(draft, selectedProduct)
      : null;
  const busy = submitState === 'loading';
  const continueEnabled = continueState.enabled && !busy;
  const [leaveOpen, setLeaveOpen] = useState(leaveSheetOpen);
  const closeControl = presentCreateClubCloseControl({
    phase: resolvedPhase,
    submitState,
  });

  const requestClose = () => {
    if (closeControl.action === 'hidden' || closeControl.action === 'blocked') {
      return;
    }
    if (closeControl.action === 'leave') {
      onLeave();
      return;
    }
    Keyboard.dismiss();
    setLeaveOpen(true);
  };

  const keepCreating = () => {
    setLeaveOpen(false);
  };

  const goBack = () => {
    if (busy || resolvedPhase === 'success') {
      return;
    }
    if (resolvedPhase === 'intro') {
      onLeave();
      return;
    }
    const previous = previousCreateClubStep(draft.step);
    if (previous) {
      onDraftChange({ ...draft, step: previous });
      return;
    }
    if (presentCreateClubNameBackTarget({ introDismissed, draft }) === 'intro') {
      onReturnToIntro?.();
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

  if (resolvedPhase === 'intro') {
    return (
      <View style={{ flex: 1, width: '100%', maxWidth: compact ? 375 : undefined, alignSelf: compact ? 'center' : undefined }}>
        <CreateClubIntro
          onStart={() => onStartClub?.()}
          onClose={requestClose}
          closeDisabled={closeControl.disabled}
          embedded={embedded}
        />
      </View>
    );
  }

  if (resolvedPhase === 'success' && success) {
    return (
      <View style={{ flex: 1, width: '100%', maxWidth: compact ? 375 : undefined, alignSelf: compact ? 'center' : undefined }}>
        <CreateClubSuccess
          success={success}
          celebrate={playCelebration && !reduceMotion}
          onInvite={() => onInviteMembers?.()}
          onGoToClub={() => onGoToClub?.()}
          embedded={embedded}
        />
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        width: '100%',
        maxWidth: compact ? 375 : undefined,
        alignSelf: compact ? 'center' : undefined,
        backgroundColor: colors.background,
        paddingTop: (embedded ? 0 : insets.top) + spacing.sm,
        paddingHorizontal: spacing.lg,
      }}
    >
      <CreateClubChrome
        step={draft.step}
        onBack={goBack}
        onClose={requestClose}
        backDisabled={busy}
        closeDisabled={closeControl.disabled}
        closeAccessibilityLabel={closeControl.accessibilityLabel}
        closeAccessibilityHint={closeControl.accessibilityHint}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {draft.step === 'name' ? <NameStep draft={draft} onDraftChange={onDraftChange} busy={busy} /> : null}
        {draft.step === 'mode' ? <ModeStep draft={draft} onDraftChange={onDraftChange} busy={busy} /> : null}
        {draft.step === 'fund' ? (
          <FundStep
            draft={draft}
            onDraftChange={onDraftChange}
            products={products}
            catalogState={catalogState}
            catalogMessage={catalogMessage}
            onRetryCatalog={onRetryCatalog}
            fundDetailOpen={fundDetailOpen}
            onFundDetailOpenChange={onFundDetailOpenChange}
            busy={busy}
          />
        ) : null}
        {draft.step === 'contribution' ? (
          <ContributionStep draft={draft} onDraftChange={onDraftChange} busy={busy} />
        ) : null}
        {draft.step === 'governance' ? (
          <GovernanceStep draft={draft} onDraftChange={onDraftChange} busy={busy} />
        ) : null}
        {draft.step === 'review' && review ? (
          <ReviewStep review={review} submit={submit} submitMessage={submitMessage} />
        ) : null}
      </ScrollView>
      <CreateClubStickyFooter>
        {draft.step === 'review' && submit.showConflictActions ? (
          <View style={{ gap: spacing.sm }}>
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
        ) : draft.step === 'review' ? (
          <>
            <CreateClubPrimaryBar
              label={submit.label}
              enabled={!submit.disabled && continueState.enabled}
              busy={submit.busy}
              onPress={onSubmit}
            />
            <CreateClubFooterNote>No payment. This is the start of a shared habit.</CreateClubFooterNote>
          </>
        ) : (
          <CreateClubPrimaryBar
            label={continueState.label}
            enabled={continueEnabled}
            busy={busy}
            onPress={goNext}
          />
        )}
      </CreateClubStickyFooter>
      <View style={{ height: insets.bottom + spacing.sm }} />
      <CreateClubLeaveSheet
        visible={leaveOpen}
        onSaveAndLeave={() => {
          setLeaveOpen(false);
          if (onSaveAndLeave) {
            onSaveAndLeave();
            return;
          }
          onLeave();
        }}
        onDiscardSetup={() => {
          setLeaveOpen(false);
          onDiscardSetup?.();
        }}
        onKeepCreating={keepCreating}
      />
    </View>
  );
}

function NameStep({
  draft,
  onDraftChange,
  busy,
}: {
  draft: CreateClubDraft;
  onDraftChange: (draft: CreateClubDraft) => void;
  busy: boolean;
}) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View>
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 28,
          backgroundColor: colors.mintSoft,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'center',
          marginBottom: spacing.xl,
        }}
      >
        <VestyMark color={colors.accentDeep} height={36} />
      </View>
      <AppText variant="label">Club name</AppText>
      <TextInput
        value={draft.name}
        onChangeText={(name) => onDraftChange({ ...draft, name })}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={CLUB_NAME_MAX_LENGTH}
        editable={!busy}
        accessibilityLabel="Club name"
        placeholder="Friday Club"
        placeholderTextColor={colors.textSecondary}
        returnKeyType="done"
        blurOnSubmit
        style={[
          typography.title,
          {
            marginTop: spacing.sm,
            paddingVertical: spacing.md,
            color: colors.textPrimary,
            borderBottomWidth: 2,
            borderBottomColor: colors.border,
          },
        ]}
      />
    </View>
  );
}

function ModeStep({
  draft,
  onDraftChange,
  busy,
}: {
  draft: CreateClubDraft;
  onDraftChange: (draft: CreateClubDraft) => void;
  busy: boolean;
}) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      {presentGroupTypeOptions(draft.mode).map((option) => (
        <CreateClubChoice
          key={option.value}
          title={option.title}
          description={option.description}
          selected={option.selected}
          locked={option.locked}
          lockReason={option.lockReason}
          accessibilityLabel={option.accessibilityLabel}
          disabled={busy}
          onPress={() => onDraftChange(selectCreateClubMode(draft, option.value))}
        >
          {option.facts.length > 0 ? (
            <AppText variant="supporting" style={{ marginTop: spacing.sm }}>
              {option.facts.join(' · ')}
            </AppText>
          ) : null}
          {option.selected && option.expanded ? (
            <AppText variant="supporting" style={{ marginTop: spacing.sm }}>
              {option.expanded}
            </AppText>
          ) : null}
        </CreateClubChoice>
      ))}
    </View>
  );
}

function FundStep({
  draft,
  onDraftChange,
  products,
  catalogState,
  catalogMessage,
  onRetryCatalog,
  fundDetailOpen,
  onFundDetailOpenChange,
  busy,
}: {
  draft: CreateClubDraft;
  onDraftChange: (draft: CreateClubDraft) => void;
  products: readonly SingleFundProduct[];
  catalogState: CatalogLoadState;
  catalogMessage?: string | null;
  onRetryCatalog?: () => void;
  fundDetailOpen: boolean;
  onFundDetailOpenChange?: (open: boolean) => void;
  busy: boolean;
}) {
  const { spacing } = useTheme();

  return (
    <View>
      <CreateClubCatalogPanel state={catalogState} message={catalogMessage} onRetry={onRetryCatalog} />
      {catalogState === 'ready'
        ? products.map((product) => (
            <View key={product.id} style={{ marginBottom: spacing.md }}>
              <CreateClubFundCard
                product={product}
                selected={product.id === draft.catalogProductId}
                detailOpen={product.id === draft.catalogProductId && fundDetailOpen}
                disabled={busy || product.status !== 'active'}
                onSelect={() =>
                  onDraftChange({
                    ...draft,
                    catalogProductId: product.id === draft.catalogProductId ? null : product.id,
                  })
                }
                onToggleDetails={() => onFundDetailOpenChange?.(!fundDetailOpen)}
              />
            </View>
          ))
        : null}
    </View>
  );
}

function ContributionStep({
  draft,
  onDraftChange,
  busy,
}: {
  draft: CreateClubDraft;
  onDraftChange: (draft: CreateClubDraft) => void;
  busy: boolean;
}) {
  const { spacing } = useTheme();
  const selected = presentCreateClubContributionOptions().find((option) => option.value === draft.contributionMode);
  const amountValue =
    draft.contributionMode === 'equal' ? draft.equalAmountInput : draft.creatorFlexibleAmountInput;
  const preview = amountValue ? presentCreateClubAmountPreview(amountValue) : null;

  return (
    <View>
      <View style={{ gap: spacing.sm }}>
        {presentCreateClubContributionOptions().map((option) => (
          <CreateClubChoice
            key={option.value}
            title={option.title}
            description={option.description}
            selected={option.value === draft.contributionMode}
            disabled={busy}
            onPress={() => onDraftChange({ ...draft, contributionMode: option.value })}
          />
        ))}
      </View>
      {selected ? (
        <View style={{ marginTop: spacing.xl }}>
          <CreateClubAmountControl
            label={selected.amountLabel}
            value={amountValue}
            onChangeText={(next) =>
              onDraftChange(
                selected.value === 'equal'
                  ? { ...draft, equalAmountInput: next }
                  : { ...draft, creatorFlexibleAmountInput: next },
              )
            }
            onApplyPreset={(input) => onDraftChange(applyCreateClubAmountPreset({ ...draft, contributionMode: selected.value }, input))}
            accessibilityLabel={selected.value === 'equal' ? 'Club amount in kroner' : 'Your amount in kroner'}
            editable={!busy}
          />
          {selected.privacy ? (
            <AppText variant="supporting" style={{ marginTop: spacing.md }}>
              {selected.privacy}
            </AppText>
          ) : null}
          {selected.amountHint && preview ? (
            <AppText variant="supporting" style={{ marginTop: spacing.sm }}>
              {`${preview} ${selected.amountHint}`}
            </AppText>
          ) : null}
          <AppText variant="supporting" style={{ marginTop: spacing.lg }}>
            {presentCreateClubMoneyPlanNote()}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function GovernanceStep({
  draft,
  onDraftChange,
  busy,
}: {
  draft: CreateClubDraft;
  onDraftChange: (draft: CreateClubDraft) => void;
  busy: boolean;
}) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      {presentCreateClubGovernanceOptions().map((option) => (
        <CreateClubChoice
          key={option.value}
          title={option.title}
          description={option.description}
          selected={option.value === draft.governance}
          disabled={busy}
          onPress={() => onDraftChange({ ...draft, governance: option.value })}
        />
      ))}
    </View>
  );
}

function ReviewStep({
  review,
  submit,
  submitMessage,
}: {
  review: ReturnType<typeof presentCreateClubReviewAgreement>;
  submit: ReturnType<typeof presentCreateClubSubmit>;
  submitMessage?: string | null;
}) {
  const { spacing } = useTheme();

  return (
    <View>
      <CreateClubReviewSummary review={review} />
      {submitMessage || submit.message ? (
        <AppText variant="meta" color="negative" style={{ marginTop: spacing.md }} accessibilityLiveRegion="polite">
          {submitMessage ?? submit.message}
        </AppText>
      ) : null}
    </View>
  );
}
