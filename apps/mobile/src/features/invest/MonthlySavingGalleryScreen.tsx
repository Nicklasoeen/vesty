import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { FlexibleContributionForm } from '@/features/clubs/FlexibleContributionForm';
import { useTheme } from '@/theme';
import { AppText, Screen, Surface } from '@/ui';

import { InvestJourney } from './InvestJourney';
import { InvestmentDayReportPanel } from './InvestmentDayReportPanel';
import type { InvestmentDayReportChoice, ReportedAmountField } from './investmentDayReport';
import { parseReportedPurchaseKronerInput } from './investmentDayReport';
import {
  getMonthlySavingGalleryScenario,
  MONTHLY_SAVING_GALLERY_SCENARIOS,
  presentGalleryInvestJourneyInput,
} from './monthlySavingGalleryFixtures';
import {
  galleryRealMonthlySavingSetup,
  MONTHLY_SAVING_GALLERY_MODE_OPTIONS,
  presentMonthlySavingGalleryModeCopy,
  type MonthlySavingGalleryMode,
} from './monthlySavingGalleryRealLink';
import {
  presentInvestCanConfirm,
  presentInvestDetailRows,
  presentInvestJourneySurface,
} from './presentInvestJourney';
import { useGalleryRealMonthlySaving } from './useGalleryRealMonthlySaving';

/**
 * Development-only gallery. Isolated from auth and Supabase.
 * UI preview never opens a URL. Real Nordnet test uses the production
 * Linking path with the verified HTTPS monthly savings page.
 */
export function MonthlySavingGalleryScreen() {
  const { colors, spacing } = useTheme();
  const [mode, setMode] = useState<MonthlySavingGalleryMode>('ui_preview');
  const copy = presentMonthlySavingGalleryModeCopy(mode);

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, paddingHorizontal: spacing.lg }}>
      <Surface
        bordered
        style={{
          padding: spacing.md,
          marginTop: spacing.sm,
          marginBottom: spacing.sm,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <AppText variant="label">{copy.heading}</AppText>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.xs,
            paddingTop: spacing.sm,
          }}
        >
          {MONTHLY_SAVING_GALLERY_MODE_OPTIONS.map((item) => {
            const active = item.id === mode;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setMode(item.id)}
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
        </View>
        <AppText variant="supporting" style={{ marginTop: spacing.sm }}>
          {copy.showRealTestNote ? copy.realTestNote : copy.previewNote}
        </AppText>
      </Surface>

      <View style={{ flex: 1, minHeight: 0 }}>
        {mode === 'ui_preview' ? <GalleryUiPreview /> : <GalleryRealNordnetTest />}
      </View>
      </View>
    </Screen>
  );
}

function GalleryUiPreview() {
  const { colors, spacing } = useTheme();
  const params = useLocalSearchParams<{ scenario?: string | string[] }>();
  const requested = typeof params.scenario === 'string'
    ? params.scenario
    : Array.isArray(params.scenario)
      ? params.scenario[0]
      : undefined;
  const initialId = MONTHLY_SAVING_GALLERY_SCENARIOS.find((item) => item.id === requested)?.id
    ?? MONTHLY_SAVING_GALLERY_SCENARIOS[0]!.id;
  const [scenarioId, setScenarioId] = useState(initialId);
  const [appliedQuery, setAppliedQuery] = useState(requested);
  const [localAction, setLocalAction] = useState(0);
  const [attested, setAttested] = useState(false);
  if (requested && requested !== appliedQuery) {
    setAppliedQuery(requested);
    setScenarioId(initialId);
    setLocalAction(0);
    setAttested(false);
  }
  const scenario = getMonthlySavingGalleryScenario(scenarioId);
  const noteLocalAction = () => setLocalAction((count) => count + 1);
  const journeyInput = {
    ...presentGalleryInvestJourneyInput(scenario),
    attested: scenario.attested === true || attested,
  };
  const surface = presentInvestJourneySurface(journeyInput);
  const handlers = {
    onStartIntro: noteLocalAction,
    onChooseMonthly: noteLocalAction,
    onChooseOneTime: noteLocalAction,
    onOpenMonthly: noteLocalAction,
    onCheckNordnet: noteLocalAction,
    onOpenOneTime: noteLocalAction,
    onCopyAmount: noteLocalAction,
    onConfirm: noteLocalAction,
    onNotYet: noteLocalAction,
    onBuyOnce: noteLocalAction,
    onRetry: noteLocalAction,
    onRetryLoad: noteLocalAction,
    onDismissSaved: noteLocalAction,
    onAttestedChange: (value: boolean) => {
      setAttested(value);
      noteLocalAction();
    },
    onClearOneTimeReturn: noteLocalAction,
  };

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <Surface
        bordered
        style={{
          padding: spacing.sm,
          marginBottom: spacing.sm,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <AppText variant="label">Development state gallery</AppText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.xs, paddingTop: spacing.sm }}
        >
          {MONTHLY_SAVING_GALLERY_SCENARIOS.map((item) => {
            const active = item.id === scenario.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setScenarioId(item.id);
                  setLocalAction(0);
                  setAttested(false);
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
        {localAction > 0 ? (
          <AppText variant="meta" color="positive" style={{ marginTop: spacing.xs }}>
            {`Local action received (${localAction}). No server or link call.`}
          </AppText>
        ) : null}
      </Surface>

      <View
        style={{
          flex: 1,
          minHeight: 0,
          maxWidth: scenario.largeText ? 288 : scenario.viewport ?? 375,
          alignSelf: 'center',
          width: '100%',
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 28,
          ...(scenario.largeText ? { transform: [{ scale: 1.15 }] } : {}),
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <InvestJourney
            surface={surface}
            setup={scenario.setup}
            plan={scenario.plan ?? null}
            clubName={scenario.plan?.clubName ?? 'Investorgroup'}
            error={scenario.setupError ?? null}
            attested={journeyInput.attested}
            canConfirm={presentInvestCanConfirm(journeyInput)}
            details={presentInvestDetailRows(journeyInput)}
            reduceMotion={scenario.id === 'reduce-motion'}
            compact
            embedded
            contribution={surface === 'setup_required' ? (
              <FlexibleContributionForm
                submitLabel="Set amount"
                onSubmit={async () => {
                  noteLocalAction();
                }}
              />
            ) : null}
            reporting={
              surface === 'investment_day_report' || surface === 'investment_day_open'
                ? (
                  <GalleryReportPreview
                    key={scenario.id}
                    onLocalAction={noteLocalAction}
                    showAmount={scenario.id === 'investment-day-report'}
                  />
                )
                : null
            }
            {...handlers}
          />
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

function GalleryRealNordnetTest() {
  const { spacing } = useTheme();
  const setup = galleryRealMonthlySavingSetup();
  const handoff = useGalleryRealMonthlySaving();
  const [localAction, setLocalAction] = useState(0);
  const [attested, setAttested] = useState(false);
  const noteLocalAction = () => setLocalAction((count) => count + 1);
  const journeyInput = presentGalleryInvestJourneyInput({
    id: 'real',
    label: 'Real',
    setup,
    phase: handoff.phase,
    view: 'monthly',
    introDismissed: true,
    localBranch: 'monthly',
    attested,
  });
  const surface = presentInvestJourneySurface({
    ...journeyInput,
    openedMonthlyUrl: handoff.phase === 'returned',
    attested,
  });

  return (
    <View style={{ flex: 1, maxWidth: 375, alignSelf: 'center', width: '100%' }}>
      <InvestJourney
        surface={surface}
        setup={setup}
        plan={null}
        clubName="Investorgroup"
        error={null}
        attested={attested}
        canConfirm={presentInvestCanConfirm({
          ...journeyInput,
          attested,
          openedMonthlyUrl: handoff.phase === 'returned',
        })}
        details={presentInvestDetailRows(journeyInput)}
        compact
        embedded
        onStartIntro={noteLocalAction}
        onChooseMonthly={noteLocalAction}
        onChooseOneTime={noteLocalAction}
        onOpenMonthly={() => {
          void handoff.open();
        }}
        onCheckNordnet={() => {
          void handoff.open();
        }}
        onOpenOneTime={noteLocalAction}
        onCopyAmount={noteLocalAction}
        onConfirm={noteLocalAction}
        onNotYet={noteLocalAction}
        onBuyOnce={noteLocalAction}
        onRetry={() => {
          void handoff.open();
        }}
        onRetryLoad={noteLocalAction}
        onDismissSaved={noteLocalAction}
        onAttestedChange={setAttested}
        onClearOneTimeReturn={noteLocalAction}
      />
      {localAction > 0 ? (
        <AppText variant="meta" color="positive" style={{ marginTop: spacing.sm }}>
          {`Local action received (${localAction}). No server call.`}
        </AppText>
      ) : null}
    </View>
  );
}

function GalleryReportPreview({
  onLocalAction,
  showAmount,
}: {
  onLocalAction: () => void;
  showAmount: boolean;
}) {
  const [choice, setChoice] = useState<InvestmentDayReportChoice>(showAmount ? 'with_changes' : 'as_planned');
  const [amount, setAmount] = useState<ReportedAmountField>(parseReportedPurchaseKronerInput('1400'));
  const target = {
    id: 'dnb-global',
    label: 'DNB Global Indeks A',
    exposureLabel: null,
    ticker: null,
    allocationBps: 10000,
    amountMinor: 200000,
    quantity: null,
    executionUnitPrice: null,
  };

  return (
    <InvestmentDayReportPanel
      expectedAmountMinor={200000}
      targets={[target]}
      choice={choice}
      amountFields={{ [target.id]: amount }}
      quantityFields={{}}
      priceFields={{}}
      showOptionalExecution={false}
      reportedTotalMinor={choice === 'with_changes' ? amount.amountMinor ?? 0 : 200000}
      canSubmit
      submitState="idle"
      error={null}
      origin="monthly"
      showHeading={false}
      showSubmit={false}
      onChoiceChange={(next) => {
        setChoice(next);
        onLocalAction();
      }}
      onAmountChange={(_targetId, value) => {
        setAmount(parseReportedPurchaseKronerInput(value));
        onLocalAction();
      }}
      onQuantityChange={() => {
        onLocalAction();
      }}
      onPriceChange={() => {
        onLocalAction();
      }}
      onSubmit={onLocalAction}
    />
  );
}
