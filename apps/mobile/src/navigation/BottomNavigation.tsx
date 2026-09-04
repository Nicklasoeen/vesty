import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';
import { AppText, VestyMark } from '@/ui';

import { QuickActionsSheet } from './QuickActionsSheet';

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

const NAV_SLOTS = ['home', 'club', 'action', 'invest', 'activity'] as const;

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

const ACTION_BUTTON_SIZE = 48;
const ACTION_BUTTON_LIFT = 10;
const ACTION_BUTTON_OVERHANG = 8;
const ACTION_ICON_COLOR = '#032C3C';
const ACTION_BUTTON_BACKGROUND = '#FFFFFF';

/**
 * Vertical clearance screens should reserve above the safe-area inset:
 * container height + gap beneath the bar + the raised + control.
 * Screens still add `insets.bottom`.
 */
export const BOTTOM_NAVIGATION_HEIGHT = NAV_CONTAINER_HEIGHT + NAV_BOTTOM_GAP + ACTION_BUTTON_OVERHANG;

const ICON_SIZE = 20;
/** Optically matches Feather 20 icons; mark viewBox is wider than it is tall. */
const MARK_HEIGHT = 15;

interface BottomNavigationProps {
  activeTab: BottomNavigationTabKey;
  onSelectTab: (tab: BottomNavigationTabKey) => void;
}

/**
 * App-shell bottom navigation — a softly rounded inset control layer,
 * shared across Home / Club / Invest / Activity. The central + is an
 * action control, not a fifth route.
 */
export function BottomNavigation({ activeTab, onSelectTab }: BottomNavigationProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [actionsOpen, setActionsOpen] = useState(false);

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
        {NAV_SLOTS.map((slot) => {
          if (slot === 'action') {
            return <View key="action" style={styles.item} pointerEvents="none" />;
          }

          const tab = TABS.find((item) => item.key === slot);
          if (!tab) {
            return null;
          }

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

      <View pointerEvents="box-none" style={styles.actionLayer}>
        <Pressable
          onPress={() => setActionsOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Create or join a club"
          accessibilityHint="Opens quick actions to create or join a club"
          hitSlop={6}
          style={({ pressed }) => [
            styles.actionButton,
            {
              top: (NAV_CONTAINER_HEIGHT - ACTION_BUTTON_SIZE) / 2 - ACTION_BUTTON_LIFT,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Feather name="plus" size={22} color={ACTION_ICON_COLOR} />
        </Pressable>
      </View>

      <QuickActionsSheet visible={actionsOpen} onClose={() => setActionsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    overflow: 'visible',
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
  actionLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
  },
  actionButton: {
    position: 'absolute',
    width: ACTION_BUTTON_SIZE,
    height: ACTION_BUTTON_SIZE,
    borderRadius: ACTION_BUTTON_SIZE / 2,
    backgroundColor: ACTION_BUTTON_BACKGROUND,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(3, 44, 60, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACTION_ICON_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
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
