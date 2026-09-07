import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { AppText, Button } from '@/ui';

import { presentCreateClubLeaveCopy } from './presentCreateClubFlow';

interface CreateClubLeaveSheetProps {
  visible: boolean;
  onSaveAndLeave: () => void;
  onDiscardSetup: () => void;
  onKeepCreating: () => void;
}

export function CreateClubLeaveSheet({
  visible,
  onSaveAndLeave,
  onDiscardSetup,
  onKeepCreating,
}: CreateClubLeaveSheetProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const copy = presentCreateClubLeaveCopy();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onKeepCreating}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.keepCreatingLabel}
          onPress={onKeepCreating}
          style={styles.backdrop}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingHorizontal: spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <AppText variant="title" accessibilityRole="header">
              {copy.title}
            </AppText>
            <AppText variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
              {copy.body}
            </AppText>
            <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
              <Button
                label={copy.saveAndLeaveLabel}
                variant="primary"
                block
                onPress={onSaveAndLeave}
              />
              <Button
                label={copy.discardSetupLabel}
                variant="secondary"
                block
                onPress={onDiscardSetup}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.keepCreatingLabel}
                onPress={onKeepCreating}
                style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <AppText variant="bodyStrong">{copy.keepCreatingLabel}</AppText>
              </Pressable>
            </View>
          </ScrollView>
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
    paddingTop: 20,
    maxHeight: '86%',
  },
});
