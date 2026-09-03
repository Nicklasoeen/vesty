import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { AppText } from './AppText';

type AvatarSize = 'sm' | 'md' | 'lg';
type AvatarRing = 'ready' | 'pending' | 'none';

interface AvatarProps {
  initials: string;
  size?: AvatarSize;
  /** Readiness signal for Investment Day — kept out of the header stack. */
  ring?: AvatarRing;
  style?: StyleProp<ViewStyle>;
}

const DIAMETER: Record<AvatarSize, number> = { sm: 24, md: 32, lg: 44 };
const TEXT_VARIANT: Record<AvatarSize, 'caption' | 'body'> = { sm: 'caption', md: 'caption', lg: 'body' };

export function Avatar({ initials, size = 'md', ring = 'none', style }: AvatarProps) {
  const { colors } = useTheme();
  const diameter = DIAMETER[size];
  const ringColor = ring === 'ready' ? colors.positive : ring === 'pending' ? colors.border : 'transparent';

  return (
    <View
      style={[
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          borderWidth: ring === 'none' ? 0 : 2,
          borderColor: ringColor,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceSecondary,
        },
        style,
      ]}
    >
      <AppText variant={TEXT_VARIANT[size]} color="secondary" style={{ fontWeight: '600' }}>
        {initials}
      </AppText>
    </View>
  );
}
