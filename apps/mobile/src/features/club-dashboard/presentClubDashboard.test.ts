import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getCuratedPackage } from '../clubs/curatedInvestmentPackages.ts';
import { BOTTOM_NAV_SLOTS, BOTTOM_NAV_TAB_KEYS } from '../../navigation/bottomNavStructure.ts';

import {
  CLUB_FUTURE_TABS,
  CLUB_HOLDINGS_TITLE,
  CLUB_IMPLEMENTED_TABS,
  CLUB_STAT_LABELS,
  CLUB_STRATEGY_TITLE,
  CLUB_TAB_KEYS,
  clubBottomNavUnchanged,
  clubCopyContainsForbidden,
  clubMemberCountLabel,
  clubOverviewCopyContainsTechnicalClutter,
  presentClubChatCapability,
  presentClubHeroStats,
  presentClubHoldingCard,
  presentClubHoldingsCaption,
  presentClubPinControl,
  presentClubPrimaryActions,
  presentClubProposalCapability,
  presentClubSettingsItems,
  presentClubStrategy,
  presentClubViewerFinance,
  visibleClubTabs,
} from './presentClubDashboard.ts';

import { formatHomeNokFromMinor } from '../home/presentHomeMoney.ts';

describe('club hero stats', () => {
  it('keeps Group value private when the aggregate is not privacy-safe', () => {
    const stats = presentClubHeroStats({
      groupAggregateMinor: 12_500_000,
      groupAggregatePrivacySafe: false,
      yourStakeMinor: 248_000,
      returnPercentage: 24,
    });

    assert.equal(stats.groupValue, '—');
    assert.equal(stats.groupValueIsPrivateOrUnavailable, true);
    assert.equal(stats.usesDemo, false);
    assert.deepEqual(stats.labels, ['Group value', 'Your stake', 'All-time return']);
    assert.match(stats.yourStake, /kr/);
    assert.match(stats.allTimeReturn, /\+/);
    assert.equal(stats.returnTone, 'positive');
  });

  it('renders exact zero return as 0%', () => {
    const stats = presentClubHeroStats({
      groupAggregateMinor: null,
      groupAggregatePrivacySafe: false,
      yourStakeMinor: 100_000,
      returnPercentage: 0,
    });

    assert.equal(stats.allTimeReturn, '0%');
    assert.equal(stats.returnTone, 'positive');
  });

  it('does not invent a group total when data is missing', () => {
    const stats = presentClubHeroStats({
      groupAggregateMinor: null,
      groupAggregatePrivacySafe: true,
      yourStakeMinor: null,
      returnPercentage: null,
    });

    assert.equal(stats.groupValue, '—');
    assert.equal(stats.yourStake, '—');
    assert.equal(stats.allTimeReturn, '—');
    assert.equal(stats.returnTone, 'secondary');
  });

  it('never uses pooled-money language for the hero stats', () => {
    for (const label of CLUB_STAT_LABELS) {
      assert.equal(clubCopyContainsForbidden(label), false);
    }
  });
});

describe('club viewer finance', () => {
  it('uses viewer-safe curated totals and never demo values', () => {
    const finance = presentClubViewerFinance({
      clubId: 'club-a',
      modellingScope: 'curated_etf',
      investedMinor: 200_000,
      estimatedCurrentValueMinor: 248_000,
      gainLossMinor: 48_000,
      gainLossBps: 2400,
      valuationConfidence: 'estimated',
    });

    assert.equal(finance.usesDemo, false);
    assert.equal(finance.presentation, 'estimated');
    assert.equal(finance.yourStakeMinor, 248_000);
    assert.equal(finance.investedMinor, 200_000);
    assert.equal(finance.returnPercentage, 24);
  });

  it('stays unavailable for legacy clubs instead of demo numbers', () => {
    const finance = presentClubViewerFinance({
      clubId: 'legacy',
      modellingScope: 'legacy',
      investedMinor: 100_000,
      estimatedCurrentValueMinor: null,
      gainLossMinor: null,
      gainLossBps: null,
      valuationConfidence: 'unavailable',
    });

    assert.equal(finance.usesDemo, false);
    assert.equal(finance.presentation, 'unavailable');
    assert.equal(finance.yourStakeMinor, null);
    assert.equal(finance.investedMinor, null);
    assert.equal(finance.returnPercentage, null);
  });

  it('keeps reported invested separate when current value is unknown', () => {
    const finance = presentClubViewerFinance({
      clubId: 'club-a',
      modellingScope: 'curated_etf',
      investedMinor: 200_000,
      estimatedCurrentValueMinor: null,
      gainLossMinor: null,
      gainLossBps: null,
      valuationConfidence: 'unavailable',
    });

    assert.equal(finance.presentation, 'unavailable');
    assert.equal(finance.yourStakeMinor, null);
    assert.equal(finance.investedMinor, 200_000);
    assert.equal(finance.returnPercentage, null);
  });
});

describe('club primary actions', () => {
  it('maps to real product actions and never proposal or pooled-money actions', () => {
    const owner = presentClubPrimaryActions({ isOwner: true });
    const member = presentClubPrimaryActions({ isOwner: false });

    assert.deepEqual(
      owner.map((action) => action.key),
      ['investment_day', 'invite'],
    );
    assert.deepEqual(
      member.map((action) => action.key),
      ['investment_day'],
    );
    assert.equal(owner[0]?.variant, 'primary');
    assert.equal(owner[1]?.variant, 'secondary');

    const labels = [...owner, ...member].map((action) => action.label).join(' ');
    assert.equal(clubCopyContainsForbidden(labels), false);
    assert.equal(/proposal|withdraw|buying power|deposit/i.test(labels), false);
  });
});

describe('club internal tabs', () => {
  it('defines the Club destinations without replacing bottom nav', () => {
    assert.deepEqual(CLUB_TAB_KEYS, ['overview', 'proposals', 'chat', 'settings']);
    assert.deepEqual(visibleClubTabs(), [...CLUB_IMPLEMENTED_TABS]);
    assert.deepEqual(CLUB_IMPLEMENTED_TABS, ['overview', 'proposals', 'settings']);
    assert.deepEqual(CLUB_FUTURE_TABS, ['chat']);
    assert.equal(CLUB_FUTURE_TABS.includes('proposals'), false);
    assert.equal(clubBottomNavUnchanged(), true);
    assert.deepEqual(BOTTOM_NAV_TAB_KEYS, ['home', 'club', 'invest', 'activity']);
    assert.deepEqual(BOTTOM_NAV_SLOTS, ['home', 'club', 'action', 'invest', 'activity']);
  });
});

describe('club strategy', () => {
  it('shows World + America read-only without internal ids', () => {
    const worldAmerica = getCuratedPackage('world_america');
    const presentation = presentClubStrategy(
      worldAmerica.allocations.map((allocation) => ({
        label: allocation.targetId,
        percentage: allocation.allocationBps / 100,
        ticker: undefined,
      })),
    );

    const named = presentClubStrategy([
      { label: 'Vanguard FTSE All-World UCITS ETF - (USD) Acc', percentage: 50 },
      { label: 'iShares Core S&P 500 UCITS ETF USD (Acc)', percentage: 30 },
      { label: 'iShares Core MSCI Europe UCITS ETF EUR (Acc)', percentage: 10 },
      { label: 'iShares Core MSCI EM IMI UCITS ETF USD (Acc)', percentage: 10 },
    ]);

    assert.equal(named.readOnly, true);
    assert.equal(named.packageName, 'World + America');
    assert.ok(named.description);
    assert.equal(named.allocationSummary, '50% VWCE\n30% SXR8\n10% EUNK\n10% IS3N');
    assert.equal(named.allocationSummary?.includes('31000000'), false);
    assert.equal(named.packageName && /world_america/.test(named.packageName), false);
    assert.equal(presentation.packageName, null);
    assert.equal(CLUB_STRATEGY_TITLE, 'Current strategy');
    assert.equal(named.lines[0]?.friendlyName, 'Global equities');
    assert.equal(named.lines[1]?.friendlyName, 'S&P 500');
    assert.equal(named.lines.some((line) => /UCITS|ETF · EUR/i.test(line.friendlyName)), false);
    assert.equal(named.lines.some((line) => line.friendlyName === line.legalName), false);
  });
});

describe('club holdings presentation', () => {
  it('uses Your holdings and quiet section-level confidence', () => {
    assert.equal(CLUB_HOLDINGS_TITLE, 'Your holdings');
    assert.equal(
      presentClubHoldingsCaption('estimated'),
      'Values are estimated from your reported investments.',
    );
    assert.equal(presentClubHoldingsCaption('mixed')?.toLowerCase().includes('verified'), false);
    assert.equal(presentClubHoldingsCaption('exact')?.toLowerCase().includes('verified'), false);
  });

  it('shows real values and never invents a per-position return', () => {
    const card = presentClubHoldingCard({
      ticker: 'VWCE',
      name: 'Vanguard FTSE All-World UCITS ETF - (USD) Acc',
      investedMinor: 80_000,
      currentValueMinor: 18_156_400,
      quantityStatus: 'unavailable',
    });

    assert.equal(card.identity.ticker, 'VWCE');
    assert.equal(card.identity.friendlyName, 'Global equities');
    assert.equal(card.currentValue, formatHomeNokFromMinor(18_156_400));
    assert.equal(card.investedLabel, `${formatHomeNokFromMinor(80_000)} invested`);
    assert.equal(card.returnLabel, null);
    assert.equal(card.usesDemo, false);
    assert.equal(card.cardStatus, null);
    assert.equal(/ucits|etf · eur|based on reported holdings/i.test(card.accessibilityLabel), false);
  });

  it('keeps legacy or missing current value unavailable rather than demo', () => {
    const card = presentClubHoldingCard({
      ticker: null,
      name: 'KLP AksjeGlobal',
      investedMinor: 100_000,
      currentValueMinor: null,
      quantityStatus: 'unavailable',
    });

    assert.equal(card.currentValue, null);
    assert.equal(card.returnLabel, null);
    assert.equal(card.usesDemo, false);
    assert.equal(card.identity.markKey, null);
    assert.equal(card.identity.ticker, 'KLP AksjeGlobal');
    assert.equal(card.identity.fallbackInitials, 'KL');
  });

  it('reuses Home money formatting for large holdings values', () => {
    const card = presentClubHoldingCard({
      ticker: 'VWCE',
      name: 'VWCE',
      investedMinor: 24_800_00,
      currentValueMinor: 587_000_000_00,
      quantityStatus: 'complete',
    });

    assert.equal(card.currentValue, formatHomeNokFromMinor(587_000_000_00));
    assert.match(card.currentValue ?? '', /mill/);
    assert.equal(card.cardStatus, 'Exact holdings');
    assert.equal(card.returnLabel, null);
  });
});

describe('club overview copy', () => {
  it('does not surface ETF · EUR or legal titles as beginner copy', () => {
    const named = presentClubStrategy([
      { label: 'Vanguard FTSE All-World UCITS ETF - (USD) Acc', percentage: 50, ticker: 'VWCE' },
    ]);
    const visible = [
      named.packageName,
      named.description,
      ...named.lines.map((line) => `${line.ticker} ${line.friendlyName}`),
      presentClubHoldingsCaption('estimated'),
      CLUB_HOLDINGS_TITLE,
    ].join(' ');

    assert.equal(clubOverviewCopyContainsTechnicalClutter(visible), false);
    assert.equal(clubOverviewCopyContainsTechnicalClutter('ETF · EUR'), true);
  });
});

describe('unimplemented club capabilities', () => {
  it('does not fabricate proposal or chat data', () => {
    const proposals = presentClubProposalCapability();
    assert.equal(proposals.available, true);
    assert.equal(proposals.usesDemo, false);
    assert.equal(proposals.canRead, true);
    assert.equal(proposals.canCastVote, true);
    assert.equal(proposals.canCreate, true);
    assert.equal(proposals.canCreateStrategy, false);
    assert.equal(proposals.canCreateContribution, true);
    assert.equal(proposals.openVoteChoicesHidden, true);
    assert.deepEqual(presentClubChatCapability(), {
      available: false,
      usesDemo: false,
      reason: 'club_chat_not_shipped',
    });
    assert.deepEqual(presentClubPinControl(), {
      visible: false,
      persistable: false,
      reason: 'home_pin_not_persisted',
    });
  });

  it('only exposes real settings controls', () => {
    assert.deepEqual(presentClubSettingsItems({ isOwner: true }), {
      details: true,
      members: true,
      contributions: true,
      governance: true,
      invite: true,
      leave: false,
      pinToHome: false,
      editDetails: true,
    });
    assert.equal(presentClubSettingsItems({ isOwner: false }).invite, false);
    assert.equal(presentClubSettingsItems({ isOwner: false }).editDetails, false);
  });
});

describe('club copy', () => {
  it('formats member counts and rejects pooled-money phrases', () => {
    assert.equal(clubMemberCountLabel(1), '1 member');
    assert.equal(clubMemberCountLabel(6), '6 members');
    assert.equal(clubCopyContainsForbidden('Buying power'), true);
    assert.equal(clubCopyContainsForbidden('Your stake'), false);
  });
});
