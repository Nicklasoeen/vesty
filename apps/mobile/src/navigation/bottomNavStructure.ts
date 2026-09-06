export const BOTTOM_NAV_TAB_KEYS = ['home', 'club', 'invest', 'activity'] as const;
export const BOTTOM_NAV_SLOTS = ['home', 'club', 'action', 'invest', 'activity'] as const;

export type BottomNavigationTabKey = (typeof BOTTOM_NAV_TAB_KEYS)[number];
