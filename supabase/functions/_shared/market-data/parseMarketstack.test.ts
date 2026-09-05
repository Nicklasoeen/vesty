import assert from 'node:assert/strict';
import test from 'node:test';

import { ProviderSyncError } from './types.ts';
import { parseMarketstackEod } from './parseMarketstack.ts';

const now = new Date('2026-09-05T12:00:00Z');

function eodRow(overrides: Record<string, unknown> = {}) {
  return {
    symbol: 'VWCE.DE',
    date: '2026-09-03T00:00:00+0000',
    close: 168.06,
    adj_close: 168.06,
    price_currency: null,
    exchange: 'XETR',
    split_factor: 1,
    dividend: 0,
    ...overrides,
  };
}

function payload(rows: unknown[]) {
  return {
    pagination: { limit: 100, offset: 0, count: rows.length, total: rows.length },
    data: rows,
  };
}

test('parses a valid Marketstack EOD row for an allowlisted ETF', () => {
  const history = parseMarketstackEod(payload([eodRow()]), 'VWCE.DE', 'EUR', now);
  assert.equal(history.providerInstrumentId, 'VWCE.DE');
  assert.equal(history.currency, 'EUR');
  assert.equal(history.observations[0].price, '168.06');
  assert.equal(history.observations[0].priceDate, '2026-09-03');
  assert.equal(history.observations[0].priceType, 'close');
});

test('accepts a null price_currency for an EUR allowlisted ETF', () => {
  const history = parseMarketstackEod(payload([eodRow({ price_currency: null })]), 'VWCE.DE', 'EUR', now);
  assert.equal(history.observations[0].currency, 'EUR');
});

test('accepts an explicit EUR price_currency', () => {
  const history = parseMarketstackEod(
    payload([eodRow({ symbol: 'EUNK.DE', close: 105.5, price_currency: 'EUR' })]),
    'EUNK.DE',
    'EUR',
    now,
  );
  assert.equal(history.providerInstrumentId, 'EUNK.DE');
  assert.equal(history.observations[0].currency, 'EUR');
});

test('rejects an explicit USD currency for these EUR targets', () => {
  assert.throws(
    () => parseMarketstackEod(payload([eodRow({ price_currency: 'USD' })]), 'VWCE.DE', 'EUR', now),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'currency_mismatch',
  );
});

test('skips zero or negative close bars and keeps valid ones', () => {
  const history = parseMarketstackEod(
    payload([eodRow({ date: '2026-09-02T00:00:00+0000', close: 0 }), eodRow()]),
    'VWCE.DE',
    'EUR',
    now,
  );
  assert.equal(history.observations.length, 1);
  assert.equal(history.observations[0].priceDate, '2026-09-03');
});

test('rejects a series that has only invalid closes', () => {
  assert.throws(
    () => parseMarketstackEod(payload([eodRow({ close: 0 })]), 'VWCE.DE', 'EUR', now),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'missing_price',
  );
});

test('skips a malformed date bar', () => {
  const history = parseMarketstackEod(
    payload([eodRow({ date: '03-09-2026' }), eodRow()]),
    'VWCE.DE',
    'EUR',
    now,
  );
  assert.equal(history.observations.length, 1);
});

test('skips a future date bar', () => {
  const history = parseMarketstackEod(
    payload([eodRow({ date: '2026-09-06T00:00:00+0000' }), eodRow()]),
    'VWCE.DE',
    'EUR',
    now,
  );
  assert.equal(history.observations.length, 1);
  assert.equal(history.observations[0].priceDate, '2026-09-03');
});

test('rejects a wrong or bare symbol', () => {
  assert.throws(
    () => parseMarketstackEod(payload([eodRow({ symbol: 'VWCE' })]), 'VWCE.DE', 'EUR', now),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'missing_price',
  );
  assert.throws(
    () => parseMarketstackEod(payload([eodRow()]), 'EQNR.XOSL', 'EUR', now),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'unknown_instrument',
  );
});

test('ignores extra unrelated symbols in a batch', () => {
  const history = parseMarketstackEod(
    payload([
      eodRow({ symbol: 'AAPL', close: 319.97, exchange: 'XNAS', price_currency: 'USD' }),
      eodRow({ symbol: 'vwce.de', close: 168.06 }),
    ]),
    'VWCE.DE',
    'EUR',
    now,
  );
  assert.equal(history.observations.length, 1);
  assert.equal(history.observations[0].price, '168.06');
});

test('rejects an ADR-scale close outside the approved band', () => {
  assert.throws(
    () => parseMarketstackEod(payload([eodRow({ close: 12 })]), 'VWCE.DE', 'EUR', now),
    (error: unknown) => error instanceof ProviderSyncError && error.code === 'malformed',
  );
});
