import { View } from 'react-native';

import { formatNokFromMinor } from '@/lib/currency';
import { useTheme } from '@/theme';
import { AppText, Button, TextField } from '@/ui';

import type { QuantityFieldState } from './investmentDayReporting';
import type { InvestTargetRow } from './types';

interface ExactHoldingsFormProps {
  targets: InvestTargetRow[];
  quantityStateByTarget: Readonly<Record<string, QuantityFieldState>>;
  priceStateByTarget: Readonly<Record<string, QuantityFieldState>>;
  canSave: boolean;
  isSaving: boolean;
  error: string | null;
  onQuantityChange: (id: string, value: string) => void;
  onExecutionPriceChange: (id: string, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function ExactHoldingsForm({
  targets,
  quantityStateByTarget,
  priceStateByTarget,
  canSave,
  isSaving,
  error,
  onQuantityChange,
  onExecutionPriceChange,
  onSave,
  onCancel,
}: ExactHoldingsFormProps) {
  const { spacing } = useTheme();

  return (
    <View>
      <AppText variant="body" color="secondary">
        Want more accurate portfolio values? Add the exact number of units you bought.
      </AppText>
      <AppText variant="meta" color="secondary" style={{ marginTop: spacing.xs }}>
        This is optional.
      </AppText>

      {targets.map((target) => {
        const title = target.ticker ?? target.exposureLabel ?? target.label;
        const quantity = quantityStateByTarget[target.id];
        const price = priceStateByTarget[target.id];

        return (
          <View key={target.id} style={{ marginTop: spacing.lg }}>
            <AppText variant="bodyStrong">{title}</AppText>
            <AppText variant="meta" color="secondary" style={{ marginTop: 2 }}>
              {formatNokFromMinor(target.amountMinor)} invested
            </AppText>

            <View style={{ marginTop: spacing.sm }}>
              <TextField
                label="Units purchased"
                value={quantity?.raw ?? ''}
                onChangeText={(value) => onQuantityChange(target.id, value)}
                keyboardType="decimal-pad"
                placeholder="0.642381"
                error={Boolean(quantity?.error)}
                accessibilityLabel={`Units purchased for ${title}`}
              />
              {quantity?.error ? (
                <AppText variant="meta" color="negative" style={{ marginTop: spacing.xs }}>
                  {quantity.error}
                </AppText>
              ) : null}
            </View>

            <View style={{ marginTop: spacing.sm }}>
              <TextField
                label="Price per unit (optional)"
                value={price?.raw ?? ''}
                onChangeText={(value) => onExecutionPriceChange(target.id, value)}
                keyboardType="decimal-pad"
                placeholder="167.54"
                error={Boolean(price?.error)}
                accessibilityLabel={`Price per unit for ${title}`}
              />
              {price?.error ? (
                <AppText variant="meta" color="negative" style={{ marginTop: spacing.xs }}>
                  {price.error}
                </AppText>
              ) : null}
            </View>
          </View>
        );
      })}

      {error ? (
        <AppText variant="meta" color="negative" style={{ marginTop: spacing.md }} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}

      <View style={{ marginTop: spacing.lg }}>
        <Button
          label={isSaving ? 'Saving…' : 'Save exact holdings'}
          variant="secondary"
          block
          disabled={!canSave || isSaving}
          busy={isSaving}
          onPress={onSave}
          accessibilityHint="Saves the units you bought. This is optional and reported by you."
        />
      </View>
      <View style={{ marginTop: spacing.sm }}>
        <Button label="Not now" variant="secondary" block onPress={onCancel} />
      </View>
    </View>
  );
}
