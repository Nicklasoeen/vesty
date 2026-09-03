import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

interface ScreenProps extends PropsWithChildren {
  /** Renders content in a vertical ScrollView. Defaults to true. */
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

/**
 * Full-bleed screen background with SafeArea-aware top padding.
 * Bottom padding is intentionally left to callers, since screens with a
 * custom tab bar need extra clearance that a generic primitive can't know.
 */
export function Screen({ children, scroll = true, contentContainerStyle }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!scroll) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top }]}>{children}</View>
    );
  }

  return (
    <ScrollView
      style={[styles.fill, { backgroundColor: colors.background }]}
      contentContainerStyle={[{ paddingTop: insets.top }, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
