import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useClubs } from '@/features/clubs/useClubs';
import { BrokerPickerSheet } from '@/features/profile/BrokerPickerSheet';
import { openBrokerActionLabel, type PreferredBroker } from '@/features/profile/brokers';
import { useProfile } from '@/features/profile/useProfile';
import { formatNokFromMinor } from '@/lib/currency';
import { BOTTOM_NAVIGATION_HEIGHT, BottomNavigation } from '@/navigation/BottomNavigation';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useTheme } from '@/theme';
import { AppText, Button, Screen } from '@/ui';

import { ExactHoldingsForm } from './ExactHoldingsForm';
import { rowsFromPlan } from './investRows';
import {
  canAddExactHoldings,
  shouldShowExactHoldingsForm,
} from './holdingConfidence';
import { InvestmentRow } from './InvestmentRow';
import {
  buildExecutionReports,
  canConfirmQuantityReports,
  parseOptionalExecutionPriceInput,
  parseQuantityInput,
  planHasMissingQuantity,
  quantityFieldFromRaw,
  supportsExactHoldings,
  type QuantityFieldState,
} from './investmentDayReporting';
import type { InvestmentDayPlan, InvestTargetRow } from './types';
import { useInvestmentDay } from './useInvestmentDay';

function formatInvestmentDayShortLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Today';
  }
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date);
}

/**
 * Invest answers: what do I need to do with my investments this cycle?
 * Completion comes from persisted member-reported transactions, not local demo state.
 */
export function InvestScreen() {
  const { colorScheme, colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeTab, onSelectTab } = useAppNavigation('invest');
  const { profile } = useProfile();
  const { selectedClub, isLoading: clubsLoading } = useClubs();
  const preferredBroker = profile?.preferredBroker ?? null;
  const { plan, isLoading, error, isConfirming, refresh, confirm } = useInvestmentDay(
    selectedClub?.clubId ?? null,
  );
  const [brokerOpened, setBrokerOpened] = useState<string | null>(null);
  const [brokerPickerOpen, setBrokerPickerOpen] = useState(false);
  const [confirmError, setConfirmError] = useState<{ cycleId: string; message: string } | null>(null);
  const [exactHoldingsOpen, setExactHoldingsOpen] = useState(false);
  const [quantityFields, setQuantityFields] = useState<Readonly<Record<string, QuantityFieldState>>>({});
  const [priceFields, setPriceFields] = useState<Readonly<Record<string, QuantityFieldState>>>({});

  const targets = useMemo(() => (plan ? rowsFromPlan(plan) : []), [plan]);
  const cycleId = plan?.cycleId ?? null;
  const canReportExact = supportsExactHoldings(targets.map((target) => target.id));
  const missingQuantity = plan
    ? planHasMissingQuantity(plan.transactions, plan.allocations.length)
    : false;
  const showExactCta = canAddExactHoldings({
    isCompleted: Boolean(plan?.isCompleted),
    supportsExactHoldings: canReportExact,
    missingQuantity,
  });
  const showExactForm = shouldShowExactHoldingsForm({
    isCompleted: Boolean(plan?.isCompleted),
    supportsExactHoldings: canReportExact,
    missingQuantity,
    exactHoldingsOpen,
  });

  const fieldKey = useCallback(
    (id: string): string | null => (cycleId ? `${cycleId}:${id}` : null),
    [cycleId],
  );

  const onQuantityChange = useCallback(
    (id: string, value: string) => {
      const key = fieldKey(id);
      if (!key) {
        return;
      }
      const parsed = parseQuantityInput(value);
      setQuantityFields((current) => ({
        ...current,
        [key]: {
          ...parsed,
          error: value.trim() === '' ? null : parsed.error,
        },
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

  const quantityStateByTarget = useMemo(() => {
    const next: Record<string, QuantityFieldState> = {};
    for (const target of targets) {
      const key = fieldKey(target.id);
      next[target.id] = (key && quantityFields[key])
        || (target.quantity ? parseQuantityInput(target.quantity) : quantityFieldFromRaw(''));
    }
    return next;
  }, [fieldKey, quantityFields, targets]);

  const priceStateByTarget = useMemo(() => {
    const next: Record<string, QuantityFieldState> = {};
    for (const target of targets) {
      const key = fieldKey(target.id);
      next[target.id] = (key && priceFields[key]) || quantityFieldFromRaw(target.executionUnitPrice ?? '');
    }
    return next;
  }, [fieldKey, priceFields, targets]);

  const exactHoldingsReady = canConfirmQuantityReports(
    targets.map((target) => target.id),
    quantityStateByTarget,
    priceStateByTarget,
  );

  const onOpenBroker = useCallback(() => {
    if (!cycleId) {
      return;
    }
    setBrokerOpened(cycleId);
  }, [cycleId]);

  const onConfirm = useCallback(async () => {
    if (isConfirming) {
      return;
    }
    setConfirmError(null);
    try {
      await confirm();
    } catch (caught) {
      setConfirmError({
        cycleId: cycleId ?? '',
        message: caught instanceof Error ? caught.message : 'Unable to confirm investments right now',
      });
    }
  }, [confirm, cycleId, isConfirming]);

  const onSaveExactHoldings = useCallback(async () => {
    if (isConfirming) {
      return;
    }
    setConfirmError(null);
    try {
      await confirm(
        buildExecutionReports(
          targets.map((target) => target.id),
          quantityStateByTarget,
          priceStateByTarget,
        ),
      );
      setExactHoldingsOpen(false);
    } catch (caught) {
      setConfirmError({
        cycleId: cycleId ?? '',
        message: caught instanceof Error ? caught.message : 'Unable to save exact holdings right now',
      });
    }
  }, [confirm, cycleId, isConfirming, priceStateByTarget, quantityStateByTarget, targets]);

  const phase = plan?.isCompleted ? 'completed' : 'today';

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
            plan={plan}
            targets={targets}
            preferredBroker={preferredBroker}
            brokerOpened={brokerOpened === cycleId}
            isConfirming={isConfirming}
            confirmError={confirmError?.cycleId === cycleId ? confirmError.message : null}
            onOpenBroker={onOpenBroker}
            onConfirm={() => {
              void onConfirm();
            }}
            onChooseBroker={() => setBrokerPickerOpen(true)}
          />
        ) : plan ? (
          <CompletedBody
            plan={plan}
            targets={targets}
            showExactCta={showExactCta}
            showExactForm={showExactForm}
            quantityStateByTarget={quantityStateByTarget}
            priceStateByTarget={priceStateByTarget}
            exactHoldingsReady={exactHoldingsReady}
            isSaving={isConfirming}
            exactHoldingsError={confirmError?.cycleId === cycleId ? confirmError.message : null}
            onOpenExactHoldings={() => setExactHoldingsOpen(true)}
            onQuantityChange={onQuantityChange}
            onExecutionPriceChange={onExecutionPriceChange}
            onSaveExactHoldings={() => {
              void onSaveExactHoldings();
            }}
            onCancelExactHoldings={() => setExactHoldingsOpen(false)}
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
  preferredBroker,
  brokerOpened,
  isConfirming,
  confirmError,
  onOpenBroker,
  onConfirm,
  onChooseBroker,
}: {
  plan: InvestmentDayPlan;
  targets: InvestTargetRow[];
  preferredBroker: PreferredBroker | null;
  brokerOpened: boolean;
  isConfirming: boolean;
  confirmError: string | null;
  onOpenBroker: () => void;
  onConfirm: () => void;
  onChooseBroker: () => void;
}) {
  const { spacing } = useTheme();
  const hasBroker = preferredBroker !== null;
  const canConfirm = hasBroker && !isConfirming;

  return (
    <View>
      <AppText variant="sectionTitle">Investment Day</AppText>
      <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
        {plan.clubName}
        {'  \u00B7  '}
        {formatInvestmentDayShortLabel(plan.investmentDayAt)}
      </AppText>

      <AppText variant="display" style={{ marginTop: spacing.lg }}>
        {formatNokFromMinor(plan.expectedAmountMinor)}
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
        to invest today
      </AppText>

      <AppText variant="sectionTitle" style={{ marginTop: spacing.xxl, marginBottom: spacing.sm }}>
        Your investments
      </AppText>

      <Breakdown targets={targets} />

      {hasBroker ? (
        <View style={{ marginTop: spacing.xl }}>
          <Button
            label={openBrokerActionLabel(preferredBroker)}
            variant="secondary"
            block
            onPress={onOpenBroker}
            accessibilityHint="Opens your broker. This does not save your Investment Day."
          />
          {brokerOpened ? (
            <AppText variant="meta" color="secondary" style={{ marginTop: spacing.sm }}>
              Come back here when you are done.
            </AppText>
          ) : null}
        </View>
      ) : (
        <View style={{ marginTop: spacing.xl }}>
          <AppText variant="bodyStrong">Choose a broker to continue</AppText>
          <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
            Select your broker before you open it from Vesty.
          </AppText>
          <View style={{ marginTop: spacing.md }}>
            <Button
              label="Choose broker"
              variant="secondary"
              onPress={onChooseBroker}
              accessibilityHint="Opens broker selection. Investment Day stays readable."
            />
          </View>
        </View>
      )}

      <View style={{ marginTop: spacing.xxl, paddingBottom: spacing.lg }}>
        <AppText variant="meta" color="secondary">
          Reported by you.
        </AppText>
        {confirmError ? (
          <AppText variant="meta" color="negative" style={{ marginTop: spacing.sm }} accessibilityLiveRegion="polite">
            {confirmError}
          </AppText>
        ) : null}
        <View style={{ marginTop: spacing.lg }}>
          <Button
            label={isConfirming ? 'Saving…' : "I've invested"}
            variant="primary"
            block
            disabled={!canConfirm}
            busy={isConfirming}
            onPress={onConfirm}
            accessibilityHint={
              canConfirm
                ? "Saves that you invested today's planned amount. Opening a broker does not do this."
                : 'Choose a broker first'
            }
          />
        </View>
      </View>
    </View>
  );
}

function CompletedBody({
  plan,
  targets,
  showExactCta,
  showExactForm,
  quantityStateByTarget,
  priceStateByTarget,
  exactHoldingsReady,
  isSaving,
  exactHoldingsError,
  onOpenExactHoldings,
  onQuantityChange,
  onExecutionPriceChange,
  onSaveExactHoldings,
  onCancelExactHoldings,
  onViewActivity,
}: {
  plan: InvestmentDayPlan;
  targets: InvestTargetRow[];
  showExactCta: boolean;
  showExactForm: boolean;
  quantityStateByTarget: Readonly<Record<string, QuantityFieldState>>;
  priceStateByTarget: Readonly<Record<string, QuantityFieldState>>;
  exactHoldingsReady: boolean;
  isSaving: boolean;
  exactHoldingsError: string | null;
  onOpenExactHoldings: () => void;
  onQuantityChange: (id: string, value: string) => void;
  onExecutionPriceChange: (id: string, value: string) => void;
  onSaveExactHoldings: () => void;
  onCancelExactHoldings: () => void;
  onViewActivity: () => void;
}) {
  const { spacing } = useTheme();
  const reportedTotal = plan.transactions.reduce((sum, item) => sum + item.amountMinor, 0);
  const displayTotal = reportedTotal > 0 ? reportedTotal : plan.expectedAmountMinor;

  return (
    <View>
      <AppText variant="sectionTitle">Investment complete</AppText>
      <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
        {plan.clubName}
        {'  \u00B7  '}
        {formatInvestmentDayShortLabel(plan.investmentDayAt)}
      </AppText>

      <AppText variant="display" style={{ marginTop: spacing.lg }}>
        {formatNokFromMinor(displayTotal)}
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
        reported
      </AppText>

      <AppText variant="sectionTitle" style={{ marginTop: spacing.xxl, marginBottom: spacing.sm }}>
        Your investments
      </AppText>

      <View>
        {targets.map((target) => (
          <AppText key={target.id} variant="body" style={{ marginTop: 6 }}>
            {target.ticker ?? target.exposureLabel ?? target.label}
            {'  \u00B7  '}
            {formatNokFromMinor(target.amountMinor)}
          </AppText>
        ))}
      </View>

      {showExactForm ? (
        <View style={{ marginTop: spacing.xxl }}>
          <ExactHoldingsForm
            targets={targets}
            quantityStateByTarget={quantityStateByTarget}
            priceStateByTarget={priceStateByTarget}
            canSave={exactHoldingsReady}
            isSaving={isSaving}
            error={exactHoldingsError}
            onQuantityChange={onQuantityChange}
            onExecutionPriceChange={onExecutionPriceChange}
            onSave={onSaveExactHoldings}
            onCancel={onCancelExactHoldings}
          />
        </View>
      ) : showExactCta ? (
        <View style={{ marginTop: spacing.xl }}>
          <Button
            label="Add exact holdings"
            variant="secondary"
            onPress={onOpenExactHoldings}
            accessibilityHint="Optional. Add the number of units you bought."
          />
        </View>
      ) : null}

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
