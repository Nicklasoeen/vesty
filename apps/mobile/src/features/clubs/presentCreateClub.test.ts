import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createEmptyCreateClubDraft, type CreateClubDraft } from './createClubWizard.ts';
import {
  presentCreateClubAmountPreview,
  presentCreateClubCatalogPanel,
  presentCreateClubContinue,
  presentCreateClubContributionChoice,
  presentCreateClubContributionOptions,
  presentCreateClubContributionSelection,
  presentCreateClubGovernanceChoice,
  presentCreateClubGovernanceOptions,
  presentCreateClubProgress,
  presentCreateClubReview,
} from './presentCreateClub.ts';
import { formatCheckedOn, presentGroupTypeOptions, presentSingleFundCard, presentSingleFundDetails } from './presentSingleFund.ts';
import { DNB_GLOBAL_INDEKS_A, DNB_GLOBAL_INDEKS_A_PRODUCT_ID } from './singleFundCatalog.ts';

const CREATION_ID = '86000000-0000-4000-8000-000000000001';

function completeDraft(overrides: Partial<CreateClubDraft> = {}): CreateClubDraft {
  return {
    ...createEmptyCreateClubDraft(CREATION_ID),
    name: 'Den Beste Klubben',
    mode: 'single_fund',
    catalogProductId: DNB_GLOBAL_INDEKS_A_PRODUCT_ID,
    contributionMode: 'equal',
    equalAmountInput: '1000',
    step: 'review',
    ...overrides,
  };
}

describe('presentCreateClubProgress', () => {
  it('numbers the Simple saving wizard order', () => {
    assert.deepEqual(presentCreateClubProgress('name'), {
      eyebrow: 'Create club',
      progressLabel: '1 of 6',
      title: 'What should your club be called?',
      supporting: 'You can change the name later.',
      stepIndex: 1,
      stepCount: 6,
    });
    assert.equal(presentCreateClubProgress('mode').title, 'Find your saving rhythm.');
    assert.equal(presentCreateClubProgress('fund').progressLabel, '3 of 6');
    assert.equal(presentCreateClubProgress('fund').title, 'One fund. Many companies.');
    assert.equal(presentCreateClubProgress('contribution').title, 'A habit that fits everyday life.');
    assert.equal(presentCreateClubProgress('governance').title, 'How will you agree?');
    assert.equal(presentCreateClubProgress('review').progressLabel, '6 of 6');
    assert.equal(presentCreateClubProgress('review').title, 'This is your club.');
  });
});

describe('group type options', () => {
  it('keeps Simple saving active and Build your strategy locked', () => {
    const options = presentGroupTypeOptions(null);
    assert.equal(options[0]?.title, 'Simple saving');
    assert.equal(options[0]?.description, 'One fund. One steady habit.');
    assert.equal(options[0]?.locked, false);
    assert.equal(options[1]?.title, 'Build your strategy');
    assert.equal(options[1]?.locked, true);
    assert.equal(options[1]?.lockReason, 'Available after initial testing');
    assert.equal(options[1]?.selected, false);
    assert.match(options[1]?.accessibilityLabel ?? '', /Available after initial testing/);
  });
});

describe('fund card', () => {
  it('explains the DNB fund without advice or live NAV', () => {
    const card = presentSingleFundCard(DNB_GLOBAL_INDEKS_A, true);
    const details = presentSingleFundDetails(DNB_GLOBAL_INDEKS_A);
    const visible = [
      card.title,
      card.description,
      ...card.facts,
      details.risk,
      details.horizon,
      details.brokers,
      ...details.notes,
      ...details.costs.map((row) => row.label),
    ].join('\n');

    assert.equal(card.title, 'DNB Global Indeks A');
    assert.match(card.description, /developed markets/);
    assert.equal(card.facts.some((fact) => fact.includes('NOK')), true);
    assert.equal(card.facts.some((fact) => fact.includes('Nordnet') && fact.includes('DNB')), true);
    assert.match(visible, /Risk 4 of 7/);
    assert.match(visible, /At least 6 years/);
    assert.match(visible, /0\.20%/);
    assert.match(visible, /0\.25%/);
    assert.doesNotMatch(visible, /live NAV|expected return|best fund|recommended for you/i);
    assert.equal(details.notes.some((note) => note.includes('unknown NAV')), true);
    assert.equal(details.notes.some((note) => note.includes('does not execute')), true);
    assert.equal(details.links.every((link) => link.url.startsWith('https://www.')), true);
  });

  it('formats any valid checked-on date, not only the first catalog day', () => {
    assert.equal(formatCheckedOn('2026-09-07'), '7 September 2026');
    assert.equal(formatCheckedOn('2026-10-12'), '12 October 2026');
    assert.equal(formatCheckedOn('2027-01-01'), '1 January 2027');
    assert.equal(formatCheckedOn('not-a-date'), 'not-a-date');
  });

  it('hides lookalike or userinfo broker URLs from the details panel', () => {
    const details = presentSingleFundDetails({
      ...DNB_GLOBAL_INDEKS_A,
      brokers: DNB_GLOBAL_INDEKS_A.brokers.map((listing) => ({
        ...listing,
        productUrl: 'https://nordnet.no.example.com/fond/liste/dnb-global-indeks-a',
      })),
    });
    assert.equal(details.links.length, 0);
  });
});

describe('catalog panel copy', () => {
  it('uses natural fund copy and a retryable catalog error', () => {
    assert.equal(presentCreateClubCatalogPanel('loading').title, 'Loading funds…');
    assert.equal(presentCreateClubCatalogPanel('empty').title, 'No funds are available right now');
    assert.equal(presentCreateClubCatalogPanel('error').title, 'Unable to load funds');
    assert.equal(presentCreateClubCatalogPanel('error').retry, true);
    assert.doesNotMatch(
      JSON.stringify([
        presentCreateClubCatalogPanel('loading'),
        presentCreateClubCatalogPanel('empty'),
        presentCreateClubCatalogPanel('error'),
      ]),
      /checked funds/i,
    );
  });
});

describe('contribution style options', () => {
  it('renders two tappable choices and reveals the matching amount field', () => {
    const options = presentCreateClubContributionOptions();
    assert.equal(options[0]?.title, 'Each chooses their own amount');
    assert.equal(options[1]?.title, 'Everyone saves the same amount');
    assert.match(options[0]?.privacy ?? '', /Other members will not see it/);

    const same = presentCreateClubContributionSelection('equal');
    assert.equal(same.revealsClubAmount, true);
    const flexible = presentCreateClubContributionSelection('flexible');
    assert.equal(flexible.revealsYourAmount, true);
    const unselected = presentCreateClubContributionChoice('equal', null);
    assert.equal(unselected.selected, false);
    assert.equal(unselected.tappable, true);
  });

  it('formats the typed amount and only then enables Continue', () => {
    assert.match(presentCreateClubAmountPreview('2000') ?? '', /2\s?000 kr/);
    const empty = presentCreateClubContinue(completeDraft({
      step: 'contribution',
      equalAmountInput: '',
    }), [DNB_GLOBAL_INDEKS_A]);
    const valid = presentCreateClubContinue(completeDraft({
      step: 'contribution',
      equalAmountInput: '2000',
    }), [DNB_GLOBAL_INDEKS_A]);
    assert.equal(empty.enabled, false);
    assert.equal(valid.enabled, true);
    assert.equal(presentCreateClubContinue(completeDraft({ step: 'name', name: '' })).enabled, false);
    assert.equal(presentCreateClubContinue(completeDraft({ step: 'name', name: 'Friday Club' })).enabled, true);
    assert.equal(presentCreateClubContinue(completeDraft({ step: 'review' }), [DNB_GLOBAL_INDEKS_A]).label, 'Create club');
    assert.equal(
      presentCreateClubContinue(completeDraft({ step: 'fund', catalogProductId: null }), [DNB_GLOBAL_INDEKS_A]).enabled,
      false,
    );
    assert.equal(
      presentCreateClubContinue(completeDraft({ step: 'fund' }), []).enabled,
      false,
    );
    assert.equal(
      presentCreateClubContinue(completeDraft({ step: 'fund' }), [DNB_GLOBAL_INDEKS_A], 'error').enabled,
      false,
    );
    assert.equal(
      presentCreateClubContinue(completeDraft({ step: 'fund' }), [DNB_GLOBAL_INDEKS_A], 'loading').enabled,
      false,
    );
  });
});

describe('governance options', () => {
  it('maps stored values to ordinary English labels', () => {
    const options = presentCreateClubGovernanceOptions();
    assert.deepEqual(options.map((option) => option.value), ['simple_majority', 'supermajority', 'unanimous']);
    assert.deepEqual(options.map((option) => option.title), [
      'Simple majority',
      'Two-thirds majority',
      'Everyone agrees',
    ]);
    const selected = presentCreateClubGovernanceChoice('simple_majority', 'simple_majority');
    assert.equal(selected.selected, true);
  });
});

describe('create club review', () => {
  it('reads as a Simple saving agreement from the draft and catalog', () => {
    const review = presentCreateClubReview(completeDraft(), DNB_GLOBAL_INDEKS_A);
    const primary = review.primaryLines.join('\n');

    assert.equal(review.clubName, 'Den Beste Klubben');
    assert.equal(review.groupTypeName, 'Simple saving');
    assert.equal(review.investmentName, 'DNB Global Indeks A');
    assert.equal(review.contributionName, 'Everyone saves the same amount');
    assert.match(review.contributionDetail, /shared with members/);
    assert.equal('customLocked' in review, false);
    assert.doesNotMatch(primary, /Build your strategy/);
    assert.doesNotMatch(primary, /Available after initial testing/);
    assert.match(primary, /does not hold money/);
    assert.doesNotMatch(primary, /recommended for you|live NAV|best fund/i);
  });

  it('keeps Flexible amounts private in review', () => {
    const review = presentCreateClubReview(
      completeDraft({
        contributionMode: 'flexible',
        creatorFlexibleAmountInput: '1500',
      }),
      DNB_GLOBAL_INDEKS_A,
    );
    assert.equal(review.contributionName, 'Each chooses their own amount');
    assert.match(review.contributionPrivacy ?? '', /Other members will not see it/);
    assert.doesNotMatch(review.contributionDetail, /shared with members/);
  });
});
