import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FlexibleContributionForm } from '@/features/clubs/FlexibleContributionForm';
import { useClubContribution } from '@/features/clubs/useClubContribution';
import { useClubs } from '@/features/clubs/useClubs';
import { BrokerPickerSheet } from '@/features/profile/BrokerPickerSheet';
import { openBrokerActionLabel, type PreferredBroker } from '@/features/profile/brokers';
import { useProfile } from '@/features/profile/useProfile';
import { formatNokFromMinor } from '@/lib/currency';
import { BOTTOM_NAVIGATION_HEIGHT, BottomNavigation } from '@/navigation/BottomNavigation';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useTheme } from '@/theme';
import { AppText, Button, Screen } from '@/ui';

import { asAmountProvenance } from './amountProvenance';
import { InvestmentDayParticipationSection } from './InvestmentDayParticipation';
import { InvestmentDayReportPanel } from './InvestmentDayReportPanel';
import { InvestmentRow } from './InvestmentRow';
import { rowsFromPlan } from './investRows';
import {
  buildAsPlannedPurchaseLines,
  buildWithChangesPurchaseLines,
  canSubmitAsPlanned,
  canSubmitWithChanges,
  parseReportedPurchaseKronerInput,
  showOptionalExecutionFields,
  sumReportedAmountMinor,
  type InvestmentDayReportChoice,
  type ReportedAmountField,
} from './investmentDayReport';
import {
  parseOptionalExecutionPriceInput,
  parseOptionalQuantityInput,
  quantityFieldFromRaw,
  type QuantityFieldState,
} from './investmentDayReporting';
import { isReportConflictError } from './investErrors';
import {
  presentCompletedAmountCaption,
  presentCompletedHeadline,
  presentPendingBanner,
  type InvestmentDayReportSubmitState,
} from './presentInvestmentDayReport';
import type { InvestmentDayPlan, InvestTargetRow } from './types';
import { useInvestmentDay } from './useInvestmentDay';
import { useInvestmentDayParticipation } from './useInvestmentDayParticipation';

function formatInvestmentDayShortLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Today';
  }
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date);
}

/**
 * Invest answers: what do I need to do with my investments this cycle?
 * Completion comes from a member report, not from opening a broker.
 */
export function InvestScreen() {
  const { colorScheme, colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeTab, onSelectTab } = useAppNavigation('invest');
  const { profile } = useProfile();
  const { selectedClub, isLoading: clubsLoading } = useClubs();
  const preferredBroker = profile?.preferredBroker ?? null;
  const selectedClubId = selectedClub?.clubId ?? null;
  const { plan, isLoading, error, setupRequired, isReporting, refresh, report } = useInvestmentDay(
    selectedClubId,
  );
  const contribution = useClubContribution(selectedClubId);
  const participation = useInvestmentDayParticipation(
    selectedClub?.clubId ?? null,
    plan?.cycleId ?? null,
  );
  const [brokerOpened, setBrokerOpened] = useState<string | null>(null);
  const [pendingCycleId, setPendingCycleId] = useState<string | null>(null);
  const [brokerPickerOpen, setBrokerPickerOpen] = useState(false);
  const [choice, setChoice] = useState<InvestmentDayReportChoice>('as_planned');
  const [submitState, setSubmitState] = useState<InvestmentDayReportSubmitState>('idle');
  const [reportError, setReportError] = useState<{ cycleId: string; message: string } | null>(null);
  const [amountFields, setAmountFields] = useState<Readonly<Record<string, ReportedAmountField>>>({});
  const [quantityFields, setQuantityFields] = useState<Readonly<Record<string, QuantityFieldState>>>({});
  const [priceFields, setPriceFields] = useState<Readonly<Record<string, QuantityFieldState>>>({});
  const [reportStarted, setReportStarted] = useState<string | null>(null);

  const targets = useMemo(() => (plan ? rowsFromPlan(plan) : []), [plan]);
  const cycleId = plan?.cycleId ?? null;
  const targetIds = targets.map((target) => target.id);

  const fieldKey = useCallback(
    (id: string): string | null => (cycleId ? `${cycleId}:${id}` : null),
    [cycleId],
  );

  const onAmountChange = useCallback(
    (id: string, value: string) => {
      const key = fieldKey(id);
      if (!key) {
        return;
      }
      setAmountFields((current) => ({
        ...current,
        [key]: parseReportedPurchaseKronerInput(value),
      }));
    },
    [fieldKey],
  );

  const onQuantityChange = useCallback(
    (id: string, value: string) => {
      const key = fieldKey(id);
      if (!key) {
        return;
      }
      setQuantityFields((current) => ({
        ...current,
        [key]: parseOptionalQuantityInput(value),
      }));
    },
    [fieldKey],
  );

  const onExecutionPriceChange = useCallback(
    (id: string, value: string) => {
      const key = fieldKey(id);
      if (!key) {
        return;
      }
      setPriceFields((current) => ({
        ...current,
        [key]: parseOptionalExecutionPriceInput(value),
      }));
    },
    [fieldKey],
  );

  const amountStateByTarget = useMemo(() => {
    const next: Record<string, ReportedAmountField> = {};
    for (const target of targets) {
      const key = fieldKey(target.id);
      next[target.id] = (key && amountFields[key]) || parseReportedPurchaseKronerInput('');
    }
    return next;
  }, [amountFields, fieldKey, targets]);

  const quantityStateByTarget = useMemo(() => {
    const next: Record<string, QuantityFieldState> = {};
    for (const target of targets) {
      const key = fieldKey(target.id);
      next[target.id] = (key && quantityFields[key]) || quantityFieldFromRaw('');
    }
    return next;
  }, [fieldKey, quantityFields, targets]);

  const priceStateByTarget = useMemo(() => {
    const next: Record<string, QuantityFieldState> = {};
    for (const target of targets) {
      const key = fieldKey(target.id);
      next[target.id] = (key && priceFields[key]) || quantityFieldFromRaw('');
    }
    return next;
  }, [fieldKey, priceFields, targets]);

  const reportedTotalMinor = sumReportedAmountMinor(amountStateByTarget, targetIds);
  const optionalReady = showOptionalExecutionFields(targetIds);
  const canSubmit = choice === 'pending' || choice === 'skipped'
    || (choice === 'as_planned' && canSubmitAsPlanned(targetIds, quantityStateByTarget, priceStateByTarget))
    || (choice === 'with_changes' && canSubmitWithChanges(
      targetIds,
      amountStateByTarget,
      quantityStateByTarget,
      priceStateByTarget,
    ));

  const onOpenBroker = useCallback(() => {
    if (!cycleId) {
      return;
    }
    setBrokerOpened(cycleId);
    setPendingCycleId((current) => (current === cycleId ? null : current));
  }, [cycleId]);

  const onStartReport = useCallback(() => {
    if (!cycleId) {
      return;
    }
    setReportStarted(cycleId);
    setPendingCycleId((current) => (current === cycleId ? null : current));
  }, [cycleId]);

  const onSubmitReport = useCallback(async () => {
    if (isReporting || !cycleId) {
      return;
    }
    if (choice === 'pending') {
      setPendingCycleId(cycleId);
      setSubmitState('idle');
      setReportError(null);
      return;
    }

    setReportError(null);
    setSubmitState('loading');
    try {
      await report({
        reportMode: choice === 'skipped' ? 'with_changes' : choice,
        outcome: choice === 'skipped' ? 'skipped' : 'confirmed',
        purchaseLines: choice === 'as_planned'
          ? buildAsPlannedPurchaseLines(targetIds, quantityStateByTarget, priceStateByTarget)
          : choice === 'with_changes'
            ? buildWithChangesPurchaseLines(
              targetIds,
              amountStateByTarget,
              quantityStateByTarget,
              priceStateByTarget,
            )
            : [],
      });
      setSubmitState('success');
      await participation.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to save this Investment Day report';
      if (isReportConflictError(caught)) {
        setSubmitState('conflict');
      } else if (message === 'Unable to save this Investment Day report') {
        setSubmitState('timeout');
      } else {
        setSubmitState('idle');
      }
      setReportError({
        cycleId,
        message,
      });
    }
  }, [
    amountStateByTarget,
    choice,
    cycleId,
    isReporting,
    participation,
    priceStateByTarget,
    quantityStateByTarget,
    report,
    targetIds,
  ]);

  const showReport = Boolean(plan && !plan.isCompleted && reportStarted === cycleId && pendingCycleId !== cycleId);
  const showPending = Boolean(plan && !plan.isCompleted && pendingCycleId === cycleId);
  const phase = plan?.isCompleted ? 'completed' : showPending ? 'pending' : showReport ? 'report' : 'today';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <Screen
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: BOTTOM_NAVIGATION_HEIGHT + insets.bottom + spacing.xxl,
        }}
      >
        <AppText variant="title" accessibilityRole="header" style={{ marginTop: spacing.md, marginBottom: spacing.lg }}>
          Invest
        </AppText>

        {clubsLoading || (selectedClub && isLoading && !plan) ? (
          <View style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator accessibilityLabel="Loading Investment Day" color={colors.accent} />
          </View>
        ) : !selectedClub ? (
          <AppText variant="body" color="secondary">
            Create or join a club to record an Investment Day.
          </AppText>
        ) : selectedClub && setupRequired && !plan ? (
          <View>
            <AppText variant="title" accessibilityRole="header">
              Set your contribution
            </AppText>
            <View style={{ marginTop: spacing.lg }}>
              <FlexibleContributionForm
                submitLabel="Set amount"
                onSubmit={async (amountMinor) => {
                  await contribution.saveFlexibleAmount(amountMinor);
                  await refresh();
                }}
              />
            </View>
          </View>
        ) : error && !plan ? (
          <View>
            <AppText variant="body" color="secondary">
              {error}
            </AppText>
            <View style={{ marginTop: spacing.lg }}>
              <Button
                label="Try again"
                variant="secondary"
                onPress={() => {
                  void refresh();
                }}
              />
            </View>
          </View>
        ) : plan && phase === 'today' ? (
          <TodayBody
            participation={participation.participation}
            plan={plan}
            targets={targets}
            preferredBroker={preferredBroker}
            brokerOpened={brokerOpened === cycleId}
            onOpenBroker={onOpenBroker}
            onStartReport={onStartReport}
            onChooseBroker={() => setBrokerPickerOpen(true)}
          />
        ) : plan && phase === 'pending' ? (
          <PendingBody
            plan={plan}
            onReportNow={() => {
              if (cycleId) {
                setReportStarted(cycleId);
              }
              setPendingCycleId(null);
            }}
          />
        ) : plan && phase === 'report' ? (
          <ReportBody
            plan={plan}
            participation={participation.participation}
            targets={targets}
            choice={choice}
            amountFields={amountStateByTarget}
            quantityFields={quantityStateByTarget}
            priceFields={priceStateByTarget}
            showOptionalExecution={optionalReady}
            reportedTotalMinor={reportedTotalMinor}
            canSubmit={canSubmit && !isReporting}
            submitState={isReporting ? 'loading' : submitState}
            error={reportError?.cycleId === cycleId ? reportError.message : null}
            onChoiceChange={(next) => {
              setChoice(next);
              if (submitState !== 'loading') {
                setSubmitState('idle');
              }
            }}
            onAmountChange={onAmountChange}
            onQuantityChange={onQuantityChange}
            onPriceChange={onExecutionPriceChange}
            onSubmit={() => {
              void onSubmitReport();
            }}
          />
        ) : plan ? (
          <CompletedBody
            plan={plan}
            participation={participation.participation}
            targets={targets}
            onViewActivity={() => onSelectTab('activity')}
          />
        ) : null}
      </Screen>

      <BottomNavigation activeTab={activeTab} onSelectTab={onSelectTab} />
      <BrokerPickerSheet visible={brokerPickerOpen} onClose={() => setBrokerPickerOpen(false)} />
    </View>
  );
}

function TodayBody({
  plan,
  targets,
  participation,
  preferredBroker,
  brokerOpened,
  onOpenBroker,
  onStartReport,
  onChooseBroker,
}: {
  plan: InvestmentDayPlan;
  targets: InvestTargetRow[];
  participation: ReturnType<typeof useInvestmentDayParticipation>['participation'];
  preferredBroker: PreferredBroker | null;
  brokerOpened: boolean;
  onOpenBroker: () => void;
  onStartReport: () => void;
  onChooseBroker: () => void;
}) {
  const { spacing } = useTheme();
  const hasBroker = preferredBroker !== null;

  return (
    <View>
      <AppText variant="sectionTitle">Investment Day</AppText>
      <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
        {plan.clubName}
        {'  \u00B7  '}
        {formatInvestmentDayShortLabel(plan.investmentDayAt)}
      </AppText>

      {participation ? (
        <View style={{ marginTop: spacing.xl }}>
          <InvestmentDayParticipationSection
            completedCount={participation.completedCount}
            totalCount={participation.totalCount}
            allCompleted={participation.allCompleted}
            members={participation.members}
          />
        </View>
      ) : null}

      <AppText variant="display" style={{ marginTop: spacing.lg }}>
        {formatNokFromMinor(plan.expectedAmountMinor)}
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
        planned for today
      </AppText>

      <AppText variant="sectionTitle" style={{ marginTop: spacing.xxl, marginBottom: spacing.sm }}>
        Your investments
      </AppText>

      <Breakdown targets={targets} />

      {hasBroker ? (
        <View style={{ marginTop: spacing.xl }}>
          <Button
            label={openBrokerActionLabel(preferredBroker)}
            variant={brokerOpened ? 'secondary' : 'primary'}
            block
            onPress={onOpenBroker}
            accessibilityHint="Opens your broker. This does not save your Investment Day."
          />
          {brokerOpened ? (
            <AppText variant="meta" color="secondary" style={{ marginTop: spacing.sm }}>
              Come back here when the order is placed, then report what actually happened.
            </AppText>
          ) : null}
          <View style={{ marginTop: spacing.md }}>
            <Button
              label={brokerOpened ? "I'm back — report what happened" : 'Report this Investment Day'}
              variant={brokerOpened ? 'primary' : 'secondary'}
              block
              onPress={onStartReport}
              accessibilityHint="Opens the report. Opening a broker never saves purchases."
            />
          </View>
        </View>
      ) : (
        <View style={{ marginTop: spacing.xl }}>
          <AppText variant="bodyStrong">Choose a broker to continue</AppText>
          <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
            Select your broker before you open it from Vesty. You can still report a skip without a broker.
          </AppText>
          <View style={{ marginTop: spacing.md }}>
            <Button
              label="Choose broker"
              variant="secondary"
              onPress={onChooseBroker}
              accessibilityHint="Opens broker selection. Investment Day stays readable."
            />
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Button
              label="Report this Investment Day"
              variant="secondary"
              block
              onPress={onStartReport}
              accessibilityHint="Opens the report without saving anything yet."
            />
          </View>
        </View>
      )}
    </View>
  );
}

function ReportBody({
  plan,
  participation,
  targets,
  choice,
  amountFields,
  quantityFields,
  priceFields,
  showOptionalExecution,
  reportedTotalMinor,
  canSubmit,
  submitState,
  error,
  onChoiceChange,
  onAmountChange,
  onQuantityChange,
  onPriceChange,
  onSubmit,
}: {
  plan: InvestmentDayPlan;
  participation: ReturnType<typeof useInvestmentDayParticipation>['participation'];
  targets: InvestTargetRow[];
  choice: InvestmentDayReportChoice;
  amountFields: Readonly<Record<string, ReportedAmountField>>;
  quantityFields: Readonly<Record<string, QuantityFieldState>>;
  priceFields: Readonly<Record<string, QuantityFieldState>>;
  showOptionalExecution: boolean;
  reportedTotalMinor: number;
  canSubmit: boolean;
  submitState: InvestmentDayReportSubmitState;
  error: string | null;
  onChoiceChange: (choice: InvestmentDayReportChoice) => void;
  onAmountChange: (id: string, value: string) => void;
  onQuantityChange: (id: string, value: string) => void;
  onPriceChange: (id: string, value: string) => void;
  onSubmit: () => void;
}) {
  const { spacing } = useTheme();

  return (
    <View>
      <AppText variant="sectionTitle">Back from your broker</AppText>
      <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
        {plan.clubName}
        {'  \u00B7  '}
        {formatInvestmentDayShortLabel(plan.investmentDayAt)}
      </AppText>

      {participation ? (
        <View style={{ marginTop: spacing.xl }}>
          <InvestmentDayParticipationSection
            completedCount={participation.completedCount}
            totalCount={participation.totalCount}
            allCompleted={participation.allCompleted}
            members={participation.members}
          />
        </View>
      ) : null}

      <View style={{ marginTop: spacing.xl }}>
        <InvestmentDayReportPanel
          expectedAmountMinor={plan.expectedAmountMinor}
          targets={targets}
          choice={choice}
          amountFields={amountFields}
          quantityFields={quantityFields}
          priceFields={priceFields}
          showOptionalExecution={showOptionalExecution}
          reportedTotalMinor={reportedTotalMinor}
          canSubmit={canSubmit}
          submitState={submitState}
          error={error}
          onChoiceChange={onChoiceChange}
          onAmountChange={onAmountChange}
          onQuantityChange={onQuantityChange}
          onPriceChange={onPriceChange}
          onSubmit={onSubmit}
        />
      </View>
    </View>
  );
}

function PendingBody({
  plan,
  onReportNow,
}: {
  plan: InvestmentDayPlan;
  onReportNow: () => void;
}) {
  const { spacing } = useTheme();
  const banner = presentPendingBanner();

  return (
    <View>
      <AppText variant="sectionTitle">{banner.title}</AppText>
      <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
        {plan.clubName}
        {'  \u00B7  '}
        {formatInvestmentDayShortLabel(plan.investmentDayAt)}
      </AppText>
      <AppText variant="body" style={{ marginTop: spacing.lg }}>
        {banner.body}
      </AppText>
      <View style={{ marginTop: spacing.xl }}>
        <Button
          label="Report now"
          variant="primary"
          block
          onPress={onReportNow}
          accessibilityHint="Opens the Investment Day report. Nothing has been saved yet."
        />
      </View>
    </View>
  );
}

function CompletedBody({
  plan,
  participation,
  targets,
  onViewActivity,
}: {
  plan: InvestmentDayPlan;
  participation: ReturnType<typeof useInvestmentDayParticipation>['participation'];
  targets: InvestTargetRow[];
  onViewActivity: () => void;
}) {
  const { spacing } = useTheme();
  const reportedTotal = plan.transactions.reduce((sum, item) => sum + item.amountMinor, 0);
  const provenance = asAmountProvenance(plan.transactions[0]?.amountProvenance);
  const purchased = targets.filter((target) => target.amountMinor > 0);

  return (
    <View>
      <AppText variant="sectionTitle">{presentCompletedHeadline(plan.participationOutcome)}</AppText>
      <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
        {plan.clubName}
        {'  \u00B7  '}
        {formatInvestmentDayShortLabel(plan.investmentDayAt)}
      </AppText>

      {participation ? (
        <View style={{ marginTop: spacing.xl }}>
          <InvestmentDayParticipationSection
            completedCount={participation.completedCount}
            totalCount={participation.totalCount}
            allCompleted={participation.allCompleted}
            members={participation.members}
          />
        </View>
      ) : null}

      {plan.participationOutcome === 'confirmed' ? (
        <>
          <AppText variant="display" style={{ marginTop: spacing.lg }}>
            {formatNokFromMinor(reportedTotal)}
          </AppText>
          <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
            {presentCompletedAmountCaption(plan.participationOutcome, provenance)}
          </AppText>
          <AppText variant="sectionTitle" style={{ marginTop: spacing.xxl, marginBottom: spacing.sm }}>
            Your purchases
          </AppText>
          <View>
            {purchased.length === 0 ? (
              <AppText variant="body" color="secondary">No purchase rows were stored.</AppText>
            ) : purchased.map((target) => (
              <AppText key={target.id} variant="body" style={{ marginTop: 6 }}>
                {target.ticker ?? target.exposureLabel ?? target.label}
                {'  \u00B7  '}
                {formatNokFromMinor(target.amountMinor)}
                {target.quantity ? `  ·  ${target.quantity} units` : ''}
              </AppText>
            ))}
          </View>
        </>
      ) : (
        <AppText variant="body" color="secondary" style={{ marginTop: spacing.lg }}>
          {presentCompletedAmountCaption(plan.participationOutcome, provenance)}
        </AppText>
      )}

      <View style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
        <Button label="View activity" variant="secondary" onPress={onViewActivity} />
      </View>
    </View>
  );
}

function Breakdown({ targets }: { targets: InvestTargetRow[] }) {
  const { colors } = useTheme();

  return (
    <View>
      {targets.map((target, index) => (
        <InvestmentRow
          key={target.id}
          target={target}
          color={colors.chart[index % colors.chart.length]}
          brokerActionLabel="Open broker"
          showBrokerAction={false}
          showSeparator={index > 0}
          onOpenBroker={() => undefined}
        />
      ))}
    </View>
  );
}
