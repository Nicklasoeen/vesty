import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';

import { useTheme } from '@/theme';
import { AppText, VestyMark } from '@/ui';

type OrbitVariant = 'intro' | 'medal' | 'stamp';
type MedalIcon = 'arrow-up-right' | 'arrow-down-left' | 'clock' | 'pause' | 'refresh-cw' | 'cloud-off' | 'check';

interface InvestOrbitArtProps {
  variant: OrbitVariant;
  dateBadge?: string | null;
  icon?: MedalIcon;
  reduceMotion?: boolean;
}

export function InvestOrbitArt({
  variant,
  dateBadge,
  icon = 'check',
  reduceMotion = false,
}: InvestOrbitArtProps) {
  const { colors, spacing } = useTheme();

  if (variant === 'stamp' || variant === 'medal') {
    return (
      <View
        accessibilityElementsHidden
        style={{
          alignItems: 'center',
          marginTop: spacing.md,
          marginBottom: spacing.md,
        }}
      >
        <View
          style={{
            width: 118,
            height: 118,
            borderRadius: 35,
            backgroundColor: colors.mintSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {variant === 'stamp' ? (
            <VestyMark color={colors.accentDeep} height={52} />
          ) : (
            <Feather name={icon} size={36} color={colors.accentDeep} />
          )}
        </View>
      </View>
    );
  }

  return (
    <View
      accessibilityElementsHidden
      style={{
        height: 236,
        marginBottom: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          position: 'absolute',
          width: 230,
          height: 184,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.accentDeep + '26',
          transform: [{ rotate: reduceMotion ? '0deg' : '-28deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 300,
          height: 210,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.accentDeep + '14',
          transform: [{ rotate: reduceMotion ? '0deg' : '32deg' }],
        }}
      />
      <View
        style={{
          width: 118,
          height: 118,
          borderRadius: 35,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: reduceMotion ? '0deg' : '-12deg' }],
        }}
      >
        <VestyMark color={colors.accentDeep} height={52} />
      </View>
      <View
        style={{
          position: 'absolute',
          left: 28,
          top: 36,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.surface,
          borderWidth: 4,
          borderColor: colors.mint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText variant="bodyStrong">{dateBadge ?? '05'}</AppText>
      </View>
      <View
        style={{
          position: 'absolute',
          right: 20,
          top: 72,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.accentDeep,
          borderWidth: 4,
          borderColor: colors.mint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name="repeat" size={16} color={colors.onAccent} />
      </View>
      <View
        style={{
          position: 'absolute',
          left: 86,
          bottom: 8,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.surface,
          borderWidth: 4,
          borderColor: colors.mint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name="check" size={16} color={colors.accentDeep} />
      </View>
    </View>
  );
}

export { type MedalIcon };
