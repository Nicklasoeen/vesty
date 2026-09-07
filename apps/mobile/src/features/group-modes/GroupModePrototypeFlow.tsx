import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { CORE_V1_TARGETS } from '@/features/clubs/curatedInvestmentPackages';
import { GOVERNANCE_OPTIONS } from '@/features/clubs/governance';
import { presentCreateClubContributionOptions } from '@/features/clubs/presentCreateClub';
import { useTheme } from '@/theme';
import {
  AllocationBar,
  AppText,
  Button,
  InvestmentIdentity,
  SelectableOptionCard,
  Surface,
  TextField,
} from '@/ui';

import {
  INITIAL_GROUP_MODE_DRAFT,
  STOREBRAND_FUND_CANDIDATE,
  nextGroupModeStep,
  previousGroupModeStep,
  prototypeCanContinue,
  selectGroupMode,
  setCustomAllocationPercent,
  toggleCustomTarget,
  type CatalogState,
  type GroupModeDraft,
  type PrototypeSubmitState,
} from './groupModePrototype';
import {
  presentCustomAllocation,
  presentFundBroker,
  presentGroupModeOptions,
  presentGroupModeStep,
  presentPrototypeReview,
} from './presentGroupModePrototype';

interface GroupModePrototypeFlowProps {
  initialDraft?: GroupModeDraft;
  catalogState?: CatalogState;
  submitState?: PrototypeSubmitState;
  fundDetailInitiallyOpen?: boolean;
  compact?: boolean;
  largeText?: boolean;
  onRetryCatalog?: () => void;
}

export function GroupModePrototypeFlow({
  initialDraft = INITIAL_GROUP_MODE_DRAFT,
  catalogState = 'ready',
  submitState = 'idle',
  fundDetailInitiallyOpen = false,
  compact = false,
  largeText = false,
  onRetryCatalog,
}: GroupModePrototypeFlowProps) {
  const { spacing } = useTheme();
  const [draft, setDraft] = useState(initialDraft);
  const [fundDetailOpen, setFundDetailOpen] = useState(fundDetailInitiallyOpen);
  const [localSubmitState, setLocalSubmitState] = useState(submitState);
  const step = presentGroupModeStep(draft.step);
  const canContinue = prototypeCanContinue(draft, catalogState);

  const goBack = () => {
    const previous = previousGroupModeStep(draft.step);
    if (previous) {
      setDraft((current) => ({ ...current, step: previous }));
    }
  };

  const goNext = () => {
    if (canContinue) {
      setDraft((current) => ({ ...current, step: nextGroupModeStep(current.step) }));
    }
  };

  return (
    <View style={{ width: '100%', maxWidth: compact ? 390 : 620, alignSelf: 'center' }}>
      <PrototypeStepHeader
        eyebrow={step.eyebrow}
        progressLabel={step.progressLabel}
        onBack={goBack}
        backDisabled={draft.step === 'name'}
      />
      <View style={{ marginTop: spacing.md }}>
        <AppText
          variant="hero"
          numberOfLines={largeText ? undefined : 3}
          style={largeText ? { fontSize: 38, lineHeight: 46 } : undefined}
        >
          {step.title}
        </AppText>
        <AppText
          variant="supporting"
          style={{
            marginTop: spacing.xs,
            ...(largeText ? { fontSize: 22, lineHeight: 30 } : null),
          }}
        >
          {step.supporting}
        </AppText>
      </View>

      {draft.step === 'name' ? (
        <View style={{ marginTop: spacing.xl }}>
          <TextField
            label="Club name"
            value={draft.clubName}
            onChangeText={(clubName) => setDraft((current) => ({ ...current, clubName }))}
            autoCapitalize="words"
            accessibilityLabel="Club name"
          />
          <PrimaryContinue enabled={canContinue} onPress={goNext} />
        </View>
      ) : null}

      {draft.step === 'mode' ? (
        <View style={{ marginTop: spacing.lg }}>
          {presentGroupModeOptions(draft.mode).map((option, index) => (
            <View key={option.value} style={{ marginTop: index === 0 ? 0 : spacing.sm }}>
              <SelectableOptionCard
                title={option.title}
                description={option.description}
                selected={option.selected}
                onPress={() => setDraft((current) => selectGroupMode(current, option.value))}
              >
                <View style={{ gap: 4 }}>
                  {option.facts.map((fact) => (
                    <AppText key={fact} variant="supporting">{`• ${fact}`}</AppText>
                  ))}
                  {option.selected ? (
                    <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
                      {option.expanded}
                    </AppText>
                  ) : null}
                </View>
              </SelectableOptionCard>
            </View>
          ))}
          <PrimaryContinue enabled={canContinue} onPress={goNext} />
        </View>
      ) : null}

      {draft.step === 'investment' ? (
        <View style={{ marginTop: spacing.lg }}>
          <CatalogStatePanel state={catalogState} onRetry={onRetryCatalog} />
          {catalogState === 'ready' && draft.mode === 'simple_saving' ? (
            <SimpleFundChoice
              draft={draft}
              detailOpen={fundDetailOpen}
              onToggleDetail={() => setFundDetailOpen((open) => !open)}
              onChange={(next) => setDraft(next)}
            />
          ) : null}
          {catalogState === 'ready' && draft.mode === 'custom_strategy' ? (
            <CustomStrategyChoice draft={draft} onChange={setDraft} />
          ) : null}
          <PrimaryContinue enabled={canContinue} onPress={goNext} />
        </View>
      ) : null}

      {draft.step === 'contribution' ? (
        <ContributionChoice draft={draft} onChange={setDraft} onContinue={goNext} />
      ) : null}

      {draft.step === 'governance' ? (
        <View style={{ marginTop: spacing.lg }}>
          {GOVERNANCE_OPTIONS.map((option, index) => (
            <View key={option.value} style={{ marginTop: index === 0 ? 0 : spacing.sm }}>
              <SelectableOptionCard
                title={option.label}
                description={option.description}
                selected={draft.governance === option.value}
                onPress={() =>
                  setDraft((current) => ({ ...current, governance: option.value }))
                }
              />
            </View>
          ))}
          <PrimaryContinue enabled onPress={goNext} />
        </View>
      ) : null}

      {draft.step === 'review' ? (
        <PrototypeReview
          draft={draft}
          submitState={localSubmitState}
          onSubmit={() => setLocalSubmitState('success')}
        />
      ) : null}

      <AppText variant="meta" color="secondary" style={{ marginTop: spacing.xl }}>
        Development-only visual prototype · no data is sent
      </AppText>
      <View style={{ height: spacing.xxl }} />
    </View>
  );
}

function PrototypeStepHeader({
  eyebrow,
  progressLabel,
  onBack,
  backDisabled,
}: {
  eyebrow: string;
  progressLabel: string;
  onBack: () => void;
  backDisabled: boolean;
}) {
  const { colors, spacing } = useTheme();
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        disabled={backDisabled}
        onPress={onBack}
        hitSlop={10}
        style={({ pressed }) => ({
          marginTop: spacing.md,
          alignSelf: 'flex-start',
          opacity: backDisabled ? 0.4 : pressed ? 0.7 : 1,
        })}
      >
        <Feather name="chevron-left" size={24} color={colors.textPrimary} />
      </Pressable>
      <View
        style={{
          marginTop: spacing.md,
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <AppText variant="label">{eyebrow}</AppText>
        <AppText variant="supporting">{progressLabel}</AppText>
      </View>
    </View>
  );
}

function PrimaryContinue({ enabled, onPress }: { enabled: boolean; onPress: () => void }) {
  const { spacing } = useTheme();
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Button label="Continue" variant="primary" block disabled={!enabled} onPress={onPress} />
    </View>
  );
}

function CatalogStatePanel({
  state,
  onRetry,
}: {
  state: CatalogState;
  onRetry?: () => void;
}) {
  const { colors, spacing } = useTheme();
  if (state === 'ready') {
    return null;
  }
  if (state === 'loading') {
    return (
      <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
        <ActivityIndicator accessibilityLabel="Loading investment catalog" color={colors.accent} />
        <AppText variant="supporting" style={{ marginTop: spacing.sm }}>
          Loading checked investments…
        </AppText>
      </View>
    );
  }
  const copy = {
    empty: ['No checked choices yet', 'There are no verified choices for this setup.'],
    error: ['Catalog unavailable', 'We could not load the checked investment catalog.'],
    unavailable: ['Fund unavailable', 'This candidate cannot be selected for a new club right now.'],
  }[state];
  return (
    <Surface bordered style={{ padding: spacing.md }}>
      <AppText variant="bodyStrong">{copy[0]}</AppText>
      <AppText variant="supporting" style={{ marginTop: spacing.xs }}>{copy[1]}</AppText>
      {state === 'error' && onRetry ? (
        <View style={{ marginTop: spacing.md }}>
          <Button label="Try again" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </Surface>
  );
}

function SimpleFundChoice({
  draft,
  detailOpen,
  onToggleDetail,
  onChange,
}: {
  draft: GroupModeDraft;
  detailOpen: boolean;
  onToggleDetail: () => void;
  onChange: (draft: GroupModeDraft) => void;
}) {
  const { colors, spacing } = useTheme();
  const broker = presentFundBroker(draft.brokerPreference);
  return (
    <View>
      <SelectableOptionCard
        title={STOREBRAND_FUND_CANDIDATE.friendlyName}
        description={STOREBRAND_FUND_CANDIDATE.description}
        caption="One monthly purchase · Risk 4/7 · 6+ years"
        selected={draft.simpleFundSelected}
        onPress={() => onChange({ ...draft, simpleFundSelected: !draft.simpleFundSelected })}
      >
        <AppText variant="meta" color="negative">
          {STOREBRAND_FUND_CANDIDATE.candidateNotice}
        </AppText>
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <AppText variant="label">Preferred broker</AppText>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {(['dnb', 'nordnet', 'unknown'] as const).map((preference) => (
              <Pressable
                key={preference}
                accessibilityRole="radio"
                accessibilityState={{ selected: draft.brokerPreference === preference }}
                onPress={() => onChange({ ...draft, brokerPreference: preference })}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderWidth: draft.brokerPreference === preference ? 2 : 1,
                  borderColor:
                    draft.brokerPreference === preference ? colors.accent : colors.border,
                  borderRadius: 999,
                }}
              >
                <AppText variant="meta">
                  {preference === 'dnb' ? 'DNB' : preference === 'nordnet' ? 'Nordnet' : 'Not sure'}
                </AppText>
              </Pressable>
            ))}
          </View>
          <AppText variant="bodyStrong">{broker.cost}</AppText>
          <AppText variant="supporting">{broker.availability}</AppText>
          <AppText variant="meta" color="secondary">
            {`Checked ${STOREBRAND_FUND_CANDIDATE.checkedDate}`}
          </AppText>
          <Pressable accessibilityRole="button" onPress={onToggleDetail}>
            <AppText variant="bodyStrong" color="accent">
              {detailOpen ? 'Hide fund details' : 'View fund details'}
            </AppText>
          </Pressable>
          {detailOpen ? (
            <Surface style={{ padding: spacing.md, backgroundColor: colors.surfaceSecondary }}>
              <AppText variant="label">{STOREBRAND_FUND_CANDIDATE.legalName}</AppText>
              <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
                {`ISIN ${STOREBRAND_FUND_CANDIDATE.isin}`}
              </AppText>
              <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
                Global equity fund including emerging markets · NOK · minimum 100 kr at DNB
              </AppText>
              <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
                The value can fall. This is an equity fund intended for at least six years.
              </AppText>
              <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
                Value unavailable · Vesty does not yet have an approved NAV source for this fund.
              </AppText>
            </Surface>
          ) : null}
        </View>
      </SelectableOptionCard>
    </View>
  );
}

function CustomStrategyChoice({
  draft,
  onChange,
}: {
  draft: GroupModeDraft;
  onChange: (draft: GroupModeDraft) => void;
}) {
  const { colors, spacing } = useTheme();
  const presentation = presentCustomAllocation(draft);
  return (
    <View>
      <AppText variant="label">{presentation.selectedCountLabel}</AppText>
      <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
        {CORE_V1_TARGETS.map((target) => {
          const selected = draft.customAllocations.some((item) => item.targetId === target.id);
          return (
            <Pressable
              key={target.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() =>
                onChange({
                  ...draft,
                  customAllocations: toggleCustomTarget(draft.customAllocations, target.id),
                })
              }
              style={{
                padding: spacing.md,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? colors.accent : colors.border,
                borderRadius: 12,
                backgroundColor: selected ? colors.mintSoft : colors.surface,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <InvestmentIdentity
                  ticker={target.ticker}
                  friendlyName={target.exposureLabel}
                  fallbackInitials={target.ticker.slice(0, 2)}
                  size={36}
                  markOnly
                />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <AppText variant="bodyStrong">{`${target.ticker} · ${target.exposureLabel}`}</AppText>
                  <AppText variant="supporting">{`ETF · ${target.exchange} · ${target.currency}`}</AppText>
                </View>
                <AppText variant="meta" color={selected ? 'accent' : 'secondary'}>
                  {selected ? 'Selected' : 'Select'}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>

      {presentation.rows.length > 0 ? (
        <View style={{ marginTop: spacing.xl }}>
          <AppText variant="subtitle">Set target percentages</AppText>
          <AppText
            variant="bodyStrong"
            color={presentation.status === 'valid' ? 'positive' : 'negative'}
            style={{ marginTop: spacing.sm }}
          >
            {`${presentation.totalPercent}% total`}
          </AppText>
          <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
            {presentation.message}
          </AppText>
          <View style={{ marginTop: spacing.md, gap: spacing.md }}>
            {presentation.rows.map((row) => (
              <View key={row.targetId}>
                <TextField
                  label={`${row.ticker} percentage`}
                  value={String(row.percent)}
                  onChangeText={(value) =>
                    onChange({
                      ...draft,
                      customAllocations: setCustomAllocationPercent(
                        draft.customAllocations,
                        row.targetId,
                        Number(value),
                      ),
                    })
                  }
                  keyboardType="number-pad"
                  inputMode="numeric"
                />
              </View>
            ))}
          </View>
          {presentation.totalPercent > 0 ? (
            <View style={{ marginTop: spacing.md }}>
              <AllocationBar
                showLegend={false}
                allocations={presentation.rows.map((row) => ({
                  id: row.targetId,
                  label: row.name,
                  ticker: row.ticker,
                  percentage: row.percent,
                }))}
              />
            </View>
          ) : null}
          <AppText variant="supporting" style={{ marginTop: spacing.md }}>
            {presentation.executionNote}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function ContributionChoice({
  draft,
  onChange,
  onContinue,
}: {
  draft: GroupModeDraft;
  onChange: (draft: GroupModeDraft) => void;
  onContinue: () => void;
}) {
  const { spacing } = useTheme();
  return (
    <View style={{ marginTop: spacing.lg }}>
      {presentCreateClubContributionOptions().map((option, index) => {
        const selected = option.value === draft.contributionMode;
        const value =
          option.value === 'equal' ? draft.equalAmountInput : draft.flexibleAmountInput;
        return (
          <View key={option.value} style={{ marginTop: index === 0 ? 0 : spacing.sm }}>
            <SelectableOptionCard
              title={option.title}
              description={option.description}
              selected={selected}
              onPress={() => onChange({ ...draft, contributionMode: option.value })}
            >
              {selected ? (
                <View>
                  <TextField
                    label={option.amountLabel}
                    value={value}
                    onChangeText={(next) =>
                      onChange(
                        option.value === 'equal'
                          ? { ...draft, equalAmountInput: next }
                          : { ...draft, flexibleAmountInput: next },
                      )
                    }
                    keyboardType="number-pad"
                    inputMode="numeric"
                  />
                  <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
                    {option.value === 'equal'
                      ? 'Shared with members · per month'
                      : 'Only you can see your amount.'}
                  </AppText>
                </View>
              ) : null}
            </SelectableOptionCard>
          </View>
        );
      })}
      <PrimaryContinue
        enabled={prototypeCanContinue(draft, 'ready')}
        onPress={onContinue}
      />
    </View>
  );
}

function PrototypeReview({
  draft,
  submitState,
  onSubmit,
}: {
  draft: GroupModeDraft;
  submitState: PrototypeSubmitState;
  onSubmit: () => void;
}) {
  const { colors, spacing } = useTheme();
  const review = presentPrototypeReview(draft);
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Surface bordered elevated style={{ padding: spacing.lg }}>
        <AppText variant="label">Ready to review</AppText>
        <AppText variant="title" style={{ marginTop: spacing.xs }}>{review.clubName}</AppText>
        <ReviewBlock label="Group type" value={review.groupType} />
        <ReviewBlock
          label="Investment choice"
          value={review.investment.title}
          details={[review.investment.detail, ...review.investment.lines]}
        />
        <ReviewBlock
          label="Monthly contribution"
          value={review.contribution.title}
          details={[review.contribution.detail, review.contribution.privacy]}
        />
        <ReviewBlock label="How decisions are made" value={review.governance} />
        <Surface style={{ padding: spacing.md, marginTop: spacing.lg, backgroundColor: colors.surfaceSecondary }}>
          <AppText variant="bodyStrong">What happens next</AppText>
          <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
            {review.ownership}
          </AppText>
        </Surface>
        <AppText variant="meta" color="negative" style={{ marginTop: spacing.lg }}>
          {review.prototypeNotice}
        </AppText>
        {submitState === 'error' ? (
          <AppText variant="supporting" color="negative" style={{ marginTop: spacing.sm }}>
            Prototype preview failed. Your choices are still here.
          </AppText>
        ) : null}
        {submitState === 'success' ? (
          <AppText variant="bodyStrong" color="positive" style={{ marginTop: spacing.sm }}>
            Review complete — no club was created.
          </AppText>
        ) : null}
        <View style={{ marginTop: spacing.lg }}>
          <Button
            label={
              submitState === 'loading'
                ? 'Checking review…'
                : submitState === 'success'
                  ? 'Review complete'
                  : 'Complete prototype review'
            }
            variant="primary"
            block
            busy={submitState === 'loading'}
            disabled={submitState === 'loading' || submitState === 'success'}
            onPress={onSubmit}
          />
        </View>
      </Surface>
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
    <View style={{ marginTop: spacing.lg }}>
      <AppText variant="label">{label}</AppText>
      <AppText variant="subtitle" style={{ marginTop: 3 }}>{value}</AppText>
      {details.map((detail) => (
        <AppText key={detail} variant="supporting" style={{ marginTop: spacing.xs }}>
          {detail}
        </AppText>
      ))}
    </View>
  );
}
