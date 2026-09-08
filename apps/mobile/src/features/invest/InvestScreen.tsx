import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FlexibleContributionForm } from '@/features/clubs/FlexibleContributionForm';
import { useClubContribution } from '@/features/clubs/useClubContribution';
import { useClubs } from '@/features/clubs/useClubs';
import { formatNokFromMinor } from '@/lib/currency';
import { BOTTOM_NAVIGATION_HEIGHT, BottomNavigation, type BottomNavigationTabKey } from '@/navigation/BottomNavigation';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useTheme } from '@/theme';
import { AppText, Button } from '@/ui';

import { InvestJourney } from './InvestJourney';
import { InvestPrimaryBar } from './InvestJourneyChrome';
import { InvestmentDayParticipationSection } from './InvestmentDayParticipation';
import { InvestmentDayReportPanel } from './InvestmentDayReportPanel';
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
  presentInvestCanConfirm,
  presentInvestDetailRows,
  presentInvestJourneySurface,
  type InvestLocalBranch,
  type InvestReportStage,
} from './presentInvestJourney';
import { presentInvestReviewCopy } from './presentInvestJourneyCopy';
import {
  presentCompletedAmountCaption,
  type InvestmentDayReportOrigin,
  type InvestmentDayReportSubmitState,
} from './presentInvestmentDayReport';
import { isReportableInvestmentDay } from './presentInvestmentDayCycle';
import { asAmountProvenance } from './amountProvenance';
import type { InvestTargetRow } from './types';
import { useInvestmentDay } from './useInvestmentDay';
import { useInvestmentDayParticipation } from './useInvestmentDayParticipation';
import { useMonthlySavingSetup } from './useMonthlySavingSetup';

/**
 * Invest answers: what is the next saving or Investment Day step?
 * Broker opens never create a purchase. Reports stay member-attested.
 */
export function InvestScreen() {
  const { colorScheme, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeTab, onSelectTab } = useAppNavigation('invest');
  const { selectedClub, isLoading: clubsLoading } = useClubs();
  const selectedClubId = selectedClub?.clubId ?? null;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const apply = (enabled: boolean) => setReduceMotion(enabled);
    void AccessibilityInfo.isReduceMotionEnabled().then(apply);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', apply);
    return () => subscription.remove();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, paddingBottom: BOTTOM_NAVIGATION_HEIGHT + insets.bottom }}>
          <InvestSession
            key={selectedClubId ?? 'none'}
            selectedClub={selectedClub}
            selectedClubId={selectedClubId}
            clubsLoading={clubsLoading}
            reduceMotion={reduceMotion}
            onSelectTab={onSelectTab}
          />
        </View>
      </KeyboardAvoidingView>
      <BottomNavigation activeTab={activeTab} onSelectTab={onSelectTab} />
    </View>
  );
}

function InvestSession({
  selectedClub,
  selectedClubId,
  clubsLoading,
  reduceMotion,
  onSelectTab,
}: {
  selectedClub: ReturnType<typeof useClubs>['selectedClub'];
  selectedClubId: string | null;
  clubsLoading: boolean;
  reduceMotion: boolean;
  onSelectTab: (tab: BottomNavigationTabKey) => void;
}) {
  const monthly = useMonthlySavingSetup(selectedClubId);
  const { plan, isLoading, error, setupRequired, isReporting, refresh, report } = useInvestmentDay(
    selectedClubId,
  );
  const contribution = useClubContribution(selectedClubId);
  const participation = useInvestmentDayParticipation(selectedClubId, plan?.cycleId ?? null);
  const [screenBranch, setScreenBranch] = useState<Exclude<InvestLocalBranch, 'one_time'>>(null);
  const [attested, setAttested] = useState(false);
  const [reportStage, setReportStage] = useState<InvestReportStage>('idle');
  const [pendingCycleId, setPendingCycleId] = useState<string | null>(null);
  const [choice, setChoice] = useState<InvestmentDayReportChoice>('as_planned');
  const [submitState, setSubmitState] = useState<InvestmentDayReportSubmitState>('idle');
  const [reportError, setReportError] = useState<{ cycleId: string; message: string } | null>(null);
  const [amountFields, setAmountFields] = useState<Readonly<Record<string, ReportedAmountField>>>({});
  const [quantityFields, setQuantityFields] = useState<Readonly<Record<string, QuantityFieldState>>>({});
  const [priceFields, setPriceFields] = useState<Readonly<Record<string, QuantityFieldState>>>({});

  const targets = useMemo(() => (plan ? rowsFromPlan(plan) : []), [plan]);
  const cycleId = plan?.cycleId ?? null;

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

  const reportedTotalMinor = sumReportedAmountMinor(amountStateByTarget, targets.map((target) => target.id));
  const optionalReady = showOptionalExecutionFields(targets.map((target) => target.id));
  const canSubmit = choice === 'pending' || choice === 'skipped'
    || (choice === 'as_planned' && canSubmitAsPlanned(
      targets.map((target) => target.id),
      quantityStateByTarget,
      priceStateByTarget,
    ))
    || (choice === 'with_changes' && canSubmitWithChanges(
      targets.map((target) => target.id),
      amountStateByTarget,
      quantityStateByTarget,
      priceStateByTarget,
    ));

  const onSubmitReport = useCallback(async () => {
    if (isReporting || !cycleId || !isReportableInvestmentDay(plan)) {
      return;
    }
    if (choice === 'pending') {
      setPendingCycleId(cycleId);
      setReportStage('pending');
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
          ? buildAsPlannedPurchaseLines(targets.map((target) => target.id), quantityStateByTarget, priceStateByTarget)
          : choice === 'with_changes'
            ? buildWithChangesPurchaseLines(
              targets.map((target) => target.id),
              amountStateByTarget,
              quantityStateByTarget,
              priceStateByTarget,
            )
            : [],
      });
      setSubmitState('success');
      setReportStage('idle');
      monthly.clearOneTimeReturn();
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
      setReportError({ cycleId, message });
    }
  }, [
    amountStateByTarget,
    choice,
    cycleId,
    isReporting,
    monthly,
    participation,
    plan,
    priceStateByTarget,
    quantityStateByTarget,
    report,
    targets,
  ]);

  const localBranch: InvestLocalBranch = monthly.view === 'one_time' || monthly.oneTimePhase !== 'idle'
    ? 'one_time'
    : screenBranch;

  const journeyInput = {
    hasClub: Boolean(selectedClub),
    clubsLoading,
    setup: monthly.setup,
    setupLoading: monthly.isLoading,
    setupError: monthly.error,
    monthlyPhase: monthly.phase,
    oneTimePhase: monthly.oneTimePhase,
    introDismissed: monthly.introDismissed,
    localBranch,
    attested,
    attestationSaved: monthly.attestationSaved,
    attestationIssue: monthly.attestationIssue,
    openedMonthlyUrl: monthly.openedMonthlyUrl,
    plan,
    planLoading: Boolean(selectedClub) && isLoading && !plan,
    planError: error,
    planSetupRequired: setupRequired,
    reportStage: pendingCycleId && pendingCycleId === cycleId ? 'pending' as const : reportStage,
    reportCompleted: Boolean(plan?.isCompleted) || submitState === 'success',
  };

  const surface = presentInvestJourneySurface(journeyInput);
  const reportOrigin: InvestmentDayReportOrigin =
    surface === 'one_time_returned_reportable' ? 'one_time' : 'monthly';

  const goBack = () => {
    if (surface === 'returned' || surface === 'opening_nordnet') {
      monthly.notYet();
      return;
    }
    if (surface === 'one_time' || surface === 'one_time_returned_outside_window' || surface === 'one_time_opening') {
      monthly.showMonthly();
      monthly.clearOneTimeReturn();
      setScreenBranch(monthly.setup?.status === 'not_set_up' ? 'choose' : null);
      return;
    }
    if (surface === 'setup' || surface === 'needs_update') {
      setScreenBranch('choose');
      return;
    }
    if (surface === 'choose') {
      monthly.restoreIntro();
      setScreenBranch(null);
      return;
    }
    if (
      surface === 'investment_day_report'
      || surface === 'investment_day_review'
      || surface === 'investment_day_pending'
    ) {
      setReportStage('idle');
      setPendingCycleId(null);
      monthly.clearOneTimeReturn();
    }
  };

  const reportingPanel = (
    surface === 'investment_day_open'
    || surface === 'investment_day_report'
    || surface === 'one_time_returned_reportable'
  ) && isReportableInvestmentDay(plan) ? (
    <InvestmentDayReportPanel
      expectedAmountMinor={plan?.expectedAmountMinor ?? 0}
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
      origin={reportOrigin}
      showHeading={false}
      showSubmit={false}
      onChoiceChange={(next) => {
        setChoice(next);
        setReportStage('choices');
        if (next === 'pending') {
          setPendingCycleId(cycleId);
          setReportStage('pending');
        }
        if (submitState !== 'loading') {
          setSubmitState('idle');
        }
      }}
      onAmountChange={onAmountChange}
      onQuantityChange={onQuantityChange}
      onPriceChange={onExecutionPriceChange}
      onSubmit={() => undefined}
    />
  ) : null;

  const reviewCopy = presentInvestReviewCopy(choice);
  const reportingAllowed = isReportableInvestmentDay(plan);
  const reviewFooter = surface === 'investment_day_review' && reportingAllowed ? (
    <View>
      <InvestPrimaryBar
        label={reviewCopy.primaryLabel}
        onPress={() => {
          void onSubmitReport();
        }}
        enabled={canSubmit && !isReporting}
        busy={isReporting || submitState === 'loading'}
      />
      {submitState === 'timeout' || submitState === 'conflict' ? (
        <View style={{ marginTop: 8 }}>
          <Button
            label={submitState === 'conflict' ? 'Back' : 'Retry saving report'}
            variant="secondary"
            block
            onPress={() => {
              if (submitState === 'conflict') {
                setReportStage('choices');
                return;
              }
              void onSubmitReport();
            }}
          />
        </View>
      ) : (
        <View style={{ marginTop: 8 }}>
          <Button
            label="Change details"
            variant="secondary"
            block
            onPress={() => setReportStage('choices')}
          />
        </View>
      )}
    </View>
  ) : surface === 'investment_day_open' || surface === 'investment_day_report' || surface === 'one_time_returned_reportable' ? (
    <View>
      {choice === 'pending' ? null : (
        <InvestPrimaryBar
          label={choice === 'skipped' ? 'Review skip' : 'Review report'}
          onPress={() => setReportStage('review')}
          enabled={canSubmit && reportingAllowed}
        />
      )}
      {surface !== 'one_time_returned_reportable' ? (
        <View style={{ marginTop: 8 }}>
          <Button
            label="Check in Nordnet"
            variant="secondary"
            block
            onPress={() => {
              void monthly.openMonthly('check');
            }}
          />
        </View>
      ) : null}
    </View>
  ) : null;

  return (
          <InvestJourney
            surface={surface}
            setup={monthly.setup}
            plan={plan}
            clubName={selectedClub?.name ?? plan?.clubName ?? null}
            error={monthly.error ?? error}
            attested={attested}
            canConfirm={presentInvestCanConfirm(journeyInput)}
            details={presentInvestDetailRows(journeyInput)}
            reduceMotion={reduceMotion}
            reporting={reportingPanel}
            contribution={
              <FlexibleContributionForm
                submitLabel="Set amount"
                onSubmit={async (amountMinor) => {
                  await contribution.saveFlexibleAmount(amountMinor);
                  await monthly.refresh();
                  await refresh();
                }}
              />
            }
            participation={
              participation.participation ? (
                <InvestmentDayParticipationSection
                  completedCount={participation.participation.completedCount}
                  totalCount={participation.participation.totalCount}
                  allCompleted={participation.participation.allCompleted}
                  members={participation.participation.members}
                />
              ) : null
            }
            review={
              surface === 'investment_day_review' ? (
                <ReviewSummary
                  choice={choice}
                  fundName={monthly.setup?.fundName ?? targets[0]?.label ?? null}
                  plannedMinor={plan?.expectedAmountMinor ?? monthly.setup?.recommendedAmountMinor ?? 0}
                  reportedMinor={choice === 'with_changes' ? reportedTotalMinor : plan?.expectedAmountMinor ?? 0}
                  targets={targets}
                />
              ) : surface === 'investment_day_completed' ? (
                <CompletedSummary
                  outcome={plan?.participationOutcome ?? 'confirmed'}
                  targets={targets}
                  provenance={asAmountProvenance(plan?.transactions[0]?.amountProvenance)}
                  reportedTotal={plan?.transactions.reduce((sum, item) => sum + item.amountMinor, 0) ?? 0}
                  onViewActivity={() => onSelectTab('activity')}
                />
              ) : null
            }
            footer={reviewFooter}
            openFailed={monthly.error === 'Unable to open Nordnet'}
            onStartIntro={() => {
              monthly.dismissIntro();
              setScreenBranch('choose');
            }}
            onChooseMonthly={() => {
              monthly.showMonthly();
              setScreenBranch('monthly');
            }}
            onChooseOneTime={() => {
              monthly.buyOnce();
            }}
            onOpenMonthly={() => {
              void monthly.openMonthly('attest');
            }}
            onCheckNordnet={() => {
              void monthly.openMonthly('check');
            }}
            onOpenOneTime={() => {
              void monthly.openOneTime();
            }}
            onCopyAmount={() => {
              void monthly.copyAmount();
            }}
            onConfirm={() => {
              void monthly.confirm(attested);
            }}
            onNotYet={() => {
              if (surface === 'investment_day_pending') {
                setPendingCycleId(null);
                setReportStage('choices');
                return;
              }
              monthly.notYet();
              setAttested(false);
            }}
            onBuyOnce={() => {
              monthly.buyOnce();
            }}
            onRetry={() => {
              monthly.retry();
            }}
            onRetryLoad={() => {
              monthly.retryLoad();
              void refresh();
            }}
            onDismissSaved={() => {
              monthly.dismissSaved();
              setAttested(false);
              setScreenBranch(null);
            }}
            onBack={goBack}
            onAttestedChange={setAttested}
            onClearOneTimeReturn={() => {
              monthly.clearOneTimeReturn();
              monthly.showMonthly();
              setScreenBranch(null);
            }}
          />
  );
}

function ReviewSummary({
  choice,
  fundName,
  plannedMinor,
  reportedMinor,
  targets,
}: {
  choice: InvestmentDayReportChoice;
  fundName: string | null;
  plannedMinor: number;
  reportedMinor: number;
  targets: InvestTargetRow[];
}) {
  const copy = presentInvestReviewCopy(choice);
  const amount = choice === 'skipped' ? 'No purchase' : formatNokFromMinor(reportedMinor);
  return (
    <View>
      <AppText variant="supporting">Purchased fund</AppText>
      <AppText variant="title" style={{ marginTop: 4 }}>{fundName ?? 'Club fund'}</AppText>
      <AppText variant="supporting" style={{ marginTop: 16 }}>
        {choice === 'with_changes' ? 'Amount you report' : 'Amount you confirm'}
      </AppText>
      <AppText variant="title" style={{ marginTop: 4 }}>{amount}</AppText>
      {choice === 'as_planned' ? (
        <View style={{ marginTop: 12 }}>
          {targets.map((target) => (
            <AppText key={target.id} variant="meta">
              {target.ticker ?? target.exposureLabel ?? target.label}
              {'  ·  '}
              {formatNokFromMinor(target.amountMinor)}
            </AppText>
          ))}
        </View>
      ) : null}
      <AppText variant="supporting" style={{ marginTop: 16 }}>
        {copy.sourceLabel ?? 'Your confirmation · not broker-verified'}
      </AppText>
      {choice !== 'skipped' && reportedMinor !== plannedMinor ? (
        <AppText variant="meta" style={{ marginTop: 8 }}>
          Planned {formatNokFromMinor(plannedMinor)}
        </AppText>
      ) : null}
    </View>
  );
}

function CompletedSummary({
  outcome,
  targets,
  provenance,
  reportedTotal,
  onViewActivity,
}: {
  outcome: string;
  targets: InvestTargetRow[];
  provenance: ReturnType<typeof asAmountProvenance>;
  reportedTotal: number;
  onViewActivity: () => void;
}) {
  const purchased = targets.filter((target) => target.amountMinor > 0);
  return (
    <View>
      {outcome === 'confirmed' ? (
        <>
          <AppText variant="display">{formatNokFromMinor(reportedTotal)}</AppText>
          <AppText variant="body" color="secondary" style={{ marginTop: 8 }}>
            {presentCompletedAmountCaption(outcome, provenance)}
          </AppText>
          {purchased.map((target) => (
            <AppText key={target.id} variant="body" style={{ marginTop: 6 }}>
              {target.ticker ?? target.exposureLabel ?? target.label}
              {'  ·  '}
              {formatNokFromMinor(target.amountMinor)}
            </AppText>
          ))}
        </>
      ) : (
        <AppText variant="body" color="secondary">
          {presentCompletedAmountCaption(outcome, provenance)}
        </AppText>
      )}
      <View style={{ marginTop: 16 }}>
        <Button label="View activity" variant="secondary" onPress={onViewActivity} />
      </View>
    </View>
  );
}
