import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BOTTOM_NAVIGATION_HEIGHT } from '@/navigation/BottomNavigation';
import { useTheme } from '@/theme';
import { AppText, Button, Screen } from '@/ui';

/**
 * Club tab when the signed-in user has no active memberships.
 */
export function ClubEmptyState() {
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <Screen
      scroll={false}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: spacing.lg,
      }}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
          paddingBottom: BOTTOM_NAVIGATION_HEIGHT + insets.bottom,
        }}
      >
        <AppText variant="title" accessibilityRole="header">
          No clubs yet
        </AppText>
        <AppText variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
          Create a club with friends, or join one with an invite code.
        </AppText>

        <View style={{ marginTop: spacing.xl }}>
          <Button
            label="Create a club"
            variant="primary"
            block
            onPress={() => router.push('/clubs/new')}
            accessibilityLabel="Create a club"
          />
          <View style={{ height: spacing.sm }} />
          <Button
            label="Join a club"
            variant="secondary"
            block
            onPress={() => router.push('/clubs/join')}
            accessibilityLabel="Join a club"
          />
        </View>
      </View>
    </Screen>
  );
}

export function HomeClubsEmpty() {
  const { spacing } = useTheme();
  const router = useRouter();

  return (
    <View>
      <AppText variant="body" color="secondary">
        No clubs yet
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create a club"
        onPress={() => router.push('/clubs/new')}
        style={{ marginTop: spacing.sm }}
      >
        <AppText variant="bodyStrong" color="accent">
          Create a club
        </AppText>
      </Pressable>
    </View>
  );
}
