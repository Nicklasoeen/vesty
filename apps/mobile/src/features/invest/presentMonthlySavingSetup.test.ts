import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatNokFromMinor } from '../../lib/currency.ts';

import {
  VERIFIED_NORDNET_MONTHLY_SAVING_URL,
  VERIFIED_NORDNET_PRODUCT_PAGE_URL,
} from './nordnetHandoffUrl.ts';
import {
  canConfirmMonthlySavingSetup,
  monthlySavingIsRecommended,
  oneTimePurchaseIsAlwaysOffered,
  openMonthlySavingSetupUrl,
  openOneTimePurchaseUrl,
  parseMonthlySavingSetup,
  presentAppStateMonthlySavingReturn,
  presentCopyAmountValue,
  presentMonthlySavingCardModel,
  presentMonthlySavingWorkbench,
  presentMonthlySavingWriteEffects,
  presentOneTimePurchaseCardModel,
  presentValidatedMonthlySavingUrl,
  type MonthlySavingSetup,
} from './presentMonthlySavingSetup.ts';

function readySetup(overrides: Partial<MonthlySavingSetup> = {}): MonthlySavingSetup {
  return {
    status: 'not_set_up',
    provenance: 'member_attested',
    broker: 'nordnet',
    fundName: 'DNB Global Indeks A',
    isin: 'NO0010582984',
    recommendedAmountMinor: 200000,
    currency: 'NOK',
    recommendedInvestmentDayAt: '2026-10-05T10:00:00.000Z',
    scheduleDayOfMonth: 5,
    monthlySetupUrl: VERIFIED_NORDNET_MONTHLY_SAVING_URL,
    oneTimeProductUrl: VERIFIED_NORDNET_PRODUCT_PAGE_URL,
    attestedAt: null,
    attestedAmountMinor: null,
    attestedFundName: null,
    attestedScheduleDayOfMonth: null,
    amountChanged: false,
    fundChanged: false,
    scheduleChanged: false,
    oneTimeAvailable: true,
    rejectedMonthlyUrl: false,
    rejectedOneTimeUrl: false,
    ...overrides,
  };
}

describe('monthly saving recommendation', () => {
  it('treats monthly saving as recommended and keeps one-time purchase available', () => {
    assert.equal(monthlySavingIsRecommended(), true);
    assert.equal(oneTimePurchaseIsAlwaysOffered(), true);
    const workbench = presentMonthlySavingWorkbench({
      setup: readySetup(),
      phase: 'idle',
      view: 'monthly',
    });
    assert.equal(workbench.monthlySavingRecommended, true);
    assert.equal(workbench.oneTimeAlwaysAvailable, true);
    assert.equal(workbench.monthly.badge, 'Recommended');
    assert.equal(workbench.monthly.primary?.label, 'Set up monthly saving');
    assert.equal(workbench.monthly.secondary?.label, 'Buy once instead');
    assert.equal(workbench.oneTime.primary?.label, 'Open in Nordnet');
  });
});

describe('parseMonthlySavingSetup', () => {
  it('keeps verified Nordnet URLs and rejects invalid ones', () => {
    const setup = parseMonthlySavingSetup({
      status: 'not_set_up',
      provenance: 'member_attested',
      broker: 'nordnet',
      fund_name: 'DNB Global Indeks A',
      isin: 'NO0010582984',
      recommended_amount_minor: 200000,
      currency: 'NOK',
      recommended_investment_day_at: '2026-10-05T10:00:00.000Z',
      schedule_day_of_month: 5,
      monthly_setup_url: VERIFIED_NORDNET_MONTHLY_SAVING_URL,
      one_time_product_url: VERIFIED_NORDNET_PRODUCT_PAGE_URL,
      one_time_available: true,
    });
    assert.equal(setup.monthlySetupUrl, VERIFIED_NORDNET_MONTHLY_SAVING_URL);
    assert.equal(setup.oneTimeProductUrl, VERIFIED_NORDNET_PRODUCT_PAGE_URL);
    assert.equal(setup.provenance, 'member_attested');
    assert.equal(setup.rejectedMonthlyUrl, false);
  });

  it('rejects lookalike monthly URLs, app schemes, and amount query params', () => {
    for (const monthly_setup_url of [
      'http://www.nordnet.no/monthlysavings/create',
      'nordnet://monthlysavings/create',
      `${VERIFIED_NORDNET_MONTHLY_SAVING_URL}?amount=2000`,
      'https://www.nordnet.no.example.com/monthlysavings/create',
      'https://www.dnb.no/sparing/fond',
    ]) {
      const setup = parseMonthlySavingSetup({
        status: 'not_set_up',
        monthly_setup_url,
        one_time_product_url: VERIFIED_NORDNET_PRODUCT_PAGE_URL,
        recommended_amount_minor: 200000,
      });
      assert.equal(setup.monthlySetupUrl, null);
      assert.equal(setup.rejectedMonthlyUrl, true);
      assert.equal(presentValidatedMonthlySavingUrl(monthly_setup_url), null);
    }
  });
});

describe('openMonthlySavingSetupUrl', () => {
  it('opens the verified monthly URL without writing or adding an amount', async () => {
    const opened: string[] = [];
    const result = await openMonthlySavingSetupUrl({
      setup: readySetup(),
      openUrl: async (url) => {
        opened.push(url);
      },
    });
    assert.deepEqual(opened, [VERIFIED_NORDNET_MONTHLY_SAVING_URL]);
    assert.equal(result.phase, 'opened');
    assert.equal(result.awaitingReturn, true);
    assert.equal(result.openedUrl?.includes('2000'), false);
    assert.equal(result.openedUrl?.includes('200000'), false);
    assert.deepEqual(result.writeEffects, presentMonthlySavingWriteEffects(false));
  });

  it('does not open an invalid monthly URL', async () => {
    const opened: string[] = [];
    const result = await openMonthlySavingSetupUrl({
      setup: readySetup({
        monthlySetupUrl: 'nordnet://monthlysavings/create',
        rejectedMonthlyUrl: true,
      }),
      openUrl: async (url) => {
        opened.push(url);
      },
    });
    assert.deepEqual(opened, []);
    assert.equal(result.phase, 'error');
    assert.equal(result.awaitingReturn, false);
  });
});

describe('monthly saving return and confirmation', () => {
  it('does nothing when Vesty becomes active without a real monthly open', () => {
    const idle = presentAppStateMonthlySavingReturn({
      phase: 'idle',
      awaitingReturn: false,
      appState: 'active',
    });
    assert.equal(idle.phase, 'idle');
    assert.equal(canConfirmMonthlySavingSetup({ phase: 'idle', openedMonthlyUrl: false }), false);

    const background = presentAppStateMonthlySavingReturn({
      phase: 'idle',
      awaitingReturn: false,
      appState: 'background',
    });
    assert.equal(background.phase, 'idle');
  });

  it('asks for an explicit confirmation only after a real monthly open', () => {
    const returned = presentAppStateMonthlySavingReturn({
      phase: 'opened',
      awaitingReturn: true,
      appState: 'active',
    });
    assert.equal(returned.phase, 'returned');
    assert.equal(canConfirmMonthlySavingSetup({ phase: 'returned', openedMonthlyUrl: true }), true);
    assert.equal(canConfirmMonthlySavingSetup({ phase: 'returned', openedMonthlyUrl: false }), false);

    const card = presentMonthlySavingCardModel({
      setup: readySetup(),
      phase: 'returned',
    });
    assert.equal(card.title, 'Did you finish setting it up?');
    assert.equal(card.primary?.action, 'confirm_setup');
    assert.equal(card.secondary?.action, 'not_yet');
    assert.equal(card.tertiary?.action, 'buy_once');
    assert.equal(card.writeEffects.writesAttestation, false);
  });

  it('stores one attestation only from I have set it up, never from opening one-time purchase', async () => {
    const opened: string[] = [];
    const oneTime = await openOneTimePurchaseUrl({
      setup: readySetup(),
      openUrl: async (url) => {
        opened.push(url);
      },
    });
    assert.deepEqual(opened, [VERIFIED_NORDNET_PRODUCT_PAGE_URL]);
    assert.equal(oneTime.writesMonthlyAttestation, false);
    assert.equal(oneTime.writeEffects.writesAttestation, false);

    const confirmEffects = presentMonthlySavingWriteEffects(true);
    assert.equal(confirmEffects.writesAttestation, true);
    assert.equal(confirmEffects.writesPurchase, false);
    assert.equal(confirmEffects.brokerVerified, false);
    assert.equal(confirmEffects.assumesMonthlyBuyHappened, false);
  });
});

describe('needs_update presentation', () => {
  it('explains an amount change', () => {
    const card = presentMonthlySavingCardModel({
      setup: readySetup({
        status: 'needs_update',
        recommendedAmountMinor: 350000,
        attestedAmountMinor: 200000,
        amountChanged: true,
      }),
      phase: 'idle',
    });
    assert.equal(card.title, 'Your Vesty plan has changed');
    assert.equal(card.body.includes(formatNokFromMinor(350000)), true);
    assert.equal(card.primary?.label, 'Update monthly saving');
    assert.equal(card.secondary?.label, 'Buy once this month');
  });

  it('explains a schedule change', () => {
    const card = presentMonthlySavingCardModel({
      setup: readySetup({
        status: 'needs_update',
        scheduleDayOfMonth: 12,
        attestedScheduleDayOfMonth: 5,
        scheduleChanged: true,
      }),
      phase: 'idle',
    });
    assert.equal(card.body.includes('12th of each month'), true);
    assert.equal(card.primary?.action, 'update_monthly');
  });
});

describe('privacy and one-time purchase', () => {
  it('never includes another member in the setup card', () => {
    const card = presentMonthlySavingCardModel({
      setup: readySetup(),
      phase: 'idle',
    });
    const blob = JSON.stringify(card);
    assert.equal(/another member|owner amount|membership/i.test(blob), false);
    assert.equal(card.disclaimer?.includes('order'), true);
  });

  it('keeps copy-amount and report on the one-time purchase card without saving monthly setup', () => {
    const oneTime = presentOneTimePurchaseCardModel(readySetup());
    assert.equal(oneTime.copyAmountValue, presentCopyAmountValue(200000));
    assert.equal(oneTime.copyAmountValue, '2000');
    assert.equal(oneTime.secondary?.action, 'copy_amount');
    assert.equal(oneTime.tertiary?.action, 'report');
    assert.equal(oneTime.writeEffects.writesAttestation, false);
    assert.equal(oneTime.disclaimer?.includes('never saves a monthly saving setup'), true);
  });
});
