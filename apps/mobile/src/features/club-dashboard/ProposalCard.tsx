import { StyleSheet, View } from 'react-native';

import type { ActiveProposalDemo } from '@/demo/clubDemoData';
import { useTheme } from '@/theme';
import { AppText, Button, Surface } from '@/ui';

interface ProposalCardProps {
  proposal: ActiveProposalDemo;
}

/**
 * Active strategy proposal summary. Shared between the Club Dashboard's
 * "Open proposal" section and Home's "Needs your attention" section — same
 * content, same visual weight, so it reads as one consistent product
 * concept rather than two different UIs for the same thing.
 */
export function ProposalCard({ proposal }: ProposalCardProps) {
  const { colors, spacing } = useTheme();

  return (
    <Surface bordered style={{ padding: spacing.lg, borderLeftWidth: 2, borderLeftColor: colors.accent }}>
      <AppText variant="body">
        <AppText variant="bodyStrong">{proposal.proposedByName}</AppText> proposed a strategy change
      </AppText>

      <View style={{ marginTop: spacing.md }}>
        {proposal.changes.map((change, index) => (
          <View key={change.id} style={[styles.changeRow, index > 0 ? { marginTop: spacing.sm } : undefined]}>
            <AppText variant="body" color="secondary">
              {change.label}
            </AppText>
            <AppText variant="bodyStrong">
              {change.fromPercentage}% {'\u2192'} {change.toPercentage}%
            </AppText>
          </View>
        ))}
      </View>

      <View style={[styles.footerRow, { marginTop: spacing.lg }]}>
        <AppText variant="caption">
          {proposal.votesCast} of {proposal.votesTotal} voted
        </AppText>
        <Button label="View proposal" variant="secondary" />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
