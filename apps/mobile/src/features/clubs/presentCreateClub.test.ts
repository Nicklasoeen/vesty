import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CURATED_INVESTMENT_PACKAGES, getCuratedPackage } from './curatedInvestmentPackages.ts';
import { INITIAL_CREATE_CLUB_DRAFT, type CreateClubDraft } from './createClubWizard.ts';
import {
  createClubReviewContainsLegalInstrumentNames,
  packageFriendlyHoldings,
  presentCreateClubAmountPreview,
  presentCreateClubContinue,
  presentCreateClubContributionChoice,
  presentCreateClubContributionOptions,
  presentCreateClubContributionSelection,
  presentCreateClubGovernanceChoice,
  presentCreateClubGovernanceOptions,
  presentCreateClubInvestmentOption,
  presentCreateClubProgress,
  presentCreateClubReview,
} from './presentCreateClub.ts';

function completeDraft(overrides: Partial<CreateClubDraft> = {}): CreateClubDraft {
  return {
    ...INITIAL_CREATE_CLUB_DRAFT,
    name: 'Den Beste Klubben',
    packageId: 'world_mix',
    contributionMode: 'equal',
    equalAmountInput: '1000',
    step: 'review',
    ...overrides,
  };
}

describe('presentCreateClubProgress', () => {
  it('numbers the real wizard order without reordering steps', () => {
    assert.deepEqual(presentCreateClubProgress('name'), {
      eyebrow: 'Create club',
      progressLabel: '1 of 5',
      title: 'Club name',
      supporting: 'What should your club be called?',
      stepIndex: 1,
      stepCount: 5,
    });
    assert.equal(presentCreateClubProgress('governance').progressLabel, '2 of 5');
    assert.equal(presentCreateClubProgress('governance').title, 'Governance');
    assert.equal(presentCreateClubProgress('style').progressLabel, '3 of 5');
    assert.equal(presentCreateClubProgress('style').title, 'Investment style');
    assert.equal(
      presentCreateClubProgress('style').supporting,
      'Choose a starting portfolio for the club.',
    );
    assert.equal(presentCreateClubProgress('contribution').progressLabel, '4 of 5');
    assert.equal(presentCreateClubProgress('review').progressLabel, '5 of 5');
    assert.equal(presentCreateClubProgress('review').title, 'Review');
  });
});

describe('investment style options', () => {
  it('keeps unselected packages compact and visually selectable', () => {
    const worldMix = getCuratedPackage('world_mix');
    const presented = presentCreateClubInvestmentOption(worldMix, false);

    assert.equal(presented.title, 'World Mix');
    assert.equal(presented.position, 'Broadest mix');
    assert.equal(presented.selected, false);
    assert.equal(presented.tappable, true);
    assert.equal(presented.indicator, 'empty');
    assert.equal(presented.surfaceToken, 'surface');
    assert.equal(presented.borderToken, 'border');
    assert.match(presented.allocationPreview, /60% World/);
  });

  it('shows friendly percentages for the selected package, not legal ETF names', () => {
    const worldMix = getCuratedPackage('world_mix');
    const presented = presentCreateClubInvestmentOption(worldMix, true);
    const visible = [presented.title, ...presented.exposureLines, ...presented.holdings.map((row) => row.line)].join('\n');

    assert.equal(presented.selected, true);
    assert.equal(presented.indicator, 'filled');
    assert.equal(presented.surfaceToken, 'mintSoft');
    assert.equal(presented.borderToken, 'accent');
    assert.deepEqual(presented.exposureLines, ['60% World', '25% Europe', '15% Emerging Markets']);
    assert.equal(presented.holdings[0]?.line, 'VWCE · Global equities');
    assert.equal(createClubReviewContainsLegalInstrumentNames(visible), false);
  });
});

describe('contribution style options', () => {
  it('renders two tappable choices and reveals the matching amount field', () => {
    const options = presentCreateClubContributionOptions();
    assert.equal(options.length, 2);
    assert.equal(options[0]?.title, 'Same amount');
    assert.equal(options[0]?.description, 'Everyone contributes the same amount.');
    assert.equal(options[1]?.title, 'Flexible amounts');
    assert.equal(options[1]?.description, 'Each member privately chooses their own amount.');

    const same = presentCreateClubContributionSelection('equal');
    assert.equal(same.revealsClubAmount, true);
    assert.equal(same.revealsYourAmount, false);
    assert.equal(same.clubAmountLabel, 'Club amount');
    assert.equal(same.indicator, 'filled');

    const flexible = presentCreateClubContributionSelection('flexible');
    assert.equal(flexible.revealsClubAmount, false);
    assert.equal(flexible.revealsYourAmount, true);
    assert.equal(flexible.yourAmountLabel, 'Your amount');
    assert.equal(flexible.privacy, 'Only you can see your amount.');

    const unselected = presentCreateClubContributionChoice('equal', null);
    assert.equal(unselected.selected, false);
    assert.equal(unselected.indicator, 'empty');
    assert.equal(unselected.tappable, true);
  });

  it('formats the typed amount and only then enables Continue', () => {
    assert.match(presentCreateClubAmountPreview('2000') ?? '', /2\s?000 kr/);
    assert.equal(presentCreateClubAmountPreview(''), null);

    const empty = presentCreateClubContinue({
      ...completeDraft({
        step: 'contribution',
        contributionMode: 'equal',
        equalAmountInput: '',
      }),
    });
    const valid = presentCreateClubContinue({
      ...completeDraft({
        step: 'contribution',
        contributionMode: 'equal',
        equalAmountInput: '2000',
      }),
    });

    assert.equal(empty.enabled, false);
    assert.equal(valid.enabled, true);
    assert.equal(valid.label, 'Continue');
  });
});

describe('governance options', () => {
  it('exposes three tappable radios with a distinct selected state', () => {
    const options = presentCreateClubGovernanceOptions();
    assert.equal(options.length, 3);
    assert.equal(options.every((option) => option.tappable && option.accessibilityRole === 'radio'), true);
    assert.equal(options[0]?.title, 'Simple majority');
    assert.equal(options[0]?.guidance, 'Good for most clubs');
    assert.equal(options[1]?.title, '75% majority');
    assert.equal(options[2]?.title, 'Unanimous');

    const selected = presentCreateClubGovernanceChoice('simple_majority', 'simple_majority');
    const unselected = presentCreateClubGovernanceChoice('unanimous', 'simple_majority');

    assert.equal(selected.selected, true);
    assert.equal(selected.indicator, 'filled');
    assert.equal(selected.surfaceToken, 'mintSoft');
    assert.equal(selected.borderToken, 'accent');
    assert.equal(selected.tappable, true);
    assert.equal(unselected.selected, false);
    assert.equal(unselected.indicator, 'empty');
    assert.equal(unselected.surfaceToken, 'surface');
  });
});

describe('create club review', () => {
  it('uses a short friendly summary instead of legal instrument names', () => {
    const review = presentCreateClubReview(completeDraft());
    const primary = review.primaryLines.join('\n');

    assert.equal(review.clubName, 'Den Beste Klubben');
    assert.equal(review.investmentName, 'World Mix');
    assert.deepEqual(review.exposureLines, ['60% World', '25% Europe', '15% Emerging Markets']);
    assert.equal(review.contributionName, 'Same amount');
    assert.match(review.contributionDetail, /1\s?000 kr per Investment Day/);
    assert.equal(review.governanceName, 'Simple majority');
    assert.equal(review.holdings[0]?.line, 'VWCE · Global equities');
    assert.equal(createClubReviewContainsLegalInstrumentNames(primary), false);
    assert.equal(
      createClubReviewContainsLegalInstrumentNames(review.holdings.map((row) => row.line).join('\n')),
      false,
    );
  });

  it('never promotes official ETF names from the catalog into review', () => {
    for (const item of CURATED_INVESTMENT_PACKAGES) {
      const review = presentCreateClubReview(completeDraft({ packageId: item.id }));
      const visible = [...review.primaryLines, ...review.holdings.map((row) => row.line)].join('\n');
      const official = packageFriendlyHoldings(item);

      assert.equal(createClubReviewContainsLegalInstrumentNames(visible), false);
      assert.equal(official.every((row) => row.friendlyName.length > 0 && !LEGAL_FRAGMENT(row.friendlyName)), true);
    }
  });
});

function LEGAL_FRAGMENT(value: string): boolean {
  return createClubReviewContainsLegalInstrumentNames(value);
}
