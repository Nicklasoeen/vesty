import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { formatNokFromMinor } from '@/lib/currency';
import { useTheme } from '@/theme';
import { AppText, Button } from '@/ui';

import { InvestIntro } from './InvestIntro';
import {
  InvestAlert,
  InvestAttestationCheckbox,
  InvestDetailRows,
  InvestHeroCard,
  InvestJourneyHeader,
  InvestJourneyTitle,
  InvestPrivacyNote,
  InvestPrimaryBar,
  InvestStepList,
  InvestStickyFooter,
} from './InvestJourneyChrome';
import { InvestOrbitArt } from './InvestOrbitArt';
import {
  presentInvestDayHero,
  presentInvestJourneyProgress,
  presentInvestOneTimeAmountLabel,
  type InvestJourneySurface,
} from './presentInvestJourney';
import {
  presentInvestAttestationConflictCopy,
  presentInvestAttestationErrorCopy,
  presentInvestAttestationTimeoutCopy,
  presentInvestChooseCopy,
  presentInvestClosedCopy,
  presentInvestCurrentCopy,
  presentInvestInvestmentDayOpenCopy,
  presentInvestLoadErrorCopy,
  presentInvestLoadingCopy,
  presentInvestNeedsUpdateCopy,
  presentInvestNoClubCopy,
  presentInvestOneTimeCopy,
  presentInvestOneTimeOutsideWindowCopy,
  presentInvestOpeningCopy,
  presentInvestOpeningErrorCopy,
  presentInvestPendingCopy,
  presentInvestReportSavedCopy,
  presentInvestReturnedCopy,
  presentInvestReviewCopy,
  presentInvestSavedCopy,
  presentInvestSetupCopy,
  presentInvestSetupRequiredCopy,
  presentInvestUnavailableCopy,
} from './presentInvestJourneyCopy';
import type { MonthlySavingDetailRow, MonthlySavingSetup } from './presentMonthlySavingSetup';
import type { InvestmentDayPlan } from './types';

export interface InvestJourneyProps {
  surface: InvestJourneySurface;
  setup: MonthlySavingSetup | null;
  plan: InvestmentDayPlan | null;
  clubName: string | null;
  error: string | null;
  attested: boolean;
  canConfirm: boolean;
  details: readonly MonthlySavingDetailRow[];
  reduceMotion?: boolean;
  compact?: boolean;
  embedded?: boolean;
  reporting?: ReactNode;
  contribution?: ReactNode;
  participation?: ReactNode;
  review?: ReactNode;
  footer?: ReactNode;
  openFailed?: boolean;
  onStartIntro: () => void;
  onChooseMonthly: () => void;
  onChooseOneTime: () => void;
  onOpenMonthly: () => void;
  onCheckNordnet: () => void;
  onOpenOneTime: () => void;
  onCopyAmount: () => void;
  onConfirm: () => void;
  onNotYet: () => void;
  onBuyOnce: () => void;
  onRetry: () => void;
  onRetryLoad: () => void;
  onDismissSaved: () => void;
  onBack?: () => void;
  onAttestedChange: (value: boolean) => void;
  onClearOneTimeReturn: () => void;
}

export function InvestJourney(props: InvestJourneyProps) {
  const { colors, spacing } = useTheme();
  const maxWidth = props.compact ? 375 : undefined;

  if (props.surface === 'intro') {
    return (
      <View style={{ flex: 1, width: '100%', maxWidth, alignSelf: props.compact ? 'center' : undefined }}>
        <InvestIntro
          scheduleDayOfMonth={props.setup?.scheduleDayOfMonth ?? 5}
          onStart={props.onStartIntro}
          reduceMotion={props.reduceMotion}
          embedded={props.embedded}
        />
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        width: '100%',
        maxWidth,
        alignSelf: props.compact ? 'center' : undefined,
        backgroundColor: colors.background,
        paddingHorizontal: spacing.lg,
      }}
    >
      <InvestJourneyBody {...props} />
    </View>
  );
}

function InvestJourneyBody(props: InvestJourneyProps) {
  const { spacing } = useTheme();
  const progress = presentInvestJourneyProgress(props.surface);
  const back = props.onBack
    && props.surface !== 'current'
    && props.surface !== 'investment_day_upcoming'
    && props.surface !== 'investment_day_open'
    && props.surface !== 'investment_day_closed'
    && props.surface !== 'investment_day_completed'
    && props.surface !== 'no_club'
    && props.surface !== 'loading'
    ? props.onBack
    : null;

  return (
    <View style={{ flex: 1 }}>
      <InvestJourneyHeader progress={progress} onBack={back} embedded={props.embedded} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <InvestJourneyContent {...props} />
      </ScrollView>
      <InvestJourneyFooter {...props} />
    </View>
  );
}

function InvestJourneyContent(props: InvestJourneyProps) {
  const { spacing } = useTheme();
  const setup = props.setup;
  const isUpdate = setup?.status === 'needs_update';

  switch (props.surface) {
    case 'loading': {
      const copy = presentInvestLoadingCopy();
      return (
        <View>
          <InvestJourneyTitle {...copy} />
          <View style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator accessibilityLabel="Loading monthly saving" />
          </View>
        </View>
      );
    }
    case 'no_club': {
      const copy = presentInvestNoClubCopy();
      return <InvestJourneyTitle {...copy} />;
    }
    case 'request_error': {
      const copy = props.openFailed
        ? presentInvestOpeningErrorCopy()
        : presentInvestLoadErrorCopy(props.error);
      return (
        <View>
          <InvestOrbitArt variant="medal" icon="cloud-off" reduceMotion={props.reduceMotion} />
          <InvestJourneyTitle {...copy} body={copy.body} />
          {'finderHint' in copy && copy.finderHint ? (
            <AppText variant="supporting" style={{ marginTop: spacing.md }}>
              {copy.finderHint}
            </AppText>
          ) : null}
        </View>
      );
    }
    case 'choose': {
      const copy = presentInvestChooseCopy();
      return (
        <View>
          <InvestJourneyTitle {...copy} />
          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            <InvestChoiceCard
              featured
              badge={copy.monthlyBadge}
              title={copy.monthlyTitle}
              body={copy.monthlyBody}
              onPress={props.onChooseMonthly}
            />
            <InvestChoiceCard
              title={copy.onceTitle}
              body={copy.onceBody}
              onPress={props.onChooseOneTime}
            />
          </View>
          <InvestPrivacyNote>{copy.privacy}</InvestPrivacyNote>
        </View>
      );
    }
    case 'setup': {
      const copy = presentInvestSetupCopy(false);
      return (
        <View>
          <InvestJourneyTitle {...copy} />
          <InvestDetailRows rows={props.details} />
          <InvestStepList steps={[{ n: 1, text: copy.stepOne }, { n: 2, text: copy.stepTwo }]} />
          <InvestPrivacyNote>{copy.note}</InvestPrivacyNote>
        </View>
      );
    }
    case 'needs_update': {
      const copy = presentInvestNeedsUpdateCopy();
      const setupCopy = presentInvestSetupCopy(true);
      return (
        <View>
          <InvestOrbitArt variant="medal" icon="refresh-cw" reduceMotion={props.reduceMotion} />
          <InvestJourneyTitle {...copy} />
          <InvestDetailRows rows={props.details} />
          <InvestStepList steps={[{ n: 1, text: setupCopy.stepOne }, { n: 2, text: setupCopy.stepTwo }]} />
          <InvestAlert>{copy.alert}</InvestAlert>
        </View>
      );
    }
    case 'opening_nordnet':
    case 'one_time_opening':
    case 'confirming': {
      const copy = presentInvestOpeningCopy(props.surface === 'one_time_opening' ? 'one_time' : 'monthly');
      return (
        <View>
          <InvestOrbitArt variant="medal" icon="arrow-up-right" reduceMotion={props.reduceMotion} />
          <InvestJourneyTitle
            eyebrow={props.surface === 'confirming' ? 'Saving your confirmation' : copy.eyebrow}
            titleLead={props.surface === 'confirming' ? 'Saving' : copy.titleLead}
            titleEmphasis={props.surface === 'confirming' ? 'your confirmation.' : copy.titleEmphasis}
            body={copy.body}
          />
          <InvestStepList steps={[{ n: 1, text: copy.stepOne }, { n: 2, text: copy.stepTwo }]} />
          {props.surface === 'confirming' ? (
            <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
              <ActivityIndicator accessibilityLabel="Saving monthly saving confirmation" />
            </View>
          ) : null}
          <InvestPrivacyNote>{copy.note}</InvestPrivacyNote>
        </View>
      );
    }
    case 'returned': {
      const copy = presentInvestReturnedCopy(isUpdate);
      return (
        <View>
          <InvestJourneyTitle
            eyebrow={copy.eyebrow}
            titleLead={copy.titleLead}
            titleEmphasis={copy.titleEmphasis}
            body={copy.body}
          />
          <InvestDetailRows rows={props.details} />
          <InvestAttestationCheckbox
            label={copy.checkboxLabel}
            checked={props.attested}
            onChange={props.onAttestedChange}
          />
          <InvestPrivacyNote>{copy.note}</InvestPrivacyNote>
        </View>
      );
    }
    case 'attestation_timeout': {
      const copy = presentInvestAttestationTimeoutCopy();
      return (
        <View>
          <InvestOrbitArt variant="medal" icon="cloud-off" reduceMotion={props.reduceMotion} />
          <InvestJourneyTitle {...copy} />
        </View>
      );
    }
    case 'attestation_error': {
      const copy = presentInvestAttestationErrorCopy();
      return (
        <View>
          <InvestOrbitArt variant="medal" icon="cloud-off" reduceMotion={props.reduceMotion} />
          <InvestJourneyTitle {...copy} />
        </View>
      );
    }
    case 'attestation_conflict': {
      const copy = presentInvestAttestationConflictCopy();
      return (
        <View>
          <InvestOrbitArt variant="medal" icon="pause" reduceMotion={props.reduceMotion} />
          <InvestJourneyTitle {...copy} />
        </View>
      );
    }
    case 'attestation_saved': {
      const copy = presentInvestSavedCopy(isUpdate);
      return (
        <View>
          <InvestOrbitArt variant="stamp" reduceMotion={props.reduceMotion} />
          <InvestJourneyTitle {...copy} />
          <InvestDetailRows
            rows={[
              { label: 'Monthly saving', value: copy.monthlyLabel, previousValue: null },
              { label: 'Purchases recorded', value: copy.purchasesLabel, previousValue: null },
            ]}
          />
          <InvestPrivacyNote>{copy.privacy}</InvestPrivacyNote>
        </View>
      );
    }
    case 'current':
    case 'investment_day_upcoming': {
      const copy = presentInvestCurrentCopy(props.clubName);
      const hero = presentInvestDayHero(setup?.recommendedInvestmentDayAt ?? props.plan?.investmentDayAt ?? null);
      return (
        <View>
          <InvestJourneyTitle
            eyebrow={copy.eyebrow}
            titleLead={copy.titleLead}
            titleEmphasis={copy.titleEmphasis}
            body={props.surface === 'investment_day_upcoming'
              ? 'Your monthly saving setup is confirmed by you. Reporting has not opened yet.'
              : copy.body}
          />
          {hero ? (
            <InvestHeroCard
              eyebrow={copy.nextLabel}
              value={`${hero.day}  ${hero.month}`}
              supporting={copy.nextBody}
            />
          ) : null}
          <InvestDetailRows rows={props.details} />
          <InvestPrivacyNote>{copy.note}</InvestPrivacyNote>
        </View>
      );
    }
    case 'investment_day_closed': {
      const copy = presentInvestClosedCopy();
      return (
        <View>
          <InvestJourneyTitle eyebrow="Investment Day" {...copy} />
          <InvestPrivacyNote>A late report cannot be saved for this Investment Day.</InvestPrivacyNote>
        </View>
      );
    }
    case 'investment_day_not_in_snapshot':
      return (
        <View>
          <InvestJourneyTitle
            eyebrow="Investment Day"
            titleLead="Not in this"
            titleEmphasis="Investment Day."
            body="You were not part of this Investment Day when it was frozen. Later joins apply from a future Investment Day."
          />
        </View>
      );
    case 'setup_required': {
      const copy = presentInvestSetupRequiredCopy();
      return (
        <View>
          <InvestJourneyTitle {...copy} />
          {props.contribution}
          <AppText variant="supporting" style={{ marginTop: spacing.lg }}>
            {copy.note}
          </AppText>
        </View>
      );
    }
    case 'unavailable': {
      const copy = presentInvestUnavailableCopy();
      return (
        <View>
          <InvestJourneyTitle {...copy} />
        </View>
      );
    }
    case 'one_time': {
      const copy = presentInvestOneTimeCopy();
      const amount = presentInvestOneTimeAmountLabel(setup);
      return (
        <View>
          <InvestJourneyTitle {...copy} />
          <InvestHeroCard
            eyebrow={copy.amountLabel}
            value={amount ?? 'Amount unavailable'}
            supporting={setup?.fundName ? `${setup.fundName}\nOne fund · purchase in ${setup.currency ?? 'NOK'}` : null}
          />
          <InvestStepList steps={[{ n: 1, text: copy.stepOne }, { n: 2, text: copy.stepTwo }]} />
          <InvestPrivacyNote>{copy.note}</InvestPrivacyNote>
        </View>
      );
    }
    case 'one_time_returned_outside_window': {
      const copy = presentInvestOneTimeOutsideWindowCopy();
      return (
        <View>
          <InvestOrbitArt variant="medal" icon="arrow-down-left" reduceMotion={props.reduceMotion} />
          <InvestJourneyTitle {...copy} />
          <InvestAlert>{copy.alert}</InvestAlert>
          <InvestPrivacyNote>{copy.note}</InvestPrivacyNote>
        </View>
      );
    }
    case 'one_time_returned_reportable':
    case 'investment_day_open':
    case 'investment_day_report': {
      const copy = presentInvestInvestmentDayOpenCopy(props.plan, setup);
      const amountLabel = presentInvestOneTimeAmountLabel(setup)
        ?? (props.plan?.expectedAmountMinor != null
          ? formatNokFromMinor(props.plan.expectedAmountMinor)
          : 'Amount unavailable');
      return (
        <View>
          <InvestJourneyTitle
            eyebrow={props.surface === 'one_time_returned_reportable' ? 'Welcome back' : copy.eyebrow}
            titleLead={props.surface === 'one_time_returned_reportable' ? 'How did' : copy.titleLead}
            titleEmphasis={props.surface === 'one_time_returned_reportable' ? 'it go?' : copy.titleEmphasis}
            body={props.surface === 'one_time_returned_reportable'
              ? 'Only report a completed purchase. An order waiting to execute is still pending.'
              : copy.body}
          />
          <InvestHeroCard
            eyebrow={copy.plannedLabel}
            value={amountLabel}
            supporting={setup?.fundName ?? null}
          />
          {props.participation}
          <View style={{ marginTop: spacing.xl }}>{props.reporting}</View>
          <InvestPrivacyNote>{copy.note}</InvestPrivacyNote>
        </View>
      );
    }
    case 'investment_day_review': {
      const copy = presentInvestReviewCopy('as_planned');
      return (
        <View>
          <InvestJourneyTitle {...copy} />
          {props.review}
          <InvestPrivacyNote>{copy.privacy}</InvestPrivacyNote>
        </View>
      );
    }
    case 'investment_day_pending': {
      const copy = presentInvestPendingCopy();
      return (
        <View>
          <InvestOrbitArt variant="medal" icon="clock" reduceMotion={props.reduceMotion} />
          <InvestJourneyTitle {...copy} />
          <InvestPrivacyNote>{copy.privacy}</InvestPrivacyNote>
        </View>
      );
    }
    case 'investment_day_completed': {
      const copy = presentInvestReportSavedCopy(
        props.plan?.participationOutcome ?? 'confirmed',
        props.plan?.transactions.reduce((sum, item) => sum + item.amountMinor, 0) ?? props.plan?.expectedAmountMinor ?? null,
        setup?.fundName ?? null,
      );
      return (
        <View>
          <InvestOrbitArt variant="stamp" reduceMotion={props.reduceMotion} />
          <InvestJourneyTitle
            eyebrow={copy.eyebrow}
            titleLead={copy.titleLead}
            titleEmphasis={copy.titleEmphasis}
            body={copy.body}
          />
          {copy.amountLabel ? (
            <InvestDetailRows
              rows={[{ label: copy.fundName ?? 'Fund', value: copy.amountLabel, previousValue: null }]}
            />
          ) : null}
          {props.participation}
          {props.review}
          <InvestPrivacyNote>{copy.note ?? 'This amount is private.'}</InvestPrivacyNote>
        </View>
      );
    }
    default:
      return (
        <InvestJourneyTitle
          eyebrow="Invest"
          titleLead="Your saving"
          titleEmphasis="plan."
          body="This state is not available."
        />
      );
  }
}

function InvestJourneyFooter(props: InvestJourneyProps) {
  const { spacing } = useTheme();
  const setup = props.setup;
  const isUpdate = setup?.status === 'needs_update';

  if (props.footer) {
    return <InvestStickyFooter>{props.footer}</InvestStickyFooter>;
  }

  switch (props.surface) {
    case 'choose':
      return null;
    case 'setup': {
      const copy = presentInvestSetupCopy(false);
      return (
        <InvestStickyFooter>
          <InvestPrimaryBar label={copy.primaryLabel} onPress={props.onOpenMonthly} enabled />
          <View style={{ marginTop: spacing.sm }}>
            <Button label={copy.secondaryLabel} variant="secondary" block onPress={props.onBuyOnce} />
          </View>
        </InvestStickyFooter>
      );
    }
    case 'needs_update': {
      const copy = presentInvestNeedsUpdateCopy();
      return (
        <InvestStickyFooter>
          <InvestPrimaryBar label={copy.primaryLabel} onPress={props.onOpenMonthly} enabled />
          <View style={{ marginTop: spacing.sm }}>
            <Button label={copy.secondaryLabel} variant="secondary" block onPress={props.onBuyOnce} />
          </View>
        </InvestStickyFooter>
      );
    }
    case 'returned': {
      const copy = presentInvestReturnedCopy(isUpdate);
      return (
        <InvestStickyFooter>
          <InvestPrimaryBar
            label={copy.primaryLabel}
            onPress={props.onConfirm}
            enabled={props.canConfirm}
          />
          <View style={{ marginTop: spacing.sm }}>
            <Button label={copy.secondaryLabel} variant="secondary" block onPress={props.onNotYet} />
          </View>
        </InvestStickyFooter>
      );
    }
    case 'attestation_timeout': {
      const copy = presentInvestAttestationTimeoutCopy();
      return (
        <InvestStickyFooter>
          <InvestPrimaryBar label={copy.primaryLabel} onPress={props.onRetry} enabled />
          <View style={{ marginTop: spacing.sm }}>
            <Button label={copy.secondaryLabel} variant="secondary" block onPress={props.onNotYet} />
          </View>
        </InvestStickyFooter>
      );
    }
    case 'attestation_error': {
      const copy = presentInvestAttestationErrorCopy();
      return (
        <InvestStickyFooter>
          <InvestPrimaryBar label={copy.primaryLabel} onPress={props.onRetry} enabled />
          <View style={{ marginTop: spacing.sm }}>
            <Button label={copy.secondaryLabel} variant="secondary" block onPress={props.onNotYet} />
          </View>
        </InvestStickyFooter>
      );
    }
    case 'attestation_conflict': {
      const copy = presentInvestAttestationConflictCopy();
      return (
        <InvestStickyFooter>
          <InvestPrimaryBar label={copy.primaryLabel} onPress={props.onNotYet} enabled />
        </InvestStickyFooter>
      );
    }
    case 'attestation_saved': {
      const copy = presentInvestSavedCopy(isUpdate);
      return (
        <InvestStickyFooter>
          <InvestPrimaryBar label={copy.primaryLabel} onPress={props.onDismissSaved} enabled />
        </InvestStickyFooter>
      );
    }
    case 'current':
    case 'investment_day_upcoming': {
      const copy = presentInvestCurrentCopy(props.clubName);
      return (
        <InvestStickyFooter note={copy.note}>
          <InvestPrimaryBar label={copy.primaryLabel} onPress={props.onCheckNordnet} enabled />
          <View style={{ marginTop: spacing.sm }}>
            <Button label={copy.secondaryLabel} variant="secondary" block onPress={props.onBuyOnce} />
          </View>
        </InvestStickyFooter>
      );
    }
    case 'one_time': {
      const copy = presentInvestOneTimeCopy();
      const canOpen = Boolean(setup?.oneTimeProductUrl);
      return (
        <InvestStickyFooter>
          <InvestPrimaryBar label={copy.primaryLabel} onPress={props.onOpenOneTime} enabled={canOpen} />
          <View style={{ marginTop: spacing.sm }}>
            <Button label={copy.secondaryLabel} variant="secondary" block onPress={props.onCopyAmount} />
          </View>
        </InvestStickyFooter>
      );
    }
    case 'one_time_returned_outside_window': {
      const copy = presentInvestOneTimeOutsideWindowCopy();
      return (
        <InvestStickyFooter>
          <InvestPrimaryBar label={copy.primaryLabel} onPress={props.onClearOneTimeReturn} enabled />
          <View style={{ marginTop: spacing.sm }}>
            <Button label={copy.secondaryLabel} variant="secondary" block onPress={props.onOpenOneTime} />
          </View>
        </InvestStickyFooter>
      );
    }
    case 'request_error': {
      const copy = presentInvestLoadErrorCopy(props.error);
      return (
        <InvestStickyFooter>
          <InvestPrimaryBar
            label={copy.primaryLabel}
            onPress={props.setup == null ? props.onRetryLoad : props.onRetry}
            enabled
          />
        </InvestStickyFooter>
      );
    }
    case 'unavailable': {
      const copy = presentInvestUnavailableCopy();
      return setup?.oneTimeAvailable ? (
        <InvestStickyFooter>
          <Button label={copy.secondaryLabel} variant="secondary" block onPress={props.onBuyOnce} />
        </InvestStickyFooter>
      ) : null;
    }
    case 'investment_day_review': {
      return <InvestStickyFooter>{props.review}</InvestStickyFooter>;
    }
    case 'investment_day_pending': {
      const copy = presentInvestPendingCopy();
      return (
        <InvestStickyFooter>
          <InvestPrimaryBar label={copy.primaryLabel} onPress={props.onNotYet} enabled />
        </InvestStickyFooter>
      );
    }
    case 'investment_day_open':
    case 'investment_day_report':
    case 'one_time_returned_reportable':
      return null;
    case 'investment_day_completed':
      return (
        <InvestStickyFooter>
          <InvestPrimaryBar label="Done" onPress={props.onDismissSaved} enabled />
        </InvestStickyFooter>
      );
    default:
      return null;
  }
}

function InvestChoiceCard({
  title,
  body,
  badge,
  featured = false,
  onPress,
}: {
  title: string;
  body: string;
  badge?: string;
  featured?: boolean;
  onPress: () => void;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={{
        width: '100%',
        borderRadius: radius.xl,
        borderWidth: featured ? 2 : 1,
        borderColor: featured ? colors.accent : colors.border,
        backgroundColor: featured ? colors.mintSoft : colors.surface,
        padding: spacing.lg,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {featured ? <Feather name="repeat" size={18} color={colors.accent} /> : <View />}
        {badge ? (
          <View
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              borderRadius: radius.full,
              backgroundColor: colors.surface,
            }}
          >
            <AppText variant="meta">{badge}</AppText>
          </View>
        ) : (
          <Feather name="arrow-up-right" size={18} color={colors.textSecondary} />
        )}
      </View>
      <AppText variant="title" style={{ marginTop: spacing.md }}>
        {title}
      </AppText>
      <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
        {body}
      </AppText>
    </Pressable>
  );
}
