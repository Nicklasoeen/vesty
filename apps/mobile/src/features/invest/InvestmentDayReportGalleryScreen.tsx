import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { formatNokFromMinor } from '@/lib/currency';
import { useTheme } from '@/theme';
import { AppText, Button, Screen, Surface } from '@/ui';

import { presentReportedAmountLabel } from './amountProvenance';
import { InvestmentDayCycleStateView } from './InvestmentDayCycleStateView';
import { InvestmentDayReportPanel } from './InvestmentDayReportPanel';
import {
  canSubmitAsPlanned,
  canSubmitWithChanges,
  showOptionalExecutionFields,
  sumReportedAmountMinor,
} from './investmentDayReport';
import {
  galleryAmountFields,
  galleryPlanTargets,
  galleryPriceFields,
  galleryQuantityFields,
  getInvestmentDayReportGalleryScenario,
  INVESTMENT_DAY_REPORT_GALLERY_SCENARIOS,
} from './investmentDayReportGalleryFixtures';
import {
  presentCompletedAmountCaption,
  presentCompletedHeadline,
  presentLegacyHistoryCaption,
  presentPendingBanner,
} from './presentInvestmentDayReport';

/**
 * Development-only gallery. Fixture-owned state only. No Supabase, auth, or report RPC.
 */
export function InvestmentDayReportGalleryScreen() {
  const { colors, spacing } = useTheme();
  const [scenarioId, setScenarioId] = useState(INVESTMENT_DAY_REPORT_GALLERY_SCENARIOS[0]!.id);
  const [localRetry, setLocalRetry] = useState(0);
  const scenario = getInvestmentDayReportGalleryScenario(scenarioId);
  const targets = galleryPlanTargets(scenario);
  const amountFields = galleryAmountFields(scenario);
  const quantityFields = galleryQuantityFields();
  const priceFields = galleryPriceFields();
  const targetIds = targets.map((target) => target.id);
  const reportedTotalMinor = scenario.choice === 'with_changes'
    ? sumReportedAmountMinor(amountFields, targetIds)
    : scenario.reportedTotalMinor;
  const canSubmit = scenario.choice === 'pending' || scenario.choice === 'skipped'
    || (scenario.choice === 'as_planned' && canSubmitAsPlanned(targetIds, quantityFields, priceFields))
    || (scenario.choice === 'with_changes' && canSubmitWithChanges(targetIds, amountFields, quantityFields, priceFields));
  const saveLocalContribution = async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 600);
    });

    if (scenario.contributionSaveResult === 'error') {
      throw new Error('Local gallery save failed. Try again.');
    }

    setLocalRetry((count) => count + 1);
  };

  return (
    <Screen
      contentContainerStyle={{
        paddingHorizontal: scenario.compact ? spacing.sm : spacing.lg,
        paddingBottom: spacing.xxl,
      }}
    >
      <Surface
        bordered
        style={{
          padding: spacing.md,
          marginTop: spacing.sm,
          marginBottom: spacing.lg,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <AppText variant="label">Development state gallery</AppText>
        <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
          Uses local fixtures only. No report, confirm, or holdings request is sent.
        </AppText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs, paddingTop: spacing.md }}
        >
          {INVESTMENT_DAY_REPORT_GALLERY_SCENARIOS.map((item) => {
            const active = item.id === scenario.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setScenarioId(item.id);
                  setLocalRetry(0);
                }}
                style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  borderRadius: 999,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: active ? colors.mintSoft : colors.surface,
                }}
              >
                <AppText variant="meta">{item.label}</AppText>
              </Pressable>
            );
          })}
        </ScrollView>
        {localRetry > 0 ? (
          <AppText variant="meta" color="positive" style={{ marginTop: spacing.sm }}>
            {`Local retry received (${localRetry}). No server call.`}
          </AppText>
        ) : null}
      </Surface>

      {scenario.view === 'cycle' ? (
        <View
          style={{
            maxWidth: scenario.largeText ? 288 : 375,
            alignSelf: 'center',
            width: '100%',
            transform: scenario.largeText ? [{ scale: 1.3 }] : undefined,
            transformOrigin: scenario.largeText ? 'top center' : undefined,
            marginTop: scenario.largeText ? spacing.xl : undefined,
            marginBottom: scenario.largeText ? spacing.xxl : undefined,
          }}
        >
          <InvestmentDayCycleStateView
            viewerState={scenario.viewerState ?? 'upcoming'}
            clubName={scenario.clubName ?? 'Friday Club'}
            investmentDayAt={scenario.investmentDayAt}
            reportingOpensAt={scenario.reportingOpensAt}
            reportingClosesAt={scenario.reportingClosesAt}
            reportingAllowed={false}
            onRetry={() => setLocalRetry((count) => count + 1)}
            onSaveContribution={
              scenario.viewerState === 'setup_next' || scenario.viewerState === 'setup_required'
                ? saveLocalContribution
                : undefined
            }
          />
        </View>
      ) : null}

      {scenario.view === 'report' ? (
        <View style={{ maxWidth: 375, alignSelf: 'center', width: '100%' }}>
        <InvestmentDayReportPanel
          expectedAmountMinor={scenario.expectedAmountMinor}
          targets={targets}
          choice={scenario.choice}
          amountFields={amountFields}
          quantityFields={quantityFields}
          priceFields={priceFields}
          showOptionalExecution={showOptionalExecutionFields(targetIds)}
          reportedTotalMinor={reportedTotalMinor}
          canSubmit={canSubmit && scenario.submitState !== 'loading'}
          submitState={scenario.submitState}
          error={scenario.error}
          onChoiceChange={() => undefined}
          onAmountChange={() => undefined}
          onQuantityChange={() => undefined}
          onPriceChange={() => undefined}
          onSubmit={() => setLocalRetry((count) => count + 1)}
        />
        </View>
      ) : null}

      {scenario.view === 'pending' ? (
        <View>
          <AppText variant="sectionTitle">{presentPendingBanner().title}</AppText>
          <AppText variant="body" style={{ marginTop: spacing.md }}>
            {presentPendingBanner().body}
          </AppText>
          <View style={{ marginTop: spacing.xl }}>
            <Button label="Report now" variant="primary" block onPress={() => setLocalRetry((count) => count + 1)} />
          </View>
        </View>
      ) : null}

      {scenario.view === 'completed' || scenario.view === 'legacy' ? (
        <View>
          <AppText variant="sectionTitle">
            {presentCompletedHeadline(scenario.outcome)}
          </AppText>
          {scenario.view === 'legacy' ? (
            <>
              <AppText variant="display" style={{ marginTop: spacing.lg }}>
                {formatNokFromMinor(scenario.expectedAmountMinor)}
              </AppText>
              <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
                {presentReportedAmountLabel(scenario.expectedAmountMinor, 'legacy_plan_assumed')}
              </AppText>
              <AppText variant="supporting" style={{ marginTop: spacing.md }}>
                {presentLegacyHistoryCaption()}
              </AppText>
            </>
          ) : (
            <AppText variant="body" color="secondary" style={{ marginTop: spacing.lg }}>
              {presentCompletedAmountCaption(scenario.outcome, scenario.amountProvenance)}
            </AppText>
          )}
        </View>
      ) : null}
    </Screen>
  );
}
