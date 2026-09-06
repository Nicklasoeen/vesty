import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClubEmptyState } from '@/features/clubs/ClubEmptyState';
import { ClubOptionsSheet } from '@/features/clubs/ClubOptionsSheet';
import { ClubSwitcherSheet } from '@/features/clubs/ClubSwitcherSheet';
import { InviteMemberSheet } from '@/features/clubs/InviteMemberSheet';
import { RenameClubSheet } from '@/features/clubs/RenameClubSheet';
import { createInvitationForClub, useClubs } from '@/features/clubs/useClubs';
import type { ClubSummary } from '@/features/clubs/types';
import { homeScrollBottomPadding } from '@/features/home/presentHomeMoney';
import { useMemberPortfolio } from '@/features/portfolio/useMemberPortfolio';
import { ClubProposalDetail } from '@/features/proposals/ClubProposalDetail';
import { ClubProposalsList } from '@/features/proposals/ClubProposalsList';
import { useClubProposals } from '@/features/proposals/useClubProposals';
import { BOTTOM_NAVIGATION_HEIGHT, BottomNavigation } from '@/navigation/BottomNavigation';
import { useAppNavigation } from '@/navigation/useAppNavigation';
import { useTheme } from '@/theme';
import { AppText, Button, IconButton, Screen, Stat } from '@/ui';

import { ClubMemberPortraits } from './ClubMemberPortraits';
import { ClubOverview } from './ClubOverview';
import { ClubSettingsPanel } from './ClubSettingsPanel';
import {
  CLUB_TAB_LABELS,
  clubMemberCountLabel,
  presentClubHeroStats,
  presentClubPrimaryActions,
  presentClubViewerFinance,
  visibleClubTabs,
  type ClubTabKey,
} from './presentClubDashboard';

export function ClubDashboardScreen() {
  const { colorScheme, colors, spacing } = useTheme();
  const { activeTab, onSelectTab } = useAppNavigation('club');
  const { clubs, selectedClub, isLoading, error, refresh, selectClub } = useClubs();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);

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
        <ClubDashboard
          key={selectedClub.clubId}
          club={selectedClub}
          canSwitch={clubs.length > 1}
          onOpenOptions={() => setOptionsOpen(true)}
          onOpenSwitcher={() => setSwitcherOpen(true)}
          onOpenInvest={() => onSelectTab('invest')}
          onInvite={() => {
            void onInvite(selectedClub);
          }}
          onEditName={() => setRenameOpen(true)}
        />
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
          {renameOpen ? (
            <RenameClubSheet
              visible
              clubId={selectedClub.clubId}
              currentName={selectedClub.name}
              onClose={() => setRenameOpen(false)}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function ClubDashboard({
  club,
  canSwitch,
  onOpenOptions,
  onOpenSwitcher,
  onOpenInvest,
  onInvite,
  onEditName,
}: {
  club: ClubSummary;
  canSwitch: boolean;
  onOpenOptions: () => void;
  onOpenSwitcher: () => void;
  onOpenInvest: () => void;
  onInvite: () => void;
  onEditName: () => void;
}) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [clubTab, setClubTab] = useState<ClubTabKey>('overview');
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const proposalsState = useClubProposals(club.clubId);
  const selectedProposal = proposalsState.proposals.find((proposal) => proposal.id === selectedProposalId) ?? null;
  const { summary, history, positions } = useMemberPortfolio(club.clubId);
  const finance = presentClubViewerFinance(summary);
  const stats = presentClubHeroStats({
    groupAggregateMinor: null,
    groupAggregatePrivacySafe: false,
    yourStakeMinor: finance.yourStakeMinor,
    returnPercentage: finance.returnPercentage,
  });
  const actions = presentClubPrimaryActions({ isOwner: club.isOwner });
  const tabs = visibleClubTabs();
  const sessionVote = selectedProposal ? proposalsState.sessionVotes[selectedProposal.id] : undefined;

  if (selectedProposal) {
    return (
      <Screen
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: homeScrollBottomPadding(BOTTOM_NAVIGATION_HEIGHT, insets.bottom),
        }}
      >
        <ClubProposalDetail
          clubId={club.clubId}
          proposal={selectedProposal}
          members={club.members}
          viewerMembershipId={club.membershipId}
          sessionChoice={sessionVote?.choice}
          alreadyVotedUnknownChoice={sessionVote != null && sessionVote.choice == null}
          onBack={() => setSelectedProposalId(null)}
          onCastVote={(choice) => proposalsState.castVote(selectedProposal.id, club.membershipId, choice)}
        />
      </Screen>
    );
  }

  return (
    <Screen
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        paddingBottom: homeScrollBottomPadding(BOTTOM_NAVIGATION_HEIGHT, insets.bottom),
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: spacing.sm,
          marginBottom: spacing.sm,
        }}
      >
        <Pressable
          accessibilityRole={canSwitch ? 'button' : undefined}
          accessibilityLabel={canSwitch ? `Switch club, ${club.name}` : undefined}
          onPress={canSwitch ? onOpenSwitcher : undefined}
          disabled={!canSwitch}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 40,
            opacity: canSwitch && pressed ? 0.7 : 1,
          })}
        >
          <AppText variant="label">Club</AppText>
          {canSwitch ? (
            <Feather name="chevron-down" size={16} color={colors.textSecondary} style={{ marginLeft: 4 }} />
          ) : null}
        </Pressable>
        <IconButton icon="more-horizontal" accessibilityLabel="Club options" onPress={onOpenOptions} />
      </View>

      <ClubMemberPortraits members={club.members} />

      <View style={{ alignItems: 'center', marginTop: 4 }}>
        <AppText
          variant="title"
          accessibilityRole="header"
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={{ textAlign: 'center' }}
        >
          {club.name}
        </AppText>
        <AppText variant="supporting" style={{ marginTop: 1 }}>
          {clubMemberCountLabel(club.members.length)}
        </AppText>
      </View>

      <View
        style={{
          flexDirection: 'row',
          marginTop: spacing.lg,
          paddingTop: spacing.sm,
        }}
      >
        <Stat value={stats.groupValue} label={stats.labels[0]} />
        <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: spacing.sm }} />
        <Stat value={stats.yourStake} label={stats.labels[1]} />
        <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: spacing.sm }} />
        <Stat value={stats.allTimeReturn} label={stats.labels[2]} valueColor={stats.returnTone} />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        {actions.map((action) => (
          <View key={action.key} style={{ flex: 1 }}>
            <Button
              label={action.label}
              variant={action.variant}
              block
              onPress={action.key === 'investment_day' ? onOpenInvest : onInvite}
            />
          </View>
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}
        contentContainerStyle={{ gap: spacing.xs }}
      >
        {tabs.map((tab) => {
          const active = tab === clubTab;
          return (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={CLUB_TAB_LABELS[tab]}
              onPress={() => setClubTab(tab)}
              style={({ pressed }) => ({
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                minHeight: 36,
                borderRadius: radius.full,
                backgroundColor: active ? colors.mintSoft : 'transparent',
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <AppText variant="statLabel" color={active ? 'accent' : 'secondary'}>
                {CLUB_TAB_LABELS[tab]}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {clubTab === 'overview' ? (
        <ClubOverview
          key={club.clubId}
          clubId={club.clubId}
          summary={summary}
          history={history}
          positions={positions}
          onOpenInvest={onOpenInvest}
        />
      ) : clubTab === 'proposals' ? (
        <ClubProposalsList
          members={club.members}
          proposals={proposalsState.proposals}
          isLoading={proposalsState.isLoading}
          error={proposalsState.error}
          onOpen={setSelectedProposalId}
          onRetry={() => {
            void proposalsState.refresh();
          }}
        />
      ) : (
        <ClubSettingsPanel club={club} onInvite={onInvite} onEditName={onEditName} />
      )}
    </Screen>
  );
}
