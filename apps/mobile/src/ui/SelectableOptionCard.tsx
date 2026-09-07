import type { PropsWithChildren } from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

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
  locked?: boolean;
  lockReason?: string | null;
  accessibilityLabel?: string;
}

/**
 * Single-select row for Create Club and later onboarding choices.
 * The whole card is the hit target; selected state is fill + border + radio.
 * Locked choices stay readable and expose a lock label to VoiceOver.
 */
export function SelectableOptionCard({
  title,
  description,
  caption,
  selected,
  onPress,
  disabled = false,
  locked = false,
  lockReason = null,
  accessibilityLabel,
  children,
}: SelectableOptionCardProps) {
  const { colors, radius, spacing } = useTheme();
  const appearance = presentSelectableOptionAppearance(selected && !locked);
  const surfaceColor = appearance.surfaceToken === 'mintSoft' ? colors.mintSoft : colors.surface;
  const borderColor = appearance.borderToken === 'accent' ? colors.accent : colors.border;
  const inactive = disabled || locked;
  const lockText = lockReason ?? caption;

  return (
    <Pressable
      accessibilityRole={appearance.accessibilityRole}
      accessibilityState={{ selected: selected && !locked, disabled: inactive }}
      accessibilityLabel={accessibilityLabel ?? title}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 64,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderWidth: selected && !locked ? 2 : 1,
        borderColor,
        backgroundColor: locked ? colors.surfaceSecondary : surfaceColor,
        opacity: locked ? 1 : pressed && !inactive ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            {locked ? (
              <Feather
                name="lock"
                size={16}
                color={colors.textSecondary}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            ) : null}
            <AppText variant="bodyStrong" style={{ flex: 1 }}>
              {title}
            </AppText>
          </View>
          {description ? (
            <AppText variant="supporting" style={{ marginTop: 4 }}>
              {description}
            </AppText>
          ) : null}
          {locked && lockText ? (
            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: spacing.sm,
                paddingHorizontal: spacing.sm,
                paddingVertical: 4,
                borderRadius: radius.sm,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <AppText variant="meta">{lockText}</AppText>
            </View>
          ) : caption ? (
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
            borderColor: selected && !locked ? colors.accent : colors.textSecondary,
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
