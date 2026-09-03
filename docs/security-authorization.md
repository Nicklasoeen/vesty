# Vesty Security and Authorization v1

## Purpose

This document describes the direct-client authorization boundary implemented by `supabase/migrations/20260903202501_add_rls_authorization_v1.sql`. Product and relational invariants remain authoritative in `docs/domain-model.md` and `docs/database-schema.md`.

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

- `profiles`: users may read themselves plus current-club roster identities, including historical members; they may insert and edit only their own display profile.
- `clubs`: current active members may read; direct inserts, updates, and deletes are blocked.
- `club_memberships`: current active members may read their club's current and historical roster; all direct client writes are blocked.
- `club_invitations`: the current owner may read club invitations; a profile-addressed recipient may read their own invitation. Email-only recipient access is blocked until email is securely bound to authenticated identity.
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

## Sensitive Monetary Data

`member_saving_plans` and `member_cycle_participations` are not club-readable tables. Ownership does not reveal another member's `amount_minor` or `expected_amount_minor`.

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

- club creation and archival
- membership creation, acceptance, removal, leaving, or ownership changes
- invitation creation, revocation, acceptance, decline, or expiry
- ownership-transfer creation, acceptance, rejection, or expiry
- genesis strategy creation
- proposal opening, cancellation, closing, or approval
- electorate creation
- approved proposal to StrategyVersion creation
- strategy and allocation snapshot mutation
- schedule mutation and cycle generation
- participation snapshot creation
- broker verification

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

These helpers run with their definer's RLS authority to avoid recursive policy evaluation on memberships, proposals, electorate rows, and participations.

## Test Coverage

`supabase/tests/authorization_v1.test.sql` uses pgTAP and the actual `authenticated` Postgres role with JWT claim context. Fixtures include:

- Alice, owner of Club A
- Bob, member of Club A
- Charlie, owner of unrelated Club B
- Diana, former member and frozen electorate member of Club A

The suite verifies club and profile isolation, immutable history, proposal identity, draft-allocation ownership, vote eligibility and privacy, saving-plan and participation privacy, readiness ownership, target immutability, owner-pointer protection, invitation visibility, former-electorate access, and anonymous denial.

Run it with:

```sh
pnpm test:db
```

## Known Deferred Security and Business Operations

- Safe invitation context for email-only invitees
- Atomic invitation acceptance and membership creation
- Atomic ownership transfer
- Trusted proposal opening, cancellation, closing, and approval
- Allocation-total and snapshot validation
- Atomic StrategyVersion creation
- Schedule changes and cycle generation
- Atomic saving-plan replacement if required by the product flow
- Safe open-vote turnout/progress projection
- Club-level readiness and participation status projections
- Monetary aggregates enforcing the three-member threshold
- Broker evidence ingestion and verification
- Exceptional support, legal-retention, and post-completion correction workflows
