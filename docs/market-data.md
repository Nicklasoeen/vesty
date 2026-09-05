# Market Data V1

## Classification

| Surface | Status | Notes |
| --- | --- | --- |
| Official names, share classes, ISINs, NOK currency | REAL | Verified from KLP/DNB documents and pages; ISIN check digits valid; OpenFIGI confirms the same share classes |
| Latest NAV via unofficial Yahoo HTTP | REAL (local ingest) | Live chart responses for all four funds, currency `NOK` |
| Historical daily NAV via unofficial Yahoo HTTP | PARTIAL | Proven ~234 daily bars from 2022-03-07 through 2026-08-30. Not full ALL-history back to inception |
| Licensed production feed | PARTIAL | Architecture exists. No licensed provider key. Yahoo is not a redistribution license |
| Twelve Data | PARTIAL | `/funds?isin=` identified all four (same `0P000*` symbols, NOK). Quote/history 401 with demo key |
| Club/Home current value, gain %, charts | DEMO | Quantity is still null on Investment Day transactions. Do not compute `amount / today's NAV` |

## Verified instruments

| Catalog name | Share class | Kind | Currency | ISIN | Official sources |
| --- | --- | --- | --- | --- | --- |
| KLP AksjeGlobal Indeks P | P | fund | NOK | NO0010776040 | [KLP prospectus](https://www.klp.no/virksomhet/fond/store-andelsklasser/_/attachment/inline/266a7c07-6888-4181-8198-b2299cfb48d4:aac9e5c129f8551c35ee6e85354b5a391ff329a1/Pros_KLP_AksjeGlobal_Indeks_01_2026.pdf), [klp.no](https://www.klp.no/fond/vare-fond/NO0010776040) |
| DNB Teknologi A | A | fund | NOK | NO0010337678 | DNB Teknologi prospectus (class A NOK), [dnb.no](https://www.dnb.no/sparing/fond/fond-liste/d/dnb-teknologi-a-NO0010337678) |
| KLP AksjeNorge Indeks P | P | fund | NOK | NO0010455694 | [klp.no](https://www.klp.no/fond/vare-fond/NO0010455694) |
| KLP AksjeFremvoksende Markeder Indeks P | P | fund | NOK | NO0010611809 | [klp.no](https://www.klp.no/fond/vare-fond/NO0010611809), [KLP fee list](https://www.klp.no/fond/priser-og-vilkar/kostnadsoversikt) |

The previous fixture name `KLP AksjeFremvoksende Markeder P` is not an official share-class name. KLP's retail class is **Indeks P**. No separate non-index `KLP AksjeFremvoksende Markeder P` product was found.

These are Norwegian UCITS equity funds with daily NAV. Tickers and exchanges stay null. OpenFIGI Bloomberg-style symbols (`VEKAKGV`, `DINORTE`, `KLPANII`, `KLPAMI2`) are not stored on `investment_targets`.

## Coverage spike (2026-09-05)

| Instrument | OpenFIGI | Yahoo unofficial latest | Yahoo history | Twelve Data catalog | Twelve Data NAV | FMP / EODHD / Finnhub / Alpha Vantage |
| --- | --- | --- | --- | --- | --- | --- |
| NO0010776040 | KLP AKSJEGLOBAL INDEKS-P | 3935.97949219 NOK | 234 days from 2022-03-07 | `0P00018V9L` NOK | 401 demo key | no usable unauthenticated coverage |
| NO0010337678 | DNB TEKNOLOGI-A NOK ACC | 7434.67626953 NOK | same window | `0P00000MVB` NOK | 401 | same |
| NO0010455694 | KLP AKSJENORGE INDEKS-P NOK | 5564.69482422 NOK | same window | `0P0000HNUP` NOK | 401 | same |
| NO0010611809 | KLP AKSJEFREM MARK IDX P | 3975.21508789 NOK | same window | `0P0000TJ5D` NOK | 401 | same |

Yahoo identifiers are `0P00018V9L.IR`, `0P00000MVB.IR`, `0P0000HNUP.IR`, `0P0000TJ5D.IR`. Latest 5-day chart bar persisted locally was 2026-09-03. That as-of date is delayed NAV, not a live quote. History `range=max` returned the same last close and a first bar of 2022-03-07.

Authoritative Norwegian NAV is the Euronext Oslo Børs Mutual Fund Feed (commercial FTP, not used). KLP also publishes monthly XLS NAV files, which are too coarse for V1 daily ingest and omit DNB Teknologi.

## Provider selection

V1 ingest uses **Yahoo unofficial HTTP** only because it is the only source that returned real latest and historical NAV for all four funds without fabricating identifiers.

It is **not** a licensed market-data agreement. Do not treat persisted Yahoo rows as a production redistribution right. A licensed provider (Twelve Data with a real key, EODHD, Finnhub, or Euronext OMFF) should replace it once NAV coverage is proven with credentials.

## Architecture

```text
InvestmentTarget (ISIN, NOK, official name)
        ↓
market_data_instrument_mappings
        ↓
Yahoo unofficial adapter (server-only)
        ↓
market_prices (numeric NAV, price_type = nav)
```

Secrets stay in Edge Function environment. Never `EXPO_PUBLIC_*`. The mobile app has no provider client and no price write path.

## Precision

`market_prices.price` is `numeric(20, 8)`. Yahoo delivers IEEE-754 closes; the adapter stores a decimal string rounded to 8 places. That is a provider limitation, not Vesty inventing NAV. Transaction `amount_minor` remains bigint.

## Sync

`sync-market-data` is a secret-key Edge Function (`verify_jwt = false`, `auth: secret`).

```sh
# Latest NAV for all mapped Yahoo instruments
curl -sS -X POST "$SUPABASE_URL/functions/v1/sync-market-data" \
  --header "apikey: $SUPABASE_SECRET_KEY" \
  --header "Content-Type: application/json" \
  --data '{}'

# Optional history backfill (stores what Yahoo returns; does not interpolate)
curl -sS -X POST "$SUPABASE_URL/functions/v1/sync-market-data" \
  --header "apikey: $SUPABASE_SECRET_KEY" \
  --header "Content-Type: application/json" \
  --data '{"backfill":true}'
```

Local secrets belong in `supabase/functions/.env` (untracked). See `supabase/functions/.env.example`.

Hosted daily scheduling is the next deployment step. Do not add a local cron hack. Mutual-fund NAV daily is enough; this is not realtime.

Failures (timeout, HTTP error, malformed payload, rate limit, unknown instrument, currency mismatch) are returned per instrument and do not write that observation. Upsert is idempotent on `(investment_target_id, provider, price_type, price_date)`.

## Quantity and valuation

Investment Day V1 stores a NOK contribution amount. `quantity` and `unit_price_minor` stay null. Mutual-fund orders typically execute at a future unknown NAV, so Vesty must not derive quantity from today's NAV.

Chosen V1 product rule: **D — current market value stays unavailable** until a later quantity-capture or broker-sync flow exists.

Valuation states for a later UI pass:

- `REAL_VALUE_AVAILABLE` — real quantity and a validated latest NAV
- `COST_BASIS_ONLY` — reported invested amount only; no fake gain %
- `NO_PRICE_DATA` — no usable NAV

Club currently shows labeled demo market value plus real own cost basis. Home stays on the demo adapter.

Historical Value charts need real quantities, real transaction dates, and historical NAVs applied in purchase order. Do not project today's quantity backward.

## Tests

- `supabase/tests/market_data_v1.test.sql`
- `node --experimental-strip-types --test supabase/functions/_shared/market-data/parseYahooChart.test.ts`
