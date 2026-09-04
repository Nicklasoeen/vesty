import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { BottomNavigation } from '@/navigation/BottomNavigation';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useTheme } from '@/theme';
import { AppText, Screen } from '@/ui';

/**
 * Placeholder destination for the Invest tab. Product flow is out of
 * scope for this design spike — this route exists so the four-tab
 * app shell can be exercised.
 */
export default function InvestRoute() {
  const { colorScheme, colors, spacing } = useTheme();
  const { activeTab, onSelectTab } = useAppNavigation('invest');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg }}>
          <AppText variant="subtitle">Invest</AppText>
          <AppText variant="body" color="secondary" style={{ marginTop: spacing.xs }}>
            Investment actions will live here.
          </AppText>
        </View>
      </Screen>

      <BottomNavigation activeTab={activeTab} onSelectTab={onSelectTab} />
    </View>
  );
}
