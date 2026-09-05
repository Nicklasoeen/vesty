import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { formatNokFromMinor } from '@/lib/currency';
import { formatQuantityLabel } from '@/lib/decimalDisplay';
import { formatBpsAsPercentLabel } from '@/lib/money';
import { useTheme } from '@/theme';
import { AppText, Button, TextField } from '@/ui';

import type { InvestTargetRow } from './types';

/** Local row interaction only. Opening the broker never writes a transaction. */
export type InvestRowStep = 'not_started' | 'broker_opened' | 'done';

interface InvestmentRowProps {
  target: InvestTargetRow;
  color: string;
  brokerActionLabel: string;
  step: InvestRowStep;
  /** Upcoming preview and completed recap hide broker/confirm actions. */
  showActions: boolean;
  showSeparator: boolean;
  confirmationMode: 'quantity_required' | 'amount_only';
  quantityValue?: string;
  quantityError?: string | null;
  executionPriceValue?: string;
  executionPriceError?: string | null;
  onQuantityChange?: (value: string) => void;
  onExecutionPriceChange?: (value: string) => void;
  onOpenBroker: () => void;
  onMarkDone: () => void;
}

/**
 * One investment target. Today is sequential: open broker, then report done.
 * Opening the broker never marks the row complete and never writes a transaction.
 */
export function InvestmentRow({
  target,
  color,
  brokerActionLabel,
  step,
  showActions,
  showSeparator,
  confirmationMode,
  quantityValue,
  quantityError,
  executionPriceValue,
  executionPriceError,
  onQuantityChange,
  onExecutionPriceChange,
  onOpenBroker,
  onMarkDone,
}: InvestmentRowProps) {
  const { colors, spacing } = useTheme();
  const percentLabel = formatBpsAsPercentLabel(target.allocationBps);
  const amountLabel = formatNokFromMinor(target.amountMinor);
  const isDone = step === 'done';
  const tickerLabel = target.ticker;

  return (
    <View>
      {showSeparator ? <View style={[styles.separator, { backgroundColor: colors.border }]} /> : null}

      <View style={[styles.row, { paddingVertical: spacing.md }]}>
        <View style={[styles.swatch, { backgroundColor: color, marginRight: spacing.sm }]} />

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={styles.title}>
              <AppText variant="bodyStrong">{target.label}</AppText>
              {tickerLabel ? (
                <AppText variant="meta" color="secondary">
                  {tickerLabel}
                  {target.secondaryLabel ? `  \u00B7  ${target.secondaryLabel}` : ''}
                </AppText>
              ) : target.secondaryLabel ? (
                <AppText variant="meta" color="secondary">
                  {target.secondaryLabel}
                </AppText>
              ) : null}
            </View>
            {isDone && confirmationMode === 'amount_only' ? (
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

          {isDone ? (
            <View style={{ marginTop: spacing.xs }}>
              <AppText variant="meta" color="secondary">
                {target.quantity
                  ? formatQuantityLabel(target.quantity)
                  : 'Quantity not reported'}
              </AppText>
              <AppText variant="meta" color="secondary">
                Member-reported
              </AppText>
            </View>
          ) : null}

          {showActions && confirmationMode === 'quantity_required' ? (
            <View style={{ marginTop: spacing.sm }}>
              {step === 'not_started' ? (
                <View style={{ marginBottom: spacing.sm }}>
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

              <TextField
                label="Quantity purchased"
                value={quantityValue ?? ''}
                onChangeText={onQuantityChange}
                keyboardType="decimal-pad"
                placeholder="0.642381"
                error={Boolean(quantityError)}
                accessibilityLabel={`Quantity purchased for ${tickerLabel ?? target.label}`}
                accessibilityHint="Enter the number of units you purchased in your broker"
              />
              {quantityError ? (
                <AppText variant="meta" color="negative" style={{ marginTop: spacing.xs }}>
                  {quantityError}
                </AppText>
              ) : (
                <AppText variant="meta" color="secondary" style={{ marginTop: spacing.xs }}>
                  Enter the number of units you purchased.
                </AppText>
              )}

              <View style={{ marginTop: spacing.sm }}>
                <TextField
                  label="Execution price (optional)"
                  value={executionPriceValue ?? ''}
                  onChangeText={onExecutionPriceChange}
                  keyboardType="decimal-pad"
                  placeholder="167.54"
                  error={Boolean(executionPriceError)}
                  accessibilityLabel={`Execution price for ${tickerLabel ?? target.label}`}
                  accessibilityHint="Optional price per unit in euros, if you know it"
                />
                {executionPriceError ? (
                  <AppText variant="meta" color="negative" style={{ marginTop: spacing.xs }}>
                    {executionPriceError}
                  </AppText>
                ) : (
                  <AppText variant="meta" color="secondary" style={{ marginTop: spacing.xs }}>
                    Price per unit in euros, if you know it
                  </AppText>
                )}
              </View>
            </View>
          ) : null}

          {showActions && confirmationMode === 'amount_only' && step === 'not_started' ? (
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

          {showActions && confirmationMode === 'amount_only' && step === 'broker_opened' ? (
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
