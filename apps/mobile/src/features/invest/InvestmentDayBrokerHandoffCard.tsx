import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText, Button } from '@/ui';

import {
  presentHandoffCardModel,
  type BrokerHandoffAvailability,
  type BrokerHandoffPhase,
  type HandoffCardAction,
} from './presentInvestmentDayBrokerHandoff';

interface InvestmentDayBrokerHandoffCardProps {
  availability: BrokerHandoffAvailability;
  phase: BrokerHandoffPhase;
  fundName: string | null;
  isin: string | null;
  plannedAmountLabel: string;
  onOpen: () => void;
  onOpenAgain: () => void;
  onRetry: () => void;
  onReport: () => void;
  onChooseBroker: () => void;
}

export function InvestmentDayBrokerHandoffCard({
  availability,
  phase,
  fundName,
  isin,
  plannedAmountLabel,
  onOpen,
  onOpenAgain,
  onRetry,
  onReport,
  onChooseBroker,
}: InvestmentDayBrokerHandoffCardProps) {
  const { colors, radius, spacing } = useTheme();
  const model = presentHandoffCardModel({
    availability,
    phase,
    fundName,
    isin,
    plannedAmountLabel,
  });

  const runAction = (action: HandoffCardAction) => {
    switch (action) {
      case 'open':
        onOpen();
        return;
      case 'open_again':
        onOpenAgain();
        return;
      case 'retry':
        onRetry();
        return;
      case 'report':
        onReport();
        return;
      case 'choose_broker':
        onChooseBroker();
    }
  };

  return (
    <View
      style={{
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: model.welcomeBack ? colors.mint : colors.border,
        backgroundColor: model.welcomeBack ? colors.mintSoft : colors.surface,
        padding: spacing.lg,
      }}
    >
      <AppText variant="eyebrow">
        {model.availability === 'nordnet' ? 'Nordnet' : 'Broker'}
      </AppText>
      <AppText variant="title" style={{ marginTop: spacing.xs }}>
        {model.title}
      </AppText>
      {model.fundName ? (
        <AppText variant="bodyStrong" style={{ marginTop: spacing.md }}>
          {model.fundName}
        </AppText>
      ) : null}
      {model.isin ? (
        <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
          {model.isin}
        </AppText>
      ) : null}
      {model.showPlannedAmount && model.plannedAmountLabel ? (
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
      {model.manualHelp && (model.error || model.listingUnavailable) ? (
        <AppText variant="body" style={{ marginTop: spacing.md }}>
          {model.manualHelp}
        </AppText>
      ) : null}
      {model.loading ? (
        <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
          <ActivityIndicator accessibilityLabel="Opening Nordnet" color={colors.accent} />
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
            accessibilityHint={
              model.primary.action === 'open' || model.primary.action === 'open_again'
                ? 'Opens Nordnet. Vesty does not send money or place an order.'
                : model.primary.action === 'report'
                  ? 'Opens the report. Opening a broker never saves purchases.'
                  : undefined
            }
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
            accessibilityHint={
              model.secondary.action === 'report'
                ? 'Opens the report without saving anything yet.'
                : model.secondary.action === 'open_again'
                  ? 'Opens Nordnet again. Vesty does not send money or place an order.'
                  : undefined
            }
          />
        </View>
      ) : null}
    </View>
  );
}
