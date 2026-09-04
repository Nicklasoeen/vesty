import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  INVEST_DEMO_DEFAULT_PHASE,
  investPlanDemo,
  type InvestFlowPhase,
  type InvestPlanDemo,
} from '@/demo/investDemoData';
import { formatNok } from '@/lib/currency';
import { BOTTOM_NAVIGATION_HEIGHT, BottomNavigation } from '@/navigation/BottomNavigation';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useTheme } from '@/theme';
import { AppText, Button, Screen } from '@/ui';
import { InvestmentRow, type InvestRowStep } from './InvestmentRow';

/**
 * Invest answers: what do I need to do with my investments this cycle?
 * Three phases of one flow — upcoming, today, completed — not three screens.
 */
export function InvestScreen() {
  const { colorScheme, colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeTab, onSelectTab } = useAppNavigation('invest');
  const plan = investPlanDemo;
  const [rowSteps, setRowSteps] = useState<Readonly<Record<string, InvestRowStep>>>(() =>
    initialRowSteps(plan),
  );
  const [confirmed, setConfirmed] = useState(false);

  const phase: InvestFlowPhase = useMemo(() => {
    if (INVEST_DEMO_DEFAULT_PHASE === 'today' && confirmed) {
      return 'completed';
    }
    return INVEST_DEMO_DEFAULT_PHASE;
  }, [confirmed]);

  const stepFor = useCallback(
    (id: string): InvestRowStep => rowSteps[id] ?? 'not_started',
    [rowSteps],
  );

  const doneCount = plan.targets.filter((target) => stepFor(target.id) === 'done').length;
  const allDone = doneCount === plan.targets.length;

  const openBroker = useCallback((id: string) => {
    setRowSteps((current) => {
      if (current[id] === 'done') {
        return current;
      }
      return { ...current, [id]: 'broker_opened' };
    });
  }, []);

  const markDone = useCallback((id: string) => {
    setRowSteps((current) => ({ ...current, [id]: 'done' }));
  }, []);

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

        {phase === 'upcoming' ? <UpcomingBody plan={plan} /> : null}

        {phase === 'today' ? (
          <TodayBody
            plan={plan}
            stepFor={stepFor}
            doneCount={doneCount}
            allDone={allDone}
            onOpenBroker={openBroker}
            onMarkDone={markDone}
            onConfirm={() => setConfirmed(true)}
          />
        ) : null}

        {phase === 'completed' ? (
          <CompletedBody plan={plan} onViewActivity={() => onSelectTab('activity')} />
        ) : null}
      </Screen>

      <BottomNavigation activeTab={activeTab} onSelectTab={onSelectTab} />
    </View>
  );
}

function initialRowSteps(plan: InvestPlanDemo): Record<string, InvestRowStep> {
  const steps: Record<string, InvestRowStep> = {};
  for (const target of plan.targets) {
    steps[target.id] = 'not_started';
  }
  return steps;
}

function UpcomingBody({ plan }: { plan: InvestPlanDemo }) {
  const { spacing } = useTheme();

  return (
    <View>
      <AppText variant="sectionTitle">Next Investment Day</AppText>
      <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
        {plan.clubName}
        {'  \u00B7  '}
        {plan.investmentDayShortLabel}
      </AppText>

      <AppText variant="display" style={{ marginTop: spacing.lg }}>
        {formatNok(plan.memberAmountNok)}
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
        planned
      </AppText>

      <AppText variant="sectionTitle" style={{ marginTop: spacing.xxl, marginBottom: spacing.sm }}>
        Planned investments
      </AppText>

      <Breakdown
        plan={plan}
        showActions={false}
        stepFor={() => 'not_started'}
        onOpenBroker={() => undefined}
        onMarkDone={() => undefined}
      />

      <AppText variant="meta" color="secondary" style={{ marginTop: spacing.lg }}>
        Broker actions become available on Investment Day.
      </AppText>
    </View>
  );
}

function TodayBody({
  plan,
  stepFor,
  doneCount,
  allDone,
  onOpenBroker,
  onMarkDone,
  onConfirm,
}: {
  plan: InvestPlanDemo;
  stepFor: (id: string) => InvestRowStep;
  doneCount: number;
  allDone: boolean;
  onOpenBroker: (id: string) => void;
  onMarkDone: (id: string) => void;
  onConfirm: () => void;
}) {
  const { spacing } = useTheme();

  return (
    <View>
      <AppText variant="sectionTitle">Investment Day</AppText>
      <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
        {plan.clubName}
        {'  \u00B7  '}
        {plan.investmentDayShortLabel}
      </AppText>

      <AppText variant="display" style={{ marginTop: spacing.lg }}>
        {formatNok(plan.memberAmountNok)}
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
        to invest today
      </AppText>

      <AppText variant="sectionTitle" style={{ marginTop: spacing.xxl, marginBottom: spacing.sm }}>
        Your investments
      </AppText>

      <Breakdown
        plan={plan}
        showActions
        stepFor={stepFor}
        onOpenBroker={onOpenBroker}
        onMarkDone={onMarkDone}
      />

      <View style={{ marginTop: spacing.xxl, paddingBottom: spacing.lg }}>
        <AppText variant="meta" color="secondary">
          {doneCount} of {plan.targets.length} completed
        </AppText>
        <AppText variant="meta" color="secondary" style={{ marginTop: spacing.sm }}>
          Reported by you. Broker verification is not available yet.
        </AppText>
        <View style={{ marginTop: spacing.lg }}>
          <Button
            label="Confirm investments"
            variant="primary"
            block
            disabled={!allDone}
            onPress={onConfirm}
            accessibilityHint={
              allDone
                ? "Records that you completed today's planned investments. This is not broker verification."
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
  onViewActivity,
}: {
  plan: InvestPlanDemo;
  onViewActivity: () => void;
}) {
  const { spacing } = useTheme();

  return (
    <View>
      <AppText variant="sectionTitle">Investment Day complete</AppText>
      <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
        {plan.clubName}
        {'  \u00B7  '}
        {plan.investmentDayShortLabel}
      </AppText>

      <AppText variant="display" style={{ marginTop: spacing.lg }}>
        {formatNok(plan.memberAmountNok)}
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
        reported invested
      </AppText>

      <AppText variant="meta" color="positive" style={{ marginTop: spacing.md }}>
        {plan.targets.length} of {plan.targets.length} investments completed
      </AppText>

      <AppText variant="sectionTitle" style={{ marginTop: spacing.xxl, marginBottom: spacing.sm }}>
        Reported investments
      </AppText>

      <Breakdown
        plan={plan}
        showActions={false}
        stepFor={() => 'done'}
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
  plan,
  showActions,
  stepFor,
  onOpenBroker,
  onMarkDone,
}: {
  plan: InvestPlanDemo;
  showActions: boolean;
  stepFor: (id: string) => InvestRowStep;
  onOpenBroker: (id: string) => void;
  onMarkDone: (id: string) => void;
}) {
  const { colors } = useTheme();

  return (
    <View>
      {plan.targets.map((target, index) => (
        <InvestmentRow
          key={target.id}
          target={target}
          color={colors.chart[index % colors.chart.length]}
          brokerActionLabel={plan.brokerActionLabel}
          brokerName={plan.brokerName}
          step={stepFor(target.id)}
          showActions={showActions}
          showSeparator={index > 0}
          onOpenBroker={() => onOpenBroker(target.id)}
          onMarkDone={() => onMarkDone(target.id)}
        />
      ))}
    </View>
  );
}
