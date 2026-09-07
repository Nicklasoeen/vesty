import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { AppText, VestyMark } from '@/ui';

import { CreateClubConfetti } from './CreateClubConfetti';
import { presentCreateClubSuccess, type CreateClubSuccessModel } from './presentCreateClubFlow';

interface CreateClubSuccessProps {
  success: CreateClubSuccessModel;
  celebrate: boolean;
  onInvite: () => void;
  onGoToClub: () => void;
  embedded?: boolean;
}

export function CreateClubSuccess({ success, celebrate, onInvite, onGoToClub, embedded = false }: CreateClubSuccessProps) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const copy = presentCreateClubSuccess(success);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: (embedded ? 0 : insets.top) + spacing.xl,
        paddingBottom: insets.bottom + spacing.lg,
        paddingHorizontal: spacing.xl,
      }}
    >
      <CreateClubConfetti play={celebrate} />
      <View style={{ flex: 1, alignItems: 'center', paddingTop: spacing.xxl }}>
        <View
          style={{
            width: 118,
            height: 118,
            borderRadius: 35,
            backgroundColor: colors.mintSoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.xl,
          }}
        >
          <VestyMark color={colors.accentDeep} height={52} />
        </View>
        <AppText
          variant="display"
          accessibilityRole="header"
          style={{ textAlign: 'center' }}
        >
          {`${copy.titleLead}\n${copy.titleEmphasis}`}
        </AppText>
        <AppText variant="body" color="secondary" style={{ marginTop: spacing.md, textAlign: 'center' }}>
          {copy.body}
        </AppText>
        <View
          style={{
            alignSelf: 'stretch',
            marginTop: spacing.xl,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.xl,
            padding: spacing.lg,
          }}
        >
          <SuccessRow label="Club" value={copy.clubName} />
          <SuccessRow label="Fund" value={copy.fundName} last />
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.inviteLabel}
        onPress={onInvite}
        style={{
          minHeight: 56,
          borderRadius: radius.lg,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText variant="bodyStrong" color="onAccent">
          {copy.inviteLabel}
        </AppText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.goToClubLabel}
        onPress={onGoToClub}
        style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm }}
      >
        <AppText variant="bodyStrong" color="accent">
          {copy.goToClubLabel}
        </AppText>
      </Pressable>
    </View>
  );
}

function SuccessRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <AppText variant="supporting">{label}</AppText>
      <AppText variant="bodyStrong" style={{ textAlign: 'right', flex: 1 }}>
        {value}
      </AppText>
    </View>
  );
}
