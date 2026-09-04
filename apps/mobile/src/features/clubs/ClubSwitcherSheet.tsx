import { Feather } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { AppText } from '@/ui';
import type { ClubSummary } from './types';

interface ClubSwitcherSheetProps {
  visible: boolean;
  clubs: readonly ClubSummary[];
  selectedClubId: string | null;
  onSelect: (clubId: string) => void;
  onClose: () => void;
}

export function ClubSwitcherSheet({
  visible,
  clubs,
  selectedClubId,
  onSelect,
  onClose,
}: ClubSwitcherSheetProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close club list" onPress={onClose} style={styles.backdrop} />
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
            Your clubs
          </AppText>
          {clubs.map((club, index) => {
            const selected = club.clubId === selectedClubId;
            return (
              <Pressable
                key={club.clubId}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={club.name}
                onPress={() => {
                  onSelect(club.clubId);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    minHeight: 48,
                    borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="body">{club.name}</AppText>
                  <AppText variant="meta" color="secondary">
                    {club.members.length} {club.members.length === 1 ? 'member' : 'members'}
                  </AppText>
                </View>
                {selected ? <Feather name="check" size={18} color={colors.accent} /> : null}
              </Pressable>
            );
          })}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
