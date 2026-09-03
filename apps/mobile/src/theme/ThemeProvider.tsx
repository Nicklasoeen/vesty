import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, radius, spacing, typography, type ColorScheme, type ThemeColors } from './tokens';

interface ThemeContextValue {
  colorScheme: ColorScheme;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  /** Dev-time affordance to compare dark/light without changing the OS setting. */
  toggleColorScheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const systemDefault: ColorScheme = systemScheme === 'dark' ? 'dark' : 'light';
  const [override, setOverride] = useState<ColorScheme | null>(null);

  const colorScheme = override ?? systemDefault;

  const value = useMemo<ThemeContextValue>(
    () => ({
      colorScheme,
      colors: colorScheme === 'dark' ? darkColors : lightColors,
      spacing,
      radius,
      typography,
      toggleColorScheme: () => {
        setOverride((current) => {
          const active = current ?? systemDefault;
          return active === 'dark' ? 'light' : 'dark';
        });
      },
    }),
    [colorScheme, systemDefault],
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
