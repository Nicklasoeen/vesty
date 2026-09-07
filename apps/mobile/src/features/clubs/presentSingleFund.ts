import { formatNokFromMinor } from '../../lib/currency.ts';
import { presentSelectableOptionAppearance } from '../../ui/selectableOptionAppearance.ts';
import { contributionStyleLabel } from './presentContribution.ts';
import { governanceLabel } from './governance.ts';
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
      description: 'Choose one fund and build a regular investing habit together.',
      facts: ['One investment', 'Minimal monthly upkeep', 'Ready-made fund choices'],
      expanded: 'Each member owns and buys the fund in their own brokerage account.',
      locked: false,
      lockReason: null,
      accessibilityLabel: 'Simple saving',
      ...presentSelectableOptionAppearance(selected === 'single_fund'),
    },
    {
      value: 'custom_portfolio' as const,
      title: 'Build your strategy',
      description: 'Choose investments together and decide how the club should be allocated.',
      facts: ['Choose several investments', 'Set target percentages', 'More decisions on Investment Day'],
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
      'One fund and one purchase',
      `Buy for a ${product.currency} amount`,
      `Risk ${product.riskIndicator}`,
      product.recommendedHorizon,
      verifiedBrokers.length > 0
        ? `Confirmed available at ${verifiedBrokers.join(' and ')}`
        : 'Broker availability is still being checked',
      `Product facts checked ${formatCheckedOn(product.checkedOn)}`,
    ],
    ...presentSelectableOptionAppearance(selected),
  };
}

export function presentSingleFundDetails(product: SingleFundProduct) {
  return {
    legalName: product.legalName,
    isin: product.isin,
    managerName: product.managerName,
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

  return {
    clubName: trimmedClubName(draft.name),
    groupTypeLabel: 'How you invest',
    groupTypeName: 'Simple saving',
    groupTypeDetail: `The club saves in ${product.legalName}.`,
    investmentLabel: 'Fund',
    investmentName: product.legalName,
    investmentDetails: [
      'Each member buys and owns the fund in their own brokerage account.',
      'One fund and one purchase, for a NOK amount.',
    ],
    contributionStyleLabel: 'Monthly contribution',
    contributionName: draft.contributionMode ? contributionStyleLabel(draft.contributionMode) : 'Not selected',
    contributionDetail:
      draft.contributionMode === 'equal'
        ? `${amountLabel} per month, shared with members`
        : amountLabel,
    contributionPrivacy:
      draft.contributionMode === 'flexible'
        ? 'Only you can see your amount. Other members will not see it.'
        : null,
    governanceLabel: 'How decisions are made',
    governanceName: governanceLabel(draft.governance),
    ownership: 'Vesty does not hold money and does not execute trades.',
    primaryLines: [
      trimmedClubName(draft.name),
      `The club saves in ${product.legalName}.`,
      'Each member buys and owns the fund in their own brokerage account.',
      draft.contributionMode ? contributionStyleLabel(draft.contributionMode) : '',
      draft.contributionMode === 'flexible'
        ? 'Only you can see your amount. Other members will not see it.'
        : amountLabel,
      governanceLabel(draft.governance),
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
