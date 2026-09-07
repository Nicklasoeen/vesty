import type { PropsWithChildren } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { presentSelectableOptionAppearance } from './selectableOptionAppearance';

interface SelectableOptionCardProps extends PropsWithChildren {
  title: string;
  description?: string | null;
  caption?: string | null;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/**
 * Single-select row for Create Club and later onboarding choices.
 * The whole card is the hit target; selected state is fill + border + radio.
 */
export function SelectableOptionCard({
  title,
  description,
  caption,
  selected,
  onPress,
  disabled = false,
  accessibilityLabel,
  children,
}: SelectableOptionCardProps) {
  const { colors, radius, spacing } = useTheme();
  const appearance = presentSelectableOptionAppearance(selected);
  const surfaceColor = appearance.surfaceToken === 'mintSoft' ? colors.mintSoft : colors.surface;
  const borderColor = appearance.borderToken === 'accent' ? colors.accent : colors.border;

  return (
    <Pressable
      accessibilityRole={appearance.accessibilityRole}
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 64,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderWidth: selected ? 2 : 1,
        borderColor,
        backgroundColor: surfaceColor,
        opacity: pressed && !disabled ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: spacing.sm }}>
          <AppText variant="bodyStrong">{title}</AppText>
          {description ? (
            <AppText variant="supporting" style={{ marginTop: 4 }}>
              {description}
            </AppText>
          ) : null}
          {caption ? (
            <AppText variant="supporting" style={{ marginTop: 4 }}>
              {caption}
            </AppText>
          ) : null}
        </View>
        <View
          accessible={false}
          style={{
            width: 22,
            height: 22,
            marginTop: 1,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: selected ? colors.accent : colors.textSecondary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {appearance.indicator === 'filled' ? (
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: colors.accent,
              }}
            />
          ) : null}
        </View>
      </View>
      {children ? <View style={{ marginTop: spacing.sm }}>{children}</View> : null}
    </Pressable>
  );
}
