# Vesty Investment Architecture V2

This document is the product/architecture contract for the four investment layers. It does not replace `docs/domain-model.md` for V1 relational invariants.

Broker Execution and Drift-Aware Execution are **not** implemented in this milestone.

## Four architecture layers

```text
1. Club Strategy
2. Contribution Policy
3. Member Investment Plan
4. Broker Execution Plan
```

These layers are independent. Changing one must not silently rewrite another.

### 1. Club Strategy

What the club aims to own.

Already represented by immutable `strategy_versions` and frozen allocation snapshots.

Strategy weights are **target portfolio weights**. They describe the shared destination mix, not how much cash a member contributes and not how a broker should execute.

Execution planning against those weights is future architecture. This milestone does not introduce execution code.

### 2. Contribution Policy

How members contribute on each Investment Day.

Two modes:

**Equal**

- Every eligible member has the same agreed contribution amount.
- Club members may read the mode, currency, and shared `equal_amount_minor`.
- No private member commitment is required.

**Flexible**

- Each member privately chooses their own contribution amount.
- The shared strategy stays the same.
- Club members may read `mode = flexible`.
- They must not read another member's amount.

Examples:

- Club A: 50% NVIDIA / 30% Tesla / 20% Spotify · Equal · 2,000 NOK
- Club B: the same strategy · Flexible · Nicklas 2,000 / Espen 1,000 / Anna 3,000 (private)

### 3. Member Investment Plan

How a member's contribution is applied to the current strategy for that member.

Not implemented here. Future work.

### 4. Broker Execution Plan

How a member actually buys at their broker, including later drift-aware execution.

Not implemented here. Future work.

## Contribution Policy lifecycle

`contribution_policy_versions` is append-only history:

- unique `(club_id, version_number)`
- `equal` requires `equal_amount_minor > 0`
- `flexible` requires `equal_amount_minor` null
- currency is the club base currency
- clients cannot insert, update, or delete policy rows
- later policy changes create a new version; they never rewrite an old one

There is no mutable "current policy" row and no `current_policy_id`.

### Activation invariant

Creating a `ContributionPolicyVersion` means activating it for the **next eligible/unfrozen Investment Cycle**.

Open or draft proposals must **not** create policy versions. Only successful approved application calls trusted/internal `private.create_contribution_policy_version_v1`. That helper is not executable by `authenticated` clients. There is no public owner RPC to append policy versions. UI hiding is not the security boundary.

`create_club` / `create_club_v2` / `create_club_v3` may still write policy version 1 in the same club-creation transaction. That is initial creation, not a post-creation policy change.

Ordinary Settings UI cannot switch Equal ↔ Flexible or edit an existing equal amount. Contribution style is a shared club decision.

### Equal setup

Create Club asks the owner to choose Same amount and enter a NOK amount.

`create_club_v2` writes:

- club + owner membership + genesis strategy
- ContributionPolicyVersion 1 with `mode = equal` and `equal_amount_minor`

The owner's expected amount derives from that policy. No private commitment is created.

Joining an Equal club does not ask for a private amount. Future cycles freeze the shared policy amount for every eligible member.

### Flexible setup

Create Club asks the owner to choose Flexible amounts and enter **their own** private NOK amount.

`create_club_v2` writes:

- club + owner membership + genesis strategy
- ContributionPolicyVersion 1 with `mode = flexible`
- owner MemberContributionCommitmentVersion 1

Joining a Flexible club creates membership only. The member must set their private amount before they can freeze their first Investment Day. No amount is invented during join.

### Member self-change

A Flexible member may change **their own** amount for future Investment Days without a club proposal.

That write creates a new immutable `MemberContributionCommitmentVersion`. Old versions are retained.

Copy: the new amount applies from the next Investment Day.

If the current Investment Day is already frozen, its `expected_amount_minor` stays unchanged.

Equal members cannot edit a personal amount. Settings shows the shared club amount as read-only.

### Cycle freeze

Resolution chain for a **new** cycle only:

```text
latest ContributionPolicyVersion
+ member commitment if flexible
→ store contribution_policy_version_id on the new cycle
→ freeze member_cycle_participations.expected_amount_minor
```

An **existing** cycle never re-resolves "latest" / `ORDER BY version_number DESC`. It always uses `investment_cycles.contribution_policy_version_id`. An existing participation is returned as stored and is never recalculated from a later commitment or later policy.

For a new cycle:

1. Select the latest `ContributionPolicyVersion`
2. Store `contribution_policy_version_id` on the cycle
3. Resolve each eligible member's expected amount
   - Equal: `policy.equal_amount_minor`
   - Flexible: that member's latest commitment
4. Freeze into `member_cycle_participations.expected_amount_minor`

After freeze:

- `expected_amount_minor` remains the authoritative per-member amount for that cycle
- a later commitment version does not rewrite an old cycle
- a later policy version does not rewrite an old cycle
- future/unfrozen cycles may use the latest policy

### Missing flexible commitment

`private.resolve_member_expected_contribution_v1` never invents an amount. If the policy is flexible and the member has no commitment, it raises `vesty.contribution_commitment_required`. The cycle freeze path uses `private.resolve_member_expected_contribution_at_v1` instead: a Flexible member without a commitment dated at or before the configuration deadline is skipped, with no invented amount and no participation row.

Vesty must never silently invent 0, 1,000, 2,000, another member's amount, or a club average.

Investment Days are generated by the trusted `advance_investment_cycles_v1` job, not by opening Home, Club, or Invest. Authenticated clients read `current_investment_day_v1`. EXECUTE on `ensure_open_investment_day_v1` is revoked.

- A new occurrence is identified by club and local occurrence date (`YYYY-MM-DD` in the schedule timezone), never by “latest open row”
- At the configuration deadline the job freezes strategy, contribution policy, eligible memberships, and each member's expected amount atomically
- Equal includes memberships active at the deadline. Flexible includes only members with a valid private commitment at the deadline
- A member who never opens the app is still frozen if they were eligible
- Late join after freeze is `not_in_snapshot` and is not pending on the historical roster
- Flexible setup after the deadline is `setup_next` and applies from the **next** Investment Day. It does not join Cycle A
- Later policy, strategy, or commitment versions do not rewrite a frozen cycle
- Social `member_count` / `completed_count` / `pending_count` / `all_completed` are computed from frozen participations, not the live membership list

Mobile maps `setup_required` and `setup_next` to contribution setup. Completing setup is not Investment Day completion and does not grant streak credit.

### Authority vs `member_saving_plans`

`member_contribution_commitment_versions` is the authoritative source of future private flexible contribution amounts.

`member_saving_plans` remains only as a legacy compatibility artifact because `member_cycle_participations.saving_plan_id` is still `NOT NULL`. Runtime writes a saving-plan row from an already-resolved amount when none exists. It never resolves a future amount from a saving plan.

Mobile flows maintain a commitment only. They do not ask the user to keep a second saving-plan record.

`saving_plan_id` is not nullable in this milestone. Changing that FK would break historical participation rows.

### Privacy

| Surface | Equal | Flexible |
|---|---|---|
| Club policy read | mode, currency, shared amount | mode, currency, `equal_amount_minor = null` |
| Own commitment | not applicable | own amount only |
| Other member amounts | not applicable | hidden |
| Club owner reading another amount | not applicable | blocked |
| Cycle participation amounts | still self-only | still self-only |
| Aggregates / averages / min / max | not shown | never shown |

Flexible UI never renders another member's amount beside avatars or names. The current user may see a private "Your contribution" row.

### Create Club and Join copy

User-facing language uses:

- Contribution style
- Same amount
- Flexible amounts
- Your amount
- per Investment Day

Do not show domain terms such as ContributionPolicyVersion, commitment, immutable, or minor units.

Flexible privacy: "Only you can see your amount. Other members will not see it."

Do not imply Vesty collects or holds the money.

### Compatibility

- `create_club` remains as a legacy path. It still writes Flexible policy v1 and does **not** invent a creator amount. Clubs created here are `legacy_package`.
- `create_club_v2` remains the package-based Create Club path with explicit Equal or Flexible setup. Meaning unchanged. Clubs created here are `legacy_package`.
- New mobile Create Club uses `create_club_v3` for Simple saving. The client sends a catalog product id and a `client_creation_id`, never allocations, an investment target id, or a clock. The trusted create writes the default Investment Day schedule and the first valid server-clock occurrence in the same transaction. If this month's configuration deadline has already passed, the dashboard shows the next valid month instead of an expired period. Build your strategy / `custom_portfolio` is visible in the UI and rejected by the server.
- `report_investment_day_v1` records `as_planned` or `with_changes` from frozen `expected_amount_minor` without treating that plan as an automatic actual
- participation / streak completion remains `outcome = confirmed`
- existing migrated historical amounts are not recalculated
- no broker execution, stocks, or drift logic are introduced
- contribution-policy **governance** exists; Create Club still chooses Equal or Flexible independently of group type

## Contribution Policy governance

Shared club contribution changes require a proposal and vote. Personal Flexible amount edits do not.

Supported transitions:

- Equal → Equal (shared amount must change)
- Equal → Flexible
- Flexible → Equal (new shared amount required)

Flexible → Flexible is rejected. Members change their own private amount without governance.

### Shared identity, typed payload

`club_proposals` is a thin identity row (`id`, `club_id`, `kind`) so `proposal_electorate_members` and `votes` stay one path.

Strategy proposals keep their existing table, columns, RLS draft edits, and mobile reads.

`contribution_policy_proposals` is the typed payload:

- `base_contribution_policy_version_id` (the exact version being changed, never "latest at approval time")
- `proposed_mode`
- `proposed_equal_amount_minor` (required for Equal, null for Flexible)

Lifecycle states match strategy proposals: draft, open, approved, rejected, expired, cancelled.

A club may have one open **strategy** proposal and one open **contribution** proposal at the same time.

### Stale-base protection

At create, open, and apply, the proposal base must equal the club's latest policy version.

If another change created a newer version first, the old proposal is stale. It must not create a policy version and must not rebase onto the new version. Finalize closes a reached-threshold stale ballot as `rejected` with `resolution_reason = stale_base`. A failed vote writes `vote_rejected`. Clients must not infer the reason from tallies.

### Approval application

`finalize_contribution_policy_proposal_v1` tallies with the same threshold math as strategy proposals. Approval atomically:

1. Inserts exactly one `ContributionPolicyVersion`
2. Stores `source_proposal_id`
3. For Equal → Flexible, writes a new private commitment for every **currently active** membership using the **current Equal** shared amount

Re-finalizing the same approved proposal returns the existing version. It does not create v3/v4.

Rejected, expired, and cancelled proposals create no policy version.

### Equal → Flexible initialization

Electorate = who may vote (frozen at open).

Active memberships at activation = who receive an initial Flexible commitment.

These are different sets. A member who joins after opening does not vote, but if they are active when the proposal is approved they receive the starting commitment.

Left/removed memberships receive no new commitment.

The initialized amount is the Equal amount being left. Historical Flexible commitments are never revived. After Flexible → Equal → Flexible, members start from the latest Equal amount.

Those new commitments are private even though they originated from a shared amount.

### Flexible → Equal

Old private commitments remain stored and private. They are not used while Equal is active. Frozen Flexible cycles keep their original per-member amounts. Future cycles use the new shared amount.

### Frozen cycles

Existing cycles keep `investment_cycles.contribution_policy_version_id` and stored `expected_amount_minor`. A later approved policy never rewrites them.

### Proposer eligibility

Any active member may propose, matching Strategy Proposal draft rules. Contribution proposals are not owner-only.

### Privacy

The contribution payload is club-readable. The read model exposes base/proposed style and a shared Equal amount only.

It never exposes Flexible private amounts, totals, averages, ranges, min, or max.

Open vote choices stay hidden. Terminal votes follow the existing strategy-proposal rule.

### Existing-club backfill

V1 had no club-wide shared contribution amount. Existing clubs were backfilled as Flexible policy v1. Existing saving-plan rows became commitment versions. Historical `expected_amount_minor` values were never recalculated.
