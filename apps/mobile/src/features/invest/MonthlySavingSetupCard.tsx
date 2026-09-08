import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText, Button } from '@/ui';

import {
  presentMonthlySavingCardModel,
  type MonthlySavingAction,
  type MonthlySavingPhase,
  type MonthlySavingSetup,
} from './presentMonthlySavingSetup';

interface MonthlySavingSetupCardProps {
  setup: MonthlySavingSetup;
  phase: MonthlySavingPhase;
  onSetupMonthly: () => void;
  onUpdateMonthly: () => void;
  onCheckNordnet: () => void;
  onBuyOnce: () => void;
  onConfirmSetup: () => void;
  onNotYet: () => void;
  onRetry: () => void;
  onReport: () => void;
}

export function MonthlySavingSetupCard({
  setup,
  phase,
  onSetupMonthly,
  onUpdateMonthly,
  onCheckNordnet,
  onBuyOnce,
  onConfirmSetup,
  onNotYet,
  onRetry,
  onReport,
}: MonthlySavingSetupCardProps) {
  const { colors, radius, spacing } = useTheme();
  const model = presentMonthlySavingCardModel({ setup, phase });

  const runAction = (action: MonthlySavingAction) => {
    switch (action) {
      case 'setup_monthly':
        onSetupMonthly();
        return;
      case 'update_monthly':
        onUpdateMonthly();
        return;
      case 'check_nordnet':
        onCheckNordnet();
        return;
      case 'buy_once':
        onBuyOnce();
        return;
      case 'confirm_setup':
        onConfirmSetup();
        return;
      case 'not_yet':
        onNotYet();
        return;
      case 'retry':
        onRetry();
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
        borderColor: phase === 'returned' ? colors.mint : colors.border,
        backgroundColor: phase === 'returned' ? colors.mintSoft : colors.surface,
        padding: spacing.lg,
      }}
    >
      <AppText variant="eyebrow">Nordnet</AppText>
      {model.badge ? (
        <AppText variant="meta" color="positive" style={{ marginTop: spacing.xs }}>
          {model.badge}
        </AppText>
      ) : null}
      <AppText variant="title" style={{ marginTop: spacing.xs }}>
        {model.title}
      </AppText>
      {model.fundName ? (
        <AppText variant="bodyStrong" style={{ marginTop: spacing.md }}>
          {model.fundName}
        </AppText>
      ) : null}
      {model.amountLabel ? (
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
          <AppText variant="supporting">Monthly amount</AppText>
          <AppText variant="bodyStrong">{model.amountLabel}</AppText>
        </View>
      ) : null}
      {model.scheduleLabel ? (
        <AppText variant="supporting" style={{ marginTop: spacing.md }}>
          {`Investment Day · ${model.scheduleLabel}`}
        </AppText>
      ) : null}
      <AppText variant="supporting" style={{ marginTop: spacing.md }}>
        {model.body}
      </AppText>
      {model.disclaimer ? (
        <AppText variant="meta" style={{ marginTop: spacing.sm }}>
          {model.disclaimer}
        </AppText>
      ) : null}
      {model.loading ? (
        <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
          <ActivityIndicator accessibilityLabel="Working" color={colors.accent} />
        </View>
      ) : null}
      {model.primary ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button
            label={model.primary.label}
            variant="primary"
            block
            busy={model.primary.busy}
            disabled={model.primary.busy}
            onPress={() => runAction(model.primary!.action)}
            accessibilityHint="Opens Nordnet or saves your confirmation. Vesty does not send money or place an order."
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
