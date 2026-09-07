import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CHART_VERTICAL_PADDING,
  chartDomain,
  isChartYInsidePlot,
  mapChartY,
} from './chartScale.ts';
import {
  formatHomeGainLine,
  formatHomeNokFromMinor,
  formatHomeSignedBps,
  formatHomeSignedPercentage,
  HOME_PINNED_STAT_LABELS,
  HOME_PORTFOLIO_STAT_LABELS,
  homeScrollBottomPadding,
  pinnedClubStackSpacing,
} from './presentHomeMoney.ts';
import {
  HOME_PORTFOLIO_DEFAULT_RANGE,
  HOME_PORTFOLIO_RANGE_OPTIONS,
  homeGreeting,
  presentHomeClubFinance,
  presentHomePortfolio,
  selectPortfolioRange,
  type HomePortfolioSummaryInput,
} from './presentHomePortfolio.ts';
import {
  HOME_CLUB_CARD_TINT_COUNT,
  clubCardTintIndex,
  filterYourClubs,
  nextLockedHomePinnedClubId,
  resolveHomePinnedClub,
} from './resolveHomePinnedClub.ts';

function normalizeSpaces(value: string): string {
  return value.replace(/\s/g, ' ');
}

const aliceClub = { clubId: 'club-a' };
const bobClub = { clubId: 'club-b' };
const caraClub = { clubId: 'club-c' };

function curatedSummary(): HomePortfolioSummaryInput {
  return {
    clubId: 'curated',
    modellingScope: 'curated_etf',
    investedMinor: 200000,
    estimatedCurrentValueMinor: 248000,
    gainLossMinor: 48000,
    gainLossBps: 2400,
    valuationConfidence: 'estimated',
  };
}

describe('resolveHomePinnedClub', () => {
  it('auto-selects the only club', () => {
    assert.equal(
      resolveHomePinnedClub({ clubs: [aliceClub], selectedClubId: null, pinnedClubId: null })?.clubId,
      'club-a',
    );
  });

  it('uses an explicit pin when several clubs exist', () => {
    assert.equal(
      resolveHomePinnedClub({
        clubs: [aliceClub, bobClub],
        selectedClubId: 'club-a',
        pinnedClubId: 'club-b',
      })?.clubId,
      'club-b',
    );
  });

  it('falls back to the selected club when no pin exists', () => {
    assert.equal(
      resolveHomePinnedClub({
        clubs: [aliceClub, bobClub, caraClub],
        selectedClubId: 'club-c',
        pinnedClubId: null,
      })?.clubId,
      'club-c',
    );
  });

  it('does not change the locked Home pin when another club is selected', () => {
    assert.equal(
      nextLockedHomePinnedClubId({
        clubs: [aliceClub, bobClub],
        selectedClubId: 'club-b',
        lockedClubId: 'club-a',
      }),
      'club-a',
    );
  });

  it('ignores a stale pin and selected id', () => {
    assert.equal(
      resolveHomePinnedClub({
        clubs: [aliceClub, bobClub],
        selectedClubId: 'gone',
        pinnedClubId: 'also-gone',
      })?.clubId,
      'club-a',
    );
  });
});

describe('filterYourClubs', () => {
  it('keeps other clubs after the pinned card', () => {
    assert.deepEqual(
      filterYourClubs([aliceClub, bobClub, caraClub], 'club-b').map((club) => club.clubId),
      ['club-a', 'club-c'],
    );
  });
});

describe('presentHomePortfolio', () => {
  it('uses curated estimated totals and never demo values', () => {
    const presented = presentHomePortfolio(curatedSummary(), 2);
    assert.equal(presented.usesDemo, false);
    assert.equal(presented.status, 'available');
    assert.equal(presented.available, true);
    assert.equal(presented.valueMinor, 248000);
    assert.equal(presented.investedMinor, 200000);
    assert.equal(presented.caption, 'Estimated');
    assert.equal(presented.activeClubs, 2);
    assert.equal(presented.caption !== null, true);
  });

  it('keeps confidence as a caption next to the subtitle, not a primary figure', () => {
    const estimated = presentHomePortfolio(curatedSummary(), 1);
    const mixed = presentHomePortfolio({ ...curatedSummary(), valuationConfidence: 'mixed' }, 1);
    const exact = presentHomePortfolio({ ...curatedSummary(), valuationConfidence: 'exact' }, 1);
    assert.equal(estimated.caption, 'Estimated');
    assert.equal(mixed.caption, 'Partly estimated');
    assert.equal(exact.caption, 'Based on reported holdings');
    assert.notEqual(estimated.valueMinor, null);
    assert.match(estimated.caption ?? '', /estimated/i);
  });

  it('does not invent demo numbers for legacy or empty portfolios', () => {
    const presented = presentHomePortfolio(
      {
        clubId: 'legacy',
        modellingScope: 'legacy',
        investedMinor: 100,
        estimatedCurrentValueMinor: null,
        gainLossMinor: null,
        gainLossBps: null,
        valuationConfidence: 'unavailable',
      },
      1,
    );
    assert.equal(presented.usesDemo, false);
    assert.equal(presented.status, 'unavailable');
    assert.equal(presented.available, false);
    assert.equal(presented.valueMinor, null);
    assert.equal(presented.investedMinor, null);
    assert.equal(presented.gainLossMinor, null);
  });

  it('keeps known invested money separate when market value is unavailable', () => {
    const presented = presentHomePortfolio(
      {
        ...curatedSummary(),
        estimatedCurrentValueMinor: null,
        gainLossMinor: null,
        gainLossBps: null,
        valuationConfidence: 'unavailable',
      },
      1,
    );

    assert.equal(presented.status, 'unavailable');
    assert.equal(presented.valueMinor, null);
    assert.equal(presented.investedMinor, 200000);
    assert.equal(presented.gainLossMinor, null);
    assert.equal(presented.gainLossBps, null);
    assert.match(presented.detail, /Reported invested/i);
  });

  it('distinguishes a request failure from a known empty portfolio', () => {
    const failed = presentHomePortfolio(null, 2, {
      isLoading: false,
      error: 'Unable to load your portfolio right now.',
    });
    const empty = presentHomePortfolio(
      {
        ...curatedSummary(),
        investedMinor: 0,
        estimatedCurrentValueMinor: null,
        gainLossMinor: null,
        gainLossBps: null,
        valuationConfidence: 'unavailable',
      },
      1,
    );

    assert.equal(failed.status, 'error');
    assert.equal(failed.valueMinor, null);
    assert.equal(failed.investedMinor, null);
    assert.equal(empty.status, 'empty');
    assert.equal(empty.valueMinor, 0);
    assert.equal(empty.investedMinor, 0);
  });

  it('keeps loading distinct from empty and error', () => {
    const presented = presentHomePortfolio(null, 1, {
      isLoading: true,
      error: null,
    });

    assert.equal(presented.status, 'loading');
    assert.equal(presented.valueMinor, null);
    assert.equal(presented.investedMinor, null);
  });
});

describe('presentHomeClubFinance', () => {
  it('uses real estimated values for curated clubs', () => {
    const row = presentHomeClubFinance(curatedSummary());
    assert.equal(row.presentation, 'estimated');
    assert.equal(row.portfolioValueNok, 2480);
    assert.equal(row.returnPercentage, 24);
  });

  it('does not attach demo market values to legacy clubs', () => {
    const row = presentHomeClubFinance({
      clubId: 'legacy',
      modellingScope: 'legacy',
      investedMinor: 0,
      estimatedCurrentValueMinor: null,
      gainLossMinor: null,
      gainLossBps: null,
      valuationConfidence: 'unavailable',
    });
    assert.equal(row.presentation, 'unavailable');
    assert.equal(row.portfolioValueNok, null);
    assert.equal(row.returnPercentage, null);
  });

  it('does not present reported invested as current value', () => {
    const row = presentHomeClubFinance({
      ...curatedSummary(),
      estimatedCurrentValueMinor: null,
      gainLossMinor: null,
      gainLossBps: null,
      valuationConfidence: 'unavailable',
    });

    assert.equal(row.presentation, 'unavailable');
    assert.equal(row.portfolioValueNok, null);
    assert.equal(row.yourStakeMinor, null);
    assert.equal(row.investedMinor, 200000);
    assert.equal(row.returnPercentage, null);
  });
});

describe('portfolio range', () => {
  it('keeps 1M 3M 6M 1Y All under the chart, defaulting to 6M', () => {
    assert.deepEqual(HOME_PORTFOLIO_RANGE_OPTIONS, ['1M', '3M', '6M', '1Y', 'ALL']);
    assert.equal(HOME_PORTFOLIO_DEFAULT_RANGE, '6M');
    assert.equal(selectPortfolioRange('6M', '1Y'), '1Y');
  });
});

describe('home money display', () => {
  it('keeps ordinary NOK as a full kroner figure', () => {
    assert.equal(normalizeSpaces(formatHomeNokFromMinor(2480000)), '24 800 kr');
    assert.equal(normalizeSpaces(formatHomeNokFromMinor(2202000)), '22 020 kr');
  });

  it('compacts extreme NOK without showing øre', () => {
    assert.equal(normalizeSpaces(formatHomeNokFromMinor(586_829_618)), '5,87 mill. kr');
    assert.doesNotMatch(formatHomeNokFromMinor(586_829_618), /,18/);
    assert.equal(normalizeSpaces(formatHomeNokFromMinor(1_250_000_000_00)), '1,25 mrd. kr');
  });

  it('formats ordinary and extreme percentages without ellipsis', () => {
    assert.equal(formatHomeSignedPercentage(0), '0%');
    assert.equal(formatHomeSignedPercentage(-0), '0%');
    assert.equal(formatHomeSignedPercentage(8), '+8.0%');
    assert.equal(formatHomeSignedBps(2400), '+24.0%');
    assert.equal(normalizeSpaces(formatHomeSignedPercentage(146607.4)), '+146 607%');
    assert.doesNotMatch(formatHomeSignedPercentage(146607.4), /\.\.\./);
    assert.equal(normalizeSpaces(formatHomeGainLine(586_829_618, 14_660_740)), '+5,87 mill. kr (+146 607%)');
  });
});

describe('pinned club presentation copy', () => {
  it('uses horizontal stats and no strategy or Your club label', () => {
    assert.deepEqual(HOME_PINNED_STAT_LABELS, ['Group value', 'Your stake', 'All-time return']);
    assert.deepEqual(HOME_PORTFOLIO_STAT_LABELS, ['Total invested', 'Your return', 'Active clubs']);
    assert.ok(!HOME_PINNED_STAT_LABELS.includes('Your club' as (typeof HOME_PINNED_STAT_LABELS)[number]));
    assert.ok(HOME_PINNED_STAT_LABELS.every((label) => !/strategy|package|world/i.test(label)));
  });
});

describe('pinned club stack spacing', () => {
  it('compacts a single-member stack and gives room to a photo row', () => {
    assert.deepEqual(pinnedClubStackSpacing(1), { marginTop: 8, marginBottom: 8 });
    assert.deepEqual(pinnedClubStackSpacing(0), { marginTop: 8, marginBottom: 8 });
    assert.deepEqual(pinnedClubStackSpacing(3), { marginTop: 12, marginBottom: 10 });
    assert.ok(pinnedClubStackSpacing(3).marginTop > pinnedClubStackSpacing(1).marginTop);
  });
});

describe('home scroll clearance', () => {
  it('reserves nav height, safe area, and extra clearance', () => {
    assert.equal(homeScrollBottomPadding(72, 34), 72 + 34 + 64);
    assert.ok(homeScrollBottomPadding(72, 34) > 72 + 34);
  });
});

describe('chart scale', () => {
  it('maps extreme spikes inside the padded plot, without clipping', () => {
    const { domainMin, domainMax } = chartDomain(20_000, 5_800_000);
    const height = 112;
    const low = mapChartY(20_000, domainMin, domainMax, height);
    const high = mapChartY(5_800_000, domainMin, domainMax, height);
    assert.equal(isChartYInsidePlot(low, height), true);
    assert.equal(isChartYInsidePlot(high, height), true);
    assert.ok(high >= CHART_VERTICAL_PADDING);
    assert.ok(low <= height - CHART_VERTICAL_PADDING);
    assert.ok(high < low);
  });
});

describe('home greeting and tints', () => {
  it('uses the first name', () => {
    assert.equal(homeGreeting('Nicklas Øen'), 'Hei, Nicklas 👋');
    assert.equal(homeGreeting(null), 'Hei 👋');
  });

  it('picks a stable tint without stock art', () => {
    assert.equal(
      clubCardTintIndex('17fb06e9-42c7-47f5-98b2-c3e9746b3fb5', HOME_CLUB_CARD_TINT_COUNT),
      clubCardTintIndex('17fb06e9-42c7-47f5-98b2-c3e9746b3fb5', HOME_CLUB_CARD_TINT_COUNT),
    );
  });
});
