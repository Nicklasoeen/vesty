import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, type ColorScheme } from '@/theme';
import { AppText } from '@/ui';

interface QuickActionsSheetProps {
  visible: boolean;
  onClose: () => void;
}

type QuickActionIcon = keyof typeof Feather.glyphMap;

interface QuickActionRowProps {
  icon: QuickActionIcon;
  label: string;
  hint: string;
  onPress: () => void;
}

/**
 * Central + actions. V1 only exposes Create club and Join club.
 */
export function QuickActionsSheet({ visible, onClose }: QuickActionsSheetProps) {
  const { colorScheme, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const materials = sheetMaterials(colorScheme);

  const go = (href: '/clubs/new' | '/clubs/join') => {
    onClose();
    router.push(href);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: materials.backdrop }]}>
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
              backgroundColor: materials.fill,
              borderColor: materials.border,
              paddingHorizontal: spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
        >
          <View pointerEvents="none" style={[styles.sheetSheen, { backgroundColor: materials.sheen }]} />
          <View style={[styles.handle, { backgroundColor: materials.handle }]} />

          <AppText variant="title" style={{ marginBottom: spacing.md }}>
            Quick actions
          </AppText>

          <QuickActionRow
            icon="plus"
            label="Create club"
            hint="Start a new investment club"
            onPress={() => go('/clubs/new')}
          />
          <QuickActionRow
            icon="users"
            label="Join club"
            hint="Enter an invite code"
            onPress={() => go('/clubs/join')}
          />
        </View>
      </View>
    </Modal>
  );
}

function QuickActionRow({ icon, label, hint, onPress }: QuickActionRowProps) {
  const { colors, colorScheme, radius, spacing } = useTheme();
  const dark = colorScheme === 'dark';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: 64,
          marginBottom: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          backgroundColor: dark ? 'rgba(26, 44, 54, 0.88)' : colors.surfaceSecondary,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: dark ? 'rgba(79, 166, 184, 0.16)' : 'rgba(3, 44, 60, 0.10)',
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.iconWell,
          {
            backgroundColor: dark ? 'rgba(79, 166, 184, 0.14)' : colors.accentMuted,
          },
        ]}
      >
        <Feather name={icon} size={18} color={colors.accent} />
      </View>
      <View style={styles.rowCopy}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText variant="meta" color="secondary" style={{ marginTop: 2 }}>
          {hint}
        </AppText>
      </View>
    </Pressable>
  );
}

function sheetMaterials(scheme: ColorScheme) {
  if (scheme === 'dark') {
    return {
      backdrop: 'rgba(7, 16, 22, 0.52)',
      fill: 'rgba(14, 28, 36, 0.98)',
      border: 'rgba(79, 166, 184, 0.16)',
      sheen: 'rgba(206, 226, 232, 0.06)',
      handle: 'rgba(196, 214, 220, 0.28)',
    };
  }

  return {
    backdrop: 'rgba(11, 22, 32, 0.28)',
    fill: '#FFFFFF',
    border: 'rgba(3, 44, 60, 0.10)',
    sheen: 'rgba(255, 255, 255, 0.40)',
    handle: 'rgba(3, 44, 60, 0.16)',
  };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingTop: 10,
  },
  sheetSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowCopy: {
    flex: 1,
    justifyContent: 'center',
  },
});
