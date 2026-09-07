import { Feather } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText } from '@/ui';

import { presentCreateClubProgress } from './presentCreateClub';
import type { CreateClubStep } from './createClubWizard';

interface CreateClubStepHeaderProps {
  step: CreateClubStep;
  onBack: () => void;
  backDisabled?: boolean;
  supporting?: string | null;
  supportingEmphasis?: boolean;
}

export function CreateClubStepHeader({
  step,
  onBack,
  backDisabled = false,
  supporting,
  supportingEmphasis = false,
}: CreateClubStepHeaderProps) {
  const { colors, spacing } = useTheme();
  const progress = presentCreateClubProgress(step);
  const supportingCopy = supporting ?? progress.supporting;

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        disabled={backDisabled}
        onPress={onBack}
        hitSlop={10}
        style={({ pressed }) => ({
          marginTop: spacing.md,
          opacity: backDisabled ? 0.4 : pressed ? 0.7 : 1,
          alignSelf: 'flex-start',
        })}
      >
        <Feather name="chevron-left" size={24} color={colors.textPrimary} />
      </Pressable>

      <View
        style={{
          marginTop: spacing.md,
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <AppText variant="label">{progress.eyebrow}</AppText>
        <AppText variant="supporting">{progress.progressLabel}</AppText>
      </View>

      <AppText variant="title" accessibilityRole="header" style={{ marginTop: spacing.xs }}>
        {progress.title}
      </AppText>

      {supportingCopy ? (
        <AppText
          variant={supportingEmphasis ? 'subtitle' : 'body'}
          color={supportingEmphasis ? 'primary' : 'secondary'}
          style={{ marginTop: spacing.sm }}
        >
          {supportingCopy}
        </AppText>
      ) : null}
    </View>
  );
}
