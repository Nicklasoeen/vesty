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
- `market_data_provider`: `yahoo_unofficial`, `twelve_data`
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
  - Stores lifecycle, base currency, locked governance mode, and current owner membership
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
  - Four TestFlight fixture IDs (`31000000-0000-4000-8000-00000000000{1-4}`) are verified NOK mutual-fund share classes: KLP AksjeGlobal Indeks P (`NO0010776040`), DNB Teknologi A (`NO0010337678`), KLP AksjeNorge Indeks P (`NO0010455694`), KLP AksjeFremvoksende Markeder Indeks P (`NO0010611809`). Ticker/exchange/`provider_symbol` stay null. See `docs/market-data.md`.

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

- `strategy_proposals`
  - Primary key: `id`
  - References proposer, club, and exact base strategy version
  - Stores lifecycle timestamps, frozen governance mode, electorate size, required yes count, and intended effective time

- `strategy_proposal_allocations`
  - Primary key: `id`
  - Stores the proposal's complete relational allocation snapshot independently of approved strategy allocations
  - Enforces unique target and display position within each proposal

- `proposal_electorate_members`
  - Composite primary key: `(proposal_id, membership_id)`
  - References a proposal and historical membership in the same club
  - Represents the frozen electorate membership set

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
  - References exact schedule and strategy revisions in the same club
  - Snapshots occurrence identity, timing, timezone, reporting window, and lifecycle

- `member_saving_plans`
  - Primary key: `id`
  - References one membership and optionally the prior plan it replaces
  - Stores positive `bigint` contribution intent, explicit currency, lifecycle, and effective interval
  - Does not represent a deposit or transaction

- `member_cycle_participations`
  - Primary key: `id`
  - Unique `(investment_cycle_id, membership_id)`
  - References the exact cycle, membership, and source saving plan
  - Snapshots expected positive `bigint` amount and currency
  - Keeps member outcome/source/timestamps separate from verification state/source/time

- `member_investment_transactions`
  - Primary key: `id`
  - Member-reported investment event for one membership, club, cycle, and target
  - V1 writes `buy` only, `source = manual`, `verification_status = member_reported`
  - `amount_minor` is a positive bigint contribution in the club base currency
  - `quantity` and `unit_price_minor` are nullable and are never fabricated from amount
  - Unique `(membership_id, investment_cycle_id, investment_target_id, transaction_type)` makes one-buy-per-target-per-cycle idempotent
  - Clients cannot insert, update, or delete rows; `confirm_investment_day_v1` is the trusted write path
  - A before-insert trigger rejects targets that are not in the cycle's strategy version

- `member_investment_positions`
  - `security_invoker` view aggregating the caller's readable buy transactions
  - Exposes membership, club, target, currency, `total_invested_minor`, and nullable `total_quantity`
  - Stores no market value and does not bypass transaction RLS
  - Quantity is still typically null after Investment Day V1, so `quantity × NAV` is not available

- `market_data_instrument_mappings`
  - Primary key: `id`
  - Maps one InvestmentTarget to one provider instrument id
  - At most one active mapping per `(investment_target_id, provider)`
  - Yahoo unofficial mappings are active because latest and historical NAV were proven by live request
  - Twelve Data mappings exist for catalog identity but stay inactive until a real key proves NAV

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
- participation report correction only while its cycle is open and report immutability after completion
- the three-member monetary aggregate threshold, safe club-level status projections, and authorization inside deferred trusted operations

## Trusted write paths

`supabase/migrations/20260904110626_add_club_create_join_v1.sql` and `supabase/migrations/20260905075952_add_instruments_transactions_v1.sql` add public invoker wrappers over private `SECURITY DEFINER` functions:

- `create_club` — authenticates via `auth.uid()`, creates the club, owner membership, owner pointer, genesis StrategyVersion 1, and a complete allocation snapshot totaling 10000 bps
- `create_club_invitation` — current owner only, after StrategyVersion 1 exists; returns a one-time plaintext token and stores only `token_hash`
- `accept_club_invitation` — authenticates via `auth.uid()`, validates token/expiry/recipient, creates one active membership, and marks the invitation accepted without changing ownership
- `ensure_open_investment_day_v1` — authenticates via `auth.uid()`, opens or reuses the caller's current TestFlight cycle/participation, and never writes transactions
- `confirm_investment_day_v1` — authenticates via `auth.uid()`, inserts missing member-reported buys for the caller only, and is idempotent on retry

Implementations live in the unexposed `private` schema. Direct client writes to clubs, memberships, invitations, strategy, and transaction tables remain blocked.

## RLS Status

Row Level Security is enabled and forced for every domain table by `supabase/migrations/20260903202501_add_rls_authorization_v1.sql`, including `member_investment_transactions` and the market-data tables. Direct-client grants and policies enforce active-club access, row ownership, immutable-history boundaries, vote privacy, and private monetary rows. Market prices are shared catalog data: authenticated SELECT, no client writes. The positions and latest-price views use `security_invoker`.

The detailed authorization matrix, helper-function design, test coverage, and deferred trusted operations are documented in `docs/security-authorization.md`. No remote Supabase project is connected.
