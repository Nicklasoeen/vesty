import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { AppText, VestyWordmark } from '@/ui';

import { InvestOrbitArt } from './InvestOrbitArt';
import { presentInvestIntroCopy } from './presentInvestJourneyCopy';
import { presentInvestScheduleBadge } from './presentInvestJourney';

interface InvestIntroProps {
  scheduleDayOfMonth?: number | null;
  onStart: () => void;
  reduceMotion?: boolean;
  embedded?: boolean;
}

export function InvestIntro({
  scheduleDayOfMonth = 5,
  onStart,
  reduceMotion = false,
  embedded = false,
}: InvestIntroProps) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const copy = presentInvestIntroCopy();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.mintSoft,
        paddingTop: (embedded ? 0 : insets.top) + spacing.md,
        paddingBottom: spacing.lg,
        paddingHorizontal: spacing.xl,
      }}
    >
      <View
        style={{
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <VestyWordmark color={colors.accentDeep} height={24} />
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <InvestOrbitArt
          variant="intro"
          dateBadge={presentInvestScheduleBadge(scheduleDayOfMonth)}
          reduceMotion={reduceMotion}
        />
        <AppText variant="eyebrow" style={{ color: colors.accentDeep }}>
          {copy.eyebrow}
        </AppText>
        <AppText
          variant="display"
          accessibilityRole="header"
          style={{ marginTop: spacing.xl, color: colors.accentDeep }}
        >
          {`${copy.titleLead}\n`}
          <AppText variant="display" style={{ color: colors.accentDeep }}>
            {copy.titleEmphasis}
          </AppText>
        </AppText>
        <AppText variant="body" style={{ marginTop: spacing.md, color: colors.accentDeep }}>
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
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText variant="bodyStrong" color="onAccent">
          {copy.startLabel}
        </AppText>
      </Pressable>
    </View>
  );
}
