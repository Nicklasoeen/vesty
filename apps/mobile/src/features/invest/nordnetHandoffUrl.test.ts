import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isAllowedNordnetHandoffUrl } from './nordnetHandoffUrl.ts';

const OFFICIAL = 'https://www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894';

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
});
