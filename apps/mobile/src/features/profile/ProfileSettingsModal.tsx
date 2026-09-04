import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRouter } from 'expo-router';

import { useAuth } from '@/features/auth/useAuth';
import { useTheme, type AppearancePreference } from '@/theme';
import { AppText, Avatar } from '@/ui';

import { BrokerPickerSheet } from './BrokerPickerSheet';
import { preferredBrokerSettingsValue } from './brokers';
import { useProfile } from './useProfile';

const OPTIONS: { value: AppearancePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const OPEN_DURATION_MS = 240;
const CLOSE_DURATION_MS = 200;
const SHEET_TOP_RADIUS = 24;
const HANDLE_WIDTH = 36;
const HANDLE_HEIGHT = 4;
const OFFSCREEN_Y = 640;

interface ProfileSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Profile / Settings surface. Identity, broker preference, appearance, and sign out.
 * Opened from the Home profile avatar. Not a full profile editor.
 */
export function ProfileSettingsModal({ visible, onClose }: ProfileSettingsModalProps) {
  const { colorScheme, colors, spacing, radius, appearancePreference, setAppearancePreference } = useTheme();
  const { signOut } = useAuth();
  const { profile, initials, avatarSource } = useProfile();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [brokerPickerOpen, setBrokerPickerOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [sheetY] = useState(() => new Animated.Value(OFFSCREEN_Y));
  const [backdropProgress] = useState(() => new Animated.Value(0));
  const sheetHeightRef = useRef(0);
  const hasOpenedRef = useRef(false);
  const closingRef = useRef(false);
  const shown = visible || isClosing;

  const runOpenAnimation = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdropProgress, {
        toValue: 1,
        duration: OPEN_DURATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetY, {
        toValue: 0,
        duration: OPEN_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropProgress, sheetY]);

  const dismiss = useCallback(() => {
    if (closingRef.current) {
      return;
    }
    closingRef.current = true;
    setBrokerPickerOpen(false);
    setIsClosing(true);

    Animated.parallel([
      Animated.timing(backdropProgress, {
        toValue: 0,
        duration: CLOSE_DURATION_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(sheetY, {
        toValue: sheetHeightRef.current || OFFSCREEN_Y,
        duration: CLOSE_DURATION_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      closingRef.current = false;
      if (!finished) {
        setIsClosing(false);
        return;
      }
      onClose();
      setIsClosing(false);
    });
  }, [backdropProgress, onClose, sheetY]);

  const onSignOut = useCallback(() => {
    dismiss();
    void signOut();
  }, [dismiss, signOut]);

  const onEditProfile = useCallback(() => {
    dismiss();
    router.push('/profile-edit');
  }, [dismiss, router]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    closingRef.current = false;
    hasOpenedRef.current = false;
    backdropProgress.setValue(0);

    const height = sheetHeightRef.current;
    if (height > 0) {
      hasOpenedRef.current = true;
      sheetY.setValue(height);
      runOpenAnimation();
      return;
    }

    sheetY.setValue(OFFSCREEN_Y);
  }, [backdropProgress, runOpenAnimation, sheetY, visible]);

  const onSheetLayout = (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    sheetHeightRef.current = height;
    if (visible && !closingRef.current && !hasOpenedRef.current) {
      hasOpenedRef.current = true;
      sheetY.setValue(height);
      runOpenAnimation();
    }
  };

  const overlayColor = colorScheme === 'dark' ? 'rgba(0, 0, 0, 0.22)' : 'rgba(11, 22, 32, 0.12)';
  const handleColor = colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.24)' : 'rgba(11, 27, 34, 0.22)';

  return (
    <Modal
      visible={shown}
      animationType="none"
      transparent
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={brokerPickerOpen ? () => setBrokerPickerOpen(false) : dismiss}
    >
      <View style={styles.root}>
        <Animated.View
          pointerEvents="none"
          style={[styles.backdropFill, { opacity: backdropProgress, backgroundColor: overlayColor }]}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close settings"
          onPress={dismiss}
          style={styles.backdropHit}
        />

        <Animated.View
          onLayout={onSheetLayout}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingHorizontal: spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
              transform: [{ translateY: sheetY }],
            },
          ]}
        >
          <View
            accessible={false}
            importantForAccessibility="no"
            style={[styles.handle, { backgroundColor: handleColor, marginTop: spacing.sm, marginBottom: spacing.sm }]}
          />

          <View style={[styles.headerRow, { marginBottom: spacing.lg }]}>
            <AppText variant="title">Profile / Settings</AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={dismiss}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <AppText variant="bodyStrong" color="accent">
                Done
              </AppText>
            </Pressable>
          </View>

          <View style={[styles.identityRow, { marginBottom: spacing.lg }]}>
            <Avatar
              initials={initials}
              imageSource={avatarSource}
              size="lg"
              accessibilityLabel="Your profile photo"
            />
            <AppText variant="bodyStrong" style={{ marginLeft: spacing.md, flex: 1 }}>
              {profile?.displayName ?? initials}
            </AppText>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            onPress={onEditProfile}
            style={({ pressed }) => [
              styles.optionRow,
              {
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                minHeight: 44,
                marginBottom: spacing.xl,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <AppText variant="body">Edit profile</AppText>
          </Pressable>

          <AppText variant="sectionTitle" color="secondary" style={{ marginBottom: spacing.sm }}>
            Investing
          </AppText>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Preferred broker, ${preferredBrokerSettingsValue(profile?.preferredBroker ?? null)}`}
            onPress={() => setBrokerPickerOpen(true)}
            style={({ pressed }) => [
              styles.optionRow,
              {
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                minHeight: 44,
                marginBottom: spacing.xl,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <AppText variant="body">Preferred broker</AppText>
            <AppText variant="body" color="secondary">
              {preferredBrokerSettingsValue(profile?.preferredBroker ?? null)}
            </AppText>
          </Pressable>

          <AppText variant="sectionTitle" color="secondary" style={{ marginBottom: spacing.sm }}>
            Appearance
          </AppText>

          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Appearance"
            style={{ borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}
          >
            {OPTIONS.map((option, index) => {
              const selected = option.value === appearancePreference;

              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                  onPress={() => setAppearancePreference(option.value)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    {
                      backgroundColor: colors.surface,
                      borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                      paddingHorizontal: spacing.md,
                      minHeight: 44,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <AppText variant="body" color={selected ? 'primary' : 'secondary'}>
                    {option.label}
                  </AppText>
                  {selected ? <Feather name="check" size={18} color={colors.accent} /> : null}
                </Pressable>
              );
            })}
          </View>

          <AppText variant="sectionTitle" color="secondary" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
            Account
          </AppText>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={onSignOut}
            style={({ pressed }) => [
              styles.optionRow,
              {
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                minHeight: 44,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <AppText variant="body">Sign out</AppText>
          </Pressable>
        </Animated.View>

        <BrokerPickerSheet
          embedded
          visible={brokerPickerOpen}
          onClose={() => setBrokerPickerOpen(false)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropFill: {
    ...StyleSheet.absoluteFill,
  },
  backdropHit: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: SHEET_TOP_RADIUS,
    borderTopRightRadius: SHEET_TOP_RADIUS,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    borderRadius: HANDLE_HEIGHT / 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
