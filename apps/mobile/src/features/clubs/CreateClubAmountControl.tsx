import { Pressable, TextInput, View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText } from '@/ui';

import { presentCreateClubAmountPresets } from './presentCreateClubFlow';

interface CreateClubAmountControlProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onApplyPreset: (input: string) => void;
  accessibilityLabel: string;
  editable: boolean;
}

export function CreateClubAmountControl({
  label,
  value,
  onChangeText,
  onApplyPreset,
  accessibilityLabel,
  editable,
}: CreateClubAmountControlProps) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View>
      <AppText variant="label">{label}</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.sm }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="number-pad"
          inputMode="numeric"
          editable={editable}
          accessibilityLabel={accessibilityLabel}
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          style={[
            typography.display,
            {
              flex: 1,
              color: colors.textPrimary,
              paddingVertical: spacing.xs,
            },
          ]}
        />
        <AppText variant="title" color="secondary">
          kr
        </AppText>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
        {presentCreateClubAmountPresets().map((preset) => (
          <Pressable
            key={preset.input}
            accessibilityRole="button"
            accessibilityLabel={preset.accessibilityLabel}
            disabled={!editable}
            onPress={() => onApplyPreset(preset.input)}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              borderRadius: 999,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            }}
          >
            <AppText variant="meta">{preset.label}</AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
