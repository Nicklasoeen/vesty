import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeClubsEmpty } from '@/features/clubs/ClubEmptyState';
import { useClubs } from '@/features/clubs/useClubs';
import { useInvestmentDay } from '@/features/invest/useInvestmentDay';
import { historyByRange } from '@/features/portfolio/buildPortfolioChartSeries';
import { useMemberPortfolio } from '@/features/portfolio/useMemberPortfolio';
import { ProfileSettingsModal } from '@/features/profile/ProfileSettingsModal';
import { useProfile } from '@/features/profile/useProfile';
import { BOTTOM_NAVIGATION_HEIGHT, BottomNavigation } from '@/navigation/BottomNavigation';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useTheme } from '@/theme';
import { AppText, Avatar, Screen, SectionHeader, VestyWordmark } from '@/ui';

import { HomeClubCard } from './HomeClubCard';
import { HomeNextInvestmentDay } from './HomeNextInvestmentDay';
import { HomePinnedClubCard } from './HomePinnedClubCard';
import { HomePortfolioCard } from './HomePortfolioCard';
import { presentHomeClubs } from './presentHomeClubs';
import { homeScrollBottomPadding } from './presentHomeMoney';
import {
  formatHomeInvestmentDayDate,
  homeGreeting,
  presentHomePortfolio,
} from './presentHomePortfolio';
import { HOME_CLUB_CARD_TINT_COUNT, clubCardTintIndex, filterYourClubs, resolveHomePinnedClub } from './resolveHomePinnedClub';

export function HomeScreen() {
  const { colorScheme, colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeTab, onSelectTab } = useAppNavigation('home');
  const { clubs, selectedClub, isLoading, selectClub } = useClubs();
  const { initials, avatarSource, profile } = useProfile();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const membershipKey = clubs.map((club) => club.clubId).join('|');
  const homePinnedClubId = useMemo(
    () =>
      resolveHomePinnedClub({
        clubs,
        selectedClubId: selectedClub?.clubId ?? null,
        pinnedClubId: null,
      })?.clubId ?? null,
    // Recompute only when memberships change so opening another club does not move the Home pin.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selected club is sampled at membership change only
    [membershipKey],
  );
  const { summary, history, clubSummaries } = useMemberPortfolio();
  const investmentDay = useInvestmentDay(homePinnedClubId);
  const homeClubRows = presentHomeClubs(clubs, clubSummaries);
  const pinnedClub = homeClubRows.find((club) => club.clubId === homePinnedClubId) ?? null;
  const otherClubs = filterYourClubs(homeClubRows, homePinnedClubId);
  const portfolio = presentHomePortfolio(summary, clubs.length);
  const estimatedHistory = historyByRange(history);

  const openClub = (clubId: string) => {
    void selectClub(clubId);
    onSelectTab('club');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <Screen
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: homeScrollBottomPadding(BOTTOM_NAVIGATION_HEIGHT, insets.bottom),
        }}
      >
        <HomeHeader
          initials={initials}
          imageSource={avatarSource}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <View style={{ marginBottom: spacing.lg }}>
          <AppText variant="hero" color="accent" numberOfLines={1} adjustsFontSizeToFit>
            {homeGreeting(profile?.displayName)}
          </AppText>
          <AppText variant="supporting" style={{ marginTop: spacing.xs }}>
            Invest smarter, together.
          </AppText>
        </View>

        <View style={{ marginBottom: spacing.md }}>
          <HomePortfolioCard presentation={portfolio} historyByRange={estimatedHistory} />
        </View>

        {pinnedClub ? (
          <View style={{ marginBottom: spacing.md }}>
            <HomePinnedClubCard
              name={pinnedClub.name}
              members={pinnedClub.members}
              memberCount={pinnedClub.memberCount}
              groupValueNok={null}
              yourStakeNok={pinnedClub.portfolioValueNok}
              returnPercentage={pinnedClub.returnPercentage}
              onOpenClub={() => openClub(pinnedClub.clubId)}
            />
          </View>
        ) : null}

        {homePinnedClubId ? (
          <View style={{ marginBottom: spacing.md }}>
            <HomeNextInvestmentDay
              dateLabel={
                investmentDay.plan
                  ? formatHomeInvestmentDayDate(investmentDay.plan.investmentDayAt)
                  : investmentDay.error
                    ? 'Date unavailable'
                    : 'Loading…'
              }
              plannedMinor={investmentDay.plan?.expectedAmountMinor ?? null}
              onPress={() => onSelectTab('invest')}
            />
          </View>
        ) : null}

        <SectionHeader title="Your Clubs" />
        {isLoading && homeClubRows.length === 0 ? null : homeClubRows.length === 0 ? (
          <HomeClubsEmpty />
        ) : otherClubs.length === 0 ? (
          <AppText variant="supporting">
            Your other clubs will show up here.
          </AppText>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clubRow}>
            {otherClubs.map((club) => (
              <HomeClubCard
                key={club.clubId}
                name={club.name}
                members={club.members}
                memberCount={club.memberCount}
                valueNok={club.portfolioValueNok}
                returnPercentage={club.returnPercentage}
                tintIndex={clubCardTintIndex(club.clubId, HOME_CLUB_CARD_TINT_COUNT)}
                onPress={() => openClub(club.clubId)}
              />
            ))}
          </ScrollView>
        )}
      </Screen>

      <BottomNavigation activeTab={activeTab} onSelectTab={onSelectTab} />

      <ProfileSettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

function HomeHeader({
  initials,
  imageSource,
  onOpenSettings,
}: {
  initials: string;
  imageSource?: ImageSourcePropType;
  onOpenSettings: () => void;
}) {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.headerRow, { marginTop: spacing.sm, marginBottom: 20 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open profile settings"
        hitSlop={10}
        onPress={onOpenSettings}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Avatar initials={initials} imageSource={imageSource} size="header" />
      </Pressable>

      <View style={styles.logoCenter} pointerEvents="none">
        <VestyWordmark color={colors.accent} height={24} />
      </View>

      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel="Notifications are not available yet"
        style={styles.bellSlot}
      >
        <Feather name="bell" size={20} color={colors.accent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellSlot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubRow: {
    gap: 9,
    paddingBottom: 2,
  },
});
