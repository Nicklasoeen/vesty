# Vesty V1 curated investment packages

This is **not** personal investment advice, a suitability assessment, or a promise of returns or capital protection. Packages are curated model portfolios for a beginner-oriented product.

## Implementation status (TestFlight V1)

Approved first-TestFlight direction: ship exactly **World Mix**, **World + America**, and **Tech Forward**. **Spotlight is FUTURE** and is not in the catalog, UI, or RPC allowlist.

Implemented in this milestone (catalog + package selection only):

- Five CORE UCITS ETFs are seeded as active `investment_targets` (`31000000-0000-4000-8000-000000000011`–`015`). Official names, ISINs, Xetra tickers, and EUR currency match the confirmed table in §4. `provider_symbol` stays null.
- Canonical packages live in `private.curated_strategy_packages` / `private.curated_strategy_package_allocations`. Clients cannot read those tables.
- `public.create_club(p_name, p_governance_threshold_kind, p_package_id, p_base_currency)` resolves an allowlisted package id server-side. Callers cannot supply allocations.
- Create Club is **Name → Governance → Investment style → Review → Create**. The client sends the stable id (`world_mix`, `world_america`, `tech_forward`), never a display name.
- UI copy uses relative language (broadest mix / more US / more tech). No Low/Medium/High risk, Recommended, Safe, or projected returns.
- Legacy KLP/DNB fixture targets (`…000001`–`004`) stay active. Existing StrategyVersion snapshots are not rewritten.

Also shipped:

- Marketstack EOD ingest for the five allowlisted mappings (`VWCE.DE`, `EUNK.DE`, `IS3N.DE`, `SXR8.DE`, `SXRV.DE`).
- Standard Investment Day is amount-only: open broker, then “I've invested.”
- Optional exact holdings via `confirm_investment_day_v2` after completion.
- Position-level EUR current value only when the member later adds exact units.
- Norges Bank EUR/NOK FX, modelled reference quantity for amount-only lots, and estimated NOK Home/Club totals for curated ETF clubs.

Still not shipped:

- Spotlight, sliders, instrument search, broker APIs, or licensed NAV for legacy KLP/DNB funds.

Mobile display copy and target ids also live in `apps/mobile/src/features/clubs/curatedInvestmentPackages.ts`. Database rows remain authoritative for genesis allocations.

Deviations from the research draft: default Create Club highlight is **none** — the owner must choose a style. Marketstack symbols are stored on mappings, not on `investment_targets.provider_symbol`.

## 1. V1 product rationale

Vesty is a private club coordination layer, not a trading terminal. The primary user wants to start saving with friends and should not have to choose from thousands of securities.

Create Club no longer reviews a single hardcoded mix. The owner chooses one curated package. StrategyVersion 1 is the server-resolved snapshot for that package. Legacy clubs may still hold the previous four Norwegian UCITS **funds**:

| Allocation | Current genesis target |
| ---: | --- |
| 40% | KLP AksjeGlobal Indeks P |
| 30% | DNB Teknologi A |
| 15% | KLP AksjeNorge Indeks P |
| 15% | KLP AksjeFremvoksende Markeder Indeks P |

Those funds are real, NOK-denominated, and widely available in Norway. They are a poor V1 **market-data** universe: Twelve Data NAV is blocked on the current plan, Yahoo unofficial is not a production license, and Marketstack does not replace mutual-fund NAV. Domain rule 7 already requires concrete purchasable products, not labels such as “Global” or “Technology”. Early fixtures used those labels (`GLOBAL` / `TECH` / `NORWAY` / `EM`) and were later replaced by the KLP/DNB names.

The proposed V1 model keeps the same architecture:

```text
InvestmentTarget
  → market_data_instrument_mappings
  → provider adapter
  → market_prices
```

It changes **what** the catalog contains and **how** Create Club chooses a complete allocation snapshot.

Direction:

- 3 shipped packages (plus one designed, deferred Spotlight package)
- 3–4 holdings per shipped package
- 5 unique CORE securities for first TestFlight
- 3 well-known US stocks reserved for a later Spotlight package
- Broad accumulating UCITS ETFs as the core
- Listings chosen for Nordnet availability **and** verified Marketstack identity
- Currency and listing stored on the Vesty target, never inferred from a Marketstack search hit

All four packages are **equity** packages. They become more concentrated, not “safer.” None of them is a bond or cash portfolio. Do not call the broadest one low-risk or safe.

## 2. Proposed package names

Avoid Low / Medium / High Risk. Avoid Recommended / Best / Safe.

| Code | Consumer name | One sentence | Relative risk (among these packages) | Expected volatility | Time-horizon language |
| --- | --- | --- | --- | --- | --- |
| A | **World Mix** | A broad mix of companies around the world, with extra room for Europe and emerging markets. | Least concentrated of the four. Still 100% equities. | Can fall a lot in a bad year. Usually moves less violently than the later packages because it is spread across more regions. | Think in years, not months. A common starting point is 5 years or longer. |
| B | **World + America** | The world mix, with a larger slice of the biggest US companies. | More US-heavy than World Mix. | More tied to US large-cap swings than World Mix. Still diversified across hundreds of companies. | Same long-term frame as World Mix. Useful when the group wants more US exposure and understands that this is a tilt, not a guarantee. |
| C | **Tech Forward** | A world core plus a larger slice of technology and growth companies. | Higher expected swings than A and B. | Technology-heavy periods can rise and fall faster than a broad world mix. | Plan for longer patience, often 7 years or more, and for larger temporary drops. |
| D | **Spotlight** (designed, not first TestFlight) | A smaller set of well-known companies, still with a world and tech core. | Most concentrated. Company-specific risk. | Individual stocks can move much more than a fund. A bad year in one name can dominate the club result. | Only if the group accepts large swings and a 10-year-style horizon. Not the default. |

UI should present A–C as the V1 choice set. D stays in this document so the allowlist and later proposal flow are designed, not improvised.

Create Club does not pre-select a package. Relative label for World Mix is “broadest mix,” not “the right one for you.”

## 3. Package allocations

Every line is a real security. Display labels such as World or Technology are UI only.

Percentages are exact. Implementation must store integer basis points totaling `10000`.

### 3.1 World Mix

| Display concept | Security | Weight | Why it is here |
| --- | --- | --- | --- |
| World | Vanguard FTSE All-World UCITS ETF (USD) Acc — `VWCE` Xetra | 60% | One purchase covers developed and emerging companies. The beginner-readable core. |
| Europe | iShares Core MSCI Europe UCITS ETF EUR Acc — `EUNK` Xetra | 25% | Pulls the mix away from the US-heavy shape of a pure world ETF (VWCE is ~59% US as of justETF 31 Jul 2026). |
| Emerging markets | iShares Core MSCI EM IMI UCITS ETF USD Acc — `IS3N` Xetra | 15% | Extra emerging-markets sleeve so the package is not only a softer copy of VWCE. |

`6000 + 2500 + 1500 = 10000` bps.

### 3.2 World + America

| Display concept | Security | Weight | Why it is here |
| --- | --- | --- | --- |
| World | `VWCE` Xetra | 50% | Keeps a global core. |
| USA | iShares Core S&P 500 UCITS ETF USD Acc — `SXR8` Xetra | 30% | Clear, beginner-understandable US large-cap tilt. |
| Europe | `EUNK` Xetra | 10% | Keeps some non-US developed exposure. |
| Emerging markets | `IS3N` Xetra | 10% | Keeps emerging markets visible instead of disappearing into the world ETF. |

`5000 + 3000 + 1000 + 1000 = 10000` bps.

### 3.3 Tech Forward

| Display concept | Security | Weight | Why it is here |
| --- | --- | --- | --- |
| World | `VWCE` Xetra | 40% | Still a diversified core so this is not a single-theme product. |
| Technology | iShares NASDAQ 100 UCITS ETF USD Acc — `SXRV` Xetra | 35% | The growth/tech tilt. Nasdaq-100 is more concentrated than a world or S&P 500 fund. |
| USA | `SXR8` Xetra | 15% | Broad US large-cap alongside the Nasdaq sleeve. |
| Emerging markets | `IS3N` Xetra | 10% | Avoids making the package US-tech only. |

`4000 + 3500 + 1500 + 1000 = 10000` bps.

### 3.4 Spotlight (designed, FUTURE)

| Display concept | Security | Weight | Why it is here |
| --- | --- | --- | --- |
| World | `VWCE` Xetra | 25% | A remaining diversified core. |
| Technology | `SXRV` Xetra | 25% | Broader tech than three single names. |
| NVIDIA | NVIDIA Corporation — `NVDA` Nasdaq | 20% | Recognizable growth company. High company-specific risk. |
| Apple | Apple Inc. — `AAPL` Nasdaq | 15% | Recognizable company. Different business mix than NVIDIA. |
| Microsoft | Microsoft Corporation — `MSFT` Nasdaq | 15% | Recognizable company. Different business mix than NVIDIA and Apple. |

`2500 + 2500 + 2000 + 1500 + 1500 = 10000` bps.

Do not ship Spotlight in the first TestFlight unless product explicitly wants to teach single-stock risk immediately. The three stocks are researched so they can be added later without a new universe hunt.

## 4. Candidate instrument research

Sources used: Nordnet.no product pages, BlackRock product/factsheet pages, justETF profiles, Vanguard listing data, prior Marketstack spike notes. Identifiers that were not confirmed from those sources are left blank.

| Official / listing name | Type | Ticker | Exchange | MIC | Trading currency | Fund / share-class currency | ISIN | Acc / Dist | UCITS | Marketstack symbol | Package role | Reused |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Vanguard FTSE All-World UCITS ETF - (USD) Acc | ETF | VWCE | Xetra | XETR | EUR | USD Acc | IE00BK5BQT80 | Accumulating | Yes | `VWCE.DE` | World core | A, B, C, D |
| iShares Core MSCI Europe UCITS ETF EUR (Acc) | ETF | EUNK | Xetra | XETR | EUR | EUR Acc | IE00B4K48X80 | Accumulating | Yes | `EUNK.DE` | Europe sleeve | A, B |
| iShares Core MSCI EM IMI UCITS ETF USD (Acc) | ETF | IS3N | Xetra | XETR | EUR | USD Acc | IE00BKM4GZ66 | Accumulating | Yes | `IS3N.DE` | Emerging markets | A, B, C |
| iShares Core S&P 500 UCITS ETF USD (Acc) | ETF | SXR8 | Xetra | XETR | EUR | USD Acc | IE00B5BMR087 | Accumulating | Yes | `SXR8.DE` | US large cap | B, C |
| iShares NASDAQ 100 UCITS ETF USD (Acc) | ETF | SXRV | Xetra | XETR | EUR | USD Acc | IE00B53SZB19 | Accumulating | Yes | `SXRV.DE` | Tech / growth | C, D |
| Apple Inc. | Stock | AAPL | Nasdaq | XNAS | USD | n/a | US0378331005 | n/a | n/a | `AAPL` | Spotlight name | D only |
| NVIDIA Corporation | Stock | NVDA | Nasdaq | XNAS | USD | n/a | *not stored in this pass* | n/a | n/a | `NVDA` | Spotlight name | D only |
| Microsoft Corporation | Stock | MSFT | Nasdaq | XNAS | USD | n/a | *not stored in this pass* | n/a | n/a | `MSFT` | Spotlight name | D only |

ISIN notes:

- ETF ISINs are the Irish accumulating share classes confirmed on Nordnet (VWCE), BlackRock (SXR8, SXRV), and justETF (EUNK, IS3N, VWCE). Confirm the BlackRock KID for IS3N/EUNK again before writing them into `investment_targets`.
- `AAPL` ISIN `US0378331005` was returned by Marketstack `/tickerinfo` in the earlier spike. Reconfirm from an Apple/SEC source before treating it as catalog identity.
- `NVDA` and `MSFT` ISINs were **not** captured from an issuer page in this research. Leave them null until confirmed.

Same share class, other listings (do **not** mix into Vesty identity):

| Share class | Other common tickers | Why Vesty should not use them in V1 |
| --- | --- | --- |
| VWCE Acc | `VWRA` LSE USD, `VWRP` LSE GBP, `VWCE` Amsterdam | London units/currency are easy to mis-handle. Xetra `VWCE.DE` already verifies. |
| S&P 500 Acc | `CSPX` LSE USD | Marketstack `CSPX.L` labeled the USD price as GBP. |
| Nasdaq-100 Acc | `CNDX` Amsterdam, `EQQQ` LSE | `EQQQ.L` is pence labeled as GBP. |
| Europe Acc | `IMAE` Amsterdam, `SMEA` LSE | Prefer the Xetra `EUNK.DE` series that verified cleanly. |
| EM IMI Acc | `EIMI` LSE USD, `EMIM` Amsterdam | Prefer `IS3N.DE`. |

## 5. Broker availability matrix

Do not assume a global ETF is available to a Norwegian retail customer. Where a public product page was found, the row is YES. Where the broker generally trades the asset class but no ISIN page was found, the row is UNKNOWN.

| Instrument | Nordnet | DNB | Other Norwegian notes |
| --- | --- | --- | --- |
| VWCE Xetra | **YES** — [nordnet.no VWCE](https://www.nordnet.no/market/etfs/17086750-vanguard-ftse-all-world?details). ISIN IE00BK5BQT80, accumulating, UCITS, Xetra listing in the slug (`vwce-xeta`). ~10,673 Nordnet owners on 2026-09-05. | UNKNOWN. DNB [documents ETF trading](https://www.dnb.no/markets/aksjer/borshandlede-fond-etf/etf) via aksjehandel + international exchanges / VP Utland. No public per-ISIN confirmation found. | Kron / SpareBank 1: UNKNOWN. Those apps are more fund-shelf than Xetra ETF shelf. |
| EUNK Xetra | **YES** — [nordnet.no EUNK](https://www.nordnet.no/etf/liste/i-shares-core-msci-europe-eunk-xeta). Acc, Xetra. | UNKNOWN (same DNB ETF platform caveat). | |
| IS3N Xetra | **YES** — [nordnet.no IS3N](https://www.nordnet.no/etf/liste/i-shares-core-msci-em-is3n-xeta). Acc, Xetra. | UNKNOWN | |
| SXR8 Xetra | **YES** — [nordnet.no SXR8](https://www.nordnet.no/etf/liste/i-shares-core-sp-500-sxr8-xeta). Acc, Xetra. | UNKNOWN | |
| SXRV Xetra | **YES** — [nordnet.no SXRV](https://www.nordnet.no/etf/liste/i-shares-nasdaq-100-ucits-sxrv-xeta). Acc, Xetra. Page notes some monthly-savings alternatives (`XNAS`, `LYMS`); the share class itself is listed for purchase. | UNKNOWN | |
| AAPL Nasdaq | **YES** — [nordnet.no AAPL Nasdaq](https://www.nordnet.no/aksjer/kurser/apple-aapl-xnas). | UNKNOWN. DNB aksjehandel supports US shares in general; no public AAPL product page checked. | Prefer the Nasdaq listing, not a Frankfurt/Toronto clone. |
| NVDA Nasdaq | **YES** — [nordnet.no NVDA Nasdaq](https://www.nordnet.no/aksjer/kurser/nvidia-nvda-xnas). Nordnet also lists other venues (`nvda-xtse`, `nvd-xetb`). Vesty must specify Nasdaq. | UNKNOWN | |
| MSFT Nasdaq | **YES** — [nordnet.no MSFT Nasdaq](https://www.nordnet.no/aksjer/kurser/microsoft-msft-xnas). | UNKNOWN | |

V1 broker stance:

- Nordnet is the verified primary path for every CORE ETF and the three Spotlight stocks.
- DNB is **not** a blocker. Tell clubs that members may need DNB aksjehandel / VP Utland for foreign ETFs, and that Vesty has not confirmed each ISIN on DNB’s shelf.
- Current KLP/DNB **funds** remain widely available at DNB and Nordnet, but they are not in this new ETF allowlist.
- Account wrappers (ASK vs ordinary share account) and tax treatment are out of scope. Do not claim ASK eligibility in the product.

## 6. Marketstack verification

Shortlist probe on 2026-09-05. Key from `supabase/functions/.env` only.

| | |
| --- | ---: |
| HTTP calls | 5 |
| Billed units | 11 |
| Endpoints | `GET /v2/tickerslist?search=`, `GET /v2/eod/latest`, `GET /v2/eod` |
| Symbols | `EUNK.DE`, `IS3N.DE`, `SXRV.DE`, plus latest-only `VWCE.DE`, `SXR8.DE` |
| History window | 2026-08-20 → 2026-09-05 |

US stocks `AAPL`, `NVDA`, `MSFT` were not re-billed. They already passed the free-tier spike (latest + 252 daily bars, Nasdaq).

`tickerslist` first hits are **not** trustworthy (`EUNK.F` Frankfurt before `EUNK.DE`). The adapter must use the explicit allowlisted suffix.

### 6.1 Results

| Instrument | Marketstack symbol | Identity | Exchange | Currency field | Latest EOD | Independent check | History | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| VWCE | `VWCE.DE` | Vanguard FTSE All-World UCITS ETF USD Accumulation | XETR | null | 168.06 on 2026-09-03 | Yahoo `VWCE.DE` close **168.06** on 2026-09-03 | Prior Basic retest: 11 Xetra bars, 165.62–168.54 | **VERIFIED** |
| SXR8 | `SXR8.DE` | iShares Core S&P 500 UCITS ETF USD | XETR | null | 718.6 on 2026-09-03 | Yahoo `SXR8.DE` prev close **718.60** (Basic retest) | Prior Basic retest: 10 Xetra bars, 707.24–721.06 | **VERIFIED** |
| EUNK | `EUNK.DE` | iShares Core MSCI Europe UCITS ETF EUR | XETR | null | 105.5 on 2026-09-03 | Yahoo `EUNK.DE` close **105.50** EUR, volume 120,023 — exact match | 11 Xetra bars, 104.96–106.72. No mixed venue | **VERIFIED** |
| IS3N | `IS3N.DE` | iShares Core MSCI EM IMI UCITS ETF USD | XETR | null | 47.534 on 2026-09-03 | Yahoo `IS3N.DE` close **47.53** EUR, volume 99,992 | 10 Xetra bars, 46.468–47.845. Missing 2026-08-27 (Yahoo has 47.55). No mixed venue | **VERIFIED** |
| SXRV | `SXRV.DE` | iShares NASDAQ 100 UCITS ETF USD | XETR | null | 1458.0 on 2026-09-03 | Yahoo `SXRV.DE` close **1,458.00** EUR, volume 9,340 — exact match | 11 Xetra bars, 1430.4–1470.6. No mixed venue | **VERIFIED** |
| AAPL | `AAPL` | Apple | XNAS | prior spike | 319.97 on 2026-09-04 | Prior spike | 252 US bars | **VERIFIED** |
| NVDA | `NVDA` | NVIDIA | XNAS | prior spike | 230.36 on 2026-09-04 | Prior spike | 252 US bars | **VERIFIED** |
| MSFT | `MSFT` | Microsoft | XNAS | prior spike | 499.7 on 2026-09-04 | Prior spike | 252 US bars | **VERIFIED** |

VERIFIED here means: correct name, correct venue, plausible magnitude, history belongs to that listing, and an independent Yahoo Xetra/Nasdaq print matches. It does **not** mean Marketstack’s `price_currency` field is trustworthy.

### 6.2 Required adapter rules for this universe

1. Allowlist only. Never resolve by bare ticker or first `tickerslist` hit.
2. Store trading currency on `investment_targets` (`EUR` for the five Xetra ETFs, `USD` for the three Nasdaq stocks). Marketstack left `price_currency` null on every Xetra print in this probe.
3. Reject `*.XOSL`, `CSPX.L`, `EQQQ.L`, and `ASML.XAMS` if they ever appear in a future expansion.
4. Xetra latest in this probe was 2026-09-03 (Friday) when run on Saturday 2026-09-05. Treat as-of date as part of freshness, not as “live.”
5. IS3N history may skip a session. Do not invent the missing bar.
6. Commercial/display rights are still not legally reviewed. Basic lists commercial use; that is not a redistribution opinion.

For **this curated Xetra + Nasdaq allowlist**, Marketstack Basic is sufficient as a V1 EOD source. That does not overturn the earlier **B** rating for a broad Europe/Oslo/guessed-symbol universe.

## 7. Recommended allowlist

### CORE V1 (ship)

Five ETFs. Enough for three genuinely different packages.

| Field | VWCE | EUNK | IS3N | SXR8 | SXRV |
| --- | --- | --- | --- | --- | --- |
| Official name | Vanguard FTSE All-World UCITS ETF - (USD) Acc | iShares Core MSCI Europe UCITS ETF EUR (Acc) | iShares Core MSCI EM IMI UCITS ETF USD (Acc) | iShares Core S&P 500 UCITS ETF USD (Acc) | iShares NASDAQ 100 UCITS ETF USD (Acc) |
| Type | ETF | ETF | ETF | ETF | ETF |
| Ticker | VWCE | EUNK | IS3N | SXR8 | SXRV |
| Exchange | Xetra | Xetra | Xetra | Xetra | Xetra |
| MIC | XETR | XETR | XETR | XETR | XETR |
| Currency | EUR | EUR | EUR | EUR | EUR |
| ISIN | IE00BK5BQT80 | IE00B4K48X80 | IE00BKM4GZ66 | IE00B5BMR087 | IE00B53SZB19 |
| Nordnet | YES | YES | YES | YES | YES |
| DNB | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| Marketstack symbol | `VWCE.DE` | `EUNK.DE` | `IS3N.DE` | `SXR8.DE` | `SXRV.DE` |
| Marketstack status | VERIFIED | VERIFIED | VERIFIED | VERIFIED | VERIFIED |
| Used in packages | A B C (D) | A B | A B C | B C | C (D) |

### FUTURE (do not block TestFlight)

| Field | AAPL | NVDA | MSFT |
| --- | --- | --- | --- |
| Official name | Apple Inc. | NVIDIA Corporation | Microsoft Corporation |
| Type | Stock | Stock | Stock |
| Ticker | AAPL | NVDA | MSFT |
| Exchange | Nasdaq | Nasdaq | Nasdaq |
| MIC | XNAS | XNAS | XNAS |
| Currency | USD | USD | USD |
| ISIN | US0378331005 (reconfirm) | leave null | leave null |
| Nordnet | YES (Nasdaq page) | YES (Nasdaq page) | YES (Nasdaq page) |
| DNB | UNKNOWN | UNKNOWN | UNKNOWN |
| Marketstack symbol | `AAPL` | `NVDA` | `MSFT` |
| Marketstack status | VERIFIED | VERIFIED | VERIFIED |
| Used in packages | D | D | D |

Also FUTURE, not researched as CORE:

- A licensed Norwegian fund NAV feed if Vesty later wants KLP/DNB funds in packages.
- Bond / money-market sleeves if a genuinely lower-volatility package is added. That would be a new product, not a rename of World Mix.

### REJECTED

| Candidate | Reason |
| --- | --- |
| Generic labels `Global`, `Technology`, `Norway`, `Emerging Markets` | Not tradable instruments. Already rejected by domain rule 7. |
| KLP AksjeGlobal / Norge / Fremvoksende P, DNB Teknologi A | Real products and still fine as *funds*, but they fail the licensed NAV gate. Keep them for existing clubs; do not carry them into new package genesis. |
| `CSPX.L` | Same S&P 500 Acc share class as SXR8, worse Marketstack currency. |
| `EQQQ.L` | Pence labeled as GBP. SXRV Xetra is the Nasdaq sleeve instead. |
| `EQNR.XOSL` / Oslo MIC-suffixed guesses | Proven ADR/NOK collision. Norwegian stocks are not required. |
| `ASML.XAMS` | Mixed USD/EUR history. |
| `EXW1` / EURO STOXX 50 Dist | Too concentrated and distributing. EUNK Acc is the Europe sleeve. |
| `IWDA` / `EUNL` MSCI World | Duplicates the world role already covered by VWCE. |
| Frankfurt/Stuttgart clones (`EUNK.F`, `SXRV.F`, `NVDA` Xetra) | Same issuer, different listing. Do not let search pick them. |
| Mutual funds as Marketstack targets | Wrong product type for this provider. |

## 8. Rejected instruments and reasons

See the REJECTED table above. The important product cut is:

- **Do not wait** for Norwegian fund NAV to ship club strategy choice.
- **Do not expand** into Oslo or London listings just because the ticker exists in Marketstack.
- **Do not** put Spotlight stocks in the first TestFlight unless the team explicitly wants that education burden.

## 9. Create Club UX

Shipped flow:

```text
Name
  → Governance (unchanged, still locked)
  → Investment style (World Mix / World + America / Tech Forward)
  → Review
       - club name and currency
       - governance
       - package name and short description
       - beginner exposure labels and percentages
       - official ETF names and tickers
  → Create club
       - client sends package id
       - server writes StrategyVersion 1
       - allocations locked
```

Selecting a style expands the same exposure and holdings detail on the picker. There is no free-form allocation editor.

### Customization

**Defer allocation sliders in V1.** Beginners should not be asked to invent a 17% Europe sleeve. A slider also implies Vesty is helping them construct a personal portfolio.

If a group later wants different weights, that is a **proposal + vote + new StrategyVersion**, not a create-time editor.

Optional later escape hatch, not V1: “Suggest a change” after the club exists.

### Package change later

Matches the existing domain model. Do not add a silent rewrite path.

```text
Member proposes a different package or a custom 10000-bps snapshot
  → open vote (club governance already chosen)
  → approval creates StrategyVersion N+1
  → readiness reset for the new version
  → later cycles use the new snapshot
  → historical transactions and old versions stay untouched
```

Copy a whole package into the proposal as the default starting snapshot so clubs are not designing from a blank securities list.

### Invite / join

Invitation preview can show the **current effective package name** and the official holdings. Joining does not freeze the invited-at strategy (already a domain rule).

## 10. Data-model implications

Keep as-is:

- `InvestmentTarget` = one purchasable product (ISIN + official name + kind + currency).
- `strategy_allocations` / `strategy_proposal_allocations` = complete 10000-bps snapshots.
- `market_data_instrument_mappings` = provider symbol, not target identity.
- Multi-provider dispatch in `provider.ts`.
- Club base currency stays NOK. Instrument currency is metadata, not an FX engine.

Implemented:

1. Five CORE ETF targets with new UUIDs. The four KLP/DNB rows are unchanged and remain active for existing clubs.
2. Private package tables (`private.curated_strategy_packages`, `private.curated_strategy_package_allocations`). Display copy and exposure labels live in the mobile catalog, not as tradable entities.
3. `public.create_club` accepts `p_package_id` only. `private.resolve_curated_package_allocations` builds the allocation JSON. Unknown or inactive ids raise `vesty.invalid_package`.
4. Snapshot `target_name` / `target_kind` at allocation time (already present).
5. Marketstack mappings are seeded for the five CORE ETFs only. Approved symbols are `VWCE.DE`, `EUNK.DE`, `IS3N.DE`, `SXR8.DE`, `SXRV.DE`. The adapter never searches or guesses.
6. EUR/NOK FX is Norges Bank daily middle rates. Amount-only lots derive a modelled reference quantity from the Investment Day rate and close. That quantity is not stored as holdings. Club/Home NOK totals for curated ETF clubs are estimated. Legacy KLP/DNB stay demo/unavailable.

KLP/DNB targets stay in the catalog. New genesis no longer uses those four funds.

## 11. Regulatory / wording considerations

Not a legal memo. Product copy risks:

| Avoid | Why | Prefer |
| --- | --- | --- |
| Low risk / safe / protected / guaranteed | These packages are 100% equities. Capital can fall a lot. | Broader mix, more concentrated, higher expected swings |
| Recommended / best / optimal / smartest | Sounds like personalized advice | World Mix is the broadest starting point |
| This package is right for you / suitable for beginners | Suitability is a regulated assessment Vesty is not performing | Here is what the group would hold, and how it differs |
| Index-beating / you will earn | Return promise | Markets go up and down; past moves are not a forecast |
| Risk-free Europe / stable USA | Region labels are not safety labels | Europe companies, US large companies |
| We picked winners | Especially for Spotlight | These are well-known companies, not a forecast |

Always show:

- Official security names, not only World / Technology.
- “You keep the money at your own broker. Vesty does not trade or hold it.”
- “This is not personal investment advice.”
- Relative comparison among the packages on screen.

PRIIPs SRI numbers from issuer documents (Nordnet showed SXR8 as 4/7, SXRV as 5/7) may be shown as **issuer figures** with a date, not as Vesty’s rating.

## 12. Clear recommendation for V1

1. **Ship 3 packages:** World Mix, World + America, Tech Forward. This is the approved TestFlight set.
2. **Use 5 unique UCITS ETFs**, all Xetra accumulating share classes, all Nordnet-listed, all Marketstack `*.DE` VERIFIED.
3. **Lock allocations** at create time. No sliders.
4. **Keep Spotlight and the three Nasdaq stocks as FUTURE.**
5. **Treat Marketstack Basic as sufficient for this allowlist only.** Do not activate mappings or ingest into `market_prices` until the adapter exists.
6. **Catalog + package picker is implemented.** Next market-data milestone is the Marketstack adapter and inactive-then-active mappings, not a rewrite of existing clubs.
7. **Leave** KLP/DNB targets and historical strategies in place. Do not silently change live clubs.

## Appendix — inspection notes

- `InvestmentTarget` kinds: fund / etf / stock. Currency is ISO-3 metadata. Provider symbols do not belong on the target.
- Strategy is an immutable 10000-bps snapshot. Version 1 is genesis from a curated package; later versions require a proposal.
- Create Club investment-style step chooses among the three packages. Exposure labels are presentation only.
- Preferred brokers already include Nordnet, DNB, Kron, SpareBank 1, Other — availability research should stay honest per instrument.
- Market-data docs: [market-data.md](./market-data.md), [market-data-marketstack-spike.md](./market-data-marketstack-spike.md).
