import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  galleryFixtureSendsServerCall,
  getInvestmentDayReportGalleryScenario,
  INVESTMENT_DAY_REPORT_GALLERY_SCENARIOS,
} from './investmentDayReportGalleryFixtures.ts';

describe('Investment Day reporting gallery fixtures', () => {
  it('covers the required visual state matrix', () => {
    const ids = new Set(INVESTMENT_DAY_REPORT_GALLERY_SCENARIOS.map((scenario) => scenario.id));
    for (const required of [
      'as-planned',
      'partial',
      'different-total',
      'skipped',
      'pending',
      'loading',
      'timeout',
      'idempotent',
      'conflict',
      'legacy',
    ]) {
      assert.equal(ids.has(required), true, `missing gallery fixture: ${required}`);
    }
  });

  it('never sends a server call from a gallery fixture', () => {
    for (const scenario of INVESTMENT_DAY_REPORT_GALLERY_SCENARIOS) {
      assert.equal(galleryFixtureSendsServerCall(scenario), false);
      assert.equal(getInvestmentDayReportGalleryScenario(scenario.id).id, scenario.id);
    }
  });
});
