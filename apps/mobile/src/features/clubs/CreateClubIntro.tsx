import { Feather } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { AppText, VestyMark, VestyWordmark } from '@/ui';

import { presentCreateClubCloseControl, presentCreateClubIntro } from './presentCreateClubFlow';

const MARKERS = [
  { left: 28, top: 36, fill: '#EFDFC6' },
  { right: 20, top: 72, fill: '#C9F1DC' },
  { left: 86, bottom: 8, fill: '#E1E0F4' },
] as const;

interface CreateClubIntroProps {
  onStart: () => void;
  onClose: () => void;
  closeDisabled?: boolean;
  embedded?: boolean;
}

export function CreateClubIntro({
  onStart,
  onClose,
  closeDisabled = false,
  embedded = false,
}: CreateClubIntroProps) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const copy = presentCreateClubIntro();
  const close = presentCreateClubCloseControl({ phase: 'intro', submitState: closeDisabled ? 'loading' : 'idle' });

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.accentDeep,
        paddingTop: (embedded ? 0 : insets.top) + spacing.md,
        paddingBottom: insets.bottom + spacing.lg,
        paddingHorizontal: spacing.xl,
      }}
    >
      <View
        style={{
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ width: 40 }} />
        <VestyWordmark color={colors.onAccent} height={24} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={close.accessibilityLabel}
          accessibilityHint={close.accessibilityHint}
          accessibilityState={{ disabled: closeDisabled }}
          disabled={closeDisabled}
          onPress={onClose}
          hitSlop={10}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            alignItems: 'flex-end',
            justifyContent: 'center',
            opacity: closeDisabled ? 0.35 : pressed ? 0.7 : 1,
          })}
        >
          <Feather name="x" size={24} color={colors.onAccent} />
        </Pressable>
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ height: 236, marginBottom: spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
          <View
            accessibilityElementsHidden
            style={{
              position: 'absolute',
              width: 230,
              height: 184,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.14)',
              transform: [{ rotate: '-25deg' }],
            }}
          />
          <View
            accessibilityElementsHidden
            style={{
              position: 'absolute',
              width: 300,
              height: 210,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              transform: [{ rotate: '28deg' }],
            }}
          />
          <View
            style={{
              width: 118,
              height: 118,
              borderRadius: 35,
              backgroundColor: colors.mintSoft,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ rotate: '-10deg' }],
            }}
          >
            <VestyMark color={colors.accentDeep} height={52} />
          </View>
          {MARKERS.map((marker, index) => (
            <View
              key={index}
              accessibilityElementsHidden
              style={{
                position: 'absolute',
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: marker.fill,
                borderWidth: 4,
                borderColor: '#224C56',
                ...marker,
              }}
            />
          ))}
        </View>

        <AppText variant="display" color="onAccent" accessibilityRole="header">
          {`${copy.titleLead}\n`}
          <AppText variant="display" style={{ color: colors.mintSoft }}>
            {copy.titleEmphasis}
          </AppText>
        </AppText>
        <AppText variant="body" style={{ marginTop: spacing.md, color: '#BDCFD0' }}>
          {copy.body}
        </AppText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.startLabel}
        onPress={onStart}
        style={{
          minHeight: 56,
          borderRadius: radius.lg,
          backgroundColor: colors.mintSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText variant="bodyStrong" color="accent">
          {copy.startLabel}
        </AppText>
      </Pressable>
      <AppText variant="supporting" style={{ marginTop: spacing.md, textAlign: 'center', color: '#BDCFD0' }}>
        {copy.timeLabel}
      </AppText>
    </View>
  );
}
