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
| Club/Home current value, gain %, charts | ESTIMATED (curated V1) | Curated ETF clubs use modelled/exact lots × historical Marketstack close × Norges Bank EUR/NOK. Legacy KLP/DNB stay demo/unavailable |
| Curated V1 ETF quantity | REAL (member-reported) | Investment Day v2 stores actual purchased units. Never inferred from Marketstack |
| Curated V1 ETF current value | REAL (EUR, position-level) | `total_quantity × latest fresh Marketstack close` when quantity is complete. Instrument currency only |

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

## Low-cost provider spike (2026-09-05)

A real `ALPHA_VANTAGE_API_KEY` was tested from untracked `supabase/functions/.env` on 2026-09-05 (18 calls). US stocks and one UCITS ETF listing passed. Oslo primary listings were not returned (only LSE/Frankfurt/US ADR). All four Norwegian funds returned empty `SYMBOL_SEARCH` for both official name and ISIN. Alpha Vantage is a stock/ETF candidate only, not a main NAV provider. Free-key access is not a commercial/display right. No `FMP_API_KEY` has been live-tested.

| Provider | All 4 funds | Latest NAV | History | Share-class confidence | Free test | Lowest realistic cost | Commercial / display | Rank |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Yahoo unofficial | YES (prior probe) | YES | ~234 daily bars | High | unofficial HTTP | $0 | no redistribution license | REJECT |
| Alpha Vantage | NO (0/4 funds) | US/ETF yes; Oslo listing no | compact daily 100 bars when listed | funds empty | 25 calls/day | $0 test; premium from $49.99/mo + written commercial agreement | Free and self-serve premium are personal/non-commercial. Showing prices to other people (including TestFlight) is commercial under their terms | STOCK/ETF ONLY |
| Financial Modeling Prep | NOT LIVE-TESTED | — | — | — | 250 calls/day | $0 test; Starter $22/mo is US-only; Ultimate $149/mo claims global + ETF/mutual-fund holdings | Personal-use license. Multi-user app display requires a separate Data Display and Licensing Agreement | POSSIBLE only after a key proves coverage |
| Twelve Data current plan | NO | NO | NO | catalog only | paid key used | Grow/Venture required for these `0P000*` symbols | subscriber API, not a proven redistribution right | REJECT this plan |
| Euronext Oslo Børs OMFF | likely (2,400+ Norway-saleable funds) | YES (Basic feed) | extra paid modules | ISIN in feed spec | no | Basic feed NOK 26,830/year + startup | licensed Norwegian NAV feed | REJECT for this cheap spike |

No cheap licensed provider covers the four TestFlight funds. Do not activate Yahoo or Alpha Vantage. A future multi-provider split (Alpha Vantage for listed stocks/ETFs, separate NAV source for Norwegian funds) is the technical path if a commercial/display agreement is obtained.

## Marketstack coverage spike (2026-09-05)

A real `MARKETSTACK_API_KEY` was tested from untracked `supabase/functions/.env` on 2026-09-05. Free-tier: 108 HTTP / 122 billed, then `usage_limit_reached`. Basic retest: 12 HTTP / 29 billed. US common stocks pass. `EQNR.XOSL` still returns the NYSE ADR 42.09 labeled `NOK` (Yahoo Oslo close 393.60 NOK on 2026-09-04). `EQNR.OL`, `DNB.OL`, `KOG.OL`, and `MOWI.OL` are real NOK. `ASML.XAMS` latest matches Amsterdam, but history mixes NASDAQ USD bars. Full table: [market-data-marketstack-spike.md](./market-data-marketstack-spike.md). Recommendation **B — US / limited secondary** for a broad Europe/Oslo/guessed-symbol universe.

A later curated-package shortlist (`VWCE.DE`, `SXR8.DE`, `EUNK.DE`, `IS3N.DE`, `SXRV.DE`) verified as Xetra EUR listings. Marketstack is now accepted **only** for those five CORE V1 ETFs. It is still not a generic resolver. Product design: [vesty-v1-investment-packages.md](./vesty-v1-investment-packages.md). The earlier B rating for a broad Europe/Oslo/guessed-symbol universe still stands.

## Marketstack V1 allowlist (activated)

Authoritative EOD ingest for the five curated Create Club ETFs uses `provider = marketstack` and these exact mappings:

| Target | Ticker | Mapping id | Provider symbol | Exchange stored |
| --- | --- | --- | --- | --- |
| `…000011` | VWCE | `41000000-0000-4000-8000-000000000021` | `VWCE.DE` | XETR |
| `…000012` | EUNK | `41000000-0000-4000-8000-000000000022` | `EUNK.DE` | XETR |
| `…000013` | IS3N | `41000000-0000-4000-8000-000000000023` | `IS3N.DE` | XETR |
| `…000014` | SXR8 | `41000000-0000-4000-8000-000000000024` | `SXR8.DE` | XETR |
| `…000015` | SXRV | `41000000-0000-4000-8000-000000000025` | `SXRV.DE` | XETR |

Policy:

- Never search, guess a MIC suffix, or derive a symbol from the ticker.
- Request the mapped symbol exactly.
- Target currency `EUR` is authoritative. Null `price_currency` is accepted for these five. Any explicit non-EUR currency is rejected.
- If `exchange` is present, it must be Xetra (`XETR` / `XETRA`).
- Wide per-symbol magnitude bands reject ADR-scale collisions. They are not price targets.
- History backfill is about one UTC year of daily EOD bars. Missing sessions are not invented. Null or `0` closes in an otherwise valid Xetra series are skipped, not stored.
- Stored `price_type` is `close`.
- KLP/DNB funds have no Marketstack mapping.

```sh
# Latest EOD for the five allowlisted ETFs
curl -sS -X POST "$SUPABASE_URL/functions/v1/sync-market-data" \
  --header "apikey: $SUPABASE_SECRET_KEY" \
  --header "Content-Type: application/json" \
  --data '{"provider":"marketstack"}'

# Bounded ~1-year backfill
curl -sS -X POST "$SUPABASE_URL/functions/v1/sync-market-data" \
  --header "apikey: $SUPABASE_SECRET_KEY" \
  --header "Content-Type: application/json" \
  --data '{"provider":"marketstack","backfill":true}'
```

`MARKETSTACK_API_KEY` stays in the Edge Function environment. Never `EXPO_PUBLIC_*`.

## Provider selection

Production default for the fund path remains `MARKET_DATA_PROVIDER=twelve_data`. Curated V1 ETF ingest selects Marketstack with `{"provider":"marketstack"}` or `MARKET_DATA_PROVIDER=marketstack`.

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
InvestmentTarget (official name, ISIN, currency)
        ↓
market_data_instrument_mappings (exactly one active mapping per target)
        ↓
provider dispatch → marketstack adapter (five V1 ETFs only)
                 → twelve_data adapter (funds; inactive until NAV proof)
                 → yahoo_unofficial adapter (explicit probe only)
        ↓
validate symbol / currency / positive finite price / date / magnitude / staleness
        ↓
market_prices upsert (numeric; ETF close or fund NAV)
```

Provider-specific URLs, query parameters, response parsing, and error mapping stay in the adapter. Generic sync does not know Marketstack or Twelve Data JSON.

Secrets stay in Edge Function environment (`MARKETSTACK_API_KEY`, `TWELVE_DATA_API_KEY`). Never `EXPO_PUBLIC_*`. The mobile app has no provider client and no price write path.

## Precision

`market_prices.price` is `numeric(20, 8)`. Twelve Data quote/history fixtures use decimal strings; the adapter stores a normalized decimal string without inventing extra precision. Yahoo still delivers IEEE-754 closes when probed. Transaction `amount_minor` remains bigint.

## Identity validation before persist

The Edge Function refuses to upsert when:

- the mapping is missing or inactive
- the provider symbol is not the exact approved mapping (Marketstack: allowlist only; no bare ticker)
- `/funds?isin=` returns a different `0P000*` than the mapping (Twelve Data only; Marketstack never resolves)
- quote/history symbol does not match the mapping
- an explicit provider currency is not the target currency (`EUR` for the five ETFs, `NOK` for the funds)
- price is missing, non-positive, or non-finite
- the date is malformed or in the future
- Marketstack close is outside the wide approved magnitude band
- the latest observation is older than 30 days (obviously stale / malformed)

A failed instrument does not delete or overwrite other instruments' valid rows. Bad payloads never become null prices.

## Historical backfill

`{"backfill":true}` stores returned daily bars only. No interpolation. No inception crawl.

Marketstack backfill requests `/v2/eod` for the last 365 UTC days, `limit=1000`. Twelve Data still uses `/time_series?interval=1day&outputsize=1500` when that path is later activated.

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

Without the selected provider key (`TWELVE_DATA_API_KEY` or `MARKETSTACK_API_KEY`), the function returns `503 missing_provider_key` and writes nothing.

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
| `provider` | `marketstack`, `twelve_data`, or `yahoo_unofficial` |
| `freshness` | `fresh`, `stale`, or `unavailable` |

`fresh` means the as-of date is on or after the previous weekday minus a 3-day holiday buffer. Missing or future dates are `unavailable`. This metadata is not wired into Home/Club UI in this pass.

## Quantity and valuation

**Standard V1 Investment Day is amount-only.** The member confirms “I've invested.” Quantity is not required. `confirm_investment_day_v1` writes the planned NOK contribution with `quantity = null`.

Exact holdings are an **optional** later path. `confirm_investment_day_v2` can fill member-reported quantity on those rows. Quantity is never inferred from a later Marketstack close. `amount / latest price` is forbidden.

Confidence states (product, not extra schema):

| State | Meaning | V1 |
| --- | --- | --- |
| Reported contribution | Member said they invested the planned amount | Standard confirm |
| Estimated / modelled holding | Synthetic reference quantity from amount + Investment Day FX + Investment Day close | Implemented. Never stored as `quantity` |
| Exact member-reported holding | Member entered actual units | Optional. Not verified |
| Broker-verified holding | Broker evidence | Reserved enum only |

Reported amount ≠ actual security quantity. Estimated/modelled quantity ≠ owned quantity. Exact member-reported quantity ≠ broker-verified quantity.

`quantity` is `numeric(28, 8)` and nullable.

`unit_price_minor` stays unused on the ETF path. EUR execution prints such as IS3N `47.534` cannot be stored in integer øre without losing precision. Optional execution price uses `execution_unit_price numeric(20, 8)` plus server-set `execution_unit_price_currency` from the target (EUR).

Current value is computed only in `member_position_valuations_v1`:

```text
current_value = total_quantity × latest_marketstack_close
```

Rules:

- Active Marketstack mapping only
- Latest `price_type = close`
- Freshness must be `fresh`
- Quantity coverage must be `complete`
- Result currency is the instrument currency (EUR)
- Missing quantity, partial quantity, missing price, or stale price → current value unavailable
- No demo prices
- No guessed FX

**EUR/NOK FX is implemented from Norges Bank.** See the FX section below. Club/Home NOK totals for curated V1 ETF clubs are estimated from reported contributions, reference FX, and Marketstack closes. Legacy KLP/DNB clubs stay demo/unavailable.

Cost basis remains the reported NOK invested amount. If both quantity and execution unit price are present, `quantity × execution_unit_price` is an optional instrument-currency execution cost, not a replacement for contribution cost basis.

Valuation states:

- `available` — complete quantity and a fresh allowlisted Marketstack close
- `quantity_incomplete` — null or partial quantity; show invested amount only
- `no_mapping` / `no_price` / `price_not_fresh` / `currency_mismatch` — quantity may exist; current value stays hidden

Club/Home headlines for curated V1 ETF clubs use the member's own estimated NOK portfolio. Club-wide monetary total and history RPCs are not exposed to authenticated clients; the old three-contributor threshold was removed because it did not protect Flexible amounts from inference. Legacy KLP/DNB clubs remain unavailable to the valuation model.

## EUR/NOK FX (Norges Bank)

Authoritative daily EUR/NOK middle rates come from Norges Bank's open data API (`EXR/B.EUR.NOK.SP`). No API key. License: [Norwegian Licence for Open Government Data (NLOD) 2.0](https://data.norge.no/nlod/en/2.0). Attribution: contains data under NLOD distributed by Norges Bank.

| Topic | Rule |
| --- | --- |
| Convention | A stored rate `R` means **1 EUR = R NOK**. Never invert. |
| Frequency | Business-day middle rates, published about 16:00 CET. Indicative, not binding on Norges Bank. |
| Weekends / holidays | No row is stored. Do not fabricate prints. |
| Historical coverage | Official series goes back decades. Vesty backfills about one UTC year, same window as Marketstack. |
| Fallback | For a date with no print, use the most recent prior rate within **10 calendar days**. Never a future rate. Outside the window → unavailable. |
| Freshness | Same weekday + holiday buffer as `market_nav_freshness_v1`. |
| Writes | Clients have SELECT only. Ingest is `sync-fx-rates` with the secret key. |

```sh
curl -sS -X POST "$SUPABASE_URL/functions/v1/sync-fx-rates" \
  --header "apikey: $SUPABASE_SECRET_KEY" \
  --header "Content-Type: application/json" \
  --data '{}'

curl -sS -X POST "$SUPABASE_URL/functions/v1/sync-fx-rates" \
  --header "apikey: $SUPABASE_SECRET_KEY" \
  --header "Content-Type: application/json" \
  --data '{"backfill":true}'
```

## Modelled quantity and NOK valuation

Amount-only lots derive a **modelled** reference quantity. This is not ownership and is never written to `member_investment_transactions.quantity`.

Reference date = `investment_cycles.investment_day_at` in the cycle timezone (`Europe/Oslo` by default). Not confirmation time (`executed_at`) and not today.

```text
modelled_quantity = (amount_minor / 100) / EURNOK_on_or_before(reference_date) / ETF_close_on_or_before(reference_date)
```

Reference ETF price is the allowlisted Marketstack EOD close on that date, else the nearest prior close within 10 calendar days. No interpolation. No future close. Missing inputs → that lot is unavailable.

Exact member-reported `quantity` takes precedence for that lot. The lot is not also modelled. No double count.

Lot current NOK value:

```text
lot_quantity × latest_fresh_EUR_close × latest_fresh_EURNOK
```

`lot_quantity` is exact quantity when present, otherwise modelled quantity.

Position / portfolio confidence:

| Confidence | Meaning |
| --- | --- |
| `exact` | Every valued lot has member-reported quantity |
| `estimated` | Every valued lot uses modelled quantity |
| `mixed` | Some exact, some estimated |
| `unavailable` | A lot is missing FX or a reference close, or latest marks are not fresh |

Value and gain/loss are exposed only when every lot in the aggregate can be valued. Invested NOK is always the sum of reported `amount_minor`.

```text
gain_loss_nok = estimated_current_value_nok − (invested_minor / 100)
gain_loss_bps = round(gain_loss_nok / (invested_minor / 100) × 10000)
```

UI labels: Estimated / Based on reported holdings / Partly estimated. Never Verified, Exact, or Broker confirmed unless a broker verification path exists.

## Historical chart

`member_portfolio_history_v1` returns weekly points (default 7-day step):

- Invested = cumulative reported NOK for lots whose Investment Day is on or before the point
- Value = those lots' quantity (exact or modelled) × that date's (or prior) ETF close × that date's (or prior) EUR/NOK
- A contribution does not appear on earlier points
- Today's FX or close is never applied backward
- If any included lot cannot be valued on that date, the value is omitted (gap)

Home/Club charts for curated clubs use this series. Legacy clubs do not.

## Tests

- `supabase/tests/market_data_v1.test.sql`
- `supabase/tests/quantity_valuation_v1.test.sql`
- `supabase/tests/fx_portfolio_modelling_v1.test.sql`
- `pnpm test:market-data` — Marketstack, Twelve Data, and Yahoo parser/adapter fixtures, no live provider network
- `pnpm test:fx` — Norges Bank SDMX parser/adapter fixtures, no live provider network
