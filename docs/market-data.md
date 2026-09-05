# Market Data V1

## Classification

| Surface | Status | Notes |
| --- | --- | --- |
| Official names, share classes, ISINs, NOK currency | REAL | Verified from KLP/DNB documents and pages; ISIN check digits valid; OpenFIGI confirms the same share classes |
| Latest NAV via unofficial Yahoo HTTP | REAL (probe only) | Live chart responses for all four funds, currency `NOK`. Not a production license |
| Historical daily NAV via unofficial Yahoo HTTP | PARTIAL | Proven ~234 daily bars from 2022-03-07 through 2026-08-30. Not full inception history |
| Twelve Data catalog identity | PARTIAL | Authenticated `/funds?symbol=` returns all four candidate ids in NOK. `/funds?isin=` is empty without the ISIN add-on. Catalog names are slightly wrong for the KLP classes |
| Twelve Data latest + historical NAV | BLOCKED | Real key loads. `/quote`, `/time_series`, `/eod`, and `/price` return 404: these mutual-fund symbols require a Grow or Venture plan. Mappings stay inactive |
| Licensed production ingest | NOT ACTIVATED | All-four NAV gate failed. Do not activate Twelve Data. Do not use Yahoo as production ingest |
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

## Licensed-provider coverage gate (2026-09-05)

A real `TWELVE_DATA_API_KEY` was loaded from untracked `supabase/functions/.env`. The key authenticates (a US equity quote succeeds). It does **not** unlock NAV for the four TestFlight funds. Do not activate mappings from this table.

| Instrument | Twelve Data ID | Identity | Currency | Latest NAV | As-of | History | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| KLP AksjeGlobal Indeks P | `0P00018V9L` | `/funds?symbol=` name `KLP AksjeGlobal Indeks V`; ISIN not echoed; `/funds?isin=` empty | NOK in catalog | 404 Grow/Venture | n/a | 404 Grow/Venture | FAIL |
| DNB Teknologi A | `0P00000MVB` | `/funds?symbol=` name matches `DNB Teknologi A`; ISIN not echoed; `/funds?isin=` empty | NOK in catalog | 404 Grow/Venture | n/a | 404 Grow/Venture | FAIL |
| KLP AksjeNorge Indeks P | `0P0000HNUP` | `/funds?symbol=` name `KLP AksjeNorge Indeks II`; ISIN not echoed; `/funds?isin=` empty | NOK in catalog | 404 Grow/Venture | n/a | 404 Grow/Venture | FAIL |
| KLP AksjeFremvoksende Markeder Indeks P | `0P0000TJ5D` | `/funds?symbol=` name `KLP Aksje Fremvoksende Markeder Indeks II`; ISIN not echoed; `/funds?isin=` empty | NOK in catalog | 404 Grow/Venture | n/a | 404 Grow/Venture | FAIL |

Identity is not strong enough to ingest even if quotes later work without an ISIN add-on:

1. `/funds?isin=<verified ISIN>` currently returns an empty list (ISIN add-on not enabled)
2. `/funds?symbol=` confirms the candidate `0P000*` and `NOK`
3. Echoed `isin` is `request_access_via_add_ons`, not the official ISIN
4. KLP catalog names use `Indeks V` / `Indeks II` rather than official share class P

Quote, history, EOD, and price for these symbols all return HTTP 404: available starting with the Grow or Venture plan. That is the coverage gap. Do not activate. Do not fall back to Yahoo for production.

Yahoo unofficial identifiers remain `0P00018V9L.IR`, `0P00000MVB.IR`, `0P0000HNUP.IR`, `0P0000TJ5D.IR`. That coverage is **dev/probe only**. Production ingest must not use Yahoo.

## Provider selection

Production default is `MARKET_DATA_PROVIDER=twelve_data`.

Yahoo unofficial HTTP stays in the codebase only as:

```sh
curl -sS -X POST "$SUPABASE_URL/functions/v1/sync-market-data" \
  --header "apikey: $SUPABASE_SECRET_KEY" \
  --header "Content-Type: application/json" \
  --data '{"probe":"yahoo_unofficial"}'
```

Yahoo mappings may still be the only *active* rows in the database until Twelve Data NAV is proven. The Edge Function does not select them unless `probe` is explicit. After all four Twelve Data funds pass, deactivate Yahoo and activate Twelve Data in one transaction so each target has exactly one active mapping.

This is **not** a redistribution license for either provider. Vesty currently has no contract text proving the right to store or display Twelve Data or Yahoo values beyond personal/subscriber API use. Do not claim broader redistribution rights.

## Architecture

```text
InvestmentTarget (ISIN, NOK, official name)
        ↓
market_data_instrument_mappings (exactly one active mapping per target)
        ↓
provider dispatch → twelve_data adapter (production)
                 → yahoo_unofficial adapter (explicit probe only)
        ↓
validate identity / currency / positive finite NAV / date / obvious staleness
        ↓
market_prices upsert (numeric NAV, price_type = nav)
```

Provider-specific URLs, query parameters, response parsing, and error mapping stay in the adapter. Generic sync does not know Twelve Data JSON.

Secrets stay in Edge Function environment (`TWELVE_DATA_API_KEY`). Never `EXPO_PUBLIC_*`. The mobile app has no provider client and no price write path.

## Precision

`market_prices.price` is `numeric(20, 8)`. Twelve Data quote/history fixtures use decimal strings; the adapter stores a normalized decimal string without inventing extra precision. Yahoo still delivers IEEE-754 closes when probed. Transaction `amount_minor` remains bigint.

## Identity validation before persist

The Edge Function refuses to upsert when:

- the mapping is missing or inactive
- `/funds?isin=` returns a different `0P000*` than the mapping
- quote/history symbol does not match the mapping
- currency is not the target currency (`NOK`)
- price is missing, non-positive, or non-finite
- the date is malformed
- the latest NAV is older than 30 days (obviously stale / malformed)

A failed instrument does not delete or overwrite other instruments' valid rows. Bad payloads never become null prices.

## Historical backfill

`{"backfill":true}` uses `/time_series?interval=1day&outputsize=1500` and stores returned bars only. No interpolation. No inception crawl.

A real key was tested. `/time_series` for all four `0P000*` symbols is plan-gated (Grow/Venture). No Twelve Data history was persisted. Do not copy Yahoo's 2022-03-07 window onto Twelve Data.

When a plan that includes these funds is available, run one conservative backfill and record:

- earliest available date
- latest date
- approximate observation count
- any `outputsize` / plan-credit limitation

## Sync

`sync-market-data` is a secret-key Edge Function (`verify_jwt = false`, `auth: secret`).

```sh
# Production path: Twelve Data latest NAV for active twelve_data mappings
curl -sS -X POST "$SUPABASE_URL/functions/v1/sync-market-data" \
  --header "apikey: $SUPABASE_SECRET_KEY" \
  --header "Content-Type: application/json" \
  --data '{}'

# Conservative history backfill after activation
curl -sS -X POST "$SUPABASE_URL/functions/v1/sync-market-data" \
  --header "apikey: $SUPABASE_SECRET_KEY" \
  --header "Content-Type: application/json" \
  --data '{"backfill":true}'
```

Without `TWELVE_DATA_API_KEY`, the function returns `503 missing_provider_key` and writes nothing.

Local secrets belong in untracked `supabase/functions/.env`. See `supabase/functions/.env.example`. Hosted secrets:

```sh
supabase secrets set TWELVE_DATA_API_KEY=...
supabase secrets set MARKET_DATA_PROVIDER=twelve_data
```

Do not print the key. Do not put it in mobile env or iOS export input.

Upsert is idempotent on `(investment_target_id, provider, price_type, price_date)`.

## Daily sync

Mutual-fund NAV needs an approximate daily refresh, not realtime.

No remote Supabase project is configured in this repo. Do **not** invent local cron.

When a hosted project exists:

1. Deploy `sync-market-data`
2. Set `TWELVE_DATA_API_KEY` and `MARKET_DATA_PROVIDER` with `supabase secrets set`
3. Store the project URL and **secret** API key in Vault
4. Schedule `pg_cron` + `pg_net` to POST `/functions/v1/sync-market-data`

The function rejects publishable keys. Official Supabase cron examples that send a publishable `apikey` will get `401` here.

See `supabase/functions/sync-market-data/schedule.example.sql`. That file is documentation, not an applied migration.

## Stale-data semantics

Daily NAV is delayed. Weekends and a short holiday gap are not treated as provider failure.

`public.market_nav_freshness_v1(price_date)` and `latest_market_price_status` expose:

| Field | Meaning |
| --- | --- |
| `price` | persisted NAV |
| `currency` | must match the target |
| `price_date` | as-of date |
| `fetched_at` | when Vesty stored the row |
| `provider` | `twelve_data` or `yahoo_unofficial` |
| `freshness` | `fresh`, `stale`, or `unavailable` |

`fresh` means the as-of date is on or after the previous weekday minus a 3-day holiday buffer. Missing or future dates are `unavailable`. This metadata is not wired into Home/Club UI in this pass.

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
- `pnpm test:market-data` — Twelve Data and Yahoo parser/adapter fixtures, no live provider network
