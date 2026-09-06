import { Feather } from '@expo/vector-icons';
import { Pressable, View, type ImageSourcePropType } from 'react-native';

import { formatNokFromMinor } from '@/lib/currency';
import { useTheme } from '@/theme';
import { AppText, Avatar, Surface } from '@/ui';

export interface InvestmentDayParticipantPreview {
  id: string;
  initials: string;
  imageSource?: ImageSourcePropType;
  completed: boolean;
}

interface HomeNextInvestmentDayProps {
  dateLabel: string;
  plannedMinor: number | null;
  onPress?: () => void;
  participationLabel?: string | null;
  participants?: readonly InvestmentDayParticipantPreview[];
}

export function HomeNextInvestmentDay({
  dateLabel,
  plannedMinor,
  onPress,
  participationLabel,
  participants,
}: HomeNextInvestmentDayProps) {
  const { colors, radius, spacing } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? 'Open Invest for next Investment Day' : undefined}
      style={({ pressed }) => ({ opacity: onPress && pressed ? 0.85 : 1 })}
    >
      <Surface
        bordered
        elevated
        style={{
          padding: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: radius.xl,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.lg,
            backgroundColor: colors.mintSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name="calendar" size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1, marginHorizontal: spacing.md, minWidth: 0 }}>
          <AppText variant="label">Next Investment Day</AppText>
          <AppText variant="subtitle" numberOfLines={1} style={{ marginTop: 1 }}>
            {dateLabel}
          </AppText>
          {plannedMinor != null ? (
            <AppText variant="supporting" style={{ marginTop: 2 }}>
              {formatNokFromMinor(plannedMinor)} planned
            </AppText>
          ) : null}
          {participationLabel ? (
            <AppText variant="supporting" style={{ marginTop: 2 }}>
              {participationLabel}
            </AppText>
          ) : null}
          {participants && participants.length > 0 ? (
            <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
              {participants.slice(0, 6).map((person, index) => (
                <Avatar
                  key={person.id}
                  initials={person.initials}
                  imageSource={person.imageSource}
                  size="sm"
                  ring={person.completed ? 'ready' : 'pending'}
                  overlap={index > 0}
                  style={index === 0 ? undefined : { marginLeft: -6 }}
                />
              ))}
              {participants.length > 6 ? (
                <Avatar
                  initials={`+${participants.length - 6}`}
                  size="sm"
                  overlap
                  overflow
                  accessibilityLabel={`${participants.length - 6} additional members`}
                  style={{ marginLeft: -6 }}
                />
              ) : null}
            </View>
          ) : null}
        </View>
        <Feather name="chevron-right" size={22} color={colors.accent} />
      </Surface>
    </Pressable>
  );
}
