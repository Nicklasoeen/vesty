import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { darkColors, lightColors, radius, spacing, typography, type ColorScheme, type ThemeColors } from './tokens';

export type AppearancePreference = 'system' | 'light' | 'dark';

const APPEARANCE_STORAGE_KEY = 'vesty.appearancePreference';

interface ThemeContextValue {
  /** Resolved light/dark used for painting. */
  colorScheme: ColorScheme;
  /** User-selected preference, including follow-the-device. */
  appearancePreference: AppearancePreference;
  setAppearancePreference: (preference: AppearancePreference) => void;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveColorScheme(preference: AppearancePreference, systemScheme: ColorScheme): ColorScheme {
  return preference === 'system' ? systemScheme : preference;
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemSchemeRaw = useColorScheme();
  const systemScheme: ColorScheme = systemSchemeRaw === 'dark' ? 'dark' : 'light';
  const [preference, setPreference] = useState<AppearancePreference>('system');

  useEffect(() => {
    let cancelled = false;

    void AsyncStorage.getItem(APPEARANCE_STORAGE_KEY)
      .then((stored) => {
        if (cancelled) {
          return;
        }
        if (stored === 'system' || stored === 'light' || stored === 'dark') {
          setPreference(stored);
        }
      })
      .catch(() => {
        // Device-local preference is optional; stay on System if storage is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setAppearancePreference = useCallback((next: AppearancePreference) => {
    setPreference(next);
    void AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, next).catch(() => {
      // Keep the in-session selection even if persistence fails.
    });
  }, []);

  const colorScheme = resolveColorScheme(preference, systemScheme);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colorScheme,
      appearancePreference: preference,
      setAppearancePreference,
      colors: colorScheme === 'dark' ? darkColors : lightColors,
      spacing,
      radius,
      typography,
    }),
    [colorScheme, preference, setAppearancePreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
