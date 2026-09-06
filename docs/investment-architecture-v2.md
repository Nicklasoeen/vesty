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

Future open proposals must **not** create policy versions while they are merely open. Proposal approval (Prompt 3) will call trusted/internal `private.create_contribution_policy_version_v1` after a vote. That helper is not executable by `authenticated` clients. There is no public owner RPC to append policy versions. UI hiding is not the security boundary.

`create_club` / `create_club_v2` may still write policy version 1 in the same club-creation transaction. That is initial creation, not a post-creation policy change.

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

`private.resolve_member_expected_contribution_v1` never invents an amount. If the policy is flexible and the member has no commitment, it raises `vesty.contribution_commitment_required`.

Vesty must never silently invent 0, 1,000, 2,000, another member's amount, or a club average.

`ensure_open_investment_day_v1` resolves **this caller** against the policy that will actually be used:

- New cycle: latest policy. If this member is unconfigured, no cycle is created and no amount is invented
- Existing cycle: that cycle's stored `contribution_policy_version_id`, never the latest policy
- If this member is unconfigured, no participation is written and no amount is invented
- A configured member can still open the club cycle
- One unconfigured member does not prevent configured members from receiving their Investment Day
- If the first caller is unconfigured, no new cycle is created yet; a later configured caller can still open it
- If Cycle A already exists and an unconfigured Flexible member later sets their amount, they become eligible for **that same Cycle A**. `expected_amount_minor` is frozen exactly once under Cycle A's stored policy. Setup never switches Cycle A to the latest policy, never invents an amount, and never rewrites another member's participation

Mobile maps that error to an explicit **Set your contribution** state. Completing setup is not Investment Day completion and does not grant streak credit.

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

Flexible privacy: "Only you can see your amount."

Do not imply Vesty collects or holds the money.

### Compatibility

- `create_club` remains as a legacy path. It still writes Flexible policy v1 and does **not** invent a creator amount. New mobile uses `create_club_v2`.
- `confirm_investment_day_v1` / `v2` still confirm from frozen `expected_amount_minor`
- participation / streak completion remains `outcome = confirmed`
- existing migrated historical amounts are not recalculated
- no broker execution, stocks, drift logic, or contribution-policy proposals are introduced

### Existing-club backfill

V1 had no club-wide shared contribution amount. Existing clubs were backfilled as Flexible policy v1. Existing saving-plan rows became commitment versions. Historical `expected_amount_minor` values were never recalculated.
