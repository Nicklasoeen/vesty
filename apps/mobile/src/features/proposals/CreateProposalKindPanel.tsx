import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText, IconButton } from '@/ui';

interface CreateProposalKindPanelProps {
  onBack: () => void;
  onSelectContribution: () => void;
}

export function CreateProposalKindPanel({
  onBack,
  onSelectContribution,
}: CreateProposalKindPanelProps) {
  const { colors, spacing } = useTheme();

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: spacing.sm,
          marginBottom: spacing.lg,
        }}
      >
        <IconButton icon="arrow-left" accessibilityLabel="Back to proposals" onPress={onBack} />
        <AppText variant="label" style={{ marginLeft: spacing.sm }}>
          New proposal
        </AppText>
      </View>

      <AppText variant="title" accessibilityRole="header">
        What should the club decide?
      </AppText>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        disabled
        style={{
          marginTop: spacing.xl,
          paddingVertical: spacing.md,
          opacity: 0.45,
        }}
      >
        <AppText variant="bodyStrong" color="secondary">
          Investment strategy
        </AppText>
        <AppText variant="supporting" style={{ marginTop: 4 }}>
          Not available yet
        </AppText>
      </Pressable>

      <View style={{ height: 1, backgroundColor: colors.border }} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Contribution style"
        onPress={onSelectContribution}
        style={({ pressed }) => ({
          paddingVertical: spacing.md,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <AppText variant="bodyStrong">Contribution style</AppText>
        <AppText variant="supporting" style={{ marginTop: 4 }}>
          Same amount or Flexible amounts
        </AppText>
      </Pressable>
    </View>
  );
}
