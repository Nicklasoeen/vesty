import { View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText, Button } from '@/ui';

import {
  presentOneTimePurchaseCardModel,
  type MonthlySavingAction,
  type MonthlySavingSetup,
} from './presentMonthlySavingSetup';

interface OneTimePurchaseCardProps {
  setup: MonthlySavingSetup;
  onOpen: () => void;
  onCopyAmount: () => void;
  onReport: () => void;
}

export function OneTimePurchaseCard({
  setup,
  onOpen,
  onCopyAmount,
  onReport,
}: OneTimePurchaseCardProps) {
  const { colors, radius, spacing } = useTheme();
  const model = presentOneTimePurchaseCardModel(setup);

  const runAction = (action: MonthlySavingAction) => {
    switch (action) {
      case 'open_one_time':
        onOpen();
        return;
      case 'copy_amount':
        onCopyAmount();
        return;
      case 'report':
        onReport();
        return;
      default:
        return;
    }
  };

  return (
    <View
      style={{
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.lg,
      }}
    >
      <AppText variant="eyebrow">Nordnet</AppText>
      <AppText variant="title" style={{ marginTop: spacing.xs }}>
        {model.title}
      </AppText>
      {model.fundName ? (
        <AppText variant="bodyStrong" style={{ marginTop: spacing.md }}>
          {model.fundName}
        </AppText>
      ) : null}
      {model.plannedAmountLabel ? (
        <View
          style={{
            marginTop: spacing.md,
            paddingVertical: spacing.md,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: colors.border,
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: spacing.md,
          }}
        >
          <AppText variant="supporting">Planned</AppText>
          <AppText variant="bodyStrong">{model.plannedAmountLabel}</AppText>
        </View>
      ) : null}
      <AppText variant="supporting" style={{ marginTop: spacing.md }}>
        {model.body}
      </AppText>
      {model.disclaimer ? (
        <AppText variant="meta" style={{ marginTop: spacing.sm }}>
          {model.disclaimer}
        </AppText>
      ) : null}
      {model.primary ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button
            label={model.primary.label}
            variant="primary"
            block
            onPress={() => runAction(model.primary!.action)}
            accessibilityHint="Opens Nordnet. This does not save a monthly saving agreement."
          />
        </View>
      ) : null}
      {model.secondary ? (
        <View style={{ marginTop: spacing.md }}>
          <Button
            label={model.secondary.label}
            variant="secondary"
            block
            onPress={() => runAction(model.secondary!.action)}
          />
        </View>
      ) : null}
      {model.tertiary ? (
        <View style={{ marginTop: spacing.md }}>
          <Button
            label={model.tertiary.label}
            variant="secondary"
            block
            onPress={() => runAction(model.tertiary!.action)}
          />
        </View>
      ) : null}
    </View>
  );
}
