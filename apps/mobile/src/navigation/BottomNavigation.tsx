import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useTheme, type ColorScheme } from '@/theme';
import { AppText, VestyMark } from '@/ui';

import { BOTTOM_NAV_SLOTS, type BottomNavigationTabKey } from './bottomNavStructure';
import { QuickActionsSheet } from './QuickActionsSheet';

export type { BottomNavigationTabKey };

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

const NAV_SLOTS = BOTTOM_NAV_SLOTS;

/** Compact capsule height: large enough for icon + label without wasted space. */
const NAV_CONTAINER_HEIGHT = 62;

/** Gap between the nav container and the home-indicator / screen edge. */
const NAV_BOTTOM_GAP = spacing.sm;

/** Horizontal inset from screen edges. */
const NAV_HORIZONTAL_INSET = spacing.lg;

const NAV_CONTAINER_RADIUS = NAV_CONTAINER_HEIGHT / 2;

/** Active and inactive content share these dimensions so selection never shifts layout. */
const TAB_CAPSULE_HEIGHT = 46;
const TAB_CAPSULE_MAX_WIDTH = 76;

/** Fixed middle slot prevents the central action from stealing adjacent tab taps. */
const ACTION_SLOT_WIDTH = 60;
const ACTION_BUTTON_SIZE = 48;
const ACTION_BUTTON_LIFT = 3;
const ACTION_BUTTON_OVERHANG = 2;

const ICON_SIZE = 18;
const MARK_HEIGHT = 13;

/**
 * Vertical clearance screens should reserve above the safe-area inset:
 * container height + gap beneath the bar + the raised + control.
 * Screens still add `insets.bottom`.
 */
export const BOTTOM_NAVIGATION_HEIGHT = NAV_CONTAINER_HEIGHT + NAV_BOTTOM_GAP + ACTION_BUTTON_OVERHANG;

interface BottomNavigationProps {
  activeTab: BottomNavigationTabKey;
  onSelectTab: (tab: BottomNavigationTabKey) => void;
}

interface NavMaterials {
  containerFill: string;
  containerBorder: string;
  activeFill: string;
  activeBorder: string;
  activeHighlight: string;
  actionFill: string;
  actionBorder: string;
  actionHighlight: string;
  actionIcon: string;
  actionShadow: string;
}

function navMaterials(scheme: ColorScheme): NavMaterials {
  if (scheme === 'dark') {
    return {
      containerFill: 'rgba(8, 26, 34, 0.96)',
      containerBorder: 'rgba(255, 255, 255, 0.14)',
      activeFill: 'rgba(43, 67, 78, 0.94)',
      activeBorder: 'rgba(79, 166, 184, 0.22)',
      activeHighlight: 'rgba(255, 255, 255, 0.10)',
      actionFill: 'rgba(255, 255, 255, 0.98)',
      actionBorder: 'rgba(255, 255, 255, 0.62)',
      actionHighlight: 'rgba(255, 255, 255, 0.94)',
      actionIcon: '#032C3C',
      actionShadow: '#021820',
    };
  }

  return {
    containerFill: '#FFFFFF',
    containerBorder: '#E4ECE9',
    activeFill: 'transparent',
    activeBorder: 'transparent',
    activeHighlight: 'transparent',
    actionFill: '#12384A',
    actionBorder: '#12384A',
    actionHighlight: 'transparent',
    actionIcon: '#FFFFFF',
    actionShadow: '#12384A',
  };
}

/**
 * App-shell bottom navigation. Four real tabs plus a central action that
 * is not a route. Selection is a stable icon-and-label capsule.
 */
export function BottomNavigation({ activeTab, onSelectTab }: BottomNavigationProps) {
  const { colors, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [actionsOpen, setActionsOpen] = useState(false);
  const materials = navMaterials(colorScheme);

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
            backgroundColor: materials.containerFill,
            borderColor: materials.containerBorder,
          },
        ]}
      >
        {NAV_SLOTS.map((slot) => {
          if (slot === 'action') {
            return <View key="action" style={styles.actionSlot} pointerEvents="none" />;
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
                  styles.tabCapsule,
                  {
                    backgroundColor: isActive ? materials.activeFill : 'transparent',
                    borderColor: isActive ? materials.activeBorder : 'transparent',
                  },
                ]}
              >
                {isActive ? (
                  <View
                    pointerEvents="none"
                    style={[styles.tabHighlight, { backgroundColor: materials.activeHighlight }]}
                  />
                ) : null}
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
        <View
          pointerEvents="box-none"
          style={[
            styles.actionLift,
            {
              top: (NAV_CONTAINER_HEIGHT - ACTION_BUTTON_SIZE) / 2 - ACTION_BUTTON_LIFT,
              shadowColor: materials.actionShadow,
            },
          ]}
        >
          <Pressable
            onPress={() => setActionsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Create or join a club"
            accessibilityHint="Opens quick actions to create or join a club"
            hitSlop={6}
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: materials.actionFill,
                borderColor: materials.actionBorder,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <View pointerEvents="none" style={[styles.actionHighlight, { backgroundColor: materials.actionHighlight }]} />
            <Feather name="plus" size={26} color={materials.actionIcon} />
          </Pressable>
        </View>
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
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  item: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  actionSlot: {
    width: ACTION_SLOT_WIDTH,
    height: '100%',
  },
  tabCapsule: {
    width: '100%',
    maxWidth: TAB_CAPSULE_MAX_WIDTH,
    height: TAB_CAPSULE_HEIGHT,
    borderRadius: TAB_CAPSULE_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tabHighlight: {
    position: 'absolute',
    top: 0,
    left: 7,
    right: 7,
    height: StyleSheet.hairlineWidth,
  },
  actionLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
  },
  actionLift: {
    position: 'absolute',
    width: ACTION_BUTTON_SIZE,
    height: ACTION_BUTTON_SIZE,
    borderRadius: ACTION_BUTTON_SIZE / 2,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.32,
    shadowRadius: 7,
    elevation: 6,
  },
  actionButton: {
    width: ACTION_BUTTON_SIZE,
    height: ACTION_BUTTON_SIZE,
    borderRadius: ACTION_BUTTON_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  actionHighlight: {
    position: 'absolute',
    top: 0,
    left: 7,
    right: 7,
    height: 1,
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
