import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatNokFromMinor } from '../../lib/currency.ts';

import {
  galleryMonthlySavingSendsServerCall,
  galleryMonthlySavingUsesProductionCards,
  getMonthlySavingGalleryScenario,
  MONTHLY_SAVING_GALLERY_SCENARIOS,
} from './monthlySavingGalleryFixtures.ts';
import { galleryMonthlySavingOpensExternalUrl } from './monthlySavingGalleryRealLink.ts';
import { presentMonthlySavingCardModel, presentOneTimePurchaseCardModel } from './presentMonthlySavingSetup.ts';

describe('monthly saving gallery fixtures', () => {
  it('covers the required visual state matrix', () => {
    const ids = new Set(MONTHLY_SAVING_GALLERY_SCENARIOS.map((scenario) => scenario.id));
    for (const required of [
      'not-set-up',
      'returned',
      'current',
      'needs-update-amount',
      'needs-update-schedule',
      'setup-required',
      'unavailable',
      'loading',
      'error',
      'ended',
      'one-time',
      'long-fund-name',
      'large-text',
    ]) {
      assert.equal(ids.has(required), true, `missing gallery fixture: ${required}`);
    }
  });

  it('never sends a server call from a gallery fixture, and UI preview never opens a URL', () => {
    assert.equal(galleryMonthlySavingOpensExternalUrl('ui_preview'), false);
    for (const scenario of MONTHLY_SAVING_GALLERY_SCENARIOS) {
      assert.equal(galleryMonthlySavingSendsServerCall(scenario), false);
      assert.equal(galleryMonthlySavingUsesProductionCards(), true);
      assert.equal(getMonthlySavingGalleryScenario(scenario.id).id, scenario.id);
    }
  });

  it('renders fixtures through the production presentation', () => {
    const notSetUp = presentMonthlySavingCardModel({
      setup: getMonthlySavingGalleryScenario('not-set-up').setup,
      phase: getMonthlySavingGalleryScenario('not-set-up').phase,
    });
    assert.equal(notSetUp.title, 'Monthly saving');
    assert.equal(notSetUp.badge, 'Recommended');

    const returned = presentMonthlySavingCardModel({
      setup: getMonthlySavingGalleryScenario('returned').setup,
      phase: getMonthlySavingGalleryScenario('returned').phase,
    });
    assert.equal(returned.title, 'Did you finish setting it up?');

    const current = presentMonthlySavingCardModel({
      setup: getMonthlySavingGalleryScenario('current').setup,
      phase: getMonthlySavingGalleryScenario('current').phase,
    });
    assert.equal(current.title, 'Monthly saving set up');

    const amountScenario = getMonthlySavingGalleryScenario('needs-update-amount');
    const amount = presentMonthlySavingCardModel({
      setup: amountScenario.setup,
      phase: amountScenario.phase,
    });
    assert.equal(amount.title, 'Your Vesty plan has changed');
    assert.equal(amount.body.includes(formatNokFromMinor(350000)), true);

    const scheduleScenario = getMonthlySavingGalleryScenario('needs-update-schedule');
    const schedule = presentMonthlySavingCardModel({
      setup: scheduleScenario.setup,
      phase: scheduleScenario.phase,
    });
    assert.equal(schedule.body.includes('12th of each month'), true);

    const requiredScenario = getMonthlySavingGalleryScenario('setup-required');
    const required = presentMonthlySavingCardModel({
      setup: requiredScenario.setup,
      phase: requiredScenario.phase,
    });
    assert.equal(required.status, 'setup_required');

    const unavailableScenario = getMonthlySavingGalleryScenario('unavailable');
    const unavailable = presentMonthlySavingCardModel({
      setup: unavailableScenario.setup,
      phase: unavailableScenario.phase,
    });
    assert.equal(unavailable.status, 'unavailable');

    const loading = presentMonthlySavingCardModel({
      setup: getMonthlySavingGalleryScenario('loading').setup,
      phase: getMonthlySavingGalleryScenario('loading').phase,
    });
    assert.equal(loading.loading, true);

    const error = presentMonthlySavingCardModel({
      setup: getMonthlySavingGalleryScenario('error').setup,
      phase: getMonthlySavingGalleryScenario('error').phase,
    });
    assert.equal(error.error, true);
    assert.equal(error.primary?.action, 'retry');

    const ended = presentMonthlySavingCardModel({
      setup: getMonthlySavingGalleryScenario('ended').setup,
      phase: getMonthlySavingGalleryScenario('ended').phase,
    });
    assert.equal(ended.status, 'not_set_up');

    const oneTime = presentOneTimePurchaseCardModel(
      getMonthlySavingGalleryScenario('one-time').setup,
    );
    assert.equal(oneTime.title, 'One-time purchase');
    assert.equal(oneTime.primary?.action, 'open_one_time');

    const longName = getMonthlySavingGalleryScenario('long-fund-name');
    assert.equal(longName.setup.fundName?.includes('exceptionally long fund name'), true);

    const largeText = getMonthlySavingGalleryScenario('large-text');
    assert.equal(largeText.largeText, true);
  });
});
