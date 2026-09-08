import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  galleryHandoffSendsServerCall,
  galleryHandoffUsesProductionCard,
  getInvestmentDayHandoffGalleryScenario,
  INVESTMENT_DAY_HANDOFF_GALLERY_SCENARIOS,
} from './investmentDayHandoffGalleryFixtures.ts';
import { galleryHandoffOpensExternalUrl } from './investmentDayHandoffGalleryRealLink.ts';
import { presentHandoffCardModel } from './presentInvestmentDayBrokerHandoff.ts';

describe('Investment Day handoff gallery fixtures', () => {
  it('covers the required visual state matrix', () => {
    const ids = new Set(INVESTMENT_DAY_HANDOFF_GALLERY_SCENARIOS.map((scenario) => scenario.id));
    for (const required of [
      'ready',
      'opening',
      'returned',
      'link-error',
      'listing-unavailable',
      'other-broker',
      'long-fund-name',
      'large-text',
    ]) {
      assert.equal(ids.has(required), true, `missing gallery fixture: ${required}`);
    }
  });

  it('never sends a server call from a gallery fixture, and UI preview never opens a URL', () => {
    assert.equal(galleryHandoffOpensExternalUrl('ui_preview'), false);
    for (const scenario of INVESTMENT_DAY_HANDOFF_GALLERY_SCENARIOS) {
      assert.equal(galleryHandoffSendsServerCall(scenario), false);
      assert.equal(galleryHandoffUsesProductionCard(), true);
      assert.equal(getInvestmentDayHandoffGalleryScenario(scenario.id).id, scenario.id);
    }
  });

  it('renders fixtures through the production handoff presentation', () => {
    const ready = presentHandoffCardModel(getInvestmentDayHandoffGalleryScenario('ready'));
    assert.equal(ready.primary?.label, 'Open in Nordnet');

    const opening = presentHandoffCardModel(getInvestmentDayHandoffGalleryScenario('opening'));
    assert.equal(opening.loading, true);

    const returned = presentHandoffCardModel(getInvestmentDayHandoffGalleryScenario('returned'));
    assert.equal(returned.welcomeBack, true);

    const error = presentHandoffCardModel(getInvestmentDayHandoffGalleryScenario('link-error'));
    assert.equal(error.error, true);

    const unavailable = presentHandoffCardModel(
      getInvestmentDayHandoffGalleryScenario('listing-unavailable'),
    );
    assert.equal(unavailable.listingUnavailable, true);

    const other = presentHandoffCardModel(getInvestmentDayHandoffGalleryScenario('other-broker'));
    assert.equal(other.availability, 'other');
    assert.notEqual(other.primary?.action, 'open');

    const longName = getInvestmentDayHandoffGalleryScenario('long-fund-name');
    assert.equal(longName.fundName?.includes('exceptionally long fund name'), true);

    const largeText = getInvestmentDayHandoffGalleryScenario('large-text');
    assert.equal(largeText.largeText, true);
  });
});
