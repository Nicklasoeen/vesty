import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clubDashboardDemoData } from '@/demo/clubDemoData';
import { formatNok, formatSignedNok, formatSignedPercentage } from '@/lib/currency';
import { BOTTOM_NAVIGATION_HEIGHT, BottomNavigation } from '@/navigation/BottomNavigation';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useTheme } from '@/theme';
import { AllocationBar, AppearanceToggle, AppText, Avatar, Screen, Section, Surface } from '@/ui';
import { PortfolioChart } from './PortfolioChart';
import { ProposalCard } from './ProposalCard';

export function ClubDashboardScreen() {
  const { colorScheme, colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeTab, onSelectTab } = useAppNavigation('club');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <Screen
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: BOTTOM_NAVIGATION_HEIGHT + insets.bottom + spacing.xl,
        }}
      >
        <DashboardHeader />

        <PortfolioSummary />

        <InvestmentDayBanner />

        <Section title="Strategy">
          <AllocationBar allocations={clubDashboardDemoData.currentStrategy} />
        </Section>

        <Section title="Open proposal" isLast>
          <ProposalCard proposal={clubDashboardDemoData.activeProposal} />
        </Section>
      </Screen>

      <BottomNavigation activeTab={activeTab} onSelectTab={onSelectTab} />
    </View>
  );
}

function DashboardHeader() {
  const { spacing } = useTheme();
  const data = clubDashboardDemoData;
  const currentUser = data.members.find((member) => member.isCurrentUser);

  return (
    <View style={[styles.headerRow, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
      <View>
        <AppText variant="title" accessibilityRole="header">
          {data.clubName}
        </AppText>
        <View style={[styles.headerMembersRow, { marginTop: spacing.xs }]}>
          <MemberAvatarStack />
          <AppText variant="caption" style={{ marginLeft: spacing.sm }}>
            {data.members.length} members
          </AppText>
        </View>
      </View>

      <View style={[styles.headerRow, { gap: spacing.sm }]}>
        <AppearanceToggle />
        <Avatar initials={currentUser?.initials ?? ''} size="md" />
      </View>
    </View>
  );
}

function MemberAvatarStack() {
  const data = clubDashboardDemoData;
  const visibleMembers = data.members.slice(0, 3);
  const overflowCount = data.members.length - visibleMembers.length;

  return (
    <View style={styles.avatarStack}>
      {visibleMembers.map((member, index) => (
        <Avatar
          key={member.id}
          initials={member.initials}
          size="sm"
          style={index === 0 ? undefined : styles.avatarOverlap}
        />
      ))}
      {overflowCount > 0 ? (
        <Avatar initials={`+${overflowCount}`} size="sm" style={styles.avatarOverlap} />
      ) : null}
    </View>
  );
}

function PortfolioSummary() {
  const { spacing } = useTheme();
  const data = clubDashboardDemoData;

  return (
    <View style={{ marginBottom: spacing.xxl }}>
      <AppText variant="label">Club portfolio</AppText>
      <AppText variant="display" style={{ marginTop: spacing.xs }}>
        {formatNok(data.portfolioValueNok)}
      </AppText>
      <AppText variant="bodyStrong" color="positive" style={{ marginTop: spacing.sm }}>
        {formatSignedNok(data.estimatedReturnNok)}
        {' \u00B7 '}
        {formatSignedPercentage(data.estimatedReturnPercentage)}
      </AppText>
      <AppText variant="caption" style={{ marginTop: spacing.xs }}>
        {formatNok(data.totalContributedNok)} contributed
      </AppText>

      <View style={{ marginTop: spacing.lg }}>
        <PortfolioChart
          historyByRange={data.portfolioHistoryByRange}
          defaultRange={data.defaultPortfolioRange}
        />
      </View>
    </View>
  );
}

function InvestmentDayBanner() {
  const { colors, spacing } = useTheme();
  const data = clubDashboardDemoData;
  const readyCount = data.members.filter((member) => member.isReadyForNextInvestmentDay).length;

  return (
    <Surface
      variant="secondary"
      style={{ padding: spacing.lg, marginBottom: spacing.xxl, borderLeftWidth: 2, borderLeftColor: colors.accent }}
    >
      <View style={styles.investmentDayRow}>
        <View>
          <AppText variant="label">Next Investment Day</AppText>
          <AppText variant="subtitle" style={{ marginTop: spacing.xs }}>
            {data.nextInvestmentDayLabel}
          </AppText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <AppText variant="bodyStrong">{formatNok(data.expectedContributionNok)} expected</AppText>
          <AppText variant="caption" style={{ marginTop: spacing.xs }}>
            {readyCount} of {data.members.length} ready
          </AppText>
        </View>
      </View>

      <View style={[styles.readinessRow, { marginTop: spacing.lg }]}>
        {data.members.map((member) => (
          <Avatar
            key={member.id}
            initials={member.initials}
            size="sm"
            ring={member.isReadyForNextInvestmentDay ? 'ready' : 'pending'}
            style={styles.readinessAvatar}
          />
        ))}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerMembersRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  investmentDayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  readinessRow: {
    flexDirection: 'row',
  },
  readinessAvatar: {
    marginRight: 8,
  },
});
