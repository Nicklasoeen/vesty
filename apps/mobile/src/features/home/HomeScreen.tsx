import { StatusBar } from 'expo-status-bar';
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clubDashboardDemoData, type DemoPerson } from '@/demo/clubDemoData';
import {
  homeClubs,
  homeOverallPerformanceSummary,
  overallPerformanceHistoryByRange,
  OVERALL_PERFORMANCE_DEFAULT_RANGE,
} from '@/demo/homeDemoData';
import { ProposalCard } from '@/features/club-dashboard/ProposalCard';
import { ProfileSettingsModal } from '@/features/profile/ProfileSettingsModal';
import { BOTTOM_NAVIGATION_HEIGHT, BottomNavigation } from '@/navigation/BottomNavigation';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useTheme } from '@/theme';
import { Avatar, Screen, Section, VestyMark } from '@/ui';
import { ClubListItem } from './ClubListItem';
import { InvestmentDaySummary, type InvestmentDayVisualState } from './InvestmentDaySummary';
import { OverallPerformanceSection } from './OverallPerformanceSection';

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
 * Total value owns the top of Home. Investment Day is a secondary event
 * Surface that sits just above the club list so the upcoming club event
 * and the clubs themselves feel connected.
 */
export function HomeScreen() {
  const { colorScheme, colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeTab, onSelectTab } = useAppNavigation('home');
  const data = clubDashboardDemoData;
  const currentUser = data.members.find((member) => member.isCurrentUser);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <Screen
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: BOTTOM_NAVIGATION_HEIGHT + insets.bottom + spacing.xl,
        }}
      >
        <HomeHeader currentUser={currentUser} onOpenSettings={() => setSettingsOpen(true)} />

        <View style={{ marginBottom: spacing.xl }}>
          <OverallPerformanceSection
            totalValueNok={homeOverallPerformanceSummary.totalValueNok}
            gainNok={homeOverallPerformanceSummary.gainNok}
            gainPercentage={homeOverallPerformanceSummary.gainPercentage}
            historyByRange={overallPerformanceHistoryByRange}
            defaultRange={OVERALL_PERFORMANCE_DEFAULT_RANGE}
          />
        </View>

        <View style={{ marginBottom: spacing.xl }}>
          <InvestmentDaySummary
            clubName={data.clubName}
            investmentDayLabel={data.nextInvestmentDayLabel}
            investmentDayShortLabel={data.nextInvestmentDayShortLabel}
            expectedContributionNok={data.expectedContributionNok}
            members={data.members}
            visualState={HOME_INVESTMENT_DAY_STATE}
            onOpenInvest={() => onSelectTab('invest')}
          />
        </View>

        <Section title="Your clubs">
          {homeClubs.map((club, index) => (
            <Fragment key={club.id}>
              {index > 0 ? <View style={{ height: 1, backgroundColor: colors.border }} /> : null}
              <ClubListItem
                clubName={club.name}
                members={club.members}
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

        <Section title="Needs your attention" isLast>
          <ProposalCard proposal={data.activeProposal} />
        </Section>
      </Screen>

      <BottomNavigation activeTab={activeTab} onSelectTab={onSelectTab} />

      <ProfileSettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

function HomeHeader({
  currentUser,
  onOpenSettings,
}: {
  currentUser: DemoPerson | undefined;
  onOpenSettings: () => void;
}) {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.headerRow, { marginTop: spacing.md, marginBottom: spacing.md }]}>
      {/* Standalone site icon — brand identity only, not a control. */}
      <VestyMark color={colors.textPrimary} height={22} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open profile settings"
        hitSlop={10}
        onPress={onOpenSettings}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Avatar initials={currentUser?.initials ?? ''} size="md" imageSource={currentUser?.imageSource} />
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
