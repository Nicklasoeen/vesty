# Vesty PostgreSQL Schema v1

## Purpose

This document describes the first physical PostgreSQL schema for the Vesty V1 domain. The authoritative product rules remain in `docs/domain-model.md`.

The schema is created by:

- `supabase/migrations/20260903195622_create_vesty_domain_schema.sql`
- `supabase/migrations/20260903202501_add_rls_authorization_v1.sql`
- `supabase/migrations/20260904110626_add_club_create_join_v1.sql`
- `supabase/migrations/20260904115953_add_profile_onboarding_v1.sql`
- `supabase/migrations/20260904172137_add_preferred_broker_v1.sql`
- `supabase/migrations/20260905075952_add_instruments_transactions_v1.sql`
- `supabase/migrations/20260905084718_add_market_data_v1.sql`
- `supabase/migrations/20260905090042_add_market_data_twelve_data_v1.sql`
- `supabase/migrations/20260905121758_curated_investment_packages_v1.sql`
- `supabase/migrations/20260905123104_add_marketstack_provider.sql`
- `supabase/migrations/20260905123105_seed_marketstack_v1_allowlist.sql`
- `supabase/migrations/20260906150144_rename_club_v1.sql`
- `supabase/migrations/20260906194634_contribution_policy_v1.sql`
- `supabase/migrations/20260906215200_contribution_policy_product_v1.sql`
- `supabase/migrations/20260906221000_contribution_policy_hardening_v1.sql`
- `supabase/migrations/20260906223000_contribution_policy_proposals_v1.sql`
- `supabase/migrations/20260906223100_contribution_policy_proposals_rls_fix_v1.sql`
- `supabase/migrations/20260906223200_contribution_policy_proposals_create_base_v1.sql`
- `supabase/migrations/20260907192616_single_fund_club_v1.sql`
- `supabase/migrations/20260907203455_single_fund_club_rectification_v1.sql`
- `supabase/migrations/20260908072728_investment_day_broker_handoff_v1.sql`

It uses the Supabase-managed `auth.users` table only as the authentication identity boundary. It does not duplicate credentials, sessions, or authentication state.

## Ownership Representation

Current club ownership is represented relationally by `clubs.current_owner_membership_id`.

The referenced membership must:

- belong to the same club
- have `membership_status = active`
- remain active while it is the referenced owner

This is enforced by a deferred composite foreign key to the generated `club_memberships.active_membership_id`. A club is therefore committed with exactly one active owner. All other memberships have the domain role `MEMBER`; no separate mutable role column exists that could contradict the club's owner pointer.

The deferred foreign key allows the club and its initial owner membership to be created in one transaction and allows a later ownership transfer to replace the pointer atomically.

The constraint remains active after club archival: an archived club retains its current active owner reference. This is the conservative V1 consequence of preserving ownership until an accepted transfer; the current domain defines no separate ownership-closeout flow for archived clubs.

## PostgreSQL Types

Lifecycle and closed-choice values use tightly scoped PostgreSQL enums:

- `club_status`: `active`, `archived`
- `club_investment_mode`: `legacy_package`, `single_fund`, `custom_portfolio`
- `single_fund_product_status`: `active`, `inactive`
- `governance_threshold_kind`: `simple_majority`, `supermajority`, `unanimous`
- `membership_status`: `active`, `left`, `removed`
- `club_invitation_status`: `pending`, `accepted`, `declined`, `revoked`, `expired`
- `ownership_transfer_status`: `pending`, `accepted`, `rejected`, `expired`
- `investment_target_kind`: `fund`, `etf`, `stock`
- `investment_target_status`: `active`, `inactive`
- `strategy_version_origin`: `genesis`, `proposal`
- `strategy_proposal_status`: `draft`, `open`, `approved`, `rejected`, `expired`, `cancelled`
- `vote_choice`: `yes`, `no`
- `strategy_readiness_status`: `pending`, `ready`
- `investment_schedule_status`: `scheduled`, `active`, `paused`, `replaced`, `ended`
- `investment_cycle_status`: `upcoming`, `open`, `completed`, `cancelled`
- `member_saving_plan_status`: `active`, `inactive`, `replaced`
- `participation_outcome`: `expected`, `confirmed`, `skipped`, `failed`
- `member_report_source`: `member_reported`
- `preferred_broker`: `nordnet`, `dnb`, `kron`, `sparebank1`, `other`
- `verification_state`: `unverified`, `verified`
- `verification_source`: `import`, `broker_api`, `embedded_broker`
- `investment_transaction_type`: `buy` (`sell` is reserved for a later migration)
- `investment_transaction_source`: `manual`, `broker_sync`
- `investment_transaction_verification`: `member_reported`, `broker_verified`
- `market_data_provider`: `yahoo_unofficial`, `twelve_data`, `marketstack`
- `market_price_type`: `nav`, `close`, `delayed`

Currency uses constrained `text`, not a reference table. Stored currency values must be three uppercase letters. Validation against the full ISO 4217 code list is deferred.

Money uses signed PostgreSQL `bigint` columns with positive-value checks. Allocations use `smallint` basis points.

## Tables

### Identity and clubs

- `profiles`
  - Primary key: `id`
  - `id` also references `auth.users.id`
  - Contains only application display/profile data and timestamps
  - `display_name` is optional until onboarding; when set it is trimmed non-empty text up to 80 characters
  - `avatar_path` is an optional Storage object key (`<auth.uid()>/avatar.jpg`), never a signed URL
  - `preferred_broker` is an optional user-level broker preference. It is private account data, not club or strategy state. Profile completeness remains `display_name` only.

- `clubs`
  - Primary key: `id`
  - Stores lifecycle, base currency, locked governance mode, immutable `investment_mode`, and current owner membership
  - Existing clubs and `create_club` / `create_club_v2` clubs are `legacy_package`
  - New Simple saving clubs are `single_fund`. `custom_portfolio` is reserved and not creatable in this release
  - `investment_mode` cannot change after insert. A before-update trigger raises `vesty.investment_mode_immutable`
  - Club names are trimmed non-empty text up to 80 characters
  - The owner foreign key is deferred so initial club and membership creation can be atomic

- `club_memberships`
  - Primary key: `id`
  - References `clubs` and `profiles`
  - Preserves active, left, and removed tenures
  - `removed_by_membership_id` references a historical membership in the same club
  - Generated `active_membership_id` supports the owner integrity constraint

- `club_invitations`
  - Primary key: `id`
  - References the club, inviting membership, optional existing invitee profile, and accepted membership
  - Supports a profile invitee, an email contact, or neither when a shareable `token_hash` is present
  - Profile and email cannot both be set on the same invitation
  - `token_hash` stores SHA-256 of a 12-byte random hex token; the plaintext is returned once at creation and is not stored
  - Stores distinct accepted, declined, revoked, and expired timestamps

- `ownership_transfers`
  - Primary key: `id`
  - References initiating, target, and resolving memberships in the same club
  - Preserves pending, accepted, rejected, and expired transfer history

### Strategies and governance

- `investment_targets`
  - Primary key: `id`
  - Global Vesty-managed catalog of purchasable products: funds, ETFs, and stocks
  - Required ISO trading/reporting `currency` (metadata only; V1 does not convert FX)
  - Optional broker-neutral ISIN, ticker, exchange, and `provider_symbol`
  - Identifier fields stay null unless a verified value exists in project data
  - Contains no live prices. Provider symbols live on `market_data_instrument_mappings`, not on `provider_symbol`
  - Four legacy fixture IDs (`31000000-0000-4000-8000-00000000000{1-4}`) are verified NOK mutual-fund share classes: KLP AksjeGlobal Indeks P (`NO0010776040`), DNB Teknologi A (`NO0010337678`), KLP AksjeNorge Indeks P (`NO0010455694`), KLP AksjeFremvoksende Markeder Indeks P (`NO0010611809`). Ticker/exchange/`provider_symbol` stay null. Existing clubs may still snapshot these names.
  - Five CORE V1 ETF IDs (`31000000-0000-4000-8000-00000000001{1-5}`) are Xetra accumulating UCITS listings (VWCE, EUNK, IS3N, SXR8, SXRV), currency EUR, official ISINs stored, `provider_symbol` null. Legacy package clubs resolve genesis allocations from curated packages. See `docs/vesty-v1-investment-packages.md`.
  - Simple saving target `31000000-0000-4000-8000-000000000021` is DNB Global Indeks A (`NO0010582984`), kind `fund`, currency `NOK`. Ticker, exchange, `provider_symbol`, NAV, and return series are not seeded.

- `strategy_versions`
  - Primary key: `id`
  - Unique `(club_id, version_number)`
  - References its creator and, for non-genesis versions, one source proposal
  - Separates `approved_at` from `effective_at`

- `strategy_allocations`
  - Primary key: `id`
  - References one strategy version and one global investment target
  - Snapshots target name, kind, and canonical descriptor fields
  - Enforces unique target and display position within each version

- `private.curated_strategy_packages` / `private.curated_strategy_package_allocations`
  - Server-owned V1 package catalog. Not on the Data API. RLS enabled and forced, with no client grants
  - Three active packages: `world_mix`, `world_america`, `tech_forward`. Allocations are integer basis points totaling `10000`
  - `public.create_club` resolves `p_package_id` through `private.resolve_curated_package_allocations`
  - These multi-ETF packages are not Simple saving alternatives

- `private.single_fund_products` / `private.single_fund_broker_listings`
  - Server-owned Simple saving catalog. Not on the Data API. RLS enabled and forced, with no client grants
  - First active product: DNB Global Indeks A, catalog id `32000000-0000-4000-8000-000000000001`, checked 7 September 2026
  - Broker listings store sourced DNB/Nordnet URLs and platform-specific costs. Costs are not a universal fund fee
  - Product and cost source URLs must be HTTPS on the exact hosts `www.dnb.no` or `www.nordnet.no`. HTTP, lookalike hosts, and userinfo disguises are rejected
  - `public.single_fund_catalog_v1` returns active products only and never exposes `investment_target_id`

- `private.club_creation_requests`
  - Idempotency ledger for `create_club_v3`. Unique `(profile_id, client_creation_id)`
  - Same fingerprint returns the stored club. A different payload raises `vesty.creation_conflict`
  - Clients have no table privileges

- `club_proposals`
  - Primary key: `id`
  - Unique `(club_id, id)`
  - Thin shared identity (`kind` = `strategy` | `contribution_policy`) for electorate and votes
  - Existing `strategy_proposals` rows were backfilled. New strategy and contribution inserts keep this row in sync

- `strategy_proposals`
  - Primary key: `id`
  - References proposer, club, and exact base strategy version
  - Also references `club_proposals.id`
  - Stores lifecycle timestamps, frozen governance mode, electorate size, required yes count, and intended effective time

- `contribution_policy_proposals`
  - Primary key: `id`
  - References proposer, club, exact base contribution-policy version, and `club_proposals.id`
  - Stores proposed mode, proposed equal amount, and the same lifecycle/threshold snapshot fields as strategy proposals
  - At most one open contribution proposal per club
  - Clients have SELECT only. Writes are trusted RPCs

- `strategy_proposal_allocations`
  - Primary key: `id`
  - Stores the proposal's complete relational allocation snapshot independently of approved strategy allocations
  - Enforces unique target and display position within each proposal

- `proposal_electorate_members`
  - Composite primary key: `(proposal_id, membership_id)`
  - References `club_proposals` and historical membership in the same club
  - Represents the frozen electorate membership set for strategy or contribution proposals

- `votes`
  - Composite primary key: `(proposal_id, membership_id)`
  - References the exact electorate pair, preventing votes disconnected from eligibility
  - Stores one final `yes` or `no` choice

- `strategy_readiness`
  - Primary key: `id`
  - Unique `(membership_id, strategy_version_id)`
  - References a membership and strategy version in the same club

### Investment Day coordination

- `investment_schedules`
  - Primary key: `id`
  - Unique `(club_id, revision_number)`
  - Represents a monthly day, explicit missing-day policy text, IANA timezone string, lead days, and effective interval
  - Does not implement scheduler execution

- `investment_cycles`
  - Primary key: `id`
  - Unique `(club_id, occurrence_key)`
  - References exact schedule and strategy revisions in the same club
  - Snapshots occurrence identity, timing, timezone, reporting window, lifecycle, and `roster_frozen_at`
  - New keys are local `YYYY-MM-DD` in the schedule timezone; historical keys such as `v1-YYYY-MM` are not rewritten

- `member_saving_plans`
  - Primary key: `id`
  - References one membership and optionally the prior plan it replaces
  - Stores positive `bigint` contribution intent, explicit currency, lifecycle, and effective interval
  - Legacy compatibility only: future flexible amounts are resolved from `member_contribution_commitment_versions`
  - Does not represent a deposit or transaction

- `member_cycle_participations`
  - Primary key: `id`
  - Unique `(investment_cycle_id, membership_id)`
  - References the exact cycle, membership, and source saving plan
  - Snapshots expected positive `bigint` amount and currency
  - Keeps member outcome/source/timestamps separate from verification state/source/time
  - Authenticated clients cannot UPDATE this table; outcome changes go through `report_investment_day_v1`

- `member_investment_day_reports`
  - Primary key: `id`
  - Unique `(membership_id, investment_cycle_id)` and `(membership_id, client_report_id)`
  - Stores report mode (`as_planned` / `with_changes`), outcome, and payload fingerprint
  - Retry with the same client id and fingerprint is idempotent; a different payload is `vesty.report_conflict`
  - Clients have SELECT on their own active membership rows only; writes go through `report_investment_day_v1`
  - Versioned correction is remaining work

- `member_investment_transactions`
  - Primary key: `id`
  - Member-reported investment event for one membership, club, cycle, and target
  - V1 writes `buy` only, `source = manual`, `verification_status = member_reported`
  - `amount_minor` is a positive bigint contribution in the club base currency
  - `amount_provenance` is `member_attested_plan`, `member_reported_actual`, `legacy_plan_assumed`, or reserved `broker_verified`
  - Existing confirm v1/v2 rows are labelled `legacy_plan_assumed` and are not upgraded
  - `quantity numeric(28, 8)` is nullable and is never fabricated from amount or from a later market price
  - `unit_price_minor` is legacy same-currency minor units and is not used for EUR ETF execution prints
  - `execution_unit_price numeric(20, 8)` plus `execution_unit_price_currency` store optional instrument-currency execution prices
  - Unique `(membership_id, investment_cycle_id, investment_target_id, transaction_type)` makes one-buy-per-target-per-cycle idempotent; two real trades of the same instrument in one period (S27) is remaining work
  - Clients cannot insert, update, or delete rows; reporting uses `report_investment_day_v1`
  - A before-insert trigger rejects targets that are not in the cycle's strategy version

- `member_investment_positions`
  - `security_invoker` view aggregating the caller's readable buy transactions
  - Exposes membership, club, target, contribution currency, `total_invested_minor`, `total_quantity`, `quantity_status` (`complete` / `partial` / `unavailable`), and `amount_provenance` (`mixed` when lots disagree)
  - `total_quantity` sums only rows that have quantity
  - Stores no market value and does not bypass transaction RLS

- `member_position_valuations_v1`
  - `security_invoker` read model: complete quantity × latest fresh Marketstack close
  - Current value is instrument currency only (EUR for CORE V1 ETFs)
  - No EUR/NOK conversion, no club aggregate, no cross-currency gain/loss
  - Remains the EUR-only exact-quantity view. NOK estimates live in `member_estimated_positions_v1`

- `fx_rates`
  - Primary key: `id`
  - Unique `(base_currency, quote_currency, provider, rate_date)`
  - V1 pair is EUR/NOK only. `rate numeric(20, 8)` means 1 EUR = rate NOK
  - Provider enum: `norges_bank`
  - Clients have SELECT only. Ingest is `sync-fx-rates`

- `latest_fx_rates` / `latest_fx_rate_status`
  - Latest print per pair/provider plus `market_nav_freshness_v1`

- `member_investment_lots_v1`
  - `security_invoker` per-buy lot. `exact_quantity` is the stored member-reported units. `modelled_quantity` is derived and never written back
  - `amount_provenance` is the stored trust of that lot's `amount_minor`
  - Reference date is the cycle Investment Day

- `member_estimated_positions_v1`
  - Own-position estimated NOK value and `valuation_confidence` (`exact` / `mixed` / `estimated` / `unavailable`)
  - `amount_provenance` is mixed when lots disagree

- `member_estimated_portfolio_v1` / `member_estimated_portfolios_v1` / `member_portfolio_history_v1`
  - Caller-owned curated ETF totals and history. Legacy clubs return `modelling_scope = legacy`
  - One missing required quantity, fresh price, or FX rate makes the complete value and return unavailable while reported invested remains separate

- `club_estimated_portfolio_v1` / `club_portfolio_history_v1`
  - Removed from the authenticated client API by `20260907080226_remove_club_money_aggregates_v1.sql`; the three-contributor threshold did not satisfy Flexible privacy

- `market_data_instrument_mappings`
  - Primary key: `id`
  - Maps one InvestmentTarget to one provider instrument id
  - At most one active mapping per `(investment_target_id, provider)`
  - At most one active mapping per `investment_target_id` (authoritative ingest)
  - Yahoo unofficial mappings remain active only as a probe source until Twelve Data NAV is proven
  - Twelve Data mappings exist for catalog identity but stay inactive until a real key proves NAV for all four funds

- `market_prices`
  - Primary key: `id`
  - One validated observation per `(investment_target_id, provider, price_type, price_date)`
  - `price` is `numeric(20, 8)` — exact decimal NAV, not bigint øre and not JavaScript float authority
  - `price_type` is `nav` for these funds
  - Currency must match `investment_targets.currency`; mismatches are rejected rather than converted
  - Clients have SELECT only. Ingest is the `sync-market-data` Edge Function using a secret key

- `latest_market_prices`
  - `security_invoker` view of the newest persisted observation per target, provider, and price type
  - Exposes `price_date` so callers can treat the value as delayed NAV, not a live quote

- `latest_market_price_status`
  - `security_invoker` view over `latest_market_prices` plus `market_nav_freshness_v1`
  - Freshness is `fresh`, `stale`, or `unavailable`. Weekends and a short holiday gap are not provider failure
  - Not a valuation and not wired into Home/Club UI

## Concurrent Proposal Rule

A club may retain multiple `draft` and terminal strategy proposals. The partial unique index `strategy_proposals_one_open_per_club_idx` applies only to rows whose status is `open`, so PostgreSQL permits proposal history while rejecting a second simultaneous open ballot. Once the open proposal becomes `approved`, `rejected`, `expired`, or `cancelled`, another proposal may open.

## Important Foreign Keys

Composite foreign keys enforce same-club ownership for:

- club owner membership
- invitation inviter and accepted membership
- ownership-transfer actors
- strategy-version creator and source proposal
- proposal proposer and base strategy version
- electorate proposal and membership
- readiness membership and strategy version
- schedule creator
- cycle schedule and strategy version
- saving-plan membership
- participation cycle, membership, and source saving plan

Historical domain foreign keys use `RESTRICT` or `NO ACTION`. The migration intentionally creates no cascading delete path through memberships, strategies, proposals, electorate entries, votes, cycles, plans, or participation.

## Important Unique Constraints

PostgreSQL directly enforces:

- one active membership tenure per club/profile
- exactly one owner pointer per club
- one pending invitation per club/profile
- one pending invitation per club/case-insensitive email
- unique invitation token hash when present
- one accepted membership per invitation acceptance record
- one pending ownership transfer per club
- unique non-null InvestmentTarget ISIN
- one strategy version number per club
- at most one strategy version per source proposal
- one target and one display position per strategy version
- at most one open strategy proposal per club
- one target and one display position per strategy proposal
- one electorate entry per proposal/membership
- one vote per proposal/electorate membership
- one readiness record per membership/strategy version
- one schedule revision number per club
- at most one current active-or-paused schedule revision per club
- one cycle occurrence key per club
- at most one active saving-plan record per membership
- one participation per cycle/membership
- one buy (or later type) per membership/cycle/target in `member_investment_transactions`
- one active market-data mapping per InvestmentTarget
- one active market-data mapping per InvestmentTarget and provider
- one NAV observation per target, provider, price type, and as-of date

## Important CHECK Constraints

Checks enforce:

- non-empty names and descriptors
- three-uppercase-letter currency shape
- lifecycle states and their required/forbidden timestamps
- active membership versus terminal membership facts
- invitation identity and terminal outcome consistency
- distinct ownership-transfer initiator and target
- accepted/rejected ownership transfers resolved by the target membership
- StrategyVersion 1 genesis provenance versus later proposal provenance
- allocation and proposal-allocation basis points in `1..10000`
- positive allocation display positions
- frozen proposal fields once `opened_at` exists
- deterministic required-yes arithmetic for every voting mode
- schedule revision, calendar day, lead-day, and effective-period ranges
- cycle deadline, reporting-window, cancellation, and lifecycle consistency
- positive saving-plan, expected participation, and transaction amounts
- transaction lot fields either both null or both present
- saving-plan effective interval consistency
- member reports using only `member_reported`
- `expected` participation having no report metadata
- verification state/source/time remaining independent from member outcome

## Important Indexes

Partial and composite indexes support realistic V1 operations:

- active membership and membership history lookup
- pending invitation deduplication
- pending ownership-transfer lookup
- active InvestmentTarget lookup and ISIN identity
- effective strategy history by club
- proposal state/history and the single-open-proposal rule
- reverse electorate and vote lookup by membership
- readiness aggregation by strategy and state
- the current schedule revision
- cycles by club/date, schedule, and strategy
- active/effective saving plans by membership
- participation lookup by membership and source plan
- one active market-data mapping per target and per target/provider
- market-price lookup by target, price type, and as-of date

Primary-key and unique-constraint indexes cover direct proposal, electorate, vote, cycle-participation, allocation, and revision lookups without redundant secondary indexes.

## Invariants Enforced Directly by PostgreSQL

The physical schema directly prevents:

- profiles without a Supabase Auth identity
- a club owner pointer to a different club or inactive membership
- committing a club without exactly one current owner relationship
- an owner membership becoming terminal while still referenced as owner
- duplicate active membership tenures
- malformed lifecycle timestamp combinations
- duplicate pending invitations and ownership transfers
- invalid strategy provenance shape
- duplicate strategy version numbers
- duplicate targets or positions in allocation snapshots
- invalid individual basis-point values
- multiple open proposals for one club
- an incorrect stored voting threshold for the frozen electorate size/mode
- duplicate electorate entries
- votes that do not reference the frozen electorate
- duplicate or non-deterministic vote choices
- readiness detached from its membership's club or strategy's club
- duplicate schedule revisions and cycle occurrences
- non-positive monetary values
- a participation detached from its cycle, member, or source saving plan
- collapsing member report outcome and broker verification into one state

## Invariants Not Yet Enforced

The following require trusted transaction functions, later authorization policy, or lifecycle-specific write paths. They are deliberately not represented by misleading row-level checks:

- allocation rows for a complete strategy version summing to exactly `10000` outside the genesis create-club RPC
- allocation rows for an opened proposal summing to exactly `10000`
- preventing allocation or target-snapshot mutation after a proposal opens or version is created
- InvestmentTargets being active when a genesis strategy is finalized or proposal opens
- preventing semantic InvestmentTarget identity changes after historical use
- governance mode and finalized historical records being immutable
- requiring StrategyVersion 1 before later versions and enforcing a gap-free version sequence
- invitation issuance only after StrategyVersion 1 and atomic invitation acceptance/membership creation — create/join RPCs now enforce this; other invitation mutations remain deferred
- detecting the same pending invitee represented once by profile and once by email
- ownership-transfer initiation by the current owner, target activity at acceptance, and atomic owner-pointer transfer
- proposal opening against the latest version, freezing electorate/allocation rows, and serializing first vote versus cancellation
- electorate row count matching `strategy_proposals.electorate_size`
- vote insertion only while the proposal is open and vote-row immutability
- approved proposals atomically creating exactly one identical StrategyVersion
- strictly monotonic and non-overlapping strategy effective times
- schedule effective intervals not overlapping, missing-day policy text naming a recognized policy, and timezone text naming a real IANA zone
- deterministic cycle generation and cycle snapshot creation
- saving-plan effective periods not overlapping beyond the current-state uniqueness constraint
- saving-plan and participation currencies matching the club base currency
- currency text naming an actual ISO 4217 currency
- participation report is written only through `report_investment_day_v1`; unaudited client correction is closed. Versioned correction is remaining work
- removal of club-wide monetary aggregate projections, safe club-level status projections, and authorization inside deferred trusted operations

## Trusted write paths

`supabase/migrations/20260904110626_add_club_create_join_v1.sql`, `supabase/migrations/20260905075952_add_instruments_transactions_v1.sql`, `supabase/migrations/20260905121758_curated_investment_packages_v1.sql`, `supabase/migrations/20260906150144_rename_club_v1.sql`, `supabase/migrations/20260906194634_contribution_policy_v1.sql`, `supabase/migrations/20260906215200_contribution_policy_product_v1.sql`, `supabase/migrations/20260906221000_contribution_policy_hardening_v1.sql`, `supabase/migrations/20260906223000_contribution_policy_proposals_v1.sql`, `supabase/migrations/20260907101905_investment_day_reporting_v1.sql`, `supabase/migrations/20260907123709_investment_day_cycle_lifecycle_v1.sql`, `supabase/migrations/20260907192616_single_fund_club_v1.sql`, `supabase/migrations/20260907203455_single_fund_club_rectification_v1.sql`, and `supabase/migrations/20260908072728_investment_day_broker_handoff_v1.sql` add public wrappers over private `SECURITY DEFINER` functions:

- `create_club` — legacy path. Authenticates via `auth.uid()`, resolves an allowlisted `p_package_id` to canonical allocations, then creates the club, owner membership, owner pointer, genesis StrategyVersion 1, a complete 10000-bps snapshot, and Flexible ContributionPolicyVersion 1. It does not invent a creator amount. Clubs created here are `legacy_package`.
- `create_club_v2` — same club/strategy creation plus an explicit Equal or Flexible genesis policy. Equal requires `p_equal_amount_minor` and forbids a creator private amount. Flexible requires `p_creator_flexible_amount_minor` and forbids a shared amount. The transaction is atomic. Meaning unchanged. Clubs created here are `legacy_package`.
- `create_club_v3` — Simple saving path. Authenticates via `auth.uid()`, requires `single_fund` and an allowlisted catalog product id, then atomically creates the club as `single_fund`, owner membership, StrategyVersion 1 with exactly one 10000-bps allocation, ContributionPolicyVersion 1, an optional private Flexible commitment, the club's default Investment Day schedule (day 5, `last_day_of_month`, `Europe/Oslo`, three-day lead), and the first valid server-clock occurrence. Clients cannot send a clock, basis points, or `investment_target_id`. Idempotent on `(caller, client_creation_id)`.
- `single_fund_catalog_v1` — authenticated read of active Simple saving products. Sourced product facts only. Broker and cost source URLs are stored only when the host is exactly `www.dnb.no` or `www.nordnet.no` over HTTPS.
- `create_club_invitation` — current owner only, after StrategyVersion 1 exists; returns a one-time plaintext token and stores only `token_hash`
- `update_club_name` — current owner only, active club; trims the name and rejects empty or over-80-character values with `vesty.club_name_invalid`
- There is no public `create_contribution_policy_version_v1` RPC. After club creation, authenticated owners and members cannot append policy versions. `private.create_contribution_policy_version_v1` remains trusted/internal (`service_role` / approved contribution finalize). `create_club` / `create_club_v2` / `create_club_v3` still write policy version 1 in the same club-creation transaction.
- `create_contribution_policy_proposal_v1` — any active member; draft only; validates supported transitions against the supplied base version
- `open_contribution_policy_proposal_v1` — proposer; freezes electorate and voting rule; rejects a stale base
- `cancel_contribution_policy_proposal_v1` — proposer; draft or open with zero votes
- `finalize_contribution_policy_proposal_v1` — active member or frozen electorate member; tallies and writes `resolution_reason` (`vote_approved`, `vote_rejected`, `stale_base`, `expired`). Approval creates exactly one policy version. Stale bases close as rejected/`stale_base` without a version
- `club_contribution_policy_proposals_v1` — active members; shared payload plus `resolution_reason`, base/proposed style, and Equal amounts only
- `create_member_contribution_commitment_v1` — caller only; appends a private flexible commitment version. Rejected when the latest club policy is equal. Also writes a legacy saving-plan row when none exists so cycle FKs remain satisfied.
- `club_contribution_policy_v1` — active members; returns latest mode/currency and a shared equal amount only when the mode is equal
- `my_contribution_commitment_v1` — caller only; latest private commitment, never another member's amount
- `accept_club_invitation` — authenticates via `auth.uid()`, validates token/expiry/recipient, creates one active membership, and marks the invitation accepted without changing ownership
- `current_investment_day_v1` — authenticated read of the current or next Investment Day. Never creates cycles, freezes policy, or writes participations. Returns `viewer_state` (`missing`, `upcoming`, `open`, `closed`, `not_in_snapshot`, `setup_next`, `setup_required`, `unavailable`) and `reporting_allowed`. Flexible members without a frozen participation see `setup_next` or `setup_required` instead of an invented amount.
- `investment_day_broker_handoff_v1` — authenticated read of a verified Nordnet product page for the caller's frozen Investment Day. Requires active membership and a frozen participation. Returns `status`, `broker`, `fund_name`, `isin`, `product_url`, and `checked_on` only. Nordnet URLs must be HTTPS with host exactly `www.nordnet.no` and no userinfo. Unsupported brokers, unverified listings, and missing pages return `unavailable` without a URL. The function never returns member amounts, other members, or catalog ids, and it never writes participation, reports, or purchases. Authenticated clients cannot execute the private implementation or the Nordnet URL helper.
- `advance_investment_cycles_v1` — trusted lifecycle. Authenticated clients have no EXECUTE; `service_role` does. Idempotently generates occurrences from the stored schedule (local noon, `day_of_month` / `last_day_of_month`, timezone, `configuration_lead_days`), skips months whose configuration deadline has already passed without a historically valid strategy, freezes eligible participations at the configuration deadline, opens the reporting window, and completes elapsed cycles without reopening it. Identifies a period by club and occurrence key, never by “latest open row”. `create_club_v3` calls this trusted path with the server clock after writing the default schedule.

## PostgREST deploy order

After a migration that adds or replaces RPC signatures:

1. Apply the migration.
2. Confirm or reload the PostgREST schema cache (`NOTIFY pgrst, 'reload schema'` is included in `20260908072728_investment_day_broker_handoff_v1.sql`).
3. Verify `single_fund_catalog_v1`, `create_club_v3`, and `investment_day_broker_handoff_v1`.
4. Ship the client.

The client still shows a retryable error if an RPC is temporarily unavailable (`PGRST202` or a transport failure).
- `ensure_open_investment_day_v1` — retired from the authenticated API. EXECUTE is revoked from `anon` and `authenticated`. The function body remains for history; clients must not call it.
- `report_investment_day_v1` — authenticates via `auth.uid()`, writes one member report plus matching transactions and participation outcome atomically. In the same locked operation it requires a frozen participation, `status = open`, and `reporting_opens_at <= now < reporting_closes_at`. Before open: `vesty.reporting_not_open`. At or after close: `vesty.reporting_closed`, even if status is still `open`. The public wrapper does not accept a client clock. `as_planned` attests the frozen plan. `with_changes` stores only explicit purchase amounts. Retry with the same `client_report_id` and fingerprint is idempotent. A different payload is `vesty.report_conflict`. Authenticated clients cannot execute the private implementation, the clock-parameter reporter, or the retired confirm v1/v2 functions.
- `club_investment_day_participation_v1` — authenticated social read. Counts and roster come from frozen `member_cycle_participations`, including members who later left. It does not use the live active membership list and does not return amounts, quantities, prices, or private contribution choices.

Implementations live in the unexposed `private` schema. Direct client writes to clubs, memberships, invitations, strategy, and transaction tables remain blocked.

## RLS Status

Row Level Security is enabled and forced for every domain table by `supabase/migrations/20260903202501_add_rls_authorization_v1.sql`, including `member_investment_transactions` and the market-data tables. Direct-client grants and policies enforce active-club access, row ownership, immutable-history boundaries, vote privacy, and private monetary rows. Market prices are shared catalog data: authenticated SELECT, no client writes. The positions and latest-price views use `security_invoker`.

The detailed authorization matrix, helper-function design, test coverage, and deferred trusted operations are documented in `docs/security-authorization.md`. No remote Supabase project is connected.
