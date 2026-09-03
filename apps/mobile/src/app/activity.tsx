import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { BottomNavigation } from '@/navigation/BottomNavigation';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useTheme } from '@/theme';
import { AppText, Screen } from '@/ui';

/**
 * Non-functional placeholder destination for this design spike. Activity
 * remains part of the navigation shell, but its screen isn't in scope yet.
 */
export default function ActivityRoute() {
  const { colorScheme, colors, spacing } = useTheme();
  const { activeTab, onSelectTab } = useAppNavigation('activity');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg }}>
          <AppText variant="subtitle">Activity</AppText>
          <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
            Coming soon
          </AppText>
        </View>
      </Screen>

      <BottomNavigation activeTab={activeTab} onSelectTab={onSelectTab} />
    </View>
  );
}
