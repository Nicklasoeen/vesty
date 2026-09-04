import { useRouter, type Href } from 'expo-router';

import type { BottomNavigationTabKey } from './BottomNavigation';

const TAB_ROUTES: Record<BottomNavigationTabKey, Href> = {
  home: '/home',
  club: '/club',
  invest: '/invest',
  activity: '/activity',
};

/**
 * Wires BottomNavigation to Expo Router for the design spike. Each screen
 * declares which tab it represents; selecting a different tab replaces the
 * current route so switching tabs behaves like switching destinations
 * rather than pushing an ever-growing stack.
 */
export function useAppNavigation(currentTab: BottomNavigationTabKey) {
  const router = useRouter();

  return {
    activeTab: currentTab,
    onSelectTab: (tab: BottomNavigationTabKey) => {
      if (tab !== currentTab) {
        router.replace(TAB_ROUTES[tab]);
      }
    },
  };
}
