import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { AppText } from '@/ui';

import { BROKER_OPTIONS, type PreferredBroker } from './brokers';
import { useProfile } from './useProfile';

interface BrokerPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Render inside an already-presented native Modal.
   * A second RN Modal next to Profile / Settings does not present on iOS.
   */
  embedded?: boolean;
}

/**
 * Compact preferred-broker picker. Saves immediately and updates profile state.
 */
export function BrokerPickerSheet({ visible, onClose, embedded = false }: BrokerPickerSheetProps) {
  const body = <BrokerPickerBody onClose={onClose} />;

  if (embedded) {
    if (!visible) {
      return null;
    }
    return <View style={styles.embeddedRoot}>{body}</View>;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      {body}
    </Modal>
  );
}

function BrokerPickerBody({ onClose }: { onClose: () => void }) {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, setPreferredBroker } = useProfile();
  const selected = profile?.preferredBroker ?? null;
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (next: PreferredBroker | null) => {
    if (isSaving) {
      return;
    }
    if (next === selected) {
      onClose();
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await setPreferredBroker(next);
      onClose();
    } catch {
      setError('Unable to save your broker right now');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close broker picker"
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
          Choose your broker
        </AppText>

        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Preferred broker"
          style={{ borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}
        >
          {BROKER_OPTIONS.map((option, index) => {
            const isSelected = option.value === selected;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected, disabled: isSaving }}
                accessibilityLabel={option.label}
                disabled={isSaving}
                onPress={() => void choose(option.value)}
                style={({ pressed }) => [
                  styles.optionRow,
                  {
                    borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                    paddingHorizontal: spacing.md,
                    minHeight: 44,
                    opacity: pressed || isSaving ? 0.7 : 1,
                  },
                ]}
              >
                <AppText variant="body" color={isSelected ? 'primary' : 'secondary'}>
                  {option.label}
                </AppText>
                {isSelected ? <Feather name="check" size={18} color={colors.accent} /> : null}
              </Pressable>
            );
          })}

          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: selected === null, disabled: isSaving }}
            accessibilityLabel="No broker selected"
            disabled={isSaving}
            onPress={() => void choose(null)}
            style={({ pressed }) => [
              styles.optionRow,
              {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
                paddingHorizontal: spacing.md,
                minHeight: 44,
                opacity: pressed || isSaving ? 0.7 : 1,
              },
            ]}
          >
            <AppText variant="body" color={selected === null ? 'primary' : 'secondary'}>
              No broker selected
            </AppText>
            {selected === null ? <Feather name="check" size={18} color={colors.accent} /> : null}
          </Pressable>
        </View>

        {error ? (
          <AppText variant="meta" color="secondary" style={{ marginTop: spacing.md }}>
            {error}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  embeddedRoot: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
  },
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
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
