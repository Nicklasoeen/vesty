import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import type { InvestTargetDemo } from '@/demo/investDemoData';
import { formatNok } from '@/lib/currency';
import { formatBpsAsPercentLabel } from '@/lib/money';
import { useTheme } from '@/theme';
import { AppText, Button } from '@/ui';

/** Local demo interaction only. Opening the broker never means invested. */
export type InvestRowStep = 'not_started' | 'broker_opened' | 'done';

interface InvestmentRowProps {
  target: InvestTargetDemo;
  color: string;
  brokerActionLabel: string;
  step: InvestRowStep;
  /** Upcoming preview and completed recap hide broker/confirm actions. */
  showActions: boolean;
  showSeparator: boolean;
  onOpenBroker: () => void;
  onMarkDone: () => void;
}

/**
 * One investment target. Today is sequential: open broker, then report done.
 * Opening the broker never marks the row complete.
 */
export function InvestmentRow({
  target,
  color,
  brokerActionLabel,
  step,
  showActions,
  showSeparator,
  onOpenBroker,
  onMarkDone,
}: InvestmentRowProps) {
  const { colors, spacing } = useTheme();
  const percentLabel = formatBpsAsPercentLabel(target.allocationBps);
  const amountLabel = formatNok(target.amountNok);
  const isDone = step === 'done';

  return (
    <View>
      {showSeparator ? <View style={[styles.separator, { backgroundColor: colors.border }]} /> : null}

      <View style={[styles.row, { paddingVertical: spacing.md }]}>
        <View style={[styles.swatch, { backgroundColor: color, marginRight: spacing.sm }]} />

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <AppText variant="bodyStrong" style={styles.title}>
              {target.label}
            </AppText>
            {isDone ? (
              <View
                accessible
                accessibilityRole="text"
                accessibilityLabel={`${target.label} completed`}
                style={styles.doneBadge}
              >
                <Feather name="check" size={14} color={colors.positive} />
                <AppText variant="meta" color="positive" style={{ marginLeft: 4 }}>
                  Done
                </AppText>
              </View>
            ) : null}
          </View>

          <View style={[styles.metaRow, { marginTop: 2 }]}>
            <AppText variant="meta" color="secondary">
              {percentLabel}
            </AppText>
            <AppText variant="bodyStrong">{amountLabel}</AppText>
          </View>

          {showActions && step === 'not_started' ? (
            <View style={{ marginTop: spacing.sm }}>
              <Button
                label={brokerActionLabel}
                variant="secondary"
                size="sm"
                onPress={onOpenBroker}
                accessibilityLabel={`${brokerActionLabel} for ${target.label}`}
                accessibilityHint="Opens the broker. This does not record the investment as done."
              />
            </View>
          ) : null}

          {showActions && step === 'broker_opened' ? (
            <View style={{ marginTop: spacing.sm }}>
              <AppText variant="meta" color="secondary" style={{ marginBottom: spacing.xs }}>
                Did you complete this?
              </AppText>
              <Button
                label="Mark as done"
                variant="primary"
                size="sm"
                onPress={onMarkDone}
                accessibilityLabel={`Mark ${target.label} as done`}
                accessibilityHint="Reports that you completed this investment. This is not broker verification."
              />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  body: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    paddingRight: 8,
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
});
