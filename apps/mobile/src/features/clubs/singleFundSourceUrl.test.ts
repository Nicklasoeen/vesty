import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isAllowedSingleFundSourceUrl } from './singleFundSourceUrl.ts';

describe('single-fund source URLs', () => {
  it('accepts the official DNB and Nordnet catalog hosts', () => {
    assert.equal(
      isAllowedSingleFundSourceUrl(
        'https://www.dnb.no/sparing/fond/fond-liste/d/dnb-global-indeks-a-NO0010582984',
      ),
      true,
    );
    assert.equal(
      isAllowedSingleFundSourceUrl('https://www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894'),
      true,
    );
  });

  it('rejects http, lookalikes, and userinfo disguises', () => {
    assert.equal(
      isAllowedSingleFundSourceUrl('http://www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894'),
      false,
    );
    assert.equal(
      isAllowedSingleFundSourceUrl('https://nordnet.no.example.com/fond/liste/dnb-global-indeks-a'),
      false,
    );
    assert.equal(
      isAllowedSingleFundSourceUrl('https://www.nordnet.no.example.com/fond/liste/dnb-global-indeks-a'),
      false,
    );
    assert.equal(
      isAllowedSingleFundSourceUrl('https://www.nordnet.no@evil.example/fond/liste/dnb-global-indeks-a'),
      false,
    );
    assert.equal(
      isAllowedSingleFundSourceUrl(
        'https://evil.example@www.nordnet.no/fond/liste/dnb-global-indeks-a-nok-7b4b0894',
      ),
      false,
    );
  });
});
