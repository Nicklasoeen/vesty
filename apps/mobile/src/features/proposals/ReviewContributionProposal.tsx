import { View } from 'react-native';

import type { ClubContributionPolicy } from '@/features/clubs/contributionPolicy';
import { useTheme } from '@/theme';
import { AppText, Button, IconButton } from '@/ui';

import type { ValidContributionProposalDraft } from './createContributionProposal';
import { presentContributionProposalReview } from './presentContributionProposal';

interface ReviewContributionProposalProps {
  policy: ClubContributionPolicy;
  proposed: ValidContributionProposalDraft;
  error: string | null;
  busy: boolean;
  onBack: () => void;
  onOpen: () => void;
}

export function ReviewContributionProposal({
  policy,
  proposed,
  error,
  busy,
  onBack,
  onOpen,
}: ReviewContributionProposalProps) {
  const { spacing } = useTheme();
  const review = presentContributionProposalReview({
    currentMode: policy.mode,
    currentEqualAmountMinor: policy.equalAmountMinor,
    proposedMode: proposed.proposedMode,
    proposedEqualAmountMinor: proposed.proposedEqualAmountMinor,
  });

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: spacing.sm,
          marginBottom: spacing.lg,
        }}
      >
        <IconButton icon="arrow-left" accessibilityLabel="Back" onPress={onBack} />
        <AppText variant="label" style={{ marginLeft: spacing.sm }}>
          {review.eyebrow}
        </AppText>
      </View>

      <AppText variant="title" accessibilityRole="header">
        Review
      </AppText>

      <View style={{ marginTop: spacing.xl }}>
        <AppText variant="label">Current</AppText>
        <AppText variant="bodyStrong" style={{ marginTop: 2 }}>
          {review.currentStyle}
        </AppText>
        {review.currentAmount ? (
          <AppText variant="supporting" style={{ marginTop: 2 }}>
            {review.currentAmount}
          </AppText>
        ) : null}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <AppText variant="label">Proposed</AppText>
        <AppText variant="bodyStrong" style={{ marginTop: 2 }}>
          {review.proposedStyle}
        </AppText>
        {review.proposedAmount ? (
          <AppText variant="supporting" style={{ marginTop: 2 }}>
            {review.proposedAmount}
          </AppText>
        ) : null}
      </View>

      <AppText variant="supporting" style={{ marginTop: spacing.xl }}>
        {review.appliesCopy}
      </AppText>
      {review.transitionCopy ? (
        <AppText variant="supporting" style={{ marginTop: spacing.sm }}>
          {review.transitionCopy}
        </AppText>
      ) : null}

      {error ? (
        <AppText variant="supporting" color="negative" style={{ marginTop: spacing.md }}>
          {error}
        </AppText>
      ) : null}

      <View style={{ marginTop: spacing.xl }}>
        <Button
          label={busy ? 'Opening…' : 'Open vote'}
          variant="primary"
          block
          busy={busy}
          disabled={busy}
          onPress={onOpen}
        />
      </View>
    </View>
  );
}
