import { StyleSheet, View } from 'react-native';

import { formatNokFromMinor } from '@/lib/currency';
import { formatBpsAsPercentLabel } from '@/lib/money';
import { useTheme } from '@/theme';
import { AppText, Button } from '@/ui';

import type { InvestTargetRow } from './types';

interface InvestmentRowProps {
  target: InvestTargetRow;
  color: string;
  brokerActionLabel: string;
  showBrokerAction: boolean;
  showSeparator: boolean;
  onOpenBroker: () => void;
}

/**
 * One planned investment. Opening the broker never confirms the day.
 */
export function InvestmentRow({
  target,
  color,
  brokerActionLabel,
  showBrokerAction,
  showSeparator,
  onOpenBroker,
}: InvestmentRowProps) {
  const { colors, spacing } = useTheme();
  const percentLabel = formatBpsAsPercentLabel(target.allocationBps);
  const amountLabel = formatNokFromMinor(target.amountMinor);
  const title = target.exposureLabel ?? target.label;
  const detail = target.ticker
    ? `${target.ticker} \u00B7 ${target.secondaryLabel ?? target.label}`
    : target.secondaryLabel ?? null;

  return (
    <View>
      {showSeparator ? <View style={[styles.separator, { backgroundColor: colors.border }]} /> : null}

      <View style={[styles.row, { paddingVertical: spacing.md }]}>
        <View style={[styles.swatch, { backgroundColor: color, marginRight: spacing.sm }]} />

        <View style={styles.body}>
          <AppText variant="bodyStrong">{title}</AppText>
          {detail ? (
            <AppText variant="meta" color="secondary" style={{ marginTop: 2 }}>
              {detail}
            </AppText>
          ) : null}

          <View style={[styles.metaRow, { marginTop: spacing.xs }]}>
            <AppText variant="bodyStrong">{amountLabel}</AppText>
            <AppText variant="meta" color="secondary">
              {percentLabel}
            </AppText>
          </View>

          {showBrokerAction ? (
            <View style={{ marginTop: spacing.sm }}>
              <Button
                label={brokerActionLabel}
                variant="secondary"
                size="sm"
                onPress={onOpenBroker}
                accessibilityLabel={`${brokerActionLabel} for ${title}`}
                accessibilityHint="Opens the broker. This does not mark the investment as done."
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
});
