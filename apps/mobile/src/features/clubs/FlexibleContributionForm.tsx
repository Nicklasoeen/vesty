import { useState } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText, Button, TextField } from '@/ui';

import { parseContributionKronerInput } from './contributionAmount';
import { presentOwnFlexibleContribution } from './presentContribution';

interface FlexibleContributionFormProps {
  initialKroner?: string;
  submitLabel: string;
  busy?: boolean;
  showAppliesNext?: boolean;
  onSubmit: (amountMinor: number) => Promise<void>;
}

export function FlexibleContributionForm({
  initialKroner = '',
  submitLabel,
  busy = false,
  showAppliesNext = false,
  onSubmit,
}: FlexibleContributionFormProps) {
  const { spacing } = useTheme();
  const copy = presentOwnFlexibleContribution(null);
  const [amount, setAmount] = useState(initialKroner);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const amountMinor = parseContributionKronerInput(amount);
  const canSubmit = amountMinor != null && !isSubmitting && !busy;

  const save = async () => {
    if (amountMinor == null || isSubmitting || busy) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(amountMinor);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save your contribution');
      setIsSubmitting(false);
    }
  };

  return (
    <View>
      <AppText variant="body" color="secondary">
        Choose how much you want to contribute on each Investment Day.
      </AppText>
      <AppText variant="meta" color="secondary" style={{ marginTop: spacing.sm }}>
        {copy.privacy}
      </AppText>
      {showAppliesNext ? (
        <AppText variant="meta" color="secondary" style={{ marginTop: spacing.xs }}>
          {copy.appliesNext}
        </AppText>
      ) : null}

      <View style={{ marginTop: spacing.lg }}>
        <TextField
          label="Your amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
          inputMode="numeric"
          autoCorrect={false}
          editable={!isSubmitting && !busy}
          error={Boolean(error)}
          accessibilityLabel="Your amount in kroner"
          placeholder="2000"
        />
      </View>
      <AppText variant="meta" color="secondary" style={{ marginTop: spacing.xs }}>
        kroner per Investment Day
      </AppText>

      {error ? (
        <AppText variant="meta" color="negative" style={{ marginTop: spacing.sm }} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}

      <View style={{ marginTop: spacing.xl }}>
        <Button
          label={isSubmitting || busy ? 'Saving…' : submitLabel}
          variant="primary"
          block
          disabled={!canSubmit}
          busy={isSubmitting || busy}
          onPress={() => {
            void save();
          }}
        />
      </View>
    </View>
  );
}
