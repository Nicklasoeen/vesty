import { StyleSheet, View } from 'react-native';

import type { ClubMemberDemo } from '@/demo/clubDemoData';
import { formatNok } from '@/lib/currency';
import { useTheme } from '@/theme';
import { AppText, Avatar } from '@/ui';

interface InvestmentDaySummaryProps {
  userName: string;
  clubName: string;
  investmentDayLabel: string;
  expectedContributionNok: number;
  members: ClubMemberDemo[];
}

/**
 * Home's editorial hero. Deliberately not a card — typography and
 * whitespace carry the hierarchy. The date is the largest number on the
 * screen, not the greeting and not a portfolio figure: Investment Day is
 * "what's happening next", which is Home's job. Detailed money figures
 * belong to Club.
 */
export function InvestmentDaySummary({
  userName,
  clubName,
  investmentDayLabel,
  expectedContributionNok,
  members,
}: InvestmentDaySummaryProps) {
  const { spacing } = useTheme();
  const readyCount = members.filter((member) => member.isReadyForNextInvestmentDay).length;

  return (
    <View>
      <AppText variant="body" color="secondary">
        Good evening, {userName}
      </AppText>

      <AppText variant="label" style={{ marginTop: spacing.lg }}>
        Next Investment Day
      </AppText>
      <AppText variant="display" style={{ marginTop: spacing.xs }}>
        {investmentDayLabel}
      </AppText>

      <View style={[styles.metaRow, { marginTop: spacing.sm }]}>
        <AppText variant="bodyStrong">{clubName}</AppText>
        <AppText variant="body" color="secondary">
          {'  \u00B7  '}
          {formatNok(expectedContributionNok)} expected
        </AppText>
      </View>

      <View style={[styles.readinessRow, { marginTop: spacing.md }]}>
        {members.map((member, index) => (
          <Avatar
            key={member.id}
            initials={member.initials}
            size="sm"
            ring={member.isReadyForNextInvestmentDay ? 'ready' : 'pending'}
            style={index === 0 ? undefined : styles.avatarSpacing}
          />
        ))}
        <AppText variant="caption" style={{ marginLeft: spacing.sm }}>
          {readyCount} of {members.length} ready
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  readinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarSpacing: {
    marginLeft: 8,
  },
});
