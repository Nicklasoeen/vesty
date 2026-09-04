import { useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { AppText } from '@/ui';

interface ClubOptionsSheetProps {
  visible: boolean;
  isOwner: boolean;
  onClose: () => void;
  onInvite: () => void;
}

export function ClubOptionsSheet({ visible, isOwner, onClose, onInvite }: ClubOptionsSheetProps) {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close club options" onPress={onClose} style={styles.backdrop} />
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
            Club
          </AppText>

          {isOwner ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Invite member"
              onPress={() => {
                onClose();
                onInvite();
              }}
              style={({ pressed }) => [
                styles.row,
                {
                  minHeight: 48,
                  borderRadius: radius.md,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <AppText variant="body">Invite member</AppText>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create club"
            onPress={() => {
              onClose();
              router.push('/clubs/new');
            }}
            style={({ pressed }) => [
              styles.row,
              {
                minHeight: 48,
                borderRadius: radius.md,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <AppText variant="body">Create club</AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Join club"
            onPress={() => {
              onClose();
              router.push('/clubs/join');
            }}
            style={({ pressed }) => [
              styles.row,
              {
                minHeight: 48,
                borderRadius: radius.md,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <AppText variant="body">Join club</AppText>
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
