import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { formatNok } from '@/lib/currency';
import { useTheme } from '@/theme';
import { AppText, Avatar, Button, Surface, type AvatarPerson } from '@/ui';

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

export type InvestmentDayMember = AvatarPerson & {
  isReadyForNextInvestmentDay?: boolean;
};

interface InvestmentDaySummaryProps {
  clubName: string;
  /** Full date label (e.g. "5 October") — used by action/today copy. */
  investmentDayLabel: string;
  /** Compact date (e.g. "5 Oct") — used by the quieter upcoming state. */
  investmentDayShortLabel: string;
  expectedContributionNok: number;
  members: readonly InvestmentDayMember[];
  /** Defaults to the calm everyday upcoming treatment. */
  visualState?: InvestmentDayVisualState;
  /** Optional navigation into Invest. Does not change the card’s design. */
  onOpenInvest?: () => void;
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
  onOpenInvest,
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
        onOpenInvest={onOpenInvest}
      />
    );
  }

  return (
    <UpcomingState
      clubName={clubName}
      dateLabel={investmentDayShortLabel}
      expectedContributionNok={expectedContributionNok}
      members={members}
      onOpenInvest={onOpenInvest}
    />
  );
}

function UpcomingState({
  clubName,
  dateLabel,
  expectedContributionNok,
  members,
  onOpenInvest,
}: {
  clubName: string;
  dateLabel: string;
  expectedContributionNok: number;
  members: readonly InvestmentDayMember[];
  onOpenInvest?: () => void;
}) {
  const { colors, spacing } = useTheme();

  return (
    <Pressable
      onPress={onOpenInvest}
      disabled={!onOpenInvest}
      accessibilityRole={onOpenInvest ? 'button' : undefined}
      accessibilityLabel={onOpenInvest ? `Open Invest, ${clubName} Investment Day` : undefined}
      style={({ pressed }) => ({ opacity: onOpenInvest && pressed ? 0.85 : 1 })}
    >
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
    </Pressable>
  );
}

function ActionRequiredState({
  clubName,
  dateLabel,
  members,
}: {
  clubName: string;
  dateLabel: string;
  members: readonly InvestmentDayMember[];
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
  onOpenInvest,
}: {
  clubName: string;
  expectedContributionNok: number;
  members: readonly InvestmentDayMember[];
  onOpenInvest?: () => void;
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
        <Button label="View investments" variant="primary" onPress={onOpenInvest} />
      </View>
    </Surface>
  );
}

function ReadinessRow({
  members,
  noun,
  style,
}: {
  members: readonly InvestmentDayMember[];
  noun: 'ready' | 'confirmed';
  style?: StyleProp<ViewStyle>;
}) {
  const { spacing } = useTheme();
  const hasReadiness = members.some((member) => member.isReadyForNextInvestmentDay !== undefined);
  const readyCount = members.filter((member) => member.isReadyForNextInvestmentDay).length;

  return (
    <View style={[styles.readinessRow, style]}>
      {members.map((member, index) => (
        <Avatar
          key={member.id}
          initials={member.initials}
          imageSource={member.imageSource}
          size="sm"
          ring={hasReadiness ? (member.isReadyForNextInvestmentDay ? 'ready' : 'pending') : 'none'}
          style={index === 0 ? undefined : styles.avatarSpacing}
        />
      ))}
      <AppText variant="meta" color="secondary" style={{ marginLeft: spacing.sm }}>
        {hasReadiness
          ? `${readyCount} of ${members.length} ${noun}`
          : `${members.length} ${members.length === 1 ? 'member' : 'members'}`}
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
