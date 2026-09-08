import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isAllowedNordnetHandoffUrl,
  isVerifiedNordnetMonthlySavingUrl,
  nordnetUrlCarriesMemberAmount,
  VERIFIED_NORDNET_MONTHLY_SAVING_URL,
  VERIFIED_NORDNET_PRODUCT_PAGE_URL,
} from './nordnetHandoffUrl.ts';

const OFFICIAL = VERIFIED_NORDNET_PRODUCT_PAGE_URL;

describe('Nordnet handoff URLs', () => {
  it('accepts the verified official HTTPS product page', () => {
    assert.equal(isAllowedNordnetHandoffUrl(OFFICIAL), true);
  });

  it('rejects http, app schemes, lookalikes, userinfo, and other hosts', () => {
    assert.equal(isAllowedNordnetHandoffUrl(OFFICIAL.replace('https://', 'http://')), false);
    assert.equal(isAllowedNordnetHandoffUrl('nordnet://fond/liste/dnb-global-indeks-a-nok-7b4b0894'), false);
    assert.equal(isAllowedNordnetHandoffUrl('https://nordnet.no.example.com/fond/liste/dnb-global-indeks-a'), false);
    assert.equal(isAllowedNordnetHandoffUrl('https://www.nordnet.no.example.com/fond/liste/dnb-global-indeks-a'), false);
    assert.equal(isAllowedNordnetHandoffUrl('https://www.nordnet.no@evil.example/fond/liste/dnb-global-indeks-a'), false);
    assert.equal(
      isAllowedNordnetHandoffUrl('https://evil.example@www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894'),
      false,
    );
    assert.equal(
      isAllowedNordnetHandoffUrl('https://www.dnb.no/sparing/fond/fond-liste/d/dnb-global-indeks-a-NO0010582984'),
      false,
    );
  });

  it('accepts the verified monthly savings HTTPS page and rejects lookalikes', () => {
    assert.equal(isVerifiedNordnetMonthlySavingUrl(VERIFIED_NORDNET_MONTHLY_SAVING_URL), true);
    assert.equal(isAllowedNordnetHandoffUrl(VERIFIED_NORDNET_MONTHLY_SAVING_URL), true);
    assert.equal(isVerifiedNordnetMonthlySavingUrl(`${VERIFIED_NORDNET_MONTHLY_SAVING_URL}?amount=2000`), false);
    assert.equal(isVerifiedNordnetMonthlySavingUrl('nordnet://monthlysavings/create'), false);
    assert.equal(isVerifiedNordnetMonthlySavingUrl('https://www.dnb.no/sparing/fond'), false);
  });

  it('does not put the member amount in either verified Nordnet URL', () => {
    assert.equal(nordnetUrlCarriesMemberAmount(VERIFIED_NORDNET_MONTHLY_SAVING_URL, 200000), false);
    assert.equal(nordnetUrlCarriesMemberAmount(VERIFIED_NORDNET_PRODUCT_PAGE_URL, 200000), false);
    assert.equal(
      nordnetUrlCarriesMemberAmount(`${VERIFIED_NORDNET_MONTHLY_SAVING_URL}?amount=2000`, 200000),
      true,
    );
  });
});
