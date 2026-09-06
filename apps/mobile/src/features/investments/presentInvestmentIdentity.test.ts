import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CORE_V1_TARGET_IDS } from '../clubs/curatedInvestmentPackages.ts';

import {
  CURATED_INSTRUMENT_PRESENTATION,
  presentInvestmentIdentity,
} from './presentInvestmentIdentity.ts';

describe('curated V1 instrument presentation', () => {
  it('maps the five V1 ETFs to beginner-facing labels', () => {
    assert.equal(presentInvestmentIdentity({ ticker: 'VWCE' }).friendlyName, 'Global equities');
    assert.equal(presentInvestmentIdentity({ ticker: 'SXR8' }).friendlyName, 'S&P 500');
    assert.equal(presentInvestmentIdentity({ ticker: 'EUNK' }).friendlyName, 'European equities');
    assert.equal(presentInvestmentIdentity({ ticker: 'IS3N' }).friendlyName, 'Emerging markets');
    assert.equal(presentInvestmentIdentity({ ticker: 'SXRV' }).friendlyName, 'Nasdaq 100');
  });

  it('keeps ticker as the strong identity and issuer marks shared', () => {
    assert.equal(presentInvestmentIdentity({ ticker: 'vwce' }).ticker, 'VWCE');
    assert.equal(presentInvestmentIdentity({ ticker: 'VWCE' }).issuer, 'Vanguard');
    assert.equal(presentInvestmentIdentity({ ticker: 'VWCE' }).markKey, 'vanguard');
    assert.equal(presentInvestmentIdentity({ ticker: 'SXR8' }).markKey, 'ishares');
    assert.equal(presentInvestmentIdentity({ ticker: 'EUNK' }).markKey, 'ishares');
    assert.equal(presentInvestmentIdentity({ ticker: 'IS3N' }).markKey, 'ishares');
    assert.equal(presentInvestmentIdentity({ ticker: 'SXRV' }).markKey, 'ishares');
  });

  it('does not use the legal ETF title as the primary label', () => {
    const identity = presentInvestmentIdentity({
      ticker: 'VWCE',
      name: CURATED_INSTRUMENT_PRESENTATION.VWCE.officialName,
    });
    assert.equal(identity.friendlyName.includes('UCITS'), false);
    assert.equal(identity.friendlyName.includes('ETF'), false);
    assert.notEqual(identity.friendlyName, identity.officialName);
    assert.equal(identity.ticker, 'VWCE');
  });

  it('resolves curated identity from a known target id', () => {
    const identity = presentInvestmentIdentity({ targetId: CORE_V1_TARGET_IDS.sxr8 });
    assert.equal(identity.ticker, 'SXR8');
    assert.equal(identity.friendlyName, 'S&P 500');
    assert.equal(identity.isCurated, true);
  });
});

describe('unknown instrument fallback', () => {
  it('falls back to ticker and a ticker mark, not a guessed product name', () => {
    const identity = presentInvestmentIdentity({
      ticker: 'ABCD',
      name: 'Mystery Super Accumulating UCITS ETF (Acc)',
    });
    assert.equal(identity.ticker, 'ABCD');
    assert.equal(identity.friendlyName, 'ABCD');
    assert.equal(identity.markKey, null);
    assert.equal(identity.issuer, null);
    assert.equal(identity.isCurated, false);
    assert.equal(identity.fallbackInitials, 'AB');
  });

  it('can use a short raw name when no ticker exists', () => {
    const identity = presentInvestmentIdentity({ name: 'KLP AksjeGlobal' });
    assert.equal(identity.ticker, 'KLP AksjeGlobal');
    assert.equal(identity.friendlyName, 'KLP AksjeGlobal');
    assert.equal(identity.markKey, null);
  });

  it('uses deterministic ticker initials when no issuer mark exists', () => {
    assert.equal(presentInvestmentIdentity({ ticker: 'abcd' }).fallbackInitials, 'AB');
    assert.equal(presentInvestmentIdentity({ ticker: 'X' }).fallbackInitials, 'X');
    assert.equal(presentInvestmentIdentity({ name: 'Mystery Super Accumulating UCITS ETF (Acc)' }).fallbackInitials, '?');
  });
});
