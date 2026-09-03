import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { AppText } from '@/ui';

export type BottomNavigationTabKey = 'home' | 'club' | 'activity';

interface TabConfig {
  key: BottomNavigationTabKey;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

/**
 * Fixed, minimal destination set for this design spike.
 * Not a generalized navigation framework — extend deliberately.
 */
const TABS: TabConfig[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'club', label: 'Club', icon: 'users' },
  { key: 'activity', label: 'Activity', icon: 'activity' },
];

/** Content height, excluding the bottom safe-area inset. Screens use this to reserve scroll clearance. */
export const BOTTOM_NAVIGATION_HEIGHT = 56;

const ICON_SIZE = 21;

interface BottomNavigationProps {
  activeTab: BottomNavigationTabKey;
  onSelectTab: (tab: BottomNavigationTabKey) => void;
}

/**
 * App-shell bottom navigation. Visual only for now — selecting a tab just
 * updates local state, no routing is wired up yet.
 */
export function BottomNavigation({ activeTab, onSelectTab }: BottomNavigationProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          height: BOTTOM_NAVIGATION_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      ]}
    >
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        const iconColor = isActive ? colors.accent : colors.textSecondary;

        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelectTab(tab.key)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
            hitSlop={6}
            style={styles.item}
          >
            <View style={[styles.indicator, { backgroundColor: isActive ? colors.accent : 'transparent' }]} />
            <Feather name={tab.icon} size={ICON_SIZE} color={iconColor} />
            <AppText
              variant="caption"
              color={isActive ? 'primary' : 'secondary'}
              style={[styles.label, isActive ? styles.labelActive : undefined]}
            >
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    width: 16,
    height: 3,
    borderRadius: 1.5,
    marginBottom: 6,
  },
  label: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 13,
  },
  labelActive: {
    fontWeight: '600',
  },
});
