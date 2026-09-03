import { Stack } from 'expo-router';

import '@/lib/supabase/client';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
