import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';
import { AppText, VestyMark } from '@/ui';

export type BottomNavigationTabKey = 'home' | 'club' | 'invest' | 'activity';

type FeatherTabConfig = {
  key: Exclude<BottomNavigationTabKey, 'home'>;
  label: string;
  icon: keyof typeof Feather.glyphMap;
};

type HomeTabConfig = {
  key: 'home';
  label: 'Home';
};

type TabConfig = HomeTabConfig | FeatherTabConfig;

/**
 * Fixed destination set for this design spike.
 * Home / Club / Invest / Activity — not a generalized nav framework.
 */
const TABS: TabConfig[] = [
  { key: 'home', label: 'Home' },
  { key: 'club', label: 'Club', icon: 'users' },
  { key: 'invest', label: 'Invest', icon: 'trending-up' },
  { key: 'activity', label: 'Activity', icon: 'activity' },
];

/** Visual height of the inset nav container (icon + label row). */
const NAV_CONTAINER_HEIGHT = 52;

/** Gap between the nav container and the home-indicator / screen edge. */
const NAV_BOTTOM_GAP = spacing.sm;

/** Horizontal inset from screen edges. */
const NAV_HORIZONTAL_INSET = spacing.md;

/**
 * Softer than radius.lg, short of a stadium/pill (half of 52 would be 26).
 * Local to the nav so other surfaces stay on the existing radius scale.
 */
const NAV_CONTAINER_RADIUS = 22;

/**
 * Vertical clearance screens should reserve above the safe-area inset:
 * container height + gap beneath the bar. Screens still add `insets.bottom`.
 */
export const BOTTOM_NAVIGATION_HEIGHT = NAV_CONTAINER_HEIGHT + NAV_BOTTOM_GAP;

const ICON_SIZE = 20;
/** Optically matches Feather 20 icons; mark viewBox is wider than it is tall. */
const MARK_HEIGHT = 15;

interface BottomNavigationProps {
  activeTab: BottomNavigationTabKey;
  onSelectTab: (tab: BottomNavigationTabKey) => void;
}

/**
 * App-shell bottom navigation — a softly rounded inset control layer,
 * shared across Home / Club / Invest / Activity.
 */
export function BottomNavigation({ activeTab, onSelectTab }: BottomNavigationProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.shell,
        {
          left: NAV_HORIZONTAL_INSET,
          right: NAV_HORIZONTAL_INSET,
          bottom: insets.bottom + NAV_BOTTOM_GAP,
        },
      ]}
    >
      <View
        style={[
          styles.container,
          {
            height: NAV_CONTAINER_HEIGHT,
            backgroundColor: colors.surface,
            borderColor: colors.border,
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
              hitSlop={4}
              style={({ pressed }) => [styles.item, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View
                style={[
                  styles.activeChip,
                  { backgroundColor: isActive ? colors.accentMuted : 'transparent' },
                ]}
              >
                {tab.key === 'home' ? (
                  <VestyMark color={iconColor} height={MARK_HEIGHT} />
                ) : (
                  <Feather name={tab.icon} size={ICON_SIZE} color={iconColor} />
                )}
                <AppText
                  variant="meta"
                  color={isActive ? 'primary' : 'secondary'}
                  style={[styles.label, isActive ? styles.labelActive : undefined]}
                >
                  {tab.label}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: NAV_CONTAINER_RADIUS,
    paddingHorizontal: 4,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  activeChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  label: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 13,
  },
  labelActive: {
    fontWeight: '600',
  },
});
