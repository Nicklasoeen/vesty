import { View } from 'react-native';

import { FlexibleContributionForm } from '@/features/clubs/FlexibleContributionForm';
import { useTheme } from '@/theme';
import { AppText, Button } from '@/ui';

import { presentInvestmentDayCycleCopy } from './presentInvestmentDayCycle';
import type { InvestmentDayViewerState } from './types';

export function InvestmentDayCycleStateView({
  viewerState,
  clubName,
  investmentDayAt,
  reportingOpensAt,
  reportingClosesAt,
  reportingAllowed,
  onRetry,
  onSaveContribution,
}: {
  viewerState: InvestmentDayViewerState | string;
  clubName?: string | null;
  investmentDayAt?: string | null;
  reportingOpensAt?: string | null;
  reportingClosesAt?: string | null;
  reportingAllowed?: boolean;
  onRetry?: () => void;
  onSaveContribution?: (amountMinor: number) => Promise<void>;
}) {
  const { spacing } = useTheme();
  const copy = presentInvestmentDayCycleCopy({
    viewerState,
    clubName,
    investmentDayAt,
    reportingOpensAt,
    reportingClosesAt,
    reportingAllowed,
  });

  return (
    <View>
      <AppText variant="sectionTitle">{copy.title}</AppText>
      {clubName ? (
        <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
          {clubName}
          {'  \u00B7  '}
          {copy.whenLabel}
        </AppText>
      ) : (
        <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
          {copy.whenLabel}
        </AppText>
      )}
      <AppText variant="body" style={{ marginTop: spacing.lg }}>
        {copy.body}
      </AppText>
      {copy.showContributionSetup && onSaveContribution ? (
        <View style={{ marginTop: spacing.xl }}>
          <FlexibleContributionForm
            submitLabel={copy.setupAppliesNext ? 'Set amount for next Investment Day' : 'Set amount'}
            showAppliesNext={copy.setupAppliesNext}
            onSubmit={onSaveContribution}
          />
        </View>
      ) : null}
      {copy.retryLabel && onRetry ? (
        <View style={{ marginTop: spacing.xl }}>
          <Button
            label={copy.retryLabel}
            variant="secondary"
            onPress={onRetry}
            accessibilityHint="Reloads this Investment Day. It does not create a new period."
          />
        </View>
      ) : null}
    </View>
  );
}
