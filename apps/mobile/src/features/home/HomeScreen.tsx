import { StatusBar } from 'expo-status-bar';
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeClubsEmpty } from '@/features/clubs/ClubEmptyState';
import { useClubs } from '@/features/clubs/useClubs';
import { ProfileSettingsModal } from '@/features/profile/ProfileSettingsModal';
import { useProfile } from '@/features/profile/useProfile';
import { BOTTOM_NAVIGATION_HEIGHT, BottomNavigation } from '@/navigation/BottomNavigation';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useTheme } from '@/theme';
import { Avatar, Screen, Section, VestyMark } from '@/ui';
import {
  homeOverallPerformanceSummary,
  overallPerformanceHistoryByRange,
  OVERALL_PERFORMANCE_DEFAULT_RANGE,
} from '@/demo/homeDemoData';
import { ClubListItem } from './ClubListItem';
import { InvestmentDaySummary, type InvestmentDayVisualState } from './InvestmentDaySummary';
import { OverallPerformanceSection } from './OverallPerformanceSection';
import { homeInvestmentDayDemo, presentHomeClubs } from './presentHomeClubs';

/**
 * Spike demo switch for Home Investment Day visual states.
 * Flip to 'actionRequired' or 'today' for visual QA; leave 'upcoming'
 * for the default everyday Home screenshot. Not a product control.
 */
const HOME_INVESTMENT_DAY_STATE: InvestmentDayVisualState = 'upcoming';

/**
 * Home answers four questions in order:
 * 1. How are all my Vesty investments doing? (Total value)
 * 2. What is happening next? (Investment Day)
 * 3. Which clubs am I in? (Your clubs)
 * 4. Does anything need my attention? (Proposal)
 *
 * Club identity is real. Overall performance and Investment Day amounts
 * remain DEMO until the financial pipeline exists.
 */
export function HomeScreen() {
  const { colorScheme, colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeTab, onSelectTab } = useAppNavigation('home');
  const { clubs, isLoading, selectClub } = useClubs();
  const { initials, avatarSource } = useProfile();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const homeClubRows = presentHomeClubs(clubs);
  const investmentDayClub = clubs[0] ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <Screen
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: BOTTOM_NAVIGATION_HEIGHT + insets.bottom + spacing.xl,
        }}
      >
        <HomeHeader
          initials={initials}
          imageSource={avatarSource}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <View style={{ marginBottom: spacing.xl }}>
          <OverallPerformanceSection
            totalValueNok={homeOverallPerformanceSummary.totalValueNok}
            gainNok={homeOverallPerformanceSummary.gainNok}
            gainPercentage={homeOverallPerformanceSummary.gainPercentage}
            historyByRange={overallPerformanceHistoryByRange}
            defaultRange={OVERALL_PERFORMANCE_DEFAULT_RANGE}
          />
        </View>

        {investmentDayClub ? (
          <View style={{ marginBottom: spacing.xl }}>
            <InvestmentDaySummary
              clubName={investmentDayClub.name}
              investmentDayLabel={homeInvestmentDayDemo.investmentDayLabel}
              investmentDayShortLabel={homeInvestmentDayDemo.investmentDayShortLabel}
              expectedContributionNok={homeInvestmentDayDemo.expectedContributionNok}
              members={investmentDayClub.members}
              visualState={HOME_INVESTMENT_DAY_STATE}
              onOpenInvest={() => onSelectTab('invest')}
            />
          </View>
        ) : null}

        <Section title="Your clubs" isLast>
          {isLoading && homeClubRows.length === 0 ? null : homeClubRows.length === 0 ? (
            <HomeClubsEmpty />
          ) : (
            homeClubRows.map((club, index) => (
              <Fragment key={club.clubId}>
                {index > 0 ? <View style={{ height: 1, backgroundColor: colors.border }} /> : null}
                <ClubListItem
                  clubName={club.name}
                  members={club.members}
                  portfolioValueNok={club.demoPortfolioValueNok}
                  returnPercentage={club.demoReturnPercentage}
                  history={club.demoHistory}
                  onPress={() => {
                    void selectClub(club.clubId);
                    onSelectTab('club');
                  }}
                />
              </Fragment>
            ))
          )}
        </Section>
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
    <View style={[styles.headerRow, { marginTop: spacing.md, marginBottom: spacing.md }]}>
      <VestyMark color={colors.textPrimary} height={22} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open profile settings"
        hitSlop={10}
        onPress={onOpenSettings}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Avatar initials={initials} imageSource={imageSource} size="md" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
