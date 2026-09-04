import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { clubDashboardDemoData } from '@/demo/clubDemoData';
import { ClubEmptyState } from '@/features/clubs/ClubEmptyState';
import { ClubOptionsSheet } from '@/features/clubs/ClubOptionsSheet';
import { ClubSwitcherSheet } from '@/features/clubs/ClubSwitcherSheet';
import { createInvitationForClub, useClubs } from '@/features/clubs/useClubs';
import { governanceLabel } from '@/features/clubs/governance';
import { InviteMemberSheet } from '@/features/clubs/InviteMemberSheet';
import { useClubStrategy } from '@/features/clubs/useClubStrategy';
import type { ClubSummary } from '@/features/clubs/types';
import { formatNok, formatSignedNok, formatSignedPercentage } from '@/lib/currency';
import { BOTTOM_NAVIGATION_HEIGHT, BottomNavigation } from '@/navigation/BottomNavigation';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useTheme } from '@/theme';
import { AllocationBar, AppText, Avatar, AvatarStack, Button, Screen, Section, Surface } from '@/ui';
import { PortfolioChart } from './PortfolioChart';

export function ClubDashboardScreen() {
  const { colorScheme, colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeTab, onSelectTab } = useAppNavigation('club');
  const { clubs, selectedClub, isLoading, error, refresh, selectClub } = useClubs();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  const onInvite = async (club: ClubSummary) => {
    if (inviteBusy) {
      return;
    }
    setInviteOpen(true);
    setInviteBusy(true);
    setInviteError(null);
    setInviteToken(null);
    try {
      const created = await createInvitationForClub(club.clubId);
      setInviteToken(created.inviteToken);
    } catch (caught) {
      setInviteError(caught instanceof Error ? caught.message : "You don't have permission to invite members");
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      {isLoading && !selectedClub ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator accessibilityLabel="Loading clubs" color={colors.accent} />
        </View>
      ) : error && !selectedClub ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg }}>
          <AppText variant="body" color="secondary" style={{ textAlign: 'center' }}>
            {error}
          </AppText>
          <View style={{ marginTop: spacing.lg }}>
            <Button
              label="Try again"
              variant="secondary"
              onPress={() => {
                void refresh();
              }}
            />
          </View>
        </View>
      ) : !selectedClub ? (
        <ClubEmptyState />
      ) : (
        <Screen
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: BOTTOM_NAVIGATION_HEIGHT + insets.bottom + spacing.xl,
          }}
        >
          <DashboardHeader
            club={selectedClub}
            canSwitch={clubs.length > 1}
            onOpenOptions={() => setOptionsOpen(true)}
            onOpenSwitcher={() => setSwitcherOpen(true)}
          />

          <PortfolioSummary />

          <InvestmentDayBanner club={selectedClub} onOpenInvest={() => onSelectTab('invest')} />

          <StrategySection key={selectedClub.clubId} clubId={selectedClub.clubId} />
        </Screen>
      )}

      <BottomNavigation activeTab={activeTab} onSelectTab={onSelectTab} />

      {selectedClub ? (
        <>
          <ClubOptionsSheet
            visible={optionsOpen}
            isOwner={selectedClub.isOwner}
            onClose={() => setOptionsOpen(false)}
            onInvite={() => {
              void onInvite(selectedClub);
            }}
          />
          <ClubSwitcherSheet
            visible={switcherOpen}
            clubs={clubs}
            selectedClubId={selectedClub.clubId}
            onSelect={(clubId) => {
              void selectClub(clubId);
            }}
            onClose={() => setSwitcherOpen(false)}
          />
          {inviteOpen ? (
            <InviteMemberSheet
              visible
              clubName={selectedClub.name}
              inviteToken={inviteToken}
              isGenerating={inviteBusy}
              error={inviteError}
              onClose={() => setInviteOpen(false)}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function DashboardHeader({
  club,
  canSwitch,
  onOpenOptions,
  onOpenSwitcher,
}: {
  club: ClubSummary;
  canSwitch: boolean;
  onOpenOptions: () => void;
  onOpenSwitcher: () => void;
}) {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.header, { marginTop: spacing.md, marginBottom: spacing.md }]}>
      <View style={styles.titleRow}>
        <Pressable
          accessibilityRole={canSwitch ? 'button' : undefined}
          accessibilityLabel={canSwitch ? `Switch club, ${club.name}` : undefined}
          onPress={canSwitch ? onOpenSwitcher : undefined}
          disabled={!canSwitch}
          style={({ pressed }) => [styles.titlePress, { opacity: canSwitch && pressed ? 0.7 : 1 }]}
        >
          <AppText variant="title" accessibilityRole="header" style={styles.title}>
            {club.name}
          </AppText>
          {canSwitch ? <Feather name="chevron-down" size={18} color={colors.textSecondary} /> : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Club options"
          hitSlop={10}
          onPress={onOpenOptions}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Feather name="more-horizontal" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <AppText variant="meta" color="secondary" style={{ marginTop: spacing.xs }}>
        {governanceLabel(club.governanceThresholdKind)}
      </AppText>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${club.members.length} members`}
        hitSlop={4}
        style={({ pressed }) => [styles.headerMembersRow, { marginTop: spacing.xs, opacity: pressed ? 0.7 : 1 }]}
      >
        <AvatarStack people={club.members} />
        <AppText variant="meta" color="secondary" style={{ marginLeft: spacing.sm }}>
          {club.members.length} {club.members.length === 1 ? 'member' : 'members'}
        </AppText>
      </Pressable>
    </View>
  );
}

function PortfolioSummary() {
  const { spacing } = useTheme();
  // DEMO financial presentation — not loaded from the database.
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

function InvestmentDayBanner({
  club,
  onOpenInvest,
}: {
  club: ClubSummary;
  onOpenInvest: () => void;
}) {
  const { colors, spacing } = useTheme();
  const data = clubDashboardDemoData;

  return (
    <Pressable
      onPress={onOpenInvest}
      accessibilityRole="button"
      accessibilityLabel={`Open Invest, ${club.name} Investment Day`}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
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
          {club.members.map((member, index) => (
            <Avatar
              key={member.id}
              initials={member.initials}
              imageSource={member.imageSource}
              size="sm"
              style={index === 0 ? undefined : styles.readinessAvatar}
            />
          ))}
          <AppText variant="meta" color="secondary" style={{ marginLeft: spacing.sm }}>
            {club.members.length} {club.members.length === 1 ? 'member' : 'members'}
          </AppText>
        </View>
      </Surface>
    </Pressable>
  );
}

function StrategySection({ clubId }: { clubId: string }) {
  const { allocations } = useClubStrategy(clubId);

  if (allocations.length === 0) {
    return null;
  }

  return (
    <Section title="Strategy" isLast>
      <AllocationBar allocations={allocations} />
    </Section>
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
  titlePress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    gap: 4,
  },
  title: {
    flexShrink: 1,
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
