import type { PropsWithChildren } from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useTheme } from '@/theme';
import { AppText } from '@/ui';

interface CreateClubChoiceProps extends PropsWithChildren {
  title: string;
  description?: string | null;
  selected: boolean;
  onPress: () => void;
  locked?: boolean;
  lockReason?: string | null;
  accessibilityLabel?: string;
  disabled?: boolean;
}

export function CreateClubChoice({
  title,
  description,
  selected,
  onPress,
  locked = false,
  lockReason = null,
  accessibilityLabel,
  disabled = false,
  children,
}: CreateClubChoiceProps) {
  const { colors, radius, spacing } = useTheme();
  const inactive = disabled || locked;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: selected && !locked, disabled: inactive }}
      accessibilityLabel={accessibilityLabel ?? title}
      disabled={inactive}
      onPress={onPress}
      style={{
        width: '100%',
        borderRadius: radius.xl,
        borderWidth: selected && !locked ? 2 : 1,
        borderColor: selected && !locked ? colors.accent : colors.border,
        backgroundColor: locked ? colors.surfaceSecondary : selected ? colors.mintSoft : colors.surface,
        padding: spacing.lg,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            {locked ? (
              <Feather name="lock" size={16} color={colors.textSecondary} accessibilityElementsHidden />
            ) : null}
            <AppText variant={selected && !locked ? 'title' : 'subtitle'} style={{ flex: 1 }}>
              {title}
            </AppText>
          </View>
          {description ? (
            <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
              {description}
            </AppText>
          ) : null}
          {locked && lockReason ? (
            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: spacing.sm,
                paddingHorizontal: spacing.sm,
                paddingVertical: 4,
                borderRadius: radius.full,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <AppText variant="meta">{lockReason}</AppText>
            </View>
          ) : null}
          {children}
        </View>
        {selected && !locked ? (
          <View
            accessibilityElementsHidden
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="check" size={12} color={colors.onAccent} />
          </View>
        ) : (
          <View
            accessibilityElementsHidden
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              borderWidth: 2,
              borderColor: colors.textSecondary,
            }}
          />
        )}
      </View>
    </Pressable>
  );
}
