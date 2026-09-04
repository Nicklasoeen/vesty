import { useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { AppText } from '@/ui';

interface QuickActionsSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Central + actions. V1 only exposes Create club and Join club.
 */
export function QuickActionsSheet({ visible, onClose }: QuickActionsSheetProps) {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const go = (href: '/clubs/new' | '/clubs/join') => {
    onClose();
    router.push(href);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close quick actions"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingHorizontal: spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
        >
          <AppText variant="title" style={{ marginBottom: spacing.md }}>
            Quick actions
          </AppText>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create club"
            accessibilityHint="Start a new investment club"
            onPress={() => go('/clubs/new')}
            style={({ pressed }) => [
              styles.row,
              {
                minHeight: 56,
                borderRadius: radius.md,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <AppText variant="body">Create club</AppText>
            <AppText variant="meta" color="secondary" style={{ marginTop: 2 }}>
              Start a new investment club
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Join club"
            accessibilityHint="Enter an invite code"
            onPress={() => go('/clubs/join')}
            style={({ pressed }) => [
              styles.row,
              {
                minHeight: 56,
                borderRadius: radius.md,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <AppText variant="body">Join club</AppText>
            <AppText variant="meta" color="secondary" style={{ marginTop: 2 }}>
              Enter an invite code
            </AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(11, 22, 32, 0.2)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  row: {
    justifyContent: 'center',
  },
});
