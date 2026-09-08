import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatNokFromMinor } from '../../lib/currency.ts';

import {
  galleryMonthlySavingSendsServerCall,
  galleryMonthlySavingUsesProductionCards,
  galleryMonthlySavingUsesProductionJourney,
  getMonthlySavingGalleryScenario,
  MONTHLY_SAVING_GALLERY_SCENARIOS,
  presentGalleryInvestJourneySurface,
} from './monthlySavingGalleryFixtures.ts';
import { galleryMonthlySavingOpensExternalUrl } from './monthlySavingGalleryRealLink.ts';
import { presentMonthlySavingCardModel, presentOneTimePurchaseCardModel } from './presentMonthlySavingSetup.ts';

describe('monthly saving gallery fixtures', () => {
  it('covers the required visual state matrix', () => {
    const ids = new Set(MONTHLY_SAVING_GALLERY_SCENARIOS.map((scenario) => scenario.id));
    for (const required of [
      'intro',
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
      'one-time-outside-window',
      'one-time-inside-window',
      'investment-day-open',
      'investment-day-upcoming',
      'reporting-closed',
      'attestation-timeout',
      'attestation-error',
      'attestation-conflict',
      'attestation-saved',
      'opening',
      'long-fund-name',
      'large-text',
      'investment-day-report',
    ]) {
      assert.equal(ids.has(required), true, `missing gallery fixture: ${required}`);
    }
  });

  it('never sends a server call from a gallery fixture, and UI preview never opens a URL', () => {
    assert.equal(galleryMonthlySavingOpensExternalUrl('ui_preview'), false);
    for (const scenario of MONTHLY_SAVING_GALLERY_SCENARIOS) {
      assert.equal(galleryMonthlySavingSendsServerCall(scenario), false);
      assert.equal(galleryMonthlySavingUsesProductionCards(), true);
      assert.equal(galleryMonthlySavingUsesProductionJourney(), true);
      assert.equal(getMonthlySavingGalleryScenario(scenario.id).id, scenario.id);
    }
  });

  it('renders fixtures through the production journey and presentation', () => {
    assert.equal(presentGalleryInvestJourneySurface(getMonthlySavingGalleryScenario('intro')), 'intro');
    assert.equal(presentGalleryInvestJourneySurface(getMonthlySavingGalleryScenario('not-set-up')), 'choose');
    assert.equal(presentGalleryInvestJourneySurface(getMonthlySavingGalleryScenario('returned')), 'returned');
    assert.equal(presentGalleryInvestJourneySurface(getMonthlySavingGalleryScenario('current')), 'investment_day_upcoming');
    assert.equal(presentGalleryInvestJourneySurface(getMonthlySavingGalleryScenario('needs-update-amount')), 'needs_update');
    assert.equal(presentGalleryInvestJourneySurface(getMonthlySavingGalleryScenario('setup-required')), 'setup_required');
    assert.equal(presentGalleryInvestJourneySurface(getMonthlySavingGalleryScenario('unavailable')), 'unavailable');
    assert.equal(presentGalleryInvestJourneySurface(getMonthlySavingGalleryScenario('loading')), 'loading');
    assert.equal(presentGalleryInvestJourneySurface(getMonthlySavingGalleryScenario('error')), 'request_error');
    assert.equal(presentGalleryInvestJourneySurface(getMonthlySavingGalleryScenario('opening')), 'opening_nordnet');
    assert.equal(presentGalleryInvestJourneySurface(getMonthlySavingGalleryScenario('one-time')), 'one_time');
    assert.equal(
      presentGalleryInvestJourneySurface(getMonthlySavingGalleryScenario('one-time-outside-window')),
      'one_time_returned_outside_window',
    );
    assert.equal(
      presentGalleryInvestJourneySurface(getMonthlySavingGalleryScenario('one-time-inside-window')),
      'one_time_returned_reportable',
    );
    assert.equal(
      presentGalleryInvestJourneySurface(getMonthlySavingGalleryScenario('investment-day-open')),
      'investment_day_open',
    );
    assert.equal(
      presentGalleryInvestJourneySurface(getMonthlySavingGalleryScenario('reporting-closed')),
      'investment_day_closed',
    );
    assert.equal(
      presentGalleryInvestJourneySurface(getMonthlySavingGalleryScenario('attestation-timeout')),
      'attestation_timeout',
    );
    assert.equal(
      presentGalleryInvestJourneySurface(getMonthlySavingGalleryScenario('attestation-error')),
      'attestation_error',
    );
    assert.equal(
      presentGalleryInvestJourneySurface(getMonthlySavingGalleryScenario('attestation-conflict')),
      'attestation_conflict',
    );
    assert.equal(
      presentGalleryInvestJourneySurface(getMonthlySavingGalleryScenario('attestation-saved')),
      'attestation_saved',
    );
    assert.equal(
      presentGalleryInvestJourneySurface(getMonthlySavingGalleryScenario('investment-day-report')),
      'investment_day_report',
    );

    const notSetUp = presentMonthlySavingCardModel({
      setup: getMonthlySavingGalleryScenario('not-set-up').setup!,
      phase: getMonthlySavingGalleryScenario('not-set-up').phase,
    });
    assert.equal(notSetUp.title, 'Monthly saving');
    assert.equal(notSetUp.badge, 'Recommended');

    const returned = presentMonthlySavingCardModel({
      setup: getMonthlySavingGalleryScenario('returned').setup!,
      phase: getMonthlySavingGalleryScenario('returned').phase,
    });
    assert.equal(returned.title, 'Did you finish setting it up?');

    const current = presentMonthlySavingCardModel({
      setup: getMonthlySavingGalleryScenario('current').setup!,
      phase: getMonthlySavingGalleryScenario('current').phase,
    });
    assert.equal(current.title, 'Monthly saving set up');

    const amountScenario = getMonthlySavingGalleryScenario('needs-update-amount');
    const amount = presentMonthlySavingCardModel({
      setup: amountScenario.setup!,
      phase: amountScenario.phase,
    });
    assert.equal(amount.title, 'Your Vesty plan has changed');
    assert.equal(amount.body.includes(formatNokFromMinor(350000)), true);

    const scheduleScenario = getMonthlySavingGalleryScenario('needs-update-schedule');
    const schedule = presentMonthlySavingCardModel({
      setup: scheduleScenario.setup!,
      phase: scheduleScenario.phase,
    });
    assert.equal(schedule.body.includes('12th of each month'), true);

    const oneTime = presentOneTimePurchaseCardModel(
      getMonthlySavingGalleryScenario('one-time').setup!,
    );
    assert.equal(oneTime.title, 'One-time purchase');
    assert.equal(oneTime.primary?.action, 'open_one_time');

    const longName = getMonthlySavingGalleryScenario('long-fund-name');
    assert.equal(longName.setup?.fundName?.includes('exceptionally long fund name'), true);

    const largeText = getMonthlySavingGalleryScenario('large-text');
    assert.equal(largeText.largeText, true);
  });
});
