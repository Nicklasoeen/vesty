# Vesty Security and Authorization v1

## Purpose

This document describes the direct-client authorization boundary implemented by `supabase/migrations/20260903202501_add_rls_authorization_v1.sql`, the Create / Join Club trusted RPCs in `supabase/migrations/20260904110626_add_club_create_join_v1.sql` and `supabase/migrations/20260905121758_curated_investment_packages_v1.sql`, the owner-only rename RPC in `supabase/migrations/20260906150144_rename_club_v1.sql`, the contribution-policy foundation in `supabase/migrations/20260906194634_contribution_policy_v1.sql`, product flows in `supabase/migrations/20260906215200_contribution_policy_product_v1.sql`, hardening in `supabase/migrations/20260906221000_contribution_policy_hardening_v1.sql`, and contribution-policy proposals in `supabase/migrations/20260906223000_contribution_policy_proposals_v1.sql`, the Investment Day transaction RPCs in `supabase/migrations/20260905075952_add_instruments_transactions_v1.sql`, and the market-data tables in `supabase/migrations/20260905084718_add_market_data_v1.sql`, `supabase/migrations/20260905090042_add_market_data_twelve_data_v1.sql`, `supabase/migrations/20260905123104_add_marketstack_provider.sql`, and `supabase/migrations/20260905123105_seed_marketstack_v1_allowlist.sql`. Product and relational invariants remain authoritative in `docs/domain-model.md` and `docs/database-schema.md`.

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
- `contribution_policy_versions`: current active members may read club policy history, including a shared equal amount; they cannot write. Flexible rows store no member amounts.
- `member_contribution_commitment_versions`: only the owning active membership may read; owners do not see other members' private amounts; all client writes are blocked.
- `club_memberships`: current active members may read their club's current and historical roster; all direct client writes are blocked.
- `club_invitations`: the current owner may read club invitations; a profile-addressed recipient may read their own invitation. Email-only recipient access is blocked until email is securely bound to authenticated identity. Shareable token invitations are accepted through `accept_club_invitation`; possession of the token plus `auth.uid()` is the V1 join factor. Token-only invitees cannot read invitation rows before joining.
- `ownership_transfers`: the current owner and active target member may read relevant transfers; all direct client writes are blocked.

Strategies and governance:

- `investment_targets`: authenticated users may read the curated catalog, including inactive targets required for historical interpretation; all client writes are blocked.
- `strategy_versions` and `strategy_allocations`: current active club members may read their club's immutable strategy history; all client writes are blocked.
- `strategy_proposals`: active members may read club proposals and create their own draft. A proposer may edit only the reason or base strategy of their own draft.
- `club_proposals`: thin shared identity for electorate/votes. Active members and frozen open-electorate members may read through `can_access_proposal`. Clients cannot insert, update, or delete.
- `contribution_policy_proposals`: active members may read the shared payload. Clients cannot insert, update, or delete. Writes go through trusted create/open/cancel/finalize RPCs.
- `strategy_proposal_allocations`: authorized proposal readers may read; only the active proposer may insert, update, or delete rows while the proposal remains a draft and the target remains active.
- `proposal_electorate_members`: active club members may read the electorate. A former member in an open frozen electorate may read only their own electorate entry. Client writes are blocked.
- `votes`: eligible electorate members may insert one vote while the proposal is open and its deadline has not passed. No client may update or delete votes. Individual rows are readable only for terminal proposals by current active club members.
- `strategy_readiness`: active members may read club readiness. A member may insert only their own readiness and may update only their own `pending` row to `ready`.

Investment Day coordination:

- `investment_schedules`: current active members may read; client writes are blocked.
- `investment_cycles`: current active members may read cycle metadata; client writes are blocked.
- `member_saving_plans`: only the owning active membership may read exact rows, insert a new active plan, or end its current active plan. Amount history cannot be updated in place and rows cannot be deleted.
- `member_cycle_participations`: only the owning active membership may read the raw row. Authenticated clients have no UPDATE grant. Outcome changes go through `report_investment_day_v1`. Creation, snapshot fields, verification fields, and deletion are blocked.
- `member_investment_day_reports`: only the owning active membership may read rows. Direct insert, update, and delete are revoked. Writes go through `report_investment_day_v1`.
- `member_monthly_saving_setup_attestations`: only the owning active membership may read rows. Direct insert, update, and delete are revoked. Writes go through `confirm_monthly_saving_setup_v1` and `end_monthly_saving_setup_v1`.
- `member_investment_transactions`: only the owning active membership may read rows. Direct insert, update, and delete are revoked. Writes go through `report_investment_day_v1`. Historical v1/v2 amounts are labelled `legacy_plan_assumed` and are not upgraded.
- `member_investment_positions` and `member_position_valuations_v1`: `security_invoker` read models over those transactions, so another member's cost basis, quantity, EUR current value, and amount provenance are not visible.
- `member_investment_lots_v1` and `member_estimated_positions_v1`: same invoker RLS. Modelled quantity and estimated NOK value are private to the owning membership.
- `market_data_instrument_mappings`, `market_prices`, `latest_market_prices`, and `latest_market_price_status`: any authenticated user may read shared catalog NAV/mappings and freshness metadata. Anonymous users have no access. Clients cannot INSERT, UPDATE, or DELETE mappings or prices. Ingest is the `sync-market-data` Edge Function, which requires a secret API key and writes with the service role. `TWELVE_DATA_API_KEY` is server-only and never an `EXPO_PUBLIC_*` value. Yahoo unofficial ingest is an explicit probe, not the production default.
- `fx_rates`, `latest_fx_rates`, and `latest_fx_rate_status`: authenticated SELECT only. Clients cannot write. Ingest is `sync-fx-rates` with the secret key. Norges Bank requires no provider secret.

## Sensitive Monetary Data

`member_saving_plans`, `member_cycle_participations`, `member_investment_transactions`, and `member_monthly_saving_setup_attestations` are not club-readable tables. Ownership does not reveal another member's `amount_minor`, `expected_amount_minor`, transaction amount, position size, or monthly saving setup.

Saving-plan insert policies prove that the membership is active, belongs to `auth.uid()`, belongs to the supplied club, and uses the club base currency. Updates are column-limited to ending an active plan; changed amounts require a new row so historical values are preserved.

Participation updates by clients are revoked. `report_investment_day_v1` is the only authenticated write path for outcome, transactions, and the member report row.

`current_investment_day_v1` is a read-only authenticated projection. It never creates a cycle, freezes strategy or policy, or writes participations. `advance_investment_cycles_v1` is the trusted lifecycle mutation: EXECUTE is granted to `service_role` and revoked from `anon` and `authenticated`. The public reporter still uses server `now()` only; `private.report_investment_day_at_v1` is not executable by authenticated clients. Reporting also requires a frozen participation, `status = open`, and `reporting_opens_at <= now < reporting_closes_at`. `vesty.reporting_not_open` and `vesty.reporting_closed` reject writes outside that window even if a delayed job left `status = open`. Social `club_investment_day_participation_v1` reads frozen participations, including members who later left, and still returns no amounts, quantities, or prices. `ensure_open_investment_day_v1` EXECUTE is revoked from `authenticated`. Opening a broker never writes. `investment_day_broker_handoff_v1` is a read-only authenticated projection of a verified Nordnet HTTPS product page for the caller's frozen cycle; fetching or opening that URL does not write participation, reports, or purchases. Authenticated clients cannot execute `private.investment_day_broker_handoff_v1` or `private.is_allowed_nordnet_handoff_url`. `monthly_saving_setup_v1` is a read-only authenticated projection of the caller's own monthly saving setup and recommended Nordnet context. It is available before the first cycle freeze. `confirm_monthly_saving_setup_v1` stores only a `member_attested` confirmation derived on the server; it never writes purchases, participations, or Investment Day reports and is never `broker_verified`. `end_monthly_saving_setup_v1` ends the caller's active attestation without deleting historical Investment Day data. Authenticated clients cannot execute the private monthly saving implementations. Investment Day reporting uses `report_investment_day_v1`: explicit `as_planned` or `with_changes`, outcomes `confirmed` / `skipped` / `failed`, purchase lines only for `confirmed`, optional quantity and execution price as separate facts, and idempotent retry by `client_report_id`. `as_planned` stores the frozen plan after attestation as `member_attested_plan`. `with_changes` stores only the member's explicit amounts as `member_reported_actual`. Existing confirm v1/v2 EXECUTE is revoked from `authenticated`. Historical v1/v2 amounts stay in place as `legacy_plan_assumed`. Versioned correction is remaining work. Quantity remains private to the owning member.

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
- strategy proposal opening, cancellation, closing, or approval
- strategy electorate creation
- approved strategy proposal to StrategyVersion creation
- contribution-policy proposal application still uses only the trusted finalize path (create/open/cancel/finalize RPCs). Authenticated clients cannot append policy versions.
- strategy and allocation snapshot mutation after genesis
- schedule mutation and cycle generation
- participation snapshot creation
- member investment transaction creation (use `report_investment_day_v1`)
- market price ingest (use `sync-market-data`)
- FX ingest (use `sync-fx-rates`)
- broker verification

Club creation, genesis strategy creation, owner invitation issuance, invitation acceptance, owner club rename, genesis contribution-policy version 1, private contribution commitments, reading the current Investment Day, reading a verified Nordnet Investment Day handoff, confirming a member-attested Nordnet monthly saving setup, and confirming member-reported buys are implemented as private `SECURITY DEFINER` functions with public wrappers. Cycle generation and roster freeze are not client writes: `advance_investment_cycles_v1` is `service_role` only. `create_club_v3` may call the private schedule-ensure and cycle-advance helpers inside the same trusted create transaction, using the server clock. Callers cannot supply `owner_user_id`, another member's identity, a client clock, or raw genesis allocations; `auth.uid()` is authoritative. `create_club` / `create_club_v2` accept only an allowlisted package id and write `legacy_package`. `create_club_v3` accepts only `single_fund` plus an allowlisted catalog product id and a client creation id. Authenticated clients cannot execute the private catalog, fingerprint, URL-allowlist, schedule, advance, `create_club_v3`, Investment Day broker-handoff, or monthly saving setup implementations, and they cannot read or write `private.single_fund_products`, `private.single_fund_broker_listings`, or `private.club_creation_requests`. Broker and cost source URLs are accepted only for the official HTTPS hosts `www.dnb.no` and `www.nordnet.no`. Investment Day Nordnet handoff URLs and monthly saving URLs are accepted only for HTTPS host exactly `www.nordnet.no`, with no userinfo. `create_club_v2` also requires an explicit contribution style and the matching amount. Later ContributionPolicyVersion rows are not a client-authorized write. Authenticated owners and members cannot execute a public policy-version RPC; `private.create_contribution_policy_version_v1` is reserved for trusted/internal governance (`service_role`) and for approved contribution-proposal application. Contribution proposal create/open/cancel/finalize are public invoker wrappers over private `SECURITY DEFINER` functions. Draft or open proposals never create a policy version.

`current_investment_day_v1` is the authenticated Investment Day read. `investment_day_broker_handoff_v1` is the authenticated Nordnet product-page read for a frozen cycle; it never writes. `monthly_saving_setup_v1` is the authenticated monthly saving read; `confirm_monthly_saving_setup_v1` and `end_monthly_saving_setup_v1` are the caller-only attestation writes. `ensure_open_investment_day_v1` EXECUTE is revoked from `authenticated`. `public.report_investment_day_v1` is a `SECURITY DEFINER` wrapper so `authenticated` never receives EXECUTE on `private.report_investment_day_v1` or `private.report_investment_day_at_v1`. Confirm v1/v2 EXECUTE is revoked from `authenticated`. Versioned correction of a completed report is remaining work.

Email-bound invitations compare `auth.users.email` for the authenticated user and require `email_confirmed_at`. The mobile UI never accepts a typed email as proof of identity. Local Auth has `enable_confirmations = false`, so development signups are stored as confirmed. When confirmations are enabled, an unconfirmed email cannot accept an email-bound invitation.

Saving-plan replacement can preserve rows through an end followed by an insert, but a future trusted operation is still required if product flows require replacement to be atomic.

## Aggregate Privacy Boundary

No raw monetary table is broadly readable. Home and Club headlines use the caller's own estimated portfolio (`member_estimated_portfolio_v1`), so they do not expose another member's amount.

`club_estimated_portfolio_v1` and `club_portfolio_history_v1` were removed from the
client API in `20260907080226_remove_club_money_aggregates_v1.sql`. A contributor
threshold does not prevent members from inferring Flexible amounts through
differences or by subtracting their own known amounts.

Authenticated clients can still read their own reported/modelled portfolio and
the existing non-monetary social participation projection. No exact club-wide
invested amount, value, return, average, minimum, maximum, or money history is
available to club members.

## RLS Helper Functions

Minimal `SECURITY DEFINER` helpers live in the unexposed `private` schema:

- `is_active_club_member`
- `is_club_owner`
- `owns_membership`
- `owns_active_membership`
- `can_read_profile`
- `can_access_proposal` (strategy or contribution-policy identity)
- `can_edit_draft_proposal` (strategy drafts only)
- `can_cast_vote` (open strategy or contribution-policy ballots)
- `can_update_participation`

Each helper derives identity internally from `auth.uid()`, returns only a boolean, and sets `search_path = ''`. Public and anonymous execution is revoked. Only authenticated execution is granted, and the `private` schema is not exposed by the local API configuration.

`get_own_preferred_broker` is a separate private `SECURITY DEFINER` reader. It returns only the caller's own `preferred_broker` and does not accept a profile id. Club roster SELECT remains limited to identity columns.

These helpers run with their definer's RLS authority to avoid recursive policy evaluation on memberships, proposals, electorate rows, and participations.

## Profile photos (Storage)

The `avatars` bucket is private. Object keys are `{auth.uid()}/avatar.jpg`. Authenticated users may insert, update, and delete only that exact own path. Reads use `private.can_read_profile` on the folder UUID, matching profile row visibility: self plus identities visible through a club the requester currently belongs to. Former members lose requester-side access because `can_read_profile` requires the requester's membership to be active. Signed URLs are resolved at read time and are not stored on `profiles`.

A public bucket was rejected for V1 so unauthenticated clients cannot fetch avatars from a guessed path.

## Test Coverage

`supabase/tests/authorization_v1.test.sql`, `supabase/tests/club_create_join_v1.test.sql`, `supabase/tests/rename_club_v1.test.sql`, `supabase/tests/contribution_policy_v1.test.sql`, `supabase/tests/contribution_policy_product_v1.test.sql`, `supabase/tests/contribution_policy_proposals_v1.test.sql`, `supabase/tests/profile_onboarding_v1.test.sql`, `supabase/tests/preferred_broker_v1.test.sql`, `supabase/tests/instruments_transactions_v1.test.sql`, `supabase/tests/market_data_v1.test.sql`, `supabase/tests/investment_day_broker_handoff_v1.test.sql`, and `supabase/tests/monthly_saving_setup_v1.test.sql` use pgTAP and the actual `authenticated` Postgres role with JWT claim context. The authorization suite verifies club and profile isolation, immutable history, proposal identity, draft-allocation ownership, vote eligibility and privacy, saving-plan and participation privacy, readiness ownership, target immutability, owner-pointer protection, invitation visibility, former-electorate access, and anonymous denial. The create/join suite verifies atomic club creation, genesis allocations, invitation token issuance, acceptance, duplicate/expired/revoked/wrong-recipient rejection, and unchanged ownership. The rename suite verifies owner-only name updates, trim and length validation, member/outsider/archived rejection, and that direct `UPDATE public.clubs` remains blocked. The contribution-policy suite verifies immutable Equal/Flexible versions, private flexible commitments, cycle freeze, missing-commitment rejection in the resolver, and that public policy reads never leak another member's amount. The profile onboarding suite verifies self-only profile updates, display-name length, club-member identity reads, outsider and former-member denial, and avatar Storage write/read isolation. The preferred-broker suite verifies a nullable default, accepted and rejected broker values, self-only updates, column-level privacy against roster and outsider reads, and that profile completeness still does not require a broker. The instruments/transactions suite verifies real catalog fixtures, own confirm, idempotent retry, wrong club/cycle/target rejection, positive amount and explicit currency, own position reads, and that other members, owners, outsiders, and former members cannot read private monetary rows. The market-data suite verifies verified ISINs, mapping identity, NAV uniqueness, currency/price rejection, authenticated reads, and that mobile users cannot forge prices or gain transaction write grants. Direct SQL `DELETE` on `storage.objects` is blocked by Storage's `protect_delete` trigger; delete authorization is still enforced by `avatars_delete_own` for the Storage API, and tests cover insert/update isolation plus the delete policy predicate. The monthly saving setup suite verifies caller-only reads and confirms, outsider/member/anon denial, server-derived fund/amount/schedule, context before the first cycle freeze, Flexible `setup_required`, idempotent retry, client-id conflicts, `needs_update` after amount/fund/schedule changes, that ending keeps Investment Day rows, and that confirm writes no purchase, participation, or report.

Run it with:

```sh
pnpm test:db
```

## Known Deferred Security and Business Operations

- Safe invitation context for email-only invitees who do not yet have a token
- Atomic ownership transfer
- Trusted **strategy** proposal opening, cancellation, closing, and approval
- Allocation-total validation outside genesis create-club
- Schedule changes and production cycle generation beyond the TestFlight ensure helper
- Atomic saving-plan replacement if required by the product flow
- Safe open-vote turnout/progress projection. Contribution finalize tallies server-side without exposing open choices.
- Club-level readiness and participation status projections
- Live InvestScreen wiring for monthly saving
- DNB monthly saving agreements
- Broker evidence ingestion and verification
- Licensed production market-data provider and hosted daily NAV scheduling
- Exceptional support, legal-retention, and post-completion correction workflows
