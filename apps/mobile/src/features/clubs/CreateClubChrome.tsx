import { Feather } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText, VestyWordmark } from '@/ui';

import { CreateClubProgressBar } from './CreateClubProgressBar';
import { presentCreateClubProgress } from './presentCreateClub';
import type { CreateClubStep } from './createClubWizard';

interface CreateClubChromeProps {
  step: CreateClubStep;
  onBack: () => void;
  onClose: () => void;
  backDisabled?: boolean;
  closeDisabled?: boolean;
  closeAccessibilityLabel?: string;
  closeAccessibilityHint?: string;
  inverted?: boolean;
}

export function CreateClubChrome({
  step,
  onBack,
  onClose,
  backDisabled = false,
  closeDisabled = false,
  closeAccessibilityLabel = 'Close club setup',
  closeAccessibilityHint,
  inverted = false,
}: CreateClubChromeProps) {
  const { colors, spacing } = useTheme();
  const progress = presentCreateClubProgress(step);
  const ink = inverted ? colors.onAccent : colors.textPrimary;

  return (
    <View>
      <View
        style={{
          minHeight: 52,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          disabled={backDisabled}
          onPress={onBack}
          hitSlop={10}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            justifyContent: 'center',
            opacity: backDisabled ? 0.35 : pressed ? 0.7 : 1,
          })}
        >
          <Feather name="chevron-left" size={26} color={ink} />
        </Pressable>
        <VestyWordmark color={ink} height={22} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeAccessibilityLabel}
          accessibilityHint={closeAccessibilityHint}
          accessibilityState={{ disabled: closeDisabled }}
          disabled={closeDisabled}
          onPress={onClose}
          hitSlop={10}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            alignItems: 'flex-end',
            justifyContent: 'center',
            opacity: closeDisabled ? 0.35 : pressed ? 0.7 : 1,
          })}
        >
          <Feather name="x" size={24} color={ink} />
        </Pressable>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginTop: spacing.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <CreateClubProgressBar step={step} />
        </View>
        <AppText variant="supporting" style={{ color: ink }}>
          {progress.progressLabel}
        </AppText>
      </View>
      <AppText
        variant="display"
        accessibilityRole="header"
        style={{ marginTop: spacing.xl, color: ink }}
      >
        {progress.title}
      </AppText>
      {progress.supporting ? (
        <AppText variant="body" style={{ marginTop: spacing.sm, color: inverted ? colors.mintSoft : colors.textSecondary }}>
          {progress.supporting}
        </AppText>
      ) : null}
    </View>
  );
}
