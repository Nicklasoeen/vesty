import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  galleryFixtureSendsServerCall,
  galleryPlanTargets,
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
      'upcoming',
      'closed',
      'missing',
      'not-in-snapshot',
      'long-fund-name',
      'long-club-name',
      'large-text',
      'setup-next',
      'setup-required',
      'setup-save-success',
      'setup-save-error',
      'request-error',
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

  it('renders the long-fund fixture through production target rows', () => {
    const scenario = getInvestmentDayReportGalleryScenario('long-fund-name');
    const [firstTarget] = galleryPlanTargets(scenario);

    assert.equal(firstTarget?.label.includes('exceptionally long fund name'), true);
  });

  it('keeps local success, failure, and next-period save outcomes explicit', () => {
    assert.equal(
      getInvestmentDayReportGalleryScenario('setup-save-success').contributionSaveResult,
      'success',
    );
    assert.equal(
      getInvestmentDayReportGalleryScenario('setup-save-error').contributionSaveResult,
      'error',
    );
    assert.equal(
      getInvestmentDayReportGalleryScenario('setup-next').viewerState,
      'setup_next',
    );
  });
});
