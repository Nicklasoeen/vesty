import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { AppText, Button, TextField } from '@/ui';

import { canSubmitClubRename, trimmedClubName } from './createClubWizard';
import { CLUB_NAME_MAX_LENGTH } from './genesisStrategy';
import { renameClub, useClubs } from './useClubs';

interface RenameClubSheetProps {
  visible: boolean;
  clubId: string;
  currentName: string;
  onClose: () => void;
}

export function RenameClubSheet({ visible, clubId, currentName, onClose }: RenameClubSheetProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { refresh } = useClubs();
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!visible) {
    return null;
  }

  const onSave = async () => {
    if (isSubmitting || !canSubmitClubRename(currentName, name)) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await renameClub(refresh, clubId, trimmedClubName(name));
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "You don't have permission to rename this club");
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable accessibilityRole="button" accessibilityLabel="Close rename club" onPress={onClose} style={styles.backdrop} />
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
          <AppText variant="title">Club name</AppText>
          <View style={{ marginTop: spacing.lg }}>
            <TextField
              label="Name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              maxLength={CLUB_NAME_MAX_LENGTH}
              error={Boolean(error)}
              editable={!isSubmitting}
              accessibilityLabel="Club name"
            />
          </View>
          {error ? (
            <AppText variant="meta" color="negative" style={{ marginTop: spacing.sm }} accessibilityLiveRegion="polite">
              {error}
            </AppText>
          ) : null}
          <View style={{ marginTop: spacing.xl }}>
            <Button
              label="Save name"
              variant="primary"
              block
              busy={isSubmitting}
              disabled={!canSubmitClubRename(currentName, name) || isSubmitting}
              onPress={() => {
                void onSave();
              }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
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
  },
});
