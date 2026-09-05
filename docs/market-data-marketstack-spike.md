# Marketstack coverage spike (2026-09-05)

Technical coverage spike only. Marketstack was **not** added to `provider.ts`, `sync-market-data`, `market_data_instrument_mappings`, or `market_prices`. The key stayed in untracked `supabase/functions/.env` and was never printed.

This spike evaluates Marketstack for Vesty V1 **listed** instruments: US/European/Oslo stocks and UCITS ETFs, EOD + history. Real-time is not required. Norwegian mutual-fund NAV was out of scope.

## Recommendation

**B) US / LIMITED SECONDARY PROVIDER**

US EOD and one-year history still stand from the free-tier spike. The Basic retest shows that **some** Europe/Oslo/UCITS symbols work if the suffix is chosen carefully (`DNB.OL`, `KOG.OL`, `MOWI.OL`, `EQNR.OL`, `NOVO-B.CO`, `SXR8.DE`, `VWCE.DE`). That is not enough for a primary V1 adapter.

`EQNR.XOSL` still returns the NYSE ADR print (42.09) labeled `NOK` / `XOSL`. Yahoo `EQNR.OL` closed **393.60 NOK** on 2026-09-04. Oslo MIC-suffixed data is therefore unreliable. `ASML.XAMS` latest EUR matches Amsterdam, but its 10-day history mixes NASDAQ USD bars into the same series. `price_currency` is sometimes wrong (`CSPX.L` = GBP vs Yahoo USD) or missing, and `EQQQ.L` is pence labeled as GBP.

Do not build the Marketstack adapter now. Do not activate mappings. Do not write these values into `market_prices`.

## Coverage scores

Revised after the Basic retest (US rows unchanged from the free-tier spike):

| Category | PASS | PARTIAL | FAIL | Score |
| --- | ---: | ---: | ---: | ---: |
| Overall | 11 | 4 | 2 | **11/17 PASS** |
| US equities | 7 | 0 | 0 | **7/7 PASS** |
| European equities | 1 | 1 | 0 | **1/2 PASS** |
| Oslo equities | 3 | 0 | 1 | **3/4 PASS** (`.OL` only; `EQNR.XOSL` FAIL) |
| UCITS ETFs | 2 | 2 | 0 | **2/4 PASS** |

Oslo PASS counts `DNB.OL`, `KOG.OL`, and `MOWI.OL`. Equinor is FAIL on the requested `EQNR.XOSL` symbol even though `EQNR.OL` is a correct NOK series.

## Coverage table

| Instrument | Requested identity | Marketstack symbol | Exchange/MIC | Currency | Latest EOD | Historical coverage | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NVIDIA | NVIDIA — NVDA | `NVDA` | NASDAQ - ALL MARKETS / `XNAS` | not on ticker; v2 EOD uses `price_currency` (not persisted on this US pull) | 230.36 as-of 2026-09-04 | 252 bars, 2025-09-05 → 2026-09-04 | PASS | Direct `/v2/tickers/NVDA`. v2 `/tickers?search=` is 404. |
| Apple | Apple — AAPL | `AAPL` | NASDAQ - ALL MARKETS / `XNAS` | same | 319.97 as-of 2026-09-04 | 252 bars, 2025-09-05 → 2026-09-04 | PASS | Ticker ISIN `US0378331005`. `/tickerinfo` `reporting_currency` was null. |
| Microsoft | Microsoft — MSFT | `MSFT` | NASDAQ - ALL MARKETS / `XNAS` | same | 499.7 as-of 2026-09-04 | 252 bars, 2025-09-05 → 2026-09-04 | PASS | |
| Tesla | Tesla — TSLA | `TSLA` | NASDAQ - ALL MARKETS / `XNAS` | same | 354.08 as-of 2026-09-04 | 252 bars, 2025-09-05 → 2026-09-04 | PASS | |
| Meta | Meta — META | `META` | NASDAQ - ALL MARKETS / `XNAS` | same | 616.77 as-of 2026-09-04 | 252 bars, 2025-09-05 → 2026-09-04 | PASS | |
| Amazon | Amazon — AMZN | `AMZN` | NASDAQ - ALL MARKETS / `XNAS` | same | 258.51 as-of 2026-09-04 | 252 bars, 2025-09-05 → 2026-09-04 | PASS | |
| Alphabet | Alphabet — GOOGL | `GOOGL` | NASDAQ - ALL MARKETS / `XNAS` | same | 338.46 as-of 2026-09-04 (EOD `dividend` 0.22) | 252 bars, 2025-09-05 → 2026-09-04 | PASS | Class A listing, as requested. |
| ASML | ASML | `ASML` (live EOD); catalog also `ASML.XAMS`, `ASML.AS` | Live EOD was `XNAS`. Home listing catalogued on Euronext Amsterdam / `XAMS` | same | US ADR 1714.88 as-of 2026-09-04 | 252 US bars | PARTIAL | Bare `ASML` is the NASDAQ ADR. `ASML.XAMS` has `has_eod=true` but was not in the 2-row MIC EOD response. |
| Novo Nordisk | Novo Nordisk | none | none | none | none | none | FAIL | `/v2/tickers/NOVO-B` 404. Copenhagen search hit `usage_limit_reached` before a XCSE symbol was confirmed. |
| Equinor ASA | Equinor ASA — prefer `EQNR.XOSL` | `EQNR.XOSL` (also `EQNR.OL` on XOSL; bare `EQNR` is NYSE) | Catalog: Oslo Børs / `XOSL`. Bare `EQNR` is NYSE / `XNYS` | v2 EOD `price_currency=NOK` on `EQNR.XOSL` | `EQNR.XOSL` close 42.09 as-of 2026-09-04. NYSE `EQNR` close also 42.09 the same day | NYSE: 252 bars. XOSL history not fetched (quota) | PARTIAL | Oslo listing exists and `has_eod=true`. The XOSL print matches the NYSE ADR close exactly and is not a trusted NOK Oslo price. |
| DNB Bank ASA | DNB Bank ASA — actual XOSL listing | Catalog `DNB.OL` (name `DNB Bank ASA`); v1 also `DNB.XOSL` (name `DNB ASA`) | Oslo Børs / `XOSL` | not retrieved on EOD | not retrieved | not retrieved | PARTIAL | Catalog + `has_eod=true`. Bare `/tickers/DNB` is Dun & Bradstreet on NYSE. Live EOD used `DNB.XOSL` in a batch that did not return this symbol, then quota died. |
| Kongsberg Gruppen ASA | Kongsberg Gruppen ASA | Catalog `KOG.OL` | Oslo Børs / `XOSL` | not retrieved on EOD | not retrieved | not retrieved | PARTIAL | Catalog + `has_eod=true`. `/v2/tickers/KOG` → `the_requested_data_is_not_available` on V2. Live EOD for `KOG.XOSL` not returned. |
| Mowi ASA | Mowi ASA | Catalog `MOWI.OL` (also empty-name `MOWIO.OL`) | Oslo Børs / `XOSL` | not retrieved on EOD | not retrieved | not retrieved | PARTIAL | Catalog + `has_eod=true`. `/v2/tickers/MOWI` 404. Live EOD for `MOWI.XOSL` not returned. |
| CSPX | CSPX | Catalog `CSPX.L` | London Stock Exchange / `XLON` | not retrieved on EOD | not retrieved | not retrieved | PARTIAL | Name `iShares VII PLC - iShares Core S&P 500 UCITS E`, `has_eod=true`. First `/tickerslist` hit was unrelated `CSPX.CL` on XBOG. `CSPX.XLON` EOD not returned. |
| SXR8 | SXR8 | none confirmed | none | none | none | none | FAIL | `/v2/tickers/SXR8` 404, then quota. |
| VWCE | VWCE | none confirmed | none | none | none | none | FAIL | `/v2/tickers/VWCE` 404, then quota. |
| EQQQ | EQQQ | none confirmed | none | none | none | none | FAIL | v2 search route 404; direct ticker not resolved; later searches 429. |

Oslo PASS requires an XOSL/Oslo listing with a plausible live EOD. Catalog-only rows and the Equinor XOSL/NYSE price collision stay PARTIAL.

## Endpoints tested

Base used successfully: `https://api.marketstack.com/v2` (v1 still answers some ticker-search routes).

| Endpoint | Result |
| --- | --- |
| `GET /v2/eod/latest?symbols=` | Works for US symbols and `EQNR.XOSL`. Returns `close`, `adj_close`, `split_factor`, `dividend`, `exchange`, `price_currency`, `date`. |
| `GET /v2/eod?symbols=&date_from=&date_to=&limit=&sort=` | Works for US symbols. 252 daily bars over ~1 year on this plan. |
| `GET /v2/eod?offset=10` | Pagination works (`limit` / `offset` / `count` / `total`). |
| `GET /v2/tickers/{symbol}` | Works for US tickers. Bare European/Oslo/ETF symbols 404 or resolve the US name. |
| `GET /v2/tickers?search=` | **404 `not_found_error` / `Route not found`.** Do not use this on v2. |
| `GET /v2/tickerslist?search=` | Works. Returns `ticker`, `name`, `stock_exchange.mic`, `has_eod`. First hit is often a US or unrelated listing. |
| `GET /v2/exchanges/XOSL` | Works. Name `OSLO BORS`. |
| `GET /v2/exchanges/{MIC}/tickers` | Works. Nested `tickers[]`. XOSL `total=599`. XAMS search returned `ASML.XAMS` and `ASML.AS`. XLON search returned `CSPX.L`. |
| `GET /v2/tickerinfo?ticker=AAPL` | Works. Company profile. `reporting_currency` was null. |
| `GET /v2/splits?symbols=AAPL` | Works. AAPL 4-for-1 on 2020-08-31. |
| `GET /v2/dividends?symbols=AAPL` | Works. 11 rows from 2024-01-01 (sample 0.26–0.27 quarterly). |
| `GET /v1/tickers?search=` | Works (v2 search does not). `DNB` + `exchange=XOSL` → `DNB.XOSL`. |
| `GET /v1/eod/latest` | Hit `429 usage_limit_reached` on this key. |

## Request count

| Wave | HTTP calls | Billed units (1 per `symbols` entry, else 1) |
| --- | ---: | ---: |
| Identity + US EOD/history + AAPL splits/dividends/pagination | 76 | 76 |
| v2 tickerslist / exchange tickers / MIC-suffixed EOD batch | 14 | 28 |
| XOSL full ticker dump + later searches | 18 | 18 |
| **Total** | **108** | **122** |

Marketstack documents that each symbol in `symbols` consumes one request. The 11-symbol `/v2/eod/latest` batch counted as 11 units and returned only 2 rows (`EQNR.XOSL` plus one unpersisted row). Shortly after that, the key returned:

```text
429 usage_limit_reached
Your monthly usage limit has been reached. Please upgrade your Subscription Plan.
```

That matches the published Free plan (100 requests / month, 1 year history). Some metadata calls still succeeded after the first 429; most subsequent calls did not.

## Response semantics

| Topic | Observation |
| --- | --- |
| `close` vs `adj_close` | Both present on v2 EOD. Equal across the US 1-year window (no split in range). Adjustments follow Marketstack’s CRSP-style `adj_*` fields. |
| Splits | EOD `split_factor` (1.0 on recent bars). Dedicated `/splits` returned AAPL 2020-08-31 factor 4.0. |
| Dividends | EOD `dividend` on the bar (GOOGL latest 0.22; several US names had 4–6 non-zero dividend days in the year). Dedicated `/dividends` returned dated cash amounts. |
| Pagination | `pagination.limit/offset/count/total`. AAPL history `total=252`. `offset=10` returned 2026-08-21 first. Default page size 100, request used up to 1000. |
| Request counting | One HTTP call can bill many units. Failed/empty MIC symbols in a batch still appear to consume units. |
| History range | Free plan delivered ~1 trading year (252 sessions) when `date_from=2025-09-04`. |
| Currency | Not on `/tickers` list objects. v2 EOD includes `price_currency` (seen `NOK` on `EQNR.XOSL`). `/tickerinfo` `reporting_currency` was null for AAPL. |
| Symbol suffixes | Inconsistent: `.XOSL` and `.OL` on Oslo, `.XAMS` / `.AS` on Amsterdam, `.L` on London. Bare tickers default to US. |
| Intraday | `has_intraday=false` on the Oslo/Amsterdam/London tickers inspected. Not required for V1. |

## Plan restrictions and API errors

| Code | Where | Meaning for Vesty |
| --- | --- | --- |
| `not_found_error` / `Route not found` | `GET /v2/tickers?search=` | v2 search is `/tickerslist`, not `/tickers`. |
| `not_found_error` / `Not Found` | `/v2/tickers/NOVO-B`, `/MOWI`, `/CSPX`, `/SXR8`, `/VWCE` | Bare or guessed symbols are not enough. |
| `the_requested_data_is_not_available` / “not available in the V2 endpoint” | `/v2/tickers/DNB`, `/v2/tickers/KOG` | Those bare symbols are not on v2; Oslo forms are `DNB.OL` / `KOG.OL`. |
| `usage_limit_reached` HTTP 429 | After ~100 billed units | This key is Free-plan sized. Production sync cannot run here. |
| Commercial use | Pricing page | Free lists no commercial use. **Basic ($9.99/mo)** is the first plan that lists Commercial Use, 10k requests/mo, 10-year history. Not a legal review. |

HTTPS worked. No `https_access_restricted` or `function_access_restricted` on the EOD/history routes that succeeded.

## Suitability as Vesty’s first production-oriented provider

**Not as primary. Basic did not clear Europe/Oslo/UCITS.**

What is usable:

- US common-stock EOD + ~1 year of history (free-tier proof)
- Oslo `.OL` NOK prints for DNB, Kongsberg, Mowi, and Equinor, matching Yahoo on the as-of date
- Copenhagen `NOVO-B.CO` and Xetra `SXR8.DE` / `VWCE.DE` latest prints matching Yahoo

What still blocks a primary adapter:

- `EQNR.XOSL` is a confirmed ADR clone labeled as Oslo NOK
- `ASML.XAMS` history mixes NASDAQ USD bars
- `price_currency` can be wrong or missing (CSPX, EQQQ, SXR8, VWCE)
- `.OL` latest can be one session behind Yahoo
- Norwegian TestFlight funds were not in this spike

Keep `MARKET_DATA_PROVIDER=twelve_data`. Do not activate Marketstack mappings. Do not write these prints into `market_prices`.

## Basic paid-plan retest

Focused retest on 2026-09-05 after Basic was enabled. Free-tier US work was not repeated. **12 HTTP calls / 29 billed units.** No `usage_limit_reached`, `function_access_restricted`, or HTTPS block.

Endpoints used: `GET /v2/eod/latest`, `GET /v2/eod` (`date_from=2026-08-20`, `date_to=2026-09-05`), `GET /v2/exchanges/XOSL/tickers?search=DNB`, `GET /v2/exchanges/XCSE/tickers?search=NOVO`, `GET /v2/tickerslist?search=`, `GET /v2/tickers/EQNR.XOSL`.

Independent checks: Yahoo Finance quote pages (2026-09-05) plus EODData Oslo history for Equinor.

### EQNR.XOSL vs NYSE ADR (required check)

| Field | `EQNR.XOSL` (Marketstack) | `EQNR` NYSE (Marketstack) | `EQNR.OL` (Marketstack) | Independent |
| --- | --- | --- | --- | --- |
| As-of | 2026-09-04 | 2026-09-04 | 2026-09-03 | Yahoo `EQNR.OL` close **2026-09-04 = 393.60 NOK** (prev 400.80). NYSE ADR 2026-09-04 = **42.09 USD** |
| OHLC | 42.66 / 42.80 / 41.98 / **42.09** | 42.66 / 42.80 / 41.98 / **42.09** | 400.8 close | Yahoo prev close 400.80 NOK |
| Volume | 2,828,700 | 2,827,385 | — | Yahoo Oslo Sep 4 volume 2,154,657 |
| Currency | `NOK` | `USD` | `NOK` | Oslo is NOK; ADR is USD |
| Exchange | `XOSL` | `XNYS` | `XOSL` | Oslo vs NYSE |

`EQNR.XOSL` is the US ADR series with the currency and MIC relabeled. That bug survived the Basic upgrade. **Oslo data addressed by MIC suffix is unreliable.** Use `EQNR.OL` only if a later adapter is ever considered, and still validate NOK magnitude (~400, not ~42).

`EQNR.OL` history 2026-08-20…09-03 matches EODData Oslo closes (401.8, 399.1, 394.8, 389.9, 387.6, 384.0, 386.4, 399.4, 405.4).

### Retest table

| Instrument | Endpoint used | Symbol | Exchange/MIC | Currency | Latest EOD | Independent reference | Historical data | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Equinor ASA | `/v2/eod/latest`, `/v2/eod` | `EQNR.XOSL` | XOSL | `NOK` (false) | 42.09 on 2026-09-04 | Yahoo Oslo 393.60 NOK on 2026-09-04; NYSE ADR 42.09 USD | 11 bars, all ~41–44 | **FAIL** | ADR clone. Do not ingest. |
| Equinor ASA (disambiguation) | `/v2/eod/latest`, `/v2/eod` | `EQNR.OL` | XOSL | `NOK` | 400.8 on 2026-09-03 | Yahoo prev close 400.80; EODData history matches | 11 bars, 384.0–405.8 NOK | PASS as `.OL` only | One session behind Yahoo’s Sep 4 close (393.60). |
| DNB Bank ASA | `/v2/eod/latest`, `/v2/eod`, `/v2/exchanges/XOSL/tickers?search=DNB` | `DNB.OL` | XOSL | `NOK` | 318.9 on 2026-09-03 | Yahoo prev close 318.90; Sep 4 close 320.20 | 11 bars, 309.2–319.8 NOK | **PASS** | Catalog name `DNB Bank ASA`, `has_eod=true`. Latest is Sep 3, not Sep 4. |
| Kongsberg Gruppen ASA | `/v2/eod/latest`, `/v2/eod` | `KOG.OL` | XOSL | `NOK` | 307.2 on 2026-09-03 | Yahoo prev close 307.20; Sep 4 close 308.40 | 11 bars, 307.2–321.1 NOK | **PASS** | Correct Oslo NOK. Latest one session stale. |
| Mowi ASA | `/v2/eod/latest`, `/v2/eod` | `MOWI.OL` | XOSL | `NOK` | 200.6 on 2026-09-03 | Yahoo prev close 200.60; Sep 4 close 201.80 | 11 bars, 197.4–211.6 NOK | **PASS** | Correct Oslo NOK. Latest one session stale. |
| ASML Holding | `/v2/eod/latest`, `/v2/eod` | `ASML.XAMS` | XAMS | `EUR` on latest | 1467.4 on 2026-09-04 | Yahoo `ASML.AS` 1,467.40 EUR; open 1,425; range 1,419.40–1,482.80; volume 436,091 — exact match | 12 bars: **mixed**. Several days are NASDAQ USD (~1646–1763) tagged `XAMS` | **PARTIAL** | Latest Amsterdam print is correct. History is not a clean EUR series. |
| Novo Nordisk | `/v2/exchanges/XCSE/tickers?search=NOVO`, `/v2/eod/latest`, `/v2/eod` | `NOVO-B.CO` | XCSE | `DKK` | 301.55 on 2026-09-03 | Yahoo `NOVO-B.CO` prev close 301.55 DKK; Sep 4 close 298.90. Not the US ADR | 11 bars, 292.4–307.8 DKK | **PASS** | Primary Copenhagen B share. Latest one session stale. |
| CSPX | `/v2/eod/latest`, `/v2/eod` | `CSPX.L` | XLON | `GBP` (Yahoo says **USD**) | 835.39 on 2026-09-03 | Yahoo `CSPX.L` USD Acc, prev close **835.39 USD**; Sep 4 831.04 USD | 10 bars, 824.96–836.87 | **PARTIAL** | Correct iShares Core S&P 500 UCITS Acc listing and USD-scale price. `price_currency=GBP` is wrong. |
| SXR8 | `/v2/tickerslist?search=SXR8`, `/v2/eod/latest`, `/v2/eod` | `SXR8.DE` | XETR | null (price is EUR-scale) | 718.6 on 2026-09-03 | Yahoo `SXR8.DE` EUR Acc, prev close 718.60; Sep 4 715.30 | 10 bars, 707.24–721.06 | **PASS** | Primary Xetra listing of the same iShares S&P 500 UCITS Acc. Currency field missing. |
| VWCE | `/v2/tickerslist?search=VWCE`, `/v2/eod/latest`, `/v2/eod` | `VWCE.DE` | XETR | null (EUR-scale) | 168.06 on 2026-09-03 | Yahoo `VWCE.DE` 168.06 on Sep 3 (USD Acc, EUR trading) | 11 bars, 165.62–168.54 | **PASS** | Vanguard FTSE All-World UCITS ETF USD Acc on Xetra. Currency field missing. |
| EQQQ | `/v2/tickerslist?search=EQQQ`, `/v2/eod/latest`, `/v2/eod` | `EQQQ.L` | XLON | `GBP` (Yahoo **GBp**) | 53295 on 2026-09-03 | Yahoo `EQQQ.L` prev close 53,295 GBp; Sep 4 53,279 GBp | 9 bars, 52076–53574 | **PARTIAL** | Correct Invesco NASDAQ-100 UCITS LSE listing. Price is pence; labeled pounds. An adapter that trusts `GBP` would be 100× high. |

### Basic-plan notes

- Quota was no longer the blocker (10k requests/month on Basic). This retest stayed at 12 HTTP / 29 billed units.
- `.OL` Oslo latest prints were dated 2026-09-03 while Yahoo already had 2026-09-04 closes (Saturday afternoon CEST). Amsterdam `ASML.XAMS` and the false `EQNR.XOSL` print had Sep 4.
- Currency must not be trusted from `price_currency` alone.
- Do not map Oslo instruments to `*.XOSL` after the Equinor collision.

## Architecture left unchanged

`InvestmentTarget` → `market_data_instrument_mappings` → `twelve_data` / `yahoo_unofficial` dispatch → validate → `market_prices` is untouched. Temporary local probes were deleted after this report.
