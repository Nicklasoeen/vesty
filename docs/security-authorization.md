# Vesty Security and Authorization v1

## Purpose

This document describes the direct-client authorization boundary implemented by `supabase/migrations/20260903202501_add_rls_authorization_v1.sql`, the Create / Join Club trusted RPCs in `supabase/migrations/20260904110626_add_club_create_join_v1.sql`, the Investment Day transaction RPCs in `supabase/migrations/20260905075952_add_instruments_transactions_v1.sql`, and the market-data tables in `supabase/migrations/20260905084718_add_market_data_v1.sql`. Product and relational invariants remain authoritative in `docs/domain-model.md` and `docs/database-schema.md`.

## Authorization Principles

- The mobile client is untrusted. Identity comes only from `auth.uid()`.
- Every domain table has Row Level Security enabled and forced.
- Anonymous users have no domain-table privileges.
- Authenticated access is deny-by-default and granted per table and operation.
- Historical membership does not grant current club access.
- Exact contribution data is visible only through the owning active membership.
- Column-level grants prevent clients from writing protected identity, lifecycle, monetary-snapshot, and verification fields.
- Atomic domain transitions remain trusted operations rather than broad direct-table policies.

## Role Model

Application authorization has two club roles:

- `OWNER`: the active membership referenced by `clubs.current_owner_membership_id`
- `MEMBER`: any other active club membership

Both roles have equal voting weight. Active membership grants normal club reads. Owner-only administration is recognized by a private helper, but direct client mutation remains blocked wherever ownership, membership, invitation, schedule, or governance invariants require a trusted transaction.

The `service_role` and database administration roles remain outside the mobile authorization model and must never be exposed to the client.

## Table-Level Access Summary

Identity and club:

- `profiles`: users may read themselves plus current-club roster identities, including historical members; they may insert their own row and edit only their own `display_name`, `avatar_path`, and `preferred_broker`. Column-level SELECT excludes `preferred_broker`, so club members and outsiders cannot read or filter another user's broker. The owner reads their own value through `get_own_preferred_broker`. V1 onboarding is complete when `display_name` is set and does not require a broker. Avatar bytes live in the private `avatars` Storage bucket; the table stores only the object path.
- `clubs`: current active members may read; direct inserts, updates, and deletes are blocked.
- `club_memberships`: current active members may read their club's current and historical roster; all direct client writes are blocked.
- `club_invitations`: the current owner may read club invitations; a profile-addressed recipient may read their own invitation. Email-only recipient access is blocked until email is securely bound to authenticated identity. Shareable token invitations are accepted through `accept_club_invitation`; possession of the token plus `auth.uid()` is the V1 join factor. Token-only invitees cannot read invitation rows before joining.
- `ownership_transfers`: the current owner and active target member may read relevant transfers; all direct client writes are blocked.

Strategies and governance:

- `investment_targets`: authenticated users may read the curated catalog, including inactive targets required for historical interpretation; all client writes are blocked.
- `strategy_versions` and `strategy_allocations`: current active club members may read their club's immutable strategy history; all client writes are blocked.
- `strategy_proposals`: active members may read club proposals and create their own draft. A proposer may edit only the reason or base strategy of their own draft.
- `strategy_proposal_allocations`: authorized proposal readers may read; only the active proposer may insert, update, or delete rows while the proposal remains a draft and the target remains active.
- `proposal_electorate_members`: active club members may read the electorate. A former member in an open frozen electorate may read only their own electorate entry. Client writes are blocked.
- `votes`: eligible electorate members may insert one vote while the proposal is open and its deadline has not passed. No client may update or delete votes. Individual rows are readable only for terminal proposals by current active club members.
- `strategy_readiness`: active members may read club readiness. A member may insert only their own readiness and may update only their own `pending` row to `ready`.

Investment Day coordination:

- `investment_schedules`: current active members may read; client writes are blocked.
- `investment_cycles`: current active members may read cycle metadata; client writes are blocked.
- `member_saving_plans`: only the owning active membership may read exact rows, insert a new active plan, or end its current active plan. Amount history cannot be updated in place and rows cannot be deleted.
- `member_cycle_participations`: only the owning active membership may read the raw row. While its cycle is open, the owner may update only member-report fields. Creation, snapshot fields, verification fields, and deletion are blocked.
- `member_investment_transactions`: only the owning active membership may read rows. Direct insert, update, and delete are revoked. Writes go through `confirm_investment_day_v1`.
- `member_investment_positions`: a `security_invoker` read model over those transactions, so another member's cost basis is not visible.
- `market_data_instrument_mappings`, `market_prices`, and `latest_market_prices`: any authenticated user may read shared catalog NAV/mappings. Anonymous users have no access. Clients cannot INSERT, UPDATE, or DELETE. Ingest is the `sync-market-data` Edge Function, which requires a secret API key and writes with the service role. Provider API secrets are never `EXPO_PUBLIC_*` values.

## Sensitive Monetary Data

`member_saving_plans`, `member_cycle_participations`, and `member_investment_transactions` are not club-readable tables. Ownership does not reveal another member's `amount_minor`, `expected_amount_minor`, transaction amount, or position size.

Saving-plan insert policies prove that the membership is active, belongs to `auth.uid()`, belongs to the supplied club, and uses the club base currency. Updates are column-limited to ending an active plan; changed amounts require a new row so historical values are preserved.

Participation updates are column-limited to `outcome`, `report_source`, `reported_at`, and `corrected_at`. Clients cannot alter expected amounts, currency, membership, cycle, saving-plan provenance, or verification fields.

## Vote Privacy

The raw `votes` table has no open-proposal SELECT policy. This prevents access to individual choices, including through client-side counting queries.

Current active club members may read individual votes only after the proposal is `approved`, `rejected`, `expired`, or `cancelled`. Aggregate open-vote turnout and progress require a future fixed-shape trusted function that does not return choices.

## Former-Member Access

A `left` or `removed` membership grants no normal club, roster, strategy, schedule, cycle, saving-plan, participation, or terminal-vote access.

The sole V1 exception is a membership already frozen into an open proposal electorate. That authenticated user may read the open proposal, its candidate allocation snapshot, and their own electorate row, and may cast their one final vote. This access ends when the proposal becomes terminal.

## Trusted-Operation Boundaries

Direct clients cannot perform operations that require atomic cross-table validation:

- club archival
- membership removal, leaving, or ownership changes
- invitation revocation, decline, or expiry jobs
- ownership-transfer creation, acceptance, rejection, or expiry
- proposal opening, cancellation, closing, or approval
- electorate creation
- approved proposal to StrategyVersion creation
- strategy and allocation snapshot mutation after genesis
- schedule mutation and cycle generation
- participation snapshot creation
- member investment transaction creation (use `confirm_investment_day_v1`)
- market price ingest (use `sync-market-data`)
- broker verification

Club creation, genesis strategy creation, owner invitation issuance, invitation acceptance, opening the current Investment Day, and confirming member-reported buys are implemented as private `SECURITY DEFINER` functions with public invoker wrappers. Callers cannot supply `owner_user_id` or another member's identity; `auth.uid()` is authoritative.

`ensure_open_investment_day_v1` may create a TestFlight schedule, an open cycle, a default 2000.00 NOK saving plan, and the caller's participation. It does not write transactions. `confirm_investment_day_v1` allocates the participation amount in integer minor units, inserts missing `buy` rows, and marks that participation confirmed. Retry is idempotent via the unique membership/cycle/target/type constraint. Opening a broker in the app is not a database write.

Email-bound invitations compare `auth.users.email` for the authenticated user and require `email_confirmed_at`. The mobile UI never accepts a typed email as proof of identity. Local Auth has `enable_confirmations = false`, so development signups are stored as confirmed. When confirmations are enabled, an unconfirmed email cannot accept an email-bound invitation.

Saving-plan replacement can preserve rows through an end followed by an insert, but a future trusted operation is still required if product flows require replacement to be atomic.

## Aggregate Privacy Boundary

No raw monetary table is broadly readable and no aggregate function is created in this migration. A future aggregate RPC must:

- require active club membership
- expose a fixed aggregate without arbitrary member filters
- include at least three distinct contributing memberships
- preserve separate expected, member-reported, and independently verified meanings
- return no row-level amounts

Non-monetary club status/count projections require the same careful fixed-shape design where the underlying raw table also contains private amount fields.

## RLS Helper Functions

Minimal `SECURITY DEFINER` helpers live in the unexposed `private` schema:

- `is_active_club_member`
- `is_club_owner`
- `owns_membership`
- `owns_active_membership`
- `can_read_profile`
- `can_access_proposal`
- `can_edit_draft_proposal`
- `can_cast_vote`
- `can_update_participation`

Each helper derives identity internally from `auth.uid()`, returns only a boolean, and sets `search_path = ''`. Public and anonymous execution is revoked. Only authenticated execution is granted, and the `private` schema is not exposed by the local API configuration.

`get_own_preferred_broker` is a separate private `SECURITY DEFINER` reader. It returns only the caller's own `preferred_broker` and does not accept a profile id. Club roster SELECT remains limited to identity columns.

These helpers run with their definer's RLS authority to avoid recursive policy evaluation on memberships, proposals, electorate rows, and participations.

## Profile photos (Storage)

The `avatars` bucket is private. Object keys are `{auth.uid()}/avatar.jpg`. Authenticated users may insert, update, and delete only that exact own path. Reads use `private.can_read_profile` on the folder UUID, matching profile row visibility: self plus identities visible through a club the requester currently belongs to. Former members lose requester-side access because `can_read_profile` requires the requester's membership to be active. Signed URLs are resolved at read time and are not stored on `profiles`.

A public bucket was rejected for V1 so unauthenticated clients cannot fetch avatars from a guessed path.

## Test Coverage

`supabase/tests/authorization_v1.test.sql`, `supabase/tests/club_create_join_v1.test.sql`, `supabase/tests/profile_onboarding_v1.test.sql`, `supabase/tests/preferred_broker_v1.test.sql`, `supabase/tests/instruments_transactions_v1.test.sql`, and `supabase/tests/market_data_v1.test.sql` use pgTAP and the actual `authenticated` Postgres role with JWT claim context. The authorization suite verifies club and profile isolation, immutable history, proposal identity, draft-allocation ownership, vote eligibility and privacy, saving-plan and participation privacy, readiness ownership, target immutability, owner-pointer protection, invitation visibility, former-electorate access, and anonymous denial. The create/join suite verifies atomic club creation, genesis allocations, invitation token issuance, acceptance, duplicate/expired/revoked/wrong-recipient rejection, and unchanged ownership. The profile onboarding suite verifies self-only profile updates, display-name length, club-member identity reads, outsider and former-member denial, and avatar Storage write/read isolation. The preferred-broker suite verifies a nullable default, accepted and rejected broker values, self-only updates, column-level privacy against roster and outsider reads, and that profile completeness still does not require a broker. The instruments/transactions suite verifies real catalog fixtures, own confirm, idempotent retry, wrong club/cycle/target rejection, positive amount and explicit currency, own position reads, and that other members, owners, outsiders, and former members cannot read private monetary rows. The market-data suite verifies verified ISINs, mapping identity, NAV uniqueness, currency/price rejection, authenticated reads, and that mobile users cannot forge prices or gain transaction write grants. Direct SQL `DELETE` on `storage.objects` is blocked by Storage's `protect_delete` trigger; delete authorization is still enforced by `avatars_delete_own` for the Storage API, and tests cover insert/update isolation plus the delete policy predicate.

Run it with:

```sh
pnpm test:db
```

## Known Deferred Security and Business Operations

- Safe invitation context for email-only invitees who do not yet have a token
- Atomic ownership transfer
- Trusted proposal opening, cancellation, closing, and approval
- Allocation-total validation outside genesis create-club
- Schedule changes and production cycle generation beyond the TestFlight ensure helper
- Atomic saving-plan replacement if required by the product flow
- Safe open-vote turnout/progress projection
- Club-level readiness and participation status projections
- Monetary aggregates enforcing the three-member threshold
- Broker evidence ingestion and verification
- Licensed production market-data provider and hosted daily NAV scheduling
- Exceptional support, legal-retention, and post-completion correction workflows
