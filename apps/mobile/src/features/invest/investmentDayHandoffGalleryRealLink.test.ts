import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { galleryHandoffSendsServerCall, galleryHandoffUsesProductionCard } from './investmentDayHandoffGalleryFixtures.ts';
import {
  galleryHandoffOpensExternalUrl,
  galleryHandoffSendsServerCall as galleryModeSendsServerCall,
  galleryRealNordnetListing,
  performGalleryHandoffOpen,
  presentGalleryHandoffReturn,
  presentGalleryReturnedCard,
  presentHandoffGalleryModeCopy,
} from './investmentDayHandoffGalleryRealLink.ts';
import { VERIFIED_NORDNET_PRODUCT_PAGE_URL } from './nordnetHandoffUrl.ts';

describe('Investment Day handoff gallery real-link mode', () => {
  it('keeps UI preview from opening an external URL', async () => {
    const opened: string[] = [];
    const copy = presentHandoffGalleryModeCopy('ui_preview');
    const result = await performGalleryHandoffOpen({
      mode: 'ui_preview',
      openUrl: async (url) => {
        opened.push(url);
      },
    });

    assert.equal(copy.heading, 'Development handoff test');
    assert.equal(copy.showRealTestNote, false);
    assert.equal(galleryHandoffOpensExternalUrl('ui_preview'), false);
    assert.equal(galleryModeSendsServerCall('ui_preview'), false);
    assert.equal(galleryHandoffSendsServerCall(), false);
    assert.deepEqual(opened, []);
    assert.equal(result.openedUrl, null);
    assert.equal(result.awaitingReturn, false);
    assert.equal(result.phase, 'idle');
  });

  it('opens the verified Nordnet HTTPS page exactly once in real-test mode', async () => {
    const opened: string[] = [];
    const copy = presentHandoffGalleryModeCopy('real_nordnet_test');
    const result = await performGalleryHandoffOpen({
      mode: 'real_nordnet_test',
      openUrl: async (url) => {
        opened.push(url);
      },
    });

    assert.equal(copy.realTestNote, 'Opens the verified Nordnet web product page. No order is placed.');
    assert.equal(copy.showRealTestNote, true);
    assert.equal(galleryHandoffOpensExternalUrl('real_nordnet_test'), true);
    assert.equal(galleryModeSendsServerCall('real_nordnet_test'), false);
    assert.deepEqual(opened, [VERIFIED_NORDNET_PRODUCT_PAGE_URL]);
    assert.equal(opened.length, 1);
    assert.equal(result.openedUrl, VERIFIED_NORDNET_PRODUCT_PAGE_URL);
    assert.equal(result.awaitingReturn, true);
    assert.equal(result.phase, 'opened');
    assert.equal(result.openedUrl?.startsWith('https://www.nordnet.no/'), true);
    assert.equal(result.openedUrl?.startsWith('nordnet://'), false);
    assert.equal(result.openedUrl?.includes('?'), false);
    assert.equal(result.openedUrl?.includes('amount'), false);
    assert.equal(result.openedUrl?.includes('200000'), false);
    assert.equal(galleryRealNordnetListing().productUrl, VERIFIED_NORDNET_PRODUCT_PAGE_URL);
    assert.equal(galleryHandoffUsesProductionCard(), true);
  });

  it('does not show Welcome back for a foreground event before a real open', () => {
    const next = presentGalleryHandoffReturn({
      mode: 'real_nordnet_test',
      phase: 'idle',
      awaitingReturn: false,
      appState: 'active',
    });
    assert.equal(next.phase, 'idle');
    assert.equal(next.awaitingReturn, false);
    assert.equal(presentGalleryReturnedCard('idle').welcomeBack, false);
  });

  it('enables return tracking only after a real open, then shows Welcome back', async () => {
    const result = await performGalleryHandoffOpen({
      mode: 'real_nordnet_test',
      openUrl: async () => undefined,
    });
    assert.equal(result.awaitingReturn, true);
    assert.equal(result.phase, 'opened');

    const background = presentGalleryHandoffReturn({
      mode: 'real_nordnet_test',
      phase: result.phase,
      awaitingReturn: result.awaitingReturn,
      appState: 'background',
    });
    assert.equal(background.phase, 'opened');
    assert.equal(background.awaitingReturn, true);

    const returned = presentGalleryHandoffReturn({
      mode: 'real_nordnet_test',
      phase: background.phase,
      awaitingReturn: background.awaitingReturn,
      appState: 'active',
    });
    assert.equal(returned.phase, 'returned');
    assert.equal(returned.awaitingReturn, false);
    assert.equal(presentGalleryReturnedCard(returned.phase).welcomeBack, true);
    assert.equal(presentGalleryReturnedCard(returned.phase).title, 'Welcome back');
  });

  it('ignores return tracking in UI preview even if awaitingReturn is set', () => {
    const next = presentGalleryHandoffReturn({
      mode: 'ui_preview',
      phase: 'opened',
      awaitingReturn: true,
      appState: 'active',
    });
    assert.equal(next.phase, 'opened');
    assert.equal(next.awaitingReturn, false);
  });
});
