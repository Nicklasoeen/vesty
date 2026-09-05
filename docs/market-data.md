# Market Data V1

## Classification

| Surface | Status | Notes |
| --- | --- | --- |
| Official names, share classes, ISINs, NOK currency | REAL | Verified from KLP/DNB documents and pages; ISIN check digits valid; OpenFIGI confirms the same share classes |
| Latest NAV via unofficial Yahoo HTTP | REAL (probe only) | Live chart responses for all four funds, currency `NOK`. Not a production license |
| Historical daily NAV via unofficial Yahoo HTTP | PARTIAL | Proven ~234 daily bars from 2022-03-07 through 2026-08-30. Not full inception history |
| Twelve Data catalog identity | PARTIAL | `/funds?isin=` identified all four (`0P000*` + NOK) with a demo/unauthenticated request. Catalog names are slightly wrong |
| Twelve Data latest + historical NAV | BLOCKED | No real `TWELVE_DATA_API_KEY` in server-side environment. Demo key returns 401. Mappings stay inactive |
| Licensed production ingest | NOT ACTIVATED | Adapter, validation, and Edge Function default to `twelve_data`. Active mappings are not flipped until all four funds pass with a real key |
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

Twelve Data is the first preferred licensed/API candidate. A real key was **not** available in process env, `supabase/functions/.env`, mobile env, or 1Password CLI. Do not activate mappings from this table.

| Instrument | Provider id | Identity match | Currency | Latest NAV | As-of | History available | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| KLP AksjeGlobal Indeks P | `0P00018V9L` | Catalog only (demo `/funds?isin=NO0010776040`) | NOK in catalog | unproven | unproven | unproven | FAIL |
| DNB Teknologi A | `0P00000MVB` | Catalog only (demo `/funds?isin=NO0010337678`) | NOK in catalog | unproven | unproven | unproven | FAIL |
| KLP AksjeNorge Indeks P | `0P0000HNUP` | Catalog only (demo `/funds?isin=NO0010455694`) | NOK in catalog | unproven | unproven | unproven | FAIL |
| KLP AksjeFremvoksende Markeder Indeks P | `0P0000TJ5D` | Catalog only (demo `/funds?isin=NO0010611809`) | NOK in catalog | unproven | unproven | unproven | FAIL |

Catalog names from Twelve Data are slightly wrong (`Indeks V`, `Indeks II`). Do not require those names to match the official KLP/DNB share-class names. Strongest available identity without a paid add-on:

1. Query `/funds?isin=<verified ISIN>`
2. Require the expected `0P000*` symbol
3. Require currency `NOK`
4. If the payload echoes a real ISIN, require an exact match
5. Treat `isin: "request_access_via_add_ons"` as "ISIN not echoed", not as a match

Do not blindly trust the `0P000*` identifiers until a paid key proves quote + history for every fund.

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

Until a real key exists, the earliest/latest Twelve Data dates and observation counts are unknown. Do not copy Yahoo's 2022-03-07 window onto Twelve Data.

When a key is available, run one conservative backfill and record:

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
