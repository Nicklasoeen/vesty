import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canReportWithoutOpeningHandoff,
  openInvestmentDayNordnetHandoff,
  parseBrokerHandoffListing,
  presentAppStateHandoffReturn,
  presentBrokerHandoffAvailability,
  presentHandoffCardModel,
  presentHandoffRetryPhase,
  presentHandoffWriteEffects,
  presentValidatedHandoffUrl,
  type BrokerHandoffListing,
} from './presentInvestmentDayBrokerHandoff.ts';

const OFFICIAL = 'https://www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894';
const PLANNED_LABEL = '2 000 kr';

function readyListing(overrides: Partial<BrokerHandoffListing> = {}): BrokerHandoffListing {
  return {
    status: 'ready',
    broker: 'nordnet',
    fundName: 'DNB Global Indeks A',
    isin: 'NO0010582984',
    productUrl: OFFICIAL,
    checkedOn: '2026-09-07',
    rejectedUrl: false,
    ...overrides,
  };
}

describe('presentBrokerHandoffAvailability', () => {
  it('only treats Nordnet as a direct handoff', () => {
    assert.equal(presentBrokerHandoffAvailability('nordnet'), 'nordnet');
    assert.equal(presentBrokerHandoffAvailability('dnb'), 'other');
    assert.equal(presentBrokerHandoffAvailability('kron'), 'other');
    assert.equal(presentBrokerHandoffAvailability('sparebank1'), 'other');
    assert.equal(presentBrokerHandoffAvailability('other'), 'other');
    assert.equal(presentBrokerHandoffAvailability(null), 'missing');
  });
});

describe('parseBrokerHandoffListing', () => {
  it('keeps the verified Nordnet HTTPS page', () => {
    const listing = parseBrokerHandoffListing({
      status: 'ready',
      broker: 'nordnet',
      fund_name: 'DNB Global Indeks A',
      isin: 'NO0010582984',
      product_url: OFFICIAL,
      checked_on: '2026-09-07',
    });
    assert.equal(listing.status, 'ready');
    assert.equal(listing.productUrl, OFFICIAL);
    assert.equal(listing.rejectedUrl, false);
  });

  it('rejects unexpected URLs instead of passing them through', () => {
    for (const product_url of [
      'http://www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894',
      'nordnet://fond/liste/dnb-global-indeks-a-nok-7b4b0894',
      'https://www.nordnet.no.example.com/fond/liste/dnb-global-indeks-a',
      'https://evil.example@www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894',
      'https://www.dnb.no/sparing/fond/fond-liste/d/dnb-global-indeks-a-NO0010582984',
    ]) {
      const listing = parseBrokerHandoffListing({
        status: 'ready',
        broker: 'nordnet',
        fund_name: 'DNB Global Indeks A',
        isin: 'NO0010582984',
        product_url,
        checked_on: '2026-09-07',
      });
      assert.equal(listing.productUrl, null);
      assert.equal(listing.rejectedUrl, true);
      assert.equal(presentValidatedHandoffUrl(product_url), null);
    }
  });
});

describe('openInvestmentDayNordnetHandoff', () => {
  it('opens the verified URL and writes nothing', async () => {
    const opened: string[] = [];
    const result = await openInvestmentDayNordnetHandoff({
      fetchListing: async () => readyListing(),
      openUrl: async (url) => {
        opened.push(url);
      },
    });

    assert.deepEqual(opened, [OFFICIAL]);
    assert.equal(result.phase, 'opened');
    assert.equal(result.openedUrl, OFFICIAL);
    assert.equal(result.awaitingReturn, true);
    assert.equal(result.openedUrl?.includes('2000'), false);
    assert.equal(result.openedUrl?.includes('200000'), false);
    assert.deepEqual(result.writeEffects, presentHandoffWriteEffects());
    assert.equal(result.writeEffects.writesReport, false);
    assert.equal(result.writeEffects.writesPurchase, false);
    assert.equal(result.writeEffects.confirmsBuy, false);
  });

  it('does not open an invalid URL and stays retryable', async () => {
    const opened: string[] = [];
    const result = await openInvestmentDayNordnetHandoff({
      fetchListing: async () => parseBrokerHandoffListing({
        status: 'ready',
        product_url: 'nordnet://fond/liste/dnb-global-indeks-a-nok-7b4b0894',
        fund_name: 'DNB Global Indeks A',
        isin: 'NO0010582984',
      }),
      openUrl: async (url) => {
        opened.push(url);
      },
    });

    assert.deepEqual(opened, []);
    assert.equal(result.phase, 'error');
    assert.equal(result.awaitingReturn, false);
    assert.equal(presentHandoffRetryPhase(result.phase), 'idle');
    assert.equal(result.writeEffects.writesReport, false);
  });

  it('maps a missing listing to unavailable without opening a URL', async () => {
    const opened: string[] = [];
    const result = await openInvestmentDayNordnetHandoff({
      fetchListing: async () => parseBrokerHandoffListing({
        status: 'unavailable',
        fund_name: 'DNB Global Indeks A',
        isin: 'NO0010582984',
        product_url: null,
      }),
      openUrl: async (url) => {
        opened.push(url);
      },
    });

    assert.deepEqual(opened, []);
    assert.equal(result.phase, 'unavailable');
    assert.equal(result.awaitingReturn, false);
  });

  it('maps a failed open to a retryable error without writing a report', async () => {
    const result = await openInvestmentDayNordnetHandoff({
      fetchListing: async () => readyListing(),
      openUrl: async () => {
        throw new Error('Unable to open URL');
      },
    });

    assert.equal(result.phase, 'error');
    assert.equal(result.openedUrl, null);
    assert.equal(result.awaitingReturn, false);
    assert.equal(result.writeEffects.writesReport, false);
    assert.equal(presentHandoffRetryPhase('error'), 'idle');
  });
});

describe('presentAppStateHandoffReturn', () => {
  it('shows Welcome back only after a successful open', () => {
    assert.deepEqual(
      presentAppStateHandoffReturn({ phase: 'opened', awaitingReturn: true, appState: 'active' }),
      { phase: 'returned', awaitingReturn: false },
    );
  });

  it('ignores a random foreground after background', () => {
    assert.deepEqual(
      presentAppStateHandoffReturn({ phase: 'idle', awaitingReturn: false, appState: 'active' }),
      { phase: 'idle', awaitingReturn: false },
    );
    assert.deepEqual(
      presentAppStateHandoffReturn({ phase: 'loading', awaitingReturn: false, appState: 'active' }),
      { phase: 'loading', awaitingReturn: false },
    );
    assert.deepEqual(
      presentAppStateHandoffReturn({ phase: 'opened', awaitingReturn: true, appState: 'background' }),
      { phase: 'opened', awaitingReturn: true },
    );
  });

  it('does not create a purchase or confirmation when the app becomes active', () => {
    const next = presentAppStateHandoffReturn({
      phase: 'opened',
      awaitingReturn: true,
      appState: 'active',
    });
    assert.equal(next.phase, 'returned');
    assert.equal(presentHandoffWriteEffects().marksCompletedOnReturn, false);
    assert.equal(presentHandoffWriteEffects().confirmsBuy, false);
    assert.equal(presentHandoffWriteEffects().writesPurchase, false);
  });
});

describe('presentHandoffCardModel', () => {
  it('lets the member report without opening Nordnet', () => {
    const ready = presentHandoffCardModel({
      availability: 'nordnet',
      phase: 'idle',
      fundName: 'DNB Global Indeks A',
      isin: 'NO0010582984',
      plannedAmountLabel: PLANNED_LABEL,
    });
    assert.equal(canReportWithoutOpeningHandoff(), true);
    assert.equal(ready.canReportWithoutOpening, true);
    assert.equal(ready.primary?.action, 'open');
    assert.equal(ready.primary?.label, 'Open in Nordnet');
    assert.equal(ready.secondary?.action, 'report');
    assert.equal(ready.secondary?.label, 'Report this Investment Day');
    assert.equal(ready.fundName, 'DNB Global Indeks A');
    assert.equal(ready.isin, 'NO0010582984');
    assert.equal(ready.plannedAmountLabel, PLANNED_LABEL);
    assert.match(ready.body, /own Nordnet account/);
    assert.match(ready.body, /does not send money/);
    assert.match(ready.body, /Enter the amount at Nordnet/);
  });

  it('shows Welcome back after return, without claiming the buy is done', () => {
    const model = presentHandoffCardModel({
      availability: 'nordnet',
      phase: 'returned',
      fundName: 'DNB Global Indeks A',
      isin: 'NO0010582984',
      plannedAmountLabel: PLANNED_LABEL,
    });
    assert.equal(model.welcomeBack, true);
    assert.equal(model.title, 'Welcome back');
    assert.equal(model.primary?.action, 'report');
    assert.equal(model.primary?.label, 'Report what happened');
    assert.equal(model.secondary?.action, 'open_again');
    assert.equal(model.secondary?.label, 'Open Nordnet again');
    assert.match(model.body, /does not mark this Investment Day as done/);
    assert.equal(model.writeEffects.marksCompletedOnReturn, false);
  });

  it('keeps a link error on screen with Try again and manual fund help', () => {
    const model = presentHandoffCardModel({
      availability: 'nordnet',
      phase: 'error',
      fundName: 'DNB Global Indeks A',
      isin: 'NO0010582984',
      plannedAmountLabel: PLANNED_LABEL,
    });
    assert.equal(model.error, true);
    assert.equal(model.title, 'Unable to open Nordnet');
    assert.equal(model.primary?.action, 'retry');
    assert.equal(model.primary?.label, 'Try again');
    assert.equal(model.manualHelp, 'DNB Global Indeks A · NO0010582984');
    assert.equal(model.secondary?.action, 'report');
  });

  it('explains an unavailable listing without a fake open button', () => {
    const model = presentHandoffCardModel({
      availability: 'nordnet',
      phase: 'unavailable',
      fundName: 'DNB Global Indeks A',
      isin: 'NO0010582984',
      plannedAmountLabel: PLANNED_LABEL,
    });
    assert.equal(model.listingUnavailable, true);
    assert.equal(model.primary?.action, 'report');
    assert.notEqual(model.primary?.action, 'open');
    assert.equal(model.manualHelp, 'DNB Global Indeks A · NO0010582984');
  });

  it('does not pretend to open another preferred broker', () => {
    const model = presentHandoffCardModel({
      availability: 'other',
      phase: 'idle',
      fundName: 'DNB Global Indeks A',
      isin: 'NO0010582984',
      plannedAmountLabel: PLANNED_LABEL,
    });
    assert.equal(model.primary?.action, 'choose_broker');
    assert.equal(model.secondary?.action, 'report');
    assert.notEqual(model.primary?.label.includes('DNB'), true);
    assert.notEqual(model.primary?.label.includes('Kron'), true);
    assert.match(model.body, /Nordnet/);
    assert.equal(model.canReportWithoutOpening, true);
  });
});
