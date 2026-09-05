import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useClubs } from '@/features/clubs/useClubs';
import { BrokerPickerSheet } from '@/features/profile/BrokerPickerSheet';
import { openBrokerActionLabel, type PreferredBroker } from '@/features/profile/brokers';
import { useProfile } from '@/features/profile/useProfile';
import { formatNokFromMinor } from '@/lib/currency';
import { instrumentSecondaryLabel } from '@/lib/instrumentLabels';
import { BOTTOM_NAVIGATION_HEIGHT, BottomNavigation } from '@/navigation/BottomNavigation';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useTheme } from '@/theme';
import { AppText, Button, Screen } from '@/ui';

import { InvestmentRow, type InvestRowStep } from './InvestmentRow';
import {
  buildExecutionReports,
  canConfirmQuantityReports,
  confirmationModeForTargetIds,
  parseOptionalExecutionPriceInput,
  parseQuantityInput,
  quantityFieldFromRaw,
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

function rowsFromPlan(plan: InvestmentDayPlan): InvestTargetRow[] {
  return [...plan.allocations]
    .sort((left, right) => left.position - right.position)
    .map((allocation) => {
      const transaction = plan.transactions.find(
        (item) => item.investmentTargetId === allocation.investmentTargetId,
      );
      return {
        id: allocation.investmentTargetId,
        label: allocation.name,
        ticker: allocation.ticker,
        secondaryLabel: instrumentSecondaryLabel(allocation.kind, allocation.instrumentCurrency),
        allocationBps: allocation.allocationBps,
        amountMinor: transaction?.amountMinor ?? allocation.amountMinor,
        quantity: transaction?.quantity ?? null,
        executionUnitPrice: transaction?.executionUnitPrice ?? null,
      };
    });
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
  const [rowSteps, setRowSteps] = useState<Readonly<Record<string, InvestRowStep>>>({});
  const [quantityFields, setQuantityFields] = useState<Readonly<Record<string, QuantityFieldState>>>({});
  const [priceFields, setPriceFields] = useState<Readonly<Record<string, QuantityFieldState>>>({});
  const [brokerPickerOpen, setBrokerPickerOpen] = useState(false);
  const [confirmError, setConfirmError] = useState<{ cycleId: string; message: string } | null>(null);

  const targets = useMemo(() => (plan ? rowsFromPlan(plan) : []), [plan]);
  const cycleId = plan?.cycleId ?? null;
  const confirmationMode = useMemo(
    () => confirmationModeForTargetIds(targets.map((target) => target.id)),
    [targets],
  );

  const stepFor = useCallback(
    (id: string): InvestRowStep => {
      if (plan?.isCompleted) {
        return 'done';
      }
      if (!cycleId) {
        return 'not_started';
      }
      return rowSteps[`${cycleId}:${id}`] ?? 'not_started';
    },
    [cycleId, plan?.isCompleted, rowSteps],
  );

  const doneCount = targets.filter((target) => stepFor(target.id) === 'done').length;
  const allDone = targets.length > 0 && doneCount === targets.length;

  const openBroker = useCallback((id: string) => {
    if (!cycleId) {
      return;
    }
    const key = `${cycleId}:${id}`;
    setRowSteps((current) => {
      if (current[key] === 'done') {
        return current;
      }
      return { ...current, [key]: 'broker_opened' };
    });
  }, [cycleId]);

  const markDone = useCallback((id: string) => {
    if (!cycleId) {
      return;
    }
    setRowSteps((current) => ({ ...current, [`${cycleId}:${id}`]: 'done' }));
  }, [cycleId]);

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
      next[target.id] = (key && quantityFields[key]) || quantityFieldFromRaw(target.quantity ?? '');
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

  const quantityReady = canConfirmQuantityReports(
    targets.map((target) => target.id),
    quantityStateByTarget,
    priceStateByTarget,
  );

  const onConfirm = useCallback(async () => {
    if (isConfirming) {
      return;
    }
    setConfirmError(null);
    try {
      if (confirmationMode === 'quantity_required') {
        await confirm(
          buildExecutionReports(
            targets.map((target) => target.id),
            quantityStateByTarget,
            priceStateByTarget,
          ),
        );
        return;
      }
      await confirm();
    } catch (caught) {
      setConfirmError({
        cycleId: cycleId ?? '',
        message: caught instanceof Error ? caught.message : 'Unable to confirm investments right now',
      });
    }
  }, [
    confirm,
    confirmationMode,
    cycleId,
    isConfirming,
    priceStateByTarget,
    quantityStateByTarget,
    targets,
  ]);

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
            confirmationMode={confirmationMode}
            stepFor={stepFor}
            doneCount={doneCount}
            allDone={allDone}
            quantityReady={quantityReady}
            quantityStateByTarget={quantityStateByTarget}
            priceStateByTarget={priceStateByTarget}
            isConfirming={isConfirming}
            confirmError={confirmError?.cycleId === cycleId ? confirmError.message : null}
            onQuantityChange={onQuantityChange}
            onExecutionPriceChange={onExecutionPriceChange}
            onOpenBroker={openBroker}
            onMarkDone={markDone}
            onConfirm={() => {
              void onConfirm();
            }}
            onChooseBroker={() => setBrokerPickerOpen(true)}
          />
        ) : plan ? (
          <CompletedBody
            plan={plan}
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
  preferredBroker,
  confirmationMode,
  stepFor,
  doneCount,
  allDone,
  quantityReady,
  quantityStateByTarget,
  priceStateByTarget,
  isConfirming,
  confirmError,
  onQuantityChange,
  onExecutionPriceChange,
  onOpenBroker,
  onMarkDone,
  onConfirm,
  onChooseBroker,
}: {
  plan: InvestmentDayPlan;
  targets: InvestTargetRow[];
  preferredBroker: PreferredBroker | null;
  confirmationMode: 'quantity_required' | 'amount_only';
  stepFor: (id: string) => InvestRowStep;
  doneCount: number;
  allDone: boolean;
  quantityReady: boolean;
  quantityStateByTarget: Readonly<Record<string, QuantityFieldState>>;
  priceStateByTarget: Readonly<Record<string, QuantityFieldState>>;
  isConfirming: boolean;
  confirmError: string | null;
  onQuantityChange: (id: string, value: string) => void;
  onExecutionPriceChange: (id: string, value: string) => void;
  onOpenBroker: (id: string) => void;
  onMarkDone: (id: string) => void;
  onConfirm: () => void;
  onChooseBroker: () => void;
}) {
  const { spacing } = useTheme();
  const hasBroker = preferredBroker !== null;
  const canConfirm = confirmationMode === 'quantity_required' ? quantityReady : allDone;

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

      {confirmationMode === 'quantity_required' ? (
        <AppText variant="body" color="secondary" style={{ marginBottom: spacing.sm }}>
          Enter the number of units you purchased. You can find this in your broker after the trade
          has completed.
        </AppText>
      ) : null}

      <Breakdown
        targets={targets}
        preferredBroker={preferredBroker}
        showActions={confirmationMode === 'quantity_required' || hasBroker}
        confirmationMode={confirmationMode}
        quantityStateByTarget={quantityStateByTarget}
        priceStateByTarget={priceStateByTarget}
        stepFor={stepFor}
        onQuantityChange={onQuantityChange}
        onExecutionPriceChange={onExecutionPriceChange}
        onOpenBroker={onOpenBroker}
        onMarkDone={onMarkDone}
      />

      {hasBroker || confirmationMode === 'quantity_required' ? null : (
        <View style={{ marginTop: spacing.xl }}>
          <AppText variant="bodyStrong">Choose a broker to continue</AppText>
          <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
            Select your preferred broker before opening an investment.
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
          {confirmationMode === 'quantity_required'
            ? quantityReady
              ? `${targets.length} of ${targets.length} quantities entered`
              : 'Enter units purchased for every ETF'
            : `${doneCount} of ${targets.length} completed`}
        </AppText>
        <AppText variant="meta" color="secondary" style={{ marginTop: spacing.sm }}>
          Reported by you. This does not mean Vesty placed the trade. Broker verification is not
          available yet.
        </AppText>
        {confirmError ? (
          <AppText variant="meta" color="negative" style={{ marginTop: spacing.sm }} accessibilityLiveRegion="polite">
            {confirmError}
          </AppText>
        ) : null}
        <View style={{ marginTop: spacing.lg }}>
          <Button
            label={isConfirming ? 'Confirming…' : 'Confirm investments'}
            variant="primary"
            block
            disabled={!canConfirm || isConfirming}
            busy={isConfirming}
            onPress={onConfirm}
            accessibilityHint={
              canConfirm
                ? 'Saves the units you purchased. This is not broker verification.'
                : confirmationMode === 'quantity_required'
                  ? 'Available after you enter units purchased for every ETF'
                  : 'Available after every investment is marked as done'
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
  onViewActivity,
}: {
  plan: InvestmentDayPlan;
  targets: InvestTargetRow[];
  onViewActivity: () => void;
}) {
  const { spacing } = useTheme();
  const reportedTotal = plan.transactions.reduce((sum, item) => sum + item.amountMinor, 0);
  const displayTotal = reportedTotal > 0 ? reportedTotal : plan.expectedAmountMinor;

  return (
    <View>
      <AppText variant="sectionTitle">Investment Day complete</AppText>
      <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
        {plan.clubName}
        {'  \u00B7  '}
        {formatInvestmentDayShortLabel(plan.investmentDayAt)}
      </AppText>

      <AppText variant="display" style={{ marginTop: spacing.lg }}>
        {formatNokFromMinor(displayTotal)}
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
        reported invested
      </AppText>

      <AppText variant="meta" color="positive" style={{ marginTop: spacing.md }}>
        {targets.length} of {targets.length} investments completed
      </AppText>

      <AppText variant="sectionTitle" style={{ marginTop: spacing.xxl, marginBottom: spacing.sm }}>
        Reported investments
      </AppText>

      <Breakdown
        targets={targets}
        preferredBroker={null}
        showActions={false}
        confirmationMode={confirmationModeForTargetIds(targets.map((target) => target.id))}
        quantityStateByTarget={{}}
        priceStateByTarget={{}}
        stepFor={() => 'done'}
        onQuantityChange={() => undefined}
        onExecutionPriceChange={() => undefined}
        onOpenBroker={() => undefined}
        onMarkDone={() => undefined}
      />

      <AppText variant="meta" color="secondary" style={{ marginTop: spacing.lg }}>
        Reported by you. Broker verification is not available yet.
      </AppText>

      <View style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
        <Button label="View activity" variant="secondary" onPress={onViewActivity} />
      </View>
    </View>
  );
}

function Breakdown({
  targets,
  preferredBroker,
  showActions,
  confirmationMode,
  quantityStateByTarget,
  priceStateByTarget,
  stepFor,
  onQuantityChange,
  onExecutionPriceChange,
  onOpenBroker,
  onMarkDone,
}: {
  targets: InvestTargetRow[];
  preferredBroker: PreferredBroker | null;
  showActions: boolean;
  confirmationMode: 'quantity_required' | 'amount_only';
  quantityStateByTarget: Readonly<Record<string, QuantityFieldState>>;
  priceStateByTarget: Readonly<Record<string, QuantityFieldState>>;
  stepFor: (id: string) => InvestRowStep;
  onQuantityChange: (id: string, value: string) => void;
  onExecutionPriceChange: (id: string, value: string) => void;
  onOpenBroker: (id: string) => void;
  onMarkDone: (id: string) => void;
}) {
  const { colors } = useTheme();
  const brokerActionLabel = preferredBroker ? openBrokerActionLabel(preferredBroker) : 'Choose broker';

  return (
    <View>
      {targets.map((target, index) => (
        <InvestmentRow
          key={target.id}
          target={target}
          color={colors.chart[index % colors.chart.length]}
          brokerActionLabel={brokerActionLabel}
          step={stepFor(target.id)}
          showActions={showActions}
          showSeparator={index > 0}
          confirmationMode={confirmationMode}
          quantityValue={quantityStateByTarget[target.id]?.raw ?? ''}
          quantityError={quantityStateByTarget[target.id]?.error ?? null}
          executionPriceValue={priceStateByTarget[target.id]?.raw ?? ''}
          executionPriceError={priceStateByTarget[target.id]?.error ?? null}
          onQuantityChange={(value) => onQuantityChange(target.id, value)}
          onExecutionPriceChange={(value) => onExecutionPriceChange(target.id, value)}
          onOpenBroker={() => onOpenBroker(target.id)}
          onMarkDone={() => onMarkDone(target.id)}
        />
      ))}
    </View>
  );
}
