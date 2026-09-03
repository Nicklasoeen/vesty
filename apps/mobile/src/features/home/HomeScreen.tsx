import { StatusBar } from 'expo-status-bar';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clubDashboardDemoData } from '@/demo/clubDemoData';
import {
  homeClubs,
  homeOverallPerformanceSummary,
  overallPerformanceHistoryByRange,
  OVERALL_PERFORMANCE_DEFAULT_RANGE,
} from '@/demo/homeDemoData';
import { ProposalCard } from '@/features/club-dashboard/ProposalCard';
import { BOTTOM_NAVIGATION_HEIGHT, BottomNavigation } from '@/navigation/BottomNavigation';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useTheme } from '@/theme';
import { AppearanceToggle, Avatar, Screen, Section, VestyWordmark } from '@/ui';
import { ClubListItem } from './ClubListItem';
import { InvestmentDaySummary } from './InvestmentDaySummary';
import { OverallPerformanceSection } from './OverallPerformanceSection';

/**
 * Home answers "what's happening in Vesty for me right now, and how am I
 * doing overall" — the next Investment Day, an aggregate performance view
 * across every club, a glance at each club, and anything that needs a
 * decision. It intentionally does not repeat Club's detailed strategy
 * breakdown or club-specific header — that level of detail lives on the
 * Club Dashboard.
 */
export function HomeScreen() {
  const { colorScheme, colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeTab, onSelectTab } = useAppNavigation('home');
  const data = clubDashboardDemoData;
  const currentUser = data.members.find((member) => member.isCurrentUser);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <Screen
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: BOTTOM_NAVIGATION_HEIGHT + insets.bottom + spacing.xl,
        }}
      >
        <HomeHeader currentUserInitials={currentUser?.initials ?? ''} />

        <InvestmentDaySummary
          userName={data.currentUserName}
          clubName={data.clubName}
          investmentDayLabel={data.nextInvestmentDayLabel}
          expectedContributionNok={data.expectedContributionNok}
          members={data.members}
        />

        <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: spacing.xl }]} />

        <View style={{ marginBottom: spacing.xl }}>
          <OverallPerformanceSection
            totalValueNok={homeOverallPerformanceSummary.totalValueNok}
            gainNok={homeOverallPerformanceSummary.gainNok}
            gainPercentage={homeOverallPerformanceSummary.gainPercentage}
            historyByRange={overallPerformanceHistoryByRange}
            defaultRange={OVERALL_PERFORMANCE_DEFAULT_RANGE}
          />
        </View>

        <Section title="Your clubs" variant="heading">
          {homeClubs.map((club, index) => (
            <Fragment key={club.id}>
              {index > 0 ? <View style={{ height: 1, backgroundColor: colors.border }} /> : null}
              <ClubListItem
                clubName={club.name}
                memberCount={club.memberCount}
                portfolioValueNok={club.portfolioValueNok}
                returnPercentage={club.returnPercentage}
                history={club.history}
                // West Coast and Family are spike-only demo clubs with no
                // dedicated dashboard yet — tapping them stays a no-op.
                onPress={club.navigable ? () => onSelectTab('club') : () => {}}
              />
            </Fragment>
          ))}
        </Section>

        <Section title="Needs your attention" variant="heading" isLast>
          <ProposalCard proposal={data.activeProposal} />
        </Section>
      </Screen>

      <BottomNavigation activeTab={activeTab} onSelectTab={onSelectTab} />
    </View>
  );
}

function HomeHeader({ currentUserInitials }: { currentUserInitials: string }) {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.headerRow, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
      <VestyWordmark color={colors.textPrimary} height={18} />

      <View style={[styles.headerRow, { gap: spacing.sm }]}>
        <AppearanceToggle />
        <Avatar initials={currentUserInitials} size="md" />
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
  divider: {
    height: 1,
  },
});
