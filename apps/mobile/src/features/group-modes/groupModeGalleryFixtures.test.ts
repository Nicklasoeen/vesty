import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  GROUP_MODE_GALLERY_SCENARIOS,
  getGroupModeGalleryScenario,
} from './groupModeGalleryFixtures.ts';
import { prototypeSubmitHasServerOperation } from './groupModePrototype.ts';

describe('group-mode development gallery fixtures', () => {
  it('covers the required visual state matrix', () => {
    const ids = new Set(GROUP_MODE_GALLERY_SCENARIOS.map((scenario) => scenario.id));
    for (const required of [
      'name',
      'mode-empty',
      'mode-simple',
      'mode-custom',
      'simple-normal',
      'simple-detail',
      'simple-broker-unknown',
      'simple-unavailable',
      'catalog-loading',
      'catalog-empty',
      'catalog-error',
      'custom-empty',
      'custom-valid',
      'custom-under',
      'custom-over',
      'contribution',
      'governance',
      'submit-loading',
      'submit-error',
      'submit-success',
      'long-name',
      'large-text',
    ]) {
      assert.equal(ids.has(required), true, `missing gallery fixture: ${required}`);
    }
  });

  it('keeps gallery submit states local and non-operational', () => {
    assert.equal(prototypeSubmitHasServerOperation(), false);
    assert.equal(getGroupModeGalleryScenario('submit-loading').submitState, 'loading');
    assert.equal(getGroupModeGalleryScenario('submit-error').submitState, 'error');
    assert.equal(getGroupModeGalleryScenario('submit-success').submitState, 'success');
  });

  it('provides narrow and large-text stress fixtures', () => {
    assert.equal(getGroupModeGalleryScenario('long-name').compact, true);
    assert.equal(getGroupModeGalleryScenario('large-text').largeText, true);
  });
});
