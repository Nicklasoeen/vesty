import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';

import { useTheme } from '@/theme';
import { AppText, Button } from '@/ui';
import { copyText } from './copyText';
import { formatInviteToken } from './inviteToken';

interface InviteMemberSheetProps {
  visible: boolean;
  clubName: string;
  inviteToken: string | null;
  isGenerating: boolean;
  error: string | null;
  onClose: () => void;
}

export function InviteMemberSheet({
  visible,
  clubName,
  inviteToken,
  isGenerating,
  error,
  onClose,
}: InviteMemberSheetProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  if (!visible) {
    return null;
  }

  const formatted = inviteToken ? formatInviteToken(inviteToken) : null;
  const inviteLink = inviteToken ? Linking.createURL('/clubs/join', { queryParams: { code: inviteToken } }) : null;

  const onCopyCode = async () => {
    if (!inviteToken) {
      return;
    }
    await copyText(inviteToken);
    setCopied('code');
  };

  const onCopyLink = async () => {
    if (!inviteLink) {
      return;
    }
    await copyText(inviteLink);
    setCopied('link');
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close invite" onPress={onClose} style={styles.backdrop} />
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
          <AppText variant="title">Invite to {clubName}</AppText>
          <AppText variant="body" color="secondary" style={{ marginTop: spacing.sm }}>
            Share this code. Anyone with it can join.
          </AppText>

          {isGenerating ? (
            <AppText variant="body" color="secondary" style={{ marginTop: spacing.lg }}>
              Generating invite…
            </AppText>
          ) : null}

          {error ? (
            <AppText variant="meta" color="negative" style={{ marginTop: spacing.md }} accessibilityLiveRegion="polite">
              {error}
            </AppText>
          ) : null}

          {formatted ? (
            <View style={{ marginTop: spacing.lg }}>
              <AppText variant="meta" color="secondary">
                Invite code
              </AppText>
              <AppText
                variant="subtitle"
                selectable
                style={{ marginTop: spacing.xs, letterSpacing: 0.6 }}
              >
                {formatted}
              </AppText>
            </View>
          ) : null}

          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <Button
              label={copied === 'code' ? 'Copied' : 'Copy code'}
              variant="primary"
              block
              disabled={!inviteToken || isGenerating}
              onPress={() => {
                void onCopyCode();
              }}
            />
            <Button
              label={copied === 'link' ? 'Copied' : 'Copy invite link'}
              variant="secondary"
              block
              disabled={!inviteLink || isGenerating}
              onPress={() => {
                void onCopyLink();
              }}
            />
          </View>
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
  },
});
