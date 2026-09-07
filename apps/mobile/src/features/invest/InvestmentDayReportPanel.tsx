import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { formatNokFromMinor } from '@/lib/currency';
import { useTheme } from '@/theme';
import { AppText, Button, SelectableOptionCard, Surface, TextField } from '@/ui';

import type { QuantityFieldState } from './investmentDayReporting';
import type {
  InvestmentDayReportChoice,
  ReportedAmountField,
} from './investmentDayReport';
import {
  presentOptionalExecutionCaption,
  presentReportChoices,
  presentReportedVersusPlanned,
  presentReportError,
  presentReportSubmitHint,
  presentReportSubmitLabel,
  type InvestmentDayReportSubmitState,
} from './presentInvestmentDayReport';
import type { InvestTargetRow } from './types';

export interface InvestmentDayReportPanelProps {
  expectedAmountMinor: number;
  targets: readonly InvestTargetRow[];
  choice: InvestmentDayReportChoice;
  amountFields: Readonly<Record<string, ReportedAmountField>>;
  quantityFields: Readonly<Record<string, QuantityFieldState>>;
  priceFields: Readonly<Record<string, QuantityFieldState>>;
  showOptionalExecution: boolean;
  reportedTotalMinor: number;
  canSubmit: boolean;
  submitState: InvestmentDayReportSubmitState;
  error: string | null;
  onChoiceChange: (choice: InvestmentDayReportChoice) => void;
  onAmountChange: (targetId: string, value: string) => void;
  onQuantityChange: (targetId: string, value: string) => void;
  onPriceChange: (targetId: string, value: string) => void;
  onSubmit: () => void;
}

export function InvestmentDayReportPanel({
  expectedAmountMinor,
  targets,
  choice,
  amountFields,
  quantityFields,
  priceFields,
  showOptionalExecution,
  reportedTotalMinor,
  canSubmit,
  submitState,
  error,
  onChoiceChange,
  onAmountChange,
  onQuantityChange,
  onPriceChange,
  onSubmit,
}: InvestmentDayReportPanelProps) {
  const { spacing } = useTheme();
  const [optionalOpen, setOptionalOpen] = useState(false);
  const options = presentReportChoices(expectedAmountMinor, targets.length);
  const submitLabel = presentReportSubmitLabel(choice, submitState);
  const visibleError = presentReportError(submitState, error);
  const loading = submitState === 'loading';
  const showExecutionFields = showOptionalExecution && optionalOpen
    && (choice === 'as_planned' || choice === 'with_changes');

  return (
    <View>
      <AppText variant="sectionTitle">How did it go?</AppText>
      <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
        Report what actually happened after your broker. Vesty does not see the order.
      </AppText>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        {options.map((option) => {
          const selected = option.choice === choice;
          return (
            <SelectableOptionCard
              key={option.choice}
              title={option.title}
              description={option.description}
              selected={selected}
              disabled={loading}
              onPress={() => onChoiceChange(option.choice)}
              accessibilityLabel={option.title}
            >
              {selected && option.choice === 'as_planned' ? (
                <PlannedBreakdown targets={targets} />
              ) : null}
              {selected && option.choice === 'with_changes' ? (
                <ChangedAmounts
                  targets={targets}
                  amountFields={amountFields}
                  plannedTotalMinor={expectedAmountMinor}
                  reportedTotalMinor={reportedTotalMinor}
                  disabled={loading}
                  onAmountChange={onAmountChange}
                />
              ) : null}
            </SelectableOptionCard>
          );
        })}
      </View>

      {showOptionalExecution && (choice === 'as_planned' || choice === 'with_changes') ? (
        <Surface bordered style={{ marginTop: spacing.lg, padding: spacing.md }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: optionalOpen }}
            onPress={() => setOptionalOpen((open) => !open)}
            disabled={loading}
          >
            <AppText variant="bodyStrong">
              {optionalOpen ? 'Units and price' : 'Add units and price (optional)'}
            </AppText>
            <AppText variant="meta" color="secondary" style={{ marginTop: spacing.xs }}>
              {presentOptionalExecutionCaption()}
            </AppText>
          </Pressable>
          {showExecutionFields ? (
            <>
              {targets.map((target) => {
                const title = target.ticker ?? target.exposureLabel ?? target.label;
                const quantity = quantityFields[target.id];
                const price = priceFields[target.id];
                return (
                  <View key={target.id} style={{ marginTop: spacing.md }}>
                    <AppText variant="meta">{title}</AppText>
                    <View style={{ marginTop: spacing.xs }}>
                      <TextField
                        label="Units purchased (optional)"
                        value={quantity?.raw ?? ''}
                        onChangeText={(value) => onQuantityChange(target.id, value)}
                        keyboardType="decimal-pad"
                        placeholder="0.642381"
                        error={Boolean(quantity?.error)}
                        editable={!loading}
                        accessibilityLabel={`Optional units for ${title}`}
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
                        onChangeText={(value) => onPriceChange(target.id, value)}
                        keyboardType="decimal-pad"
                        placeholder="167.54"
                        error={Boolean(price?.error)}
                        editable={!loading}
                        accessibilityLabel={`Optional price for ${title}`}
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
            </>
          ) : null}
        </Surface>
      ) : null}

      {visibleError ? (
        <AppText variant="meta" color="negative" style={{ marginTop: spacing.md }} accessibilityLiveRegion="polite">
          {visibleError}
        </AppText>
      ) : null}

      {submitState === 'idempotent' ? (
        <AppText variant="meta" color="positive" style={{ marginTop: spacing.md }}>
          Same report received. Nothing was duplicated.
        </AppText>
      ) : null}

      <View style={{ marginTop: spacing.xl }}>
        <Button
          label={submitLabel}
          variant="primary"
          block
          disabled={!canSubmit || loading}
          busy={loading}
          onPress={onSubmit}
          accessibilityHint={presentReportSubmitHint(choice)}
        />
      </View>
      <AppText variant="meta" color="secondary" style={{ marginTop: spacing.sm }}>
        {presentReportSubmitHint(choice)}
      </AppText>
    </View>
  );
}

function PlannedBreakdown({ targets }: { targets: readonly InvestTargetRow[] }) {
  const { spacing } = useTheme();
  return (
    <View>
      {targets.map((target) => (
        <AppText key={target.id} variant="meta" style={{ marginTop: spacing.xs }}>
          {target.ticker ?? target.exposureLabel ?? target.label}
          {'  ·  '}
          {formatNokFromMinor(target.amountMinor)}
        </AppText>
      ))}
      <AppText variant="meta" color="secondary" style={{ marginTop: spacing.sm }}>
        Last step: confirm that this frozen plan is what you bought.
      </AppText>
    </View>
  );
}

function ChangedAmounts({
  targets,
  amountFields,
  plannedTotalMinor,
  reportedTotalMinor,
  disabled,
  onAmountChange,
}: {
  targets: readonly InvestTargetRow[];
  amountFields: Readonly<Record<string, ReportedAmountField>>;
  plannedTotalMinor: number;
  reportedTotalMinor: number;
  disabled: boolean;
  onAmountChange: (targetId: string, value: string) => void;
}) {
  const { spacing } = useTheme();
  return (
    <View>
      {targets.map((target) => {
        const title = target.ticker ?? target.exposureLabel ?? target.label;
        const field = amountFields[target.id];
        return (
          <View key={target.id} style={{ marginTop: spacing.sm }}>
            <TextField
              label={`${title} (planned ${formatNokFromMinor(target.amountMinor)})`}
              value={field?.raw ?? ''}
              onChangeText={(value) => onAmountChange(target.id, value)}
              keyboardType="number-pad"
              placeholder="0"
              error={Boolean(field?.error)}
              editable={!disabled}
              accessibilityLabel={`Reported kroner for ${title}`}
            />
            {field?.error ? (
              <AppText variant="meta" color="negative" style={{ marginTop: spacing.xs }}>
                {field.error}
              </AppText>
            ) : null}
          </View>
        );
      })}
      <AppText variant="bodyStrong" style={{ marginTop: spacing.md }}>
        {presentReportedVersusPlanned(reportedTotalMinor, plannedTotalMinor)}
      </AppText>
    </View>
  );
}
