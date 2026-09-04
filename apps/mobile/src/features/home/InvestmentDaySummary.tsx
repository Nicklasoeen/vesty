import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { ClubMemberDemo } from '@/demo/clubDemoData';
import { formatNok } from '@/lib/currency';
import { useTheme } from '@/theme';
import { AppText, Avatar, Button, Surface } from '@/ui';

/**
 * Visual states for Home's Investment Day module.
 *
 * upcoming        — calm upcoming event (default everyday Home)
 * actionRequired  — user has something concrete to do before the day
 * today           — the event itself is happening
 *
 * Spike-only presentational states — not a production state machine.
 */
export type InvestmentDayVisualState = 'upcoming' | 'actionRequired' | 'today';

interface InvestmentDaySummaryProps {
  clubName: string;
  /** Full date label (e.g. "5 October") — used by action/today copy. */
  investmentDayLabel: string;
  /** Compact date (e.g. "5 Oct") — used by the quieter upcoming state. */
  investmentDayShortLabel: string;
  expectedContributionNok: number;
  members: ClubMemberDemo[];
  /** Defaults to the calm everyday upcoming treatment. */
  visualState?: InvestmentDayVisualState;
}

/**
 * Home Investment Day — a secondary event/status Surface below Total value.
 *
 * Structurally related to Club's Investment Day Surface, but quieter and
 * subordinated to the Home portfolio hero. Always rendered as a restrained
 * Surface so it reads as one dedicated module, not a promo or calendar widget.
 */
export function InvestmentDaySummary({
  clubName,
  investmentDayLabel,
  investmentDayShortLabel,
  expectedContributionNok,
  members,
  visualState = 'upcoming',
}: InvestmentDaySummaryProps) {
  if (visualState === 'actionRequired') {
    return <ActionRequiredState clubName={clubName} dateLabel={investmentDayLabel} members={members} />;
  }

  if (visualState === 'today') {
    return (
      <TodayState
        clubName={clubName}
        expectedContributionNok={expectedContributionNok}
        members={members}
      />
    );
  }

  return (
    <UpcomingState
      clubName={clubName}
      dateLabel={investmentDayShortLabel}
      expectedContributionNok={expectedContributionNok}
      members={members}
    />
  );
}

function UpcomingState({
  clubName,
  dateLabel,
  expectedContributionNok,
  members,
}: {
  clubName: string;
  dateLabel: string;
  expectedContributionNok: number;
  members: ClubMemberDemo[];
}) {
  const { colors, spacing } = useTheme();

  return (
    <Surface
      variant="secondary"
      style={{
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderLeftWidth: 2,
        borderLeftColor: colors.accent,
      }}
    >
      <AppText variant="sectionTitle">Next Investment Day</AppText>
      <AppText variant="title" style={{ marginTop: spacing.xs }}>
        {dateLabel}
      </AppText>

      <View style={[styles.metaRow, { marginTop: spacing.sm }]}>
        <AppText variant="bodyStrong">{clubName}</AppText>
        <AppText variant="body" color="secondary">
          {'  \u00B7  '}
          {formatNok(expectedContributionNok)} expected
        </AppText>
      </View>

      <ReadinessRow members={members} noun="ready" style={{ marginTop: spacing.md }} />
    </Surface>
  );
}

function ActionRequiredState({
  clubName,
  dateLabel,
  members,
}: {
  clubName: string;
  dateLabel: string;
  members: ClubMemberDemo[];
}) {
  const { colors, spacing } = useTheme();

  return (
    <Surface
      variant="secondary"
      style={{
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderLeftWidth: 2,
        borderLeftColor: colors.accent,
      }}
    >
      <AppText variant="eyebrow">Action required</AppText>
      <AppText variant="subtitle" style={{ marginTop: spacing.sm }}>
        Update your saving plan
      </AppText>
      <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
        before {dateLabel}
      </AppText>

      <View style={[styles.metaRow, { marginTop: spacing.md }]}>
        <AppText variant="bodyStrong">{clubName}</AppText>
      </View>

      <ReadinessRow members={members} noun="ready" style={{ marginTop: spacing.md }} />

      <View style={{ marginTop: spacing.md }}>
        <Button label="Review changes" variant="primary" />
      </View>
    </Surface>
  );
}

function TodayState({
  clubName,
  expectedContributionNok,
  members,
}: {
  clubName: string;
  expectedContributionNok: number;
  members: ClubMemberDemo[];
}) {
  const { colors, spacing } = useTheme();

  return (
    <Surface
      variant="secondary"
      style={{
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderLeftWidth: 2,
        borderLeftColor: colors.accent,
      }}
    >
      <AppText variant="hero">Investment Day is today</AppText>

      <View style={[styles.metaRow, { marginTop: spacing.sm }]}>
        <AppText variant="bodyStrong">{clubName}</AppText>
        <AppText variant="body" color="secondary">
          {'  \u00B7  '}
          {formatNok(expectedContributionNok)} expected
        </AppText>
      </View>

      <ReadinessRow members={members} noun="confirmed" style={{ marginTop: spacing.md }} />

      <View style={{ marginTop: spacing.md }}>
        <Button label="View investments" variant="primary" />
      </View>
    </Surface>
  );
}

function ReadinessRow({
  members,
  noun,
  style,
}: {
  members: ClubMemberDemo[];
  noun: 'ready' | 'confirmed';
  style?: StyleProp<ViewStyle>;
}) {
  const { spacing } = useTheme();
  const readyCount = members.filter((member) => member.isReadyForNextInvestmentDay).length;

  return (
    <View style={[styles.readinessRow, style]}>
      {members.map((member, index) => (
        <Avatar
          key={member.id}
          initials={member.initials}
          imageSource={member.imageSource}
          size="sm"
          ring={member.isReadyForNextInvestmentDay ? 'ready' : 'pending'}
          style={index === 0 ? undefined : styles.avatarSpacing}
        />
      ))}
      <AppText variant="meta" color="secondary" style={{ marginLeft: spacing.sm }}>
        {readyCount} of {members.length} {noun}
      </AppText>
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
