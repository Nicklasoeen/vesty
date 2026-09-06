import { useState } from 'react';
import { Image, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { AppText } from './AppText';
import { resolveAvatarContent, splitAvatarStack } from './avatarPresentation';

export type AvatarSize = 'sm' | 'stack' | 'md' | 'header' | 'lg' | 'xl';
type AvatarRing = 'ready' | 'pending' | 'none';

export interface AvatarPerson {
  id: string;
  initials: string;
  imageSource?: ImageSourcePropType;
}

interface AvatarProps {
  initials: string;
  size?: AvatarSize;
  /** Optional photo — when set, replaces initials with a circular cover crop. */
  imageSource?: ImageSourcePropType;
  /** Readiness signal for Investment Day. */
  ring?: AvatarRing;
  /** Hairline in the parent background so overlapping stack faces stay distinct. */
  overlap?: boolean;
  /** Quieter +N chip — additional members, not a person. */
  overflow?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const DIAMETER: Record<AvatarSize, number> = { sm: 24, stack: 26, md: 32, header: 42, lg: 44, xl: 48 };
const TEXT_VARIANT: Record<AvatarSize, 'meta' | 'body'> = {
  sm: 'meta',
  stack: 'meta',
  md: 'meta',
  header: 'body',
  lg: 'body',
  xl: 'body',
};
const OVERLAP_INSET: Record<AvatarSize, number> = { sm: 6, stack: 6, md: 8, header: 8, lg: 10, xl: 10 };

export function Avatar({
  initials,
  size = 'md',
  imageSource,
  ring = 'none',
  overlap = false,
  overflow = false,
  accessibilityLabel,
  style,
}: AvatarProps) {
  const { colors } = useTheme();
  const [failedSource, setFailedSource] = useState<ImageSourcePropType | undefined>(undefined);
  const diameter = DIAMETER[size];
  const showImage = resolveAvatarContent({ imageSource, failedSource, overflow }) === 'image';
  const hasRing = !overflow && ring !== 'none';
  const borderWidth = hasRing ? 2 : overflow ? 1 : overlap ? 1.5 : showImage ? 1 : 0;
  const borderColor = ring === 'ready'
    ? colors.positive
    : ring === 'pending'
      ? colors.border
      : overflow
        ? colors.border
        : overlap
          ? colors.surface
          : colors.border;

  return (
    <View
      accessible={overflow}
      accessibilityLabel={overflow ? accessibilityLabel : undefined}
      style={[
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          borderWidth,
          borderColor,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: overflow ? colors.surface : colors.surfaceSecondary,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={imageSource}
          accessibilityLabel={initials}
          onError={() => setFailedSource(imageSource)}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <AppText
          variant={TEXT_VARIANT[size]}
          color="secondary"
          accessible={!overflow}
          style={{ fontWeight: overflow ? '500' : '600', fontSize: overflow ? 11 : undefined, lineHeight: overflow ? 13 : undefined }}
        >
          {initials}
        </AppText>
      )}
    </View>
  );
}

interface AvatarStackProps {
  people: readonly AvatarPerson[];
  maxVisible?: number;
  size?: AvatarSize;
  style?: StyleProp<ViewStyle>;
}

/**
 * Compact overlapping identity stack. Overflow is a quieter +N chip, not a person.
 */
export function AvatarStack({ people, maxVisible = 3, size = 'sm', style }: AvatarStackProps) {
  const { visible, overflowCount } = splitAvatarStack(people, maxVisible);
  const overlapInset = OVERLAP_INSET[size];

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      {visible.map((person, index) => (
        <Avatar
          key={person.id}
          initials={person.initials}
          imageSource={person.imageSource}
          size={size}
          overlap={index > 0}
          style={index === 0 ? undefined : { marginLeft: -overlapInset }}
        />
      ))}
      {overflowCount > 0 ? (
        <Avatar
          initials={`+${overflowCount}`}
          size={size}
          overlap
          overflow
          accessibilityLabel={`${overflowCount} additional ${overflowCount === 1 ? 'member' : 'members'}`}
          style={{ marginLeft: -overlapInset }}
        />
      ) : null}
    </View>
  );
}
