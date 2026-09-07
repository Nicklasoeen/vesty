import { formatNokFromMinor } from '../../lib/currency.ts';
import { presentSelectableOptionAppearance } from '../../ui/selectableOptionAppearance.ts';
import { createClubContributionTitle, createClubGovernanceLabel } from './presentCreateClubFlow.ts';
import {
  parsedCreatorFlexibleAmountMinor,
  parsedEqualAmountMinor,
  trimmedClubName,
  type ClubInvestmentModeChoice,
  type CreateClubDraft,
} from './createClubWizard.ts';
import { isAllowedSingleFundSourceUrl } from './singleFundSourceUrl.ts';
import type { SingleFundBrokerListing, SingleFundProduct } from './singleFundCatalog.ts';

export function presentGroupTypeOptions(selected: ClubInvestmentModeChoice | null) {
  return [
    {
      value: 'single_fund' as const,
      title: 'Simple saving',
      description: 'One fund. One steady habit.',
      facts: ['One fund · Buy in NOK'],
      expanded: 'Each member buys and owns the fund in their own brokerage account.',
      locked: false,
      lockReason: null,
      accessibilityLabel: 'Simple saving',
      ...presentSelectableOptionAppearance(selected === 'single_fund'),
    },
    {
      value: 'custom_portfolio' as const,
      title: 'Build your strategy',
      description: 'Choose several investments together',
      facts: [],
      expanded: null,
      locked: true,
      lockReason: 'Available after initial testing',
      lockLabel: 'Available after initial testing',
      accessibilityLabel: 'Build your strategy. Available after initial testing',
      selected: false,
      indicator: 'empty' as const,
      surfaceToken: 'surface' as const,
      borderToken: 'border' as const,
      titleEmphasis: 'default' as const,
      accessibilityRole: 'radio' as const,
    },
  ];
}

export function presentSingleFundCard(product: SingleFundProduct, selected: boolean) {
  const dnb = product.brokers.find((listing) => listing.broker === 'dnb');
  const nordnet = product.brokers.find((listing) => listing.broker === 'nordnet');
  const verifiedBrokers = [nordnet?.isVerified ? 'Nordnet' : null, dnb?.isVerified ? 'DNB' : null].filter(
    (name): name is string => Boolean(name),
  );

  return {
    title: product.displayName,
    description: product.shortDescription,
    facts: [
      `Buy for a ${product.currency} amount`,
      `Risk ${product.riskIndicator}`,
      product.recommendedHorizon,
      verifiedBrokers.length > 0
        ? `Available at ${verifiedBrokers.join(' and ')}`
        : 'Broker availability is still being checked',
      `Checked ${formatCheckedOn(product.checkedOn)}`,
    ],
    ...presentSelectableOptionAppearance(selected),
  };
}

export function presentSingleFundDetails(product: SingleFundProduct) {
  const verifiedBrokers = product.brokers
    .filter((listing) => listing.isVerified)
    .map((listing) => (listing.broker === 'dnb' ? 'DNB' : 'Nordnet'));

  return {
    legalName: product.legalName,
    isin: product.isin,
    managerName: product.managerName,
    risk: `Risk ${product.riskIndicator}`,
    horizon: product.recommendedHorizon,
    brokers: verifiedBrokers.length > 0 ? `Available at ${verifiedBrokers.join(' and ')}` : null,
    costs: product.brokers.map((listing) => presentBrokerCost(listing)),
    links: product.brokers.flatMap((listing) => {
      if (!isAllowedSingleFundSourceUrl(listing.productUrl)) {
        return [];
      }
      return [
        {
          broker: listing.broker,
          label: listing.broker === 'dnb' ? 'Open DNB fund page' : 'Open Nordnet fund page',
          url: listing.productUrl,
        },
      ];
    }),
    notes: [
      'Fund orders are normally executed later at an unknown NAV.',
      'Each member buys and owns the fund in their own brokerage account.',
      'Vesty does not execute the trade.',
      'Read the key investor information before you buy.',
    ],
  };
}

export function presentCreateClubReviewAgreement(
  draft: CreateClubDraft,
  product: SingleFundProduct,
) {
  const amountMinor =
    draft.contributionMode === 'equal'
      ? parsedEqualAmountMinor(draft)
      : parsedCreatorFlexibleAmountMinor(draft);
  const amountLabel = amountMinor == null ? '' : formatNokFromMinor(amountMinor);
  const contributionTitle = draft.contributionMode ? createClubContributionTitle(draft.contributionMode) : 'Not selected';

  return {
    clubName: trimmedClubName(draft.name),
    groupTypeLabel: 'Saving',
    groupTypeName: 'Simple saving',
    groupTypeDetail: `The club saves in ${product.legalName}.`,
    investmentLabel: 'Fund',
    investmentName: product.displayName,
    investmentDetails: [
      'Each member buys and owns the fund in their own brokerage account.',
    ],
    contributionStyleLabel: 'Contribution',
    contributionName: contributionTitle,
    contributionDetail:
      draft.contributionMode === 'equal'
        ? `${amountLabel} each month, shared with members`
        : amountLabel,
    contributionPrivacy:
      draft.contributionMode === 'flexible'
        ? 'Only you can see your amount. Other members will not see it.'
        : null,
    governanceLabel: 'Decisions',
    governanceName: createClubGovernanceLabel(draft.governance),
    ownership: 'Each member buys and owns the fund in their own brokerage account. Vesty does not hold money and does not execute trades.',
    primaryLines: [
      trimmedClubName(draft.name),
      `The club saves in ${product.legalName}.`,
      'Each member buys and owns the fund in their own brokerage account.',
      draft.contributionMode ? createClubContributionTitle(draft.contributionMode) : '',
      draft.contributionMode === 'flexible'
        ? 'Only you can see your amount. Other members will not see it.'
        : amountLabel,
      createClubGovernanceLabel(draft.governance),
      'Vesty does not hold money and does not execute trades.',
    ].filter(Boolean),
  };
}

function presentBrokerCost(listing: SingleFundBrokerListing) {
  return {
    broker: listing.broker,
    label: listing.annualCostLabel,
    source: listing.costSourceLabel,
    url: listing.costSourceUrl,
    minimumNote: listing.minimumNote,
  };
}

export function formatCheckedOn(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return value;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(date.getTime())
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return value;
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
