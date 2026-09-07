import { View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText } from '@/ui';

import type { presentCreateClubReviewAgreement } from './presentSingleFund';

interface CreateClubReviewSummaryProps {
  review: ReturnType<typeof presentCreateClubReviewAgreement>;
}

export function CreateClubReviewSummary({ review }: CreateClubReviewSummaryProps) {
  const { colors, radius, spacing } = useTheme();

  return (
    <View>
      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.xl,
          padding: spacing.lg,
        }}
      >
        <AppText variant="eyebrow">{review.groupTypeName}</AppText>
        <AppText variant="title" style={{ marginTop: spacing.xs }}>
          {review.clubName}
        </AppText>
        <ReviewRow label={review.investmentLabel} value={review.investmentName} />
        <ReviewRow label={review.contributionStyleLabel} value={review.contributionName} />
        <ReviewRow
          label={review.contributionPrivacy ? 'Your amount · private' : 'Each member'}
          value={review.contributionDetail}
        />
        <ReviewRow label={review.governanceLabel} value={review.governanceName} last />
      </View>
      <AppText variant="supporting" style={{ marginTop: spacing.lg }}>
        {review.ownership}
      </AppText>
    </View>
  );
}

function ReviewRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <AppText variant="supporting" style={{ flexShrink: 0 }}>
        {label}
      </AppText>
      <AppText variant="bodyStrong" style={{ textAlign: 'right', flex: 1 }}>
        {value}
      </AppText>
    </View>
  );
}
