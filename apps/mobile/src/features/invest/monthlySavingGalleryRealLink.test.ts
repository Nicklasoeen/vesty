import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { galleryMonthlySavingSendsServerCall, galleryMonthlySavingUsesProductionCards } from './monthlySavingGalleryFixtures.ts';
import {
  galleryMonthlySavingOpensExternalUrl,
  galleryMonthlySavingSendsServerCall as galleryModeSendsServerCall,
  galleryRealMonthlySavingSetup,
  performGalleryMonthlySavingOpen,
  presentGalleryMonthlySavingReturn,
  presentGalleryReturnedMonthlyCard,
  presentMonthlySavingGalleryModeCopy,
} from './monthlySavingGalleryRealLink.ts';
import { VERIFIED_NORDNET_MONTHLY_SAVING_URL } from './nordnetHandoffUrl.ts';

describe('monthly saving gallery real-link mode', () => {
  it('keeps UI preview from opening an external URL', async () => {
    const opened: string[] = [];
    const copy = presentMonthlySavingGalleryModeCopy('ui_preview');
    const result = await performGalleryMonthlySavingOpen({
      mode: 'ui_preview',
      openUrl: async (url) => {
        opened.push(url);
      },
    });

    assert.equal(copy.heading, 'Development monthly saving test');
    assert.equal(copy.showRealTestNote, false);
    assert.equal(galleryMonthlySavingOpensExternalUrl('ui_preview'), false);
    assert.equal(galleryModeSendsServerCall('ui_preview'), false);
    assert.equal(galleryMonthlySavingSendsServerCall(), false);
    assert.deepEqual(opened, []);
    assert.equal(result.openedUrl, null);
    assert.equal(result.awaitingReturn, false);
    assert.equal(result.phase, 'idle');
  });

  it('opens the verified Nordnet monthly savings page after an explicit press', async () => {
    const opened: string[] = [];
    const copy = presentMonthlySavingGalleryModeCopy('real_nordnet_test');
    const result = await performGalleryMonthlySavingOpen({
      mode: 'real_nordnet_test',
      openUrl: async (url) => {
        opened.push(url);
      },
    });

    assert.equal(copy.showRealTestNote, true);
    assert.equal(copy.realTestNote.includes('No order is placed'), true);
    assert.equal(galleryMonthlySavingOpensExternalUrl('real_nordnet_test'), true);
    assert.equal(galleryModeSendsServerCall('real_nordnet_test'), false);
    assert.deepEqual(opened, [VERIFIED_NORDNET_MONTHLY_SAVING_URL]);
    assert.equal(result.openedUrl, VERIFIED_NORDNET_MONTHLY_SAVING_URL);
    assert.equal(result.openedUrl?.includes('2000'), false);
    assert.equal(result.awaitingReturn, true);
    assert.equal(galleryMonthlySavingUsesProductionCards(), true);
    assert.equal(galleryRealMonthlySavingSetup().monthlySetupUrl, VERIFIED_NORDNET_MONTHLY_SAVING_URL);
  });

  it('tracks return only after a real monthly open, without storing an attestation', () => {
    const ignored = presentGalleryMonthlySavingReturn({
      mode: 'ui_preview',
      phase: 'opened',
      awaitingReturn: true,
      appState: 'active',
    });
    assert.equal(ignored.phase, 'opened');
    assert.equal(ignored.awaitingReturn, false);

    const returned = presentGalleryMonthlySavingReturn({
      mode: 'real_nordnet_test',
      phase: 'opened',
      awaitingReturn: true,
      appState: 'active',
    });
    assert.equal(returned.phase, 'returned');
    const card = presentGalleryReturnedMonthlyCard('returned');
    assert.equal(card.primary?.action, 'confirm_setup');
    assert.equal(card.writeEffects.writesAttestation, false);
  });
});
