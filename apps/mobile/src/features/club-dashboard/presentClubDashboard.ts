import { CORE_V1_TARGETS, CURATED_INVESTMENT_PACKAGES, getCoreV1Target } from '../clubs/curatedInvestmentPackages.ts';
import { formatHomeNokFromMinor, formatHomeSignedPercentage } from '../home/presentHomeMoney.ts';
import { presentHomeClubFinance, type HomePortfolioSummaryInput } from '../home/presentHomePortfolio.ts';
import {
  presentInvestmentIdentity,
  type InvestmentIdentityPresentation,
} from '../investments/presentInvestmentIdentity.ts';
import { BOTTOM_NAV_SLOTS, BOTTOM_NAV_TAB_KEYS } from '../../navigation/bottomNavStructure.ts';
import type { PortfolioValuationConfidence } from '../portfolio/valuationLabels.ts';

export const CLUB_TAB_KEYS = ['overview', 'proposals', 'chat', 'settings'] as const;
export type ClubTabKey = (typeof CLUB_TAB_KEYS)[number];

export const CLUB_IMPLEMENTED_TABS = ['overview', 'proposals', 'settings'] as const satisfies readonly ClubTabKey[];
export const CLUB_FUTURE_TABS = ['chat'] as const satisfies readonly ClubTabKey[];

export const CLUB_TAB_LABELS: Record<ClubTabKey, string> = {
  overview: 'Overview',
  proposals: 'Proposals',
  chat: 'Chat',
  settings: 'Settings',
};

export const CLUB_STAT_LABELS = ['Group value', 'Your stake', 'All-time return'] as const;

export const CLUB_PERFORMANCE_TITLE = 'Your position';
export const CLUB_PERFORMANCE_CAPTION = 'Estimated value in this club';
export const CLUB_HOLDINGS_TITLE = 'Your holdings';
export const CLUB_STRATEGY_TITLE = 'Current strategy';

export const FORBIDDEN_CLUB_COPY = [
  'buying power',
  'withdraw',
  'deposit',
  'group cash',
  'pooled',
  'shares per member',
  'cost per member',
  'verified',
] as const;

export type ClubActionKey = 'investment_day' | 'invite';

export interface ClubPrimaryAction {
  key: ClubActionKey;
  label: string;
  variant: 'primary' | 'secondary';
}

export interface ClubHeroStats {
  groupValue: string;
  yourStake: string;
  allTimeReturn: string;
  returnTone: 'positive' | 'negative' | 'secondary';
  labels: typeof CLUB_STAT_LABELS;
  usesDemo: false;
  groupValueIsPrivateOrUnavailable: boolean;
}

export interface ClubStrategySliceInput {
  label: string;
  percentage: number;
  ticker?: string | null;
}

export interface ClubStrategyLine {
  ticker: string;
  friendlyName: string;
  legalName: string | null;
  issuer: string | null;
  markKey: InvestmentIdentityPresentation['markKey'];
  fallbackInitials: string;
  percentage: number;
  name: string;
}

export interface ClubStrategyPresentation {
  readOnly: true;
  packageName: string | null;
  description: string | null;
  lines: ClubStrategyLine[];
  allocationSummary: string | null;
}

export interface ClubHoldingCardPresentation {
  identity: InvestmentIdentityPresentation;
  currentValue: string | null;
  currentValueCaption: 'Current value' | null;
  investedLabel: string;
  returnLabel: null;
  cardStatus: 'Exact holdings' | null;
  usesDemo: false;
  accessibilityLabel: string;
}

export function visibleClubTabs(): ClubTabKey[] {
  return [...CLUB_IMPLEMENTED_TABS];
}

export function isClubTabImplemented(tab: ClubTabKey): boolean {
  return (CLUB_IMPLEMENTED_TABS as readonly ClubTabKey[]).includes(tab);
}

export function clubMemberCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'member' : 'members'}`;
}

export function presentClubPrimaryActions(input: { isOwner: boolean }): ClubPrimaryAction[] {
  const actions: ClubPrimaryAction[] = [
    { key: 'investment_day', label: 'Investment Day', variant: 'primary' },
  ];

  if (input.isOwner) {
    actions.push({ key: 'invite', label: 'Invite member', variant: 'secondary' });
  }

  return actions;
}

/**
 * Group value stays hidden unless a future privacy-safe sharing contract is
 * supplied. Current authenticated APIs expose caller-owned values only, and
 * Club V2 does not invent a group total.
 */
export function presentClubHeroStats(input: {
  groupAggregateMinor: number | null;
  groupAggregatePrivacySafe: boolean;
  yourStakeMinor: number | null;
  returnPercentage: number | null;
}): ClubHeroStats {
  const canShowGroup = input.groupAggregatePrivacySafe && input.groupAggregateMinor != null;

  return {
    groupValue: canShowGroup && input.groupAggregateMinor != null
      ? formatHomeNokFromMinor(input.groupAggregateMinor)
      : '—',
    yourStake: input.yourStakeMinor != null ? formatHomeNokFromMinor(input.yourStakeMinor) : '—',
    allTimeReturn:
      input.returnPercentage != null ? formatHomeSignedPercentage(input.returnPercentage) : '—',
    returnTone:
      input.returnPercentage == null ? 'secondary' : input.returnPercentage < 0 ? 'negative' : 'positive',
    labels: CLUB_STAT_LABELS,
    usesDemo: false,
    groupValueIsPrivateOrUnavailable: !canShowGroup,
  };
}

export function presentClubViewerFinance(summary: HomePortfolioSummaryInput | null) {
  const finance = presentHomeClubFinance(summary ?? undefined);
  return {
    ...finance,
    usesDemo: false as const,
  };
}

function resolveTicker(slice: ClubStrategySliceInput): string | null {
  const explicit = slice.ticker?.trim();
  if (explicit) {
    return explicit.toUpperCase();
  }

  const label = slice.label;
  for (const target of CORE_V1_TARGETS) {
    if (label === target.officialName || label === target.shortName) {
      return target.ticker;
    }
    if (label.toUpperCase().includes(target.ticker)) {
      return target.ticker;
    }
  }

  return null;
}

function matchCuratedPackage(slices: readonly ClubStrategySliceInput[]) {
  const resolved = slices.map((slice) => {
    const ticker = resolveTicker(slice);
    const target = CORE_V1_TARGETS.find((item) => item.ticker === ticker);
    return {
      targetId: target?.id ?? null,
      bps: Math.round(slice.percentage * 100),
    };
  });

  if (resolved.length === 0 || resolved.some((row) => row.targetId == null)) {
    return null;
  }

  return (
    CURATED_INVESTMENT_PACKAGES.find((item) => {
      if (item.allocations.length !== resolved.length) {
        return false;
      }

      return item.allocations.every((allocation) =>
        resolved.some((row) => row.targetId === allocation.targetId && row.bps === allocation.allocationBps),
      );
    }) ?? null
  );
}

export function presentClubStrategy(slices: readonly ClubStrategySliceInput[]): ClubStrategyPresentation {
  const matched = matchCuratedPackage(slices);
  const lines = slices.map((slice) => {
    const identity = presentInvestmentIdentity({
      ticker: resolveTicker(slice) ?? slice.ticker,
      name: slice.label,
    });

    return {
      ticker: identity.ticker,
      friendlyName: identity.friendlyName,
      legalName: identity.officialName,
      issuer: identity.issuer,
      markKey: identity.markKey,
      fallbackInitials: identity.fallbackInitials,
      percentage: slice.percentage,
      name: slice.label,
    };
  });

  return {
    readOnly: true,
    packageName: matched?.displayName ?? null,
    description: matched?.shortDescription ?? null,
    lines,
    allocationSummary: matched
      ? matched.allocations
          .map((allocation) => {
            const target = getCoreV1Target(allocation.targetId);
            return `${allocation.allocationBps / 100}% ${target.ticker}`;
          })
          .join('\n')
      : lines.length > 0
        ? lines.map((line) => `${line.percentage}% ${line.ticker}`).join('\n')
        : null,
  };
}

export function presentClubHoldingsCaption(
  confidence: PortfolioValuationConfidence | null | undefined,
): string | null {
  if (confidence === 'estimated') {
    return 'Values are estimated from your reported investments.';
  }
  if (confidence === 'mixed') {
    return 'Some values are estimated from your reported investments.';
  }
  if (confidence === 'exact') {
    return 'Based on your reported investments.';
  }
  return null;
}

export function presentClubHoldingCard(input: {
  ticker: string | null;
  name: string;
  targetId?: string | null;
  investedMinor: number;
  currentValueMinor: number | null;
  quantityStatus: 'complete' | 'partial' | 'unavailable';
}): ClubHoldingCardPresentation {
  const identity = presentInvestmentIdentity({
    ticker: input.ticker,
    name: input.name,
    targetId: input.targetId,
  });
  const currentValue =
    input.currentValueMinor != null ? formatHomeNokFromMinor(input.currentValueMinor) : null;
  const investedLabel = `${formatHomeNokFromMinor(input.investedMinor)} invested`;
  const cardStatus = input.quantityStatus === 'complete' ? 'Exact holdings' : null;
  const parts = [
    identity.ticker,
    identity.friendlyName !== identity.ticker ? identity.friendlyName : null,
    currentValue ? `${currentValue} current value` : null,
    investedLabel,
    cardStatus,
  ].filter((part): part is string => Boolean(part));

  return {
    identity,
    currentValue,
    currentValueCaption: currentValue ? 'Current value' : null,
    investedLabel,
    returnLabel: null,
    cardStatus,
    usesDemo: false,
    accessibilityLabel: parts.join(', '),
  };
}

export function clubOverviewCopyContainsTechnicalClutter(text: string): boolean {
  return /ucits|\betf\s*·|\betf\s*·\s*eur|etf · eur/i.test(text);
}

export function presentClubProposalCapability() {
  return {
    available: true as const,
    usesDemo: false as const,
    canRead: true as const,
    canCastVote: true as const,
    canCreate: false as const,
    openVoteChoicesHidden: true as const,
    reason: 'open_vote_choices_hidden_by_rls' as const,
  };
}

export function presentClubChatCapability() {
  return {
    available: false as const,
    usesDemo: false as const,
    reason: 'club_chat_not_shipped' as const,
  };
}

export function presentClubPinControl() {
  return {
    visible: false as const,
    persistable: false as const,
    reason: 'home_pin_not_persisted' as const,
  };
}

export function presentClubSettingsItems(input: { isOwner: boolean }) {
  return {
    details: true,
    members: true,
    contributions: true,
    governance: true,
    invite: input.isOwner,
    leave: false,
    pinToHome: false,
    editDetails: input.isOwner,
  };
}

export function clubCopyContainsForbidden(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_CLUB_COPY.some((phrase) => lower.includes(phrase));
}

export function clubBottomNavUnchanged(): boolean {
  return (
    BOTTOM_NAV_TAB_KEYS[0] === 'home'
    && BOTTOM_NAV_TAB_KEYS[1] === 'club'
    && BOTTOM_NAV_TAB_KEYS[2] === 'invest'
    && BOTTOM_NAV_TAB_KEYS[3] === 'activity'
    && BOTTOM_NAV_SLOTS[2] === 'action'
  );
}
