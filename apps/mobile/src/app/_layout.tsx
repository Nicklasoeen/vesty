import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/lib/supabase/client';
import { ThemeProvider } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
