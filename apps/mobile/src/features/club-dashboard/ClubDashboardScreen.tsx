import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clubDashboardDemoData } from '@/demo/clubDemoData';
import { formatNok, formatSignedNok, formatSignedPercentage } from '@/lib/currency';
import { BOTTOM_NAVIGATION_HEIGHT, BottomNavigation } from '@/navigation/BottomNavigation';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useTheme } from '@/theme';
import { AllocationBar, AppText, Avatar, AvatarStack, Screen, Section, Surface } from '@/ui';
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
  const { colors, spacing } = useTheme();
  const data = clubDashboardDemoData;

  return (
    <View style={[styles.header, { marginTop: spacing.md, marginBottom: spacing.md }]}>
      <View style={styles.titleRow}>
        <AppText variant="title" accessibilityRole="header" style={styles.title}>
          {data.clubName}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Club options"
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Feather name="more-horizontal" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${data.members.length} members`}
        hitSlop={4}
        style={({ pressed }) => [styles.headerMembersRow, { marginTop: spacing.xs, opacity: pressed ? 0.7 : 1 }]}
      >
        <AvatarStack people={data.members} />
        <AppText variant="meta" color="secondary" style={{ marginLeft: spacing.sm }}>
          {data.members.length} members
        </AppText>
      </Pressable>
    </View>
  );
}

function PortfolioSummary() {
  const { spacing } = useTheme();
  const data = clubDashboardDemoData;

  return (
    <View style={{ marginBottom: spacing.xxl }}>
      <AppText variant="sectionTitle">Portfolio</AppText>
      <AppText variant="display" style={{ marginTop: spacing.xs }}>
        {formatNok(data.portfolioValueNok)}
      </AppText>
      <AppText variant="value" color="positive" style={{ marginTop: spacing.sm }}>
        {formatSignedNok(data.estimatedReturnNok)}
        {' \u00B7 '}
        {formatSignedPercentage(data.estimatedReturnPercentage)}
      </AppText>
      <AppText variant="meta" style={{ marginTop: spacing.xs }}>
        {formatNok(data.totalContributedNok)} invested
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
      style={{
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        marginBottom: spacing.xxl,
        borderLeftWidth: 2,
        borderLeftColor: colors.accent,
      }}
    >
      <View style={styles.investmentDayRow}>
        <View style={{ flex: 1, paddingRight: spacing.md }}>
          <AppText variant="sectionTitle">Next Investment Day</AppText>
          <AppText variant="subtitle" style={{ marginTop: spacing.xs }}>
            {data.nextInvestmentDayLabel}
          </AppText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <AppText variant="bodyStrong">{formatNok(data.expectedContributionNok)} expected</AppText>
        </View>
      </View>

      <View style={[styles.readinessRow, { marginTop: spacing.md }]}>
        {data.members.map((member, index) => (
          <Avatar
            key={member.id}
            initials={member.initials}
            imageSource={member.imageSource}
            size="sm"
            ring={member.isReadyForNextInvestmentDay ? 'ready' : 'pending'}
            style={index === 0 ? undefined : styles.readinessAvatar}
          />
        ))}
        <AppText variant="meta" color="secondary" style={{ marginLeft: spacing.sm }}>
          {readyCount} of {data.members.length} ready
        </AppText>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'stretch',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    paddingRight: 12,
  },
  headerMembersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  investmentDayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  readinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readinessAvatar: {
    marginLeft: 8,
  },
});
