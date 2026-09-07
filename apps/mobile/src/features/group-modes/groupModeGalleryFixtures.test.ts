import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { presentCreateClubConflict } from '../clubs/createClubSubmission.ts';
import { presentCreateClubCatalogPanel } from '../clubs/presentCreateClub.ts';
import { presentGroupTypeOptions } from '../clubs/presentSingleFund.ts';
import {
  GROUP_MODE_GALLERY_SCENARIOS,
  galleryFixtureSendsServerCall,
  getGroupModeGalleryScenario,
} from './groupModeGalleryFixtures.ts';

describe('create-club development gallery fixtures', () => {
  it('covers the required visual state matrix', () => {
    const ids = new Set(GROUP_MODE_GALLERY_SCENARIOS.map((scenario) => scenario.id));
    for (const required of [
      'mode-empty',
      'mode-simple',
      'mode-locked',
      'catalog-loading',
      'catalog-error',
      'catalog-empty',
      'fund-deactivated',
      'fund-selected',
      'fund-detail',
      'contribution-equal',
      'contribution-flexible',
      'review',
      'submit-loading',
      'submit-timeout',
      'submit-idempotent',
      'submit-conflict',
      'submit-success',
      'long-name',
      'long-fund',
      'large-text',
      'small-iphone',
    ]) {
      assert.equal(ids.has(required), true, `missing gallery fixture: ${required}`);
    }
  });

  it('keeps gallery submit states local and non-operational', () => {
    for (const scenario of GROUP_MODE_GALLERY_SCENARIOS) {
      assert.equal(galleryFixtureSendsServerCall(scenario), false);
    }
    assert.equal(getGroupModeGalleryScenario('submit-loading').submitState, 'loading');
    assert.equal(getGroupModeGalleryScenario('submit-timeout').submitState, 'timeout');
    assert.equal(getGroupModeGalleryScenario('submit-conflict').submitState, 'conflict');
    assert.equal(getGroupModeGalleryScenario('submit-success').submitState, 'success');
  });

  it('provides narrow, long-name, and large-text stress fixtures', () => {
    assert.equal(getGroupModeGalleryScenario('small-iphone').compact, true);
    assert.equal(getGroupModeGalleryScenario('long-name').compact, true);
    assert.equal(getGroupModeGalleryScenario('large-text').largeText, true);
    assert.match(getGroupModeGalleryScenario('long-fund').products[0]?.displayName ?? '', /unusually long/);
  });

  it('keeps conflict recovery and catalog copy local to the fixture', () => {
    const conflict = presentCreateClubConflict();
    assert.equal(conflict.goToClubsLabel, 'Go to clubs');
    assert.equal(conflict.startNewSetupLabel, 'Start a new setup');
    assert.equal(presentCreateClubCatalogPanel('error').retry, true);
    assert.equal(presentGroupTypeOptions(null)[1]?.locked, true);
    assert.doesNotMatch(presentCreateClubCatalogPanel('loading').title, /checked/i);
  });
});
