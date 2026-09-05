# Vesty Domain Model v1

## 1. Purpose

This document defines the product and domain contract for Vesty v1. It describes the concepts, relationships, lifecycle states, invariants, authorization expectations, and historical guarantees that later database and application designs must preserve.

Vesty is a private coordination and governance layer for investment clubs. It does not hold customer money, custody assets, execute trades, or prove that a broker completed an investment. Each member keeps their money and investments at their own broker.

This document does not define:

- PostgreSQL tables, columns, indexes, migrations, triggers, or RLS policies
- API contracts, background jobs, recurring scheduler infrastructure, or UI
- authentication or identity-provider implementation
- brokerage, market-data, or transaction-import integrations
- portfolio accounting, tax accounting, or personalized investment advice

Entity and attribute names below are domain terminology, not a finalized physical schema.

## 2. Core Domain Principles

1. A user may belong to multiple private clubs, and each club may have multiple members.
2. Every member of a club follows the same target strategy using money held at their own broker.
3. Member contribution intentions may differ in amount, but they do not change the club's percentage allocation.
4. Exact per-member contribution amounts are private. Monetary aggregates may be shown only when they include at least three distinct contributing members.
5. Each club has exactly one base currency. Every authoritative contribution amount in that club uses that currency in V1.
6. A strategy is a complete allocation snapshot whose integer basis points total exactly `10000`.
7. Vesty curates the V1 InvestmentTarget catalog. Targets represent concrete purchasable products (funds, ETFs, stocks) without coupling their core identity to a broker. Generic exposure categories are not instruments.
8. Planned amounts, member reports, and future broker verification are different facts and must never be conflated.
9. The owner chooses an allowlisted curated investment package at club creation. The server resolves that package into immutable StrategyVersion 1. Every later strategy change requires a proposal and vote, and approval creates a new immutable version. Clients cannot invent targets or percentages.
10. Proposal rules, electorate, votes, results, strategy history, ownership transfers, and membership tenures must remain auditable.
11. Each active club has exactly one active owner. The only V1 membership roles are `OWNER` and `MEMBER`.
12. A club's voting mode is selected at creation and remains locked for V1.
13. Governance and authorization are enforced by the server/database in the eventual implementation. The mobile client is not authoritative.
14. Money uses integer minor units with an explicit currency. Allocations use integer basis points. Authoritative financial values never use floating point.
15. Historical records are preserved when a member leaves or is removed, without preserving that person's access to the live club.
16. Vesty records coordination intent and evidence quality honestly. A manual confirmation is a member report, not broker verification.
17. Each electorate membership may cast at most one immutable vote. A submitted vote cannot be replaced.
18. A participation report may be corrected by its member only while the InvestmentCycle is `OPEN`; normal member-facing edits stop when the cycle is `COMPLETED`.

## 3. Domain Map

```text
Vesty-managed catalog
└─ InvestmentTarget *

Identity boundary
└─ User
   ├─ ClubInvitation ───────────────────────────────┐
   └─ ClubMembership (one membership tenure) ──────┤
                                                   ▼
Club
├─ GovernanceRuleSet
├─ OwnershipTransfer *
├─ StrategyVersion *
│  └─ StrategyAllocation * ──references/snapshots──> InvestmentTarget
├─ StrategyProposal *
│  ├─ ProposedStrategySnapshot
│  ├─ ProposalElectorate *
│  └─ Vote *
├─ InvestmentSchedule *
│  └─ generates
│     └─ InvestmentCycle *
│        ├─ MemberCycleParticipation * ──for──> ClubMembership
│        └─ MemberInvestmentTransaction * ──for──> ClubMembership + InvestmentTarget
└─ ClubMembership
   ├─ MemberSavingPlan *
   └─ StrategyReadiness * ──for──> StrategyVersion

Future integration boundary
Broker adapter / import
└─ External contribution evidence
   └─ Verification assessment
      └─ relates to MemberCycleParticipation without replacing member-reported facts
```

`*` means that multiple historical records may exist. The map shows domain ownership, not table design.

## 4. Entities

### 4.1 User

**Responsibility:** Represent the person/account identity referenced by Vesty domain records.

**Important attributes:** Stable identity, account lifecycle, and only the minimum display information needed by the product.

**Relationships:** A user may receive invitations and have multiple club membership tenures.

**Lifecycle:** Account lifecycle belongs primarily to the identity/authentication boundary. Account deletion or anonymization must not cascade-delete historical memberships, proposals, or votes.

**Invariants:**

- One user identity may have at most one active membership in a given club.
- A rejoining user receives a new membership tenure rather than reactivating or rewriting an old one.

**Does not own:** Broker accounts, club roles globally, strategy allocations, contribution amounts, or authorization truth supplied by the client.

### 4.2 Club

**Responsibility:** Be the private collaboration and authorization boundary for one investment club.

**Important attributes:** Stable identity, name, lifecycle status, creation time, one base currency, and the governance rule set selected at creation.

**Relationships:** Owns memberships, invitations, ownership transfers, strategy history, proposals, schedule history, and investment cycles. Strategy allocations reference Vesty-managed InvestmentTargets.

**Lifecycle:**

```text
active -> archived
```

Archiving stops new operational activity but preserves history. A club with meaningful history is archived rather than hard-deleted through normal V1 product flows. Exceptional legal or privacy deletion is a future retention process outside normal club lifecycle.

**Invariants:**

- An active club has exactly one active owner membership.
- The base currency is one explicit ISO currency; NOK is the expected Norwegian V1 default.
- All authoritative member saving-plan and cycle expectation amounts use the club base currency.
- The governance rule set is chosen when the club is created and is not editable in V1.
- At most one ownership transfer is pending at a time.
- At most one strategy version is effective at a given instant.
- At most one schedule revision is effective at a given instant.
- All child records belong to the same club boundary.

**Does not own:** Customer money, pooled holdings, broker credentials, orders, trades, custody, or member-specific allocation percentages.

### 4.3 ClubInvitation

**Responsibility:** Represent an offer to join a club before membership exists.

**Important attributes:** Club, inviting owner membership, intended invitee identity or contact, creation time, expiration time, and terminal outcome.

**Relationships:** Belongs to a club; is issued by the active owner membership; acceptance creates a new `ClubMembership`.

**Lifecycle:**

```text
pending -> accepted
        -> declined
        -> revoked
        -> expired
```

**Invariants:**

- A pending invitation grants no club access and no voting rights.
- A club may issue invitations only after StrategyVersion 1 has been finalized.
- Invitation context may present the club's current effective strategy before acceptance without granting broader club access.
- Acceptance does not freeze the strategy from invitation time; the new member joins under the strategy effective when membership is created.
- V1 invitations create `MEMBER` memberships; ownership is transferred only to an existing active member.
- Only the server-validated intended recipient may accept or decline an invitation.
- Acceptance and active membership creation are one atomic domain action.
- An accepted, revoked, declined, or expired invitation is immutable.
- Duplicate pending invitations for the same club and intended person should be prevented.

**Does not own:** Ongoing role changes, membership history, or votes. `invited` is therefore not a membership state.

### 4.4 ClubMembership

**Responsibility:** Represent one continuous tenure of one user in one club.

**Important attributes:** Club, user, role, joined time, terminal time, status, and who performed a removal when applicable.

**Relationships:** Belongs to one club and one user; may own saving plans, strategy-readiness acknowledgements, cycle participations, proposals, and votes.

**Lifecycle:**

```text
active -> left
       -> removed
```

`left` and `removed` are terminal. Rejoining creates a new membership record.

**V1 roles:**

- `OWNER`
- `MEMBER`

Both have equal voting weight. Ownership is an administration role, not a larger economic stake.

**Invariants:**

- At most one active membership per club and user.
- Only an active membership may perform current club actions, except for the narrowly scoped right of a frozen proposal electorate member to complete that already-open ballot.
- A membership tenure is never deleted merely because it becomes inactive.
- Historical references use the membership tenure, not only the user, so a later rejoin does not rewrite old participation.
- Exactly one active membership has role `OWNER` while the club is active.
- The owner cannot leave, be removed, or become inactive while still owner.
- An accepted ownership transfer atomically changes the current owner to `MEMBER` and one active member to `OWNER`.

**Does not own:** A custom strategy, a share of the club, pooled assets, or a permanent readiness flag.

### 4.5 OwnershipTransfer

**Responsibility:** Represent the explicit, accepted, and auditable process for transferring ownership to an active member.

**Important attributes:** Club, initiating owner membership, target member membership, status, initiated time, expiration time, terminal actor when applicable, and terminal action time.

**Relationships:** Belongs to one club and references its current owner and one active target member.

**Lifecycle:**

```text
PENDING -> ACCEPTED
        -> REJECTED
        -> EXPIRED
```

**Invariants:**

- Only the current owner may initiate a transfer.
- The target is a different active `MEMBER` in the same club.
- At most one transfer is `PENDING` for a club.
- While pending, the initiator remains `OWNER` and the target remains `MEMBER`.
- The target member is the only actor who may accept or reject.
- The target must still be an active `MEMBER` at acceptance; otherwise the transfer cannot complete and expires.
- Acceptance atomically demotes the existing owner to `MEMBER`, promotes the target to `OWNER`, and records the acceptance time.
- Exactly one active owner exists immediately before and after acceptance.
- Rejection or expiry leaves both membership roles unchanged.
- The current owner cannot leave while the transfer is pending because they still own the club.
- Terminal transfer records are immutable and retained for audit.

**Does not own:** Additional permissions, voting weight, club economics, or a general-purpose approval workflow.

This small dependent entity is justified by pending acceptance and audit history; mutable fields on `Club` would lose rejected, expired, or repeated transfer attempts.

### 4.6 InvestmentTarget

**Responsibility:** Give Vesty a consistent, broker-agnostic identity for a supported long-term investment product referenced across clubs and strategy history.

**Important attributes:** Stable Vesty identifier, product name, target kind, lifecycle status, and optional broker-neutral instrument metadata such as ISIN, ticker, and exchange.

V1 target kinds:

- `FUND`
- `ETF`
- `STOCK`

A target is a purchasable product such as `DNB Teknologi A` or `KLP AksjeGlobal Indeks P`. Labels such as Technology or Norway are not valid production targets. The four TestFlight funds now have verified official names, share classes, ISINs, and NOK currency. Ticker, exchange, and `provider_symbol` stay unset for these mutual funds. Market-data provider symbols live on a separate mapping. Instrument currency is metadata; V1 does not convert FX.

**Relationships:** Is managed by Vesty and may be referenced by allocation snapshots across multiple clubs. Future market-data and broker mappings may reference it from outside the V1 core domain.

**Lifecycle:**

```text
ACTIVE <-> INACTIVE
```

An inactive target remains valid in historical snapshots but cannot be added to a new proposal or genesis strategy unless Vesty reactivates it.

**Invariants:**

- Ticker symbols and broker product IDs are not identity.
- Users and clubs cannot create arbitrary global targets in V1.
- Vesty curates each target and should use broker-neutral identifiers such as ISIN where available.
- Market-data and broker identifiers are optional future mappings, not dependencies of Club, StrategyVersion, StrategyProposal, or Vote.
- Each strategy snapshot contains the target descriptor needed to interpret history, so later label or metadata changes cannot rewrite historical meaning.
- A target referenced by history is not hard-deleted.
- Vesty must not change a referenced target's identity in a way that changes what an immutable strategy meant.

**Does not own:** Market prices, holdings, broker availability, orders, suitability, or member-specific instrument choices.

This curated catalog lets clubs identify the same actual savings product consistently without designing a full securities master, broker mapping model, or market-data architecture in V1.

### 4.7 StrategyVersion

**Responsibility:** Represent one immutable, complete target-allocation policy established for a club.

**Important attributes:** Club, monotonically increasing version number, complete allocations, origin (`GENESIS` or `PROPOSAL`), `created_by`, `created_at`, source proposal and approval time for proposal-origin versions, and effective time.

**Relationships:** Belongs to a club; contains `StrategyAllocation` records; either has genesis origin or is based on exactly one approved proposal; is referenced by investment cycles and `StrategyReadiness` records.

**Lifecycle labels:**

```text
scheduled -> active -> superseded
```

These labels should normally be derived from `effective_at` and later versions rather than stored as mutable truth.

**Invariants:**

- Allocations total exactly `10000` basis points.
- Version numbers are unique and increasing within a club.
- Once created, a version and its allocations are immutable.
- At most one version may be created from a proposal.
- Only StrategyVersion 1 may have `GENESIS` origin and no source proposal.
- Every version after StrategyVersion 1 has `PROPOSAL` origin and references exactly one approved proposal.
- A proposal-origin version's `effective_at` is not earlier than its `approved_at`.
- The genesis version's `effective_at` is not earlier than its `created_at`.
- Version order and effective-time order are strictly monotonic: a successor's `effective_at` is later than its base version's `effective_at`.
- A version governs the half-open interval from its `effective_at` until the next version's `effective_at`; active intervals cannot overlap.
- The strategy active at time `t` is deterministically derivable from effective times and version order.

**Does not own:** Draft edits, votes, member amounts, actual trades, actual holdings, or broker configuration.

No separate mutable `Strategy` entity is recommended in V1. The club's strategy is the ordered history of its `StrategyVersion` records.

### 4.8 StrategyAllocation

**Responsibility:** Be one line in a complete strategy-version snapshot.

**Important attributes:** Strategy version, investment target reference, snapshotted target descriptor, integer basis points, and stable line order for display and deterministic rounding ties.

**Relationships:** Belongs to exactly one strategy version and identifies one investment target.

**Lifecycle:** Created with its strategy version and immutable thereafter.

**Invariants:**

- Basis points are positive integers.
- A target appears at most once in a strategy version.
- All lines together total exactly `10000`.
- The referenced target is a valid Vesty-managed target and was active when the genesis strategy was finalized or the proposal snapshot was frozen.

**Does not own:** A monetary amount, member assignment, market value, transaction, or broker product mapping.

### 4.9 StrategyProposal

**Responsibility:** Govern a proposed replacement for the club's strategy.

**Important attributes:** Club, proposing membership, base strategy version, complete candidate strategy snapshot, lifecycle state, opening/deadline/closure times, voting-rule snapshot, electorate size, required yes count, outcome, approval time when approved, and intended effective time.

**Relationships:** Belongs to a club; references one base strategy version; owns a proposed strategy snapshot, frozen electorate, and votes; may create exactly one new strategy version.

**Lifecycle:** Defined in section 6.

**Invariants:**

- A draft may be edited or cancelled freely by its creator while that membership remains active.
- Opening freezes the base version, candidate snapshot, electorate, voting rule, required yes count, deadline, and activation policy.
- An open candidate is a complete allocation snapshot of active Vesty-managed targets totaling `10000` basis points.
- The active creator may cancel an open proposal only while zero votes have been cast.
- Open-proposal cancellation and the first vote must be serialized atomically so cancellation cannot succeed after a vote is accepted.
- Once the first vote is cast, normal V1 cancellation is forbidden and the proposal resolves through approval, rejection, or expiry.
- Approval creates a new version from exactly that frozen snapshot.
- A draft's base version must still be current when it opens.
- A club may have multiple `DRAFT` and terminal strategy proposals.
- At most one strategy proposal may be open for a club in V1, preventing its base version from becoming stale through a competing approval.
- `APPROVED`, `REJECTED`, `EXPIRED`, and `CANCELLED` are terminal and can never return to `OPEN`.

**Does not own:** Mutable pointers to the club's current allocations, actual broker changes, or proof that members implemented the approved strategy.

V1 should model this specifically as a strategy-change proposal rather than introduce a generic proposal framework.

### 4.10 ProposalElectorate

**Responsibility:** Preserve the exact frozen set of memberships eligible to vote when a proposal opens.

**Important attributes:** Proposal, frozen membership-tenure entries, snapshot time, electorate size, and the resulting required yes count.

**Relationships:** Belongs to one proposal and contains references to eligible membership tenures in the same club.

**Lifecycle:** Created atomically when voting opens and immutable thereafter.

**Invariants:**

- Exactly one electorate snapshot exists for every proposal that reached `OPEN`, including after it becomes terminal. A draft cancelled before opening has none.
- Each membership tenure appears at most once in the snapshot.
- Every entry represents an eligible voter and counts toward electorate size `N`; excluded memberships have no entry.
- The frozen electorate determines the voting denominator and required yes count.
- Joining after the proposal opens does not add voting eligibility.
- Leaving or removal after opening does not remove the historical entry, reduce the denominator, or erase a cast vote.
- Leaving or removal after opening does not revoke eligibility to cast on that already-frozen proposal.
- A former electorate member's temporary access is limited to the frozen proposal snapshot and ballot until the proposal becomes terminal; it does not restore general club access.

**Does not own:** A vote choice or continuing club access.

The snapshot is recommended because an integer voter count alone cannot answer who was eligible or explain a historical result.

### 4.11 Vote

**Responsibility:** Record one eligible membership tenure's decision on one open proposal.

**Important attributes:** Proposal, membership tenure, choice, and cast time.

Recommended V1 choices:

- `YES`
- `NO`

No explicit abstention is needed in V1; not voting is recorded by the absence of a vote against the frozen electorate.

**Relationships:** Belongs to one proposal and one electorate membership.

**Lifecycle:** A vote is final and immutable once cast.

**Invariants:**

- At most one vote exists per proposal and membership tenure.
- A member cannot replace `YES` with `NO`, replace `NO` with `YES`, or retract a submitted vote.
- Contribution amount and role do not affect voting weight.
- The voter must be in the frozen electorate and authorized to act when casting.
- A valid cast vote remains part of the result if the member later leaves or is removed.
- While the proposal is `OPEN`, members may see aggregate turnout and progress but not individual vote choices.
- After the proposal becomes terminal, individual historical votes are visible to current club members.

**Does not own:** The threshold, proposal result, membership status, or economic ownership.

### 4.12 InvestmentSchedule

**Responsibility:** Define the club's recurring cadence for future Investment Days.

**Important attributes:** Club, immutable schedule revision number, recurring-schedule value, timezone, default configuration-deadline offset, effective interval, and lifecycle.

**Relationships:** Belongs to a club and generates investment cycles. A cycle records the exact schedule revision that generated it.

**Lifecycle:**

```text
scheduled -> active -> replaced
                   -> ended
active <-> paused
```

A material schedule change creates a new schedule revision for future cycles rather than rewriting generated occurrences.

**Invariants:**

- At most one schedule revision is active at an instant.
- Every generated occurrence has a stable occurrence key and cannot be generated twice.
- Schedule changes do not rewrite existing cycles.
- Calendar behavior and timezone are explicit.
- The V1 default configuration deadline is approximately three days before Investment Day, while the exact offset may remain product-configurable.

**Does not own:** A specific Investment Day outcome, member amounts, scheduler execution state, or broker instructions.

### 4.13 InvestmentCycle

**Responsibility:** Represent one concrete occurrence of the club's recurring Investment Day.

**Important attributes:** Club, occurrence key, `investment_day_at`, `configuration_deadline_at`, timezone, schedule revision, applicable strategy version, lifecycle state, generation time, and cancellation reason when relevant.

**Relationships:** Belongs to a club and schedule revision; references the strategy version intended for that occurrence; owns cycle-participation snapshots.

**Lifecycle:** Defined in section 6.

**Invariants:**

- One cycle exists per club and schedule occurrence key.
- `configuration_deadline_at` is earlier than `investment_day_at`.
- The applicable strategy version and expected member participation are frozen no later than `configuration_deadline_at`.
- Expected amounts are copied from the saving plans applicable at the deadline and never derived historically from current plans.
- Cancelling a cycle does not delete its record or any participation already recorded.

**Does not own:** Actual broker transfers, trades, settlement, or a claim that all members invested.

“Investment Day” is Vesty's planned coordination date. It is not evidence that a broker debited cash or executed a trade on that exact date. `InvestmentCycle` is the precise domain term because it includes configuration and reporting around the date.

### 4.14 MemberSavingPlan

**Responsibility:** Represent one member's standing intended recurring contribution configuration for a club.

**Important attributes:** Membership tenure, `amount_minor`, explicit currency, `active_from`, optional `active_until`, lifecycle state, creation time, and replacement/update metadata.

**Relationships:** Belongs to one membership tenure. The plan effective at an Investment Cycle's configuration deadline supplies that cycle's expected amount.

**Lifecycle:**

```text
active -> inactive
active -> replaced by a new effective plan
```

A changed amount creates a replacement with a new effective period. It does not rewrite the plan used by historical cycles.

**Invariants:**

- Amount uses integer minor units and the club's base currency.
- An active plan amount is positive.
- At most one plan is effective for a membership at an instant.
- Exact plan amounts are visible only to that member.
- A saving plan is an intention recorded by Vesty, not a deposit, receivable, trade, broker instruction, or proof that money was invested.

**Does not own:** Strategy percentages, another member's amount, broker credentials, or execution evidence.

### 4.15 StrategyReadiness

**Responsibility:** Record whether a membership reports being configured for one specific strategy version.

**Important attributes:** Membership tenure, strategy version, status, and `confirmed_at` when ready.

**Relationships:** Belongs to one membership tenure and one strategy version in the same club. Club-level readiness such as “3 / 4 ready for Strategy v5” is an aggregate over these records.

**Lifecycle:**

```text
PENDING -> READY
```

When a future strategy version is approved, each relevant active membership begins `PENDING` for that version. Readiness for an older version remains historical.

**Invariants:**

- At most one readiness record exists per membership tenure and strategy version.
- Readiness belongs to `membership + strategy_version`, never permanently to membership.
- `READY` is member-confirmed preparation and is not proof of broker execution.

**Does not own:** Cycle completion, contribution amounts, actual trades, or broker verification.

### 4.16 MemberCycleParticipation

**Responsibility:** Preserve one member's expected amount, latest member-reported outcome, and independent verification evidence for one Investment Cycle.

**Important attributes:** Investment cycle, membership tenure, snapshotted expected `Money`, latest member-reported outcome, initial report time, correction time, member-report source, verification state, verification source, and verification time.

**Relationships:** Belongs to one Investment Cycle and one membership tenure. It snapshots the `MemberSavingPlan` applicable at the cycle's configuration deadline. Future external evidence may attach to this participation without replacing member-reported facts.

**Outcome states:**

- `EXPECTED`: No outcome has been reported.
- `CONFIRMED`: The scheduled investment was reported completed.
- `SKIPPED`: The member reported that they intentionally did not complete it.
- `FAILED`: The member reported that the saving plan did not complete successfully.

**Member-report source:**

- `MEMBER_REPORTED`

**Future verification sources:**

- `IMPORT`
- `BROKER_API`
- `EMBEDDED_BROKER`

`VERIFIED` is evidence quality, not an outcome parallel to `CONFIRMED`, `FAILED`, or `SKIPPED`. The durable model therefore keeps a separate verification state such as `UNVERIFIED | VERIFIED`. A future physical design must not collapse outcome and verification into one mutually exclusive status field. A product-facing combined status may display “Verified” when appropriate.

Examples:

```text
outcome = FAILED
member_report_source = MEMBER_REPORTED
verification = UNVERIFIED

outcome = EXPECTED
verification = VERIFIED
verification_source = BROKER_API
```

**Lifecycle:**

```text
EXPECTED -> CONFIRMED
         -> SKIPPED
         -> FAILED

While cycle is OPEN:
CONFIRMED | SKIPPED | FAILED -> any other member-reported outcome

UNVERIFIED -> VERIFIED
```

V1 member actions produce `MEMBER_REPORTED` outcomes and remain unverified. While the cycle is `OPEN`, the member may correct their own outcome; the record keeps the latest report plus appropriate original-report and correction timestamps without introducing a revision ledger. Future external evidence may add verification and its own source without erasing or replacing the manual outcome.

**Invariants:**

- At most one participation exists per cycle and membership tenure.
- Expected amount and currency are frozen no later than `configuration_deadline_at`.
- Historical expected amounts are never derived only from the member's current saving plan.
- A member may report only their own participation.
- Member-reported outcome corrections are allowed only while the cycle is `OPEN`.
- When the cycle becomes `COMPLETED`, the member-reported outcome is immutable through normal member-facing V1 flows.
- A correction keeps `member_report_source = MEMBER_REPORTED`.
- A manual confirmation must never set verification to `VERIFIED`.
- Absence of a report remains `EXPECTED`; it is not silently converted to failed, skipped, or completed.
- Exact expected and reported member amounts are private.
- A participation never represents pooled club money.

**Does not own:** The recurring schedule, mutable membership state, broker orders, custody, or settlement truth.

### 4.17 MemberInvestmentTransaction

**Responsibility:** Record one member-reported investment event against a real InvestmentTarget for a cycle.

**Important attributes:** Club, membership, investment cycle, investment target, transaction type (`BUY` in V1), positive `Money` amount, optional quantity and unit price, executed/reported time, source (`MANUAL` in V1), and verification status (`MEMBER_REPORTED` in V1).

**Relationships:** Belongs to one membership tenure and one Investment Cycle. References a catalog InvestmentTarget that must appear in that cycle's strategy version. Future broker-sync rows may use `BROKER_SYNC` / `BROKER_VERIFIED` without rewriting manual rows.

**Invariants:**

- V1 writes `BUY` only. Quantity and unit price stay null unless a later lot/price flow supplies them. They are never derived from amount.
- Amount currency is the club base currency: the reported contribution, not an FX-converted instrument purchase.
- At most one V1 buy exists per membership, cycle, and target.
- Ordinary UX does not mutate a finalized cycle's transactions.
- Exact transaction amounts and derived position sizes are private to the owning active membership. Club owners do not automatically see them.
- Positions are derived cost basis. No current market value is stored.

**Does not own:** Broker execution, market prices, FX, or club-level holdings.

## 5. Value Objects

### Money

```text
Money {
  minor_units: integer
  currency: Currency
}
```

- `minor_units` is an integer in the currency's minor unit, for example `200000 NOK = 2,000.00 NOK`.
- Currency is mandatory; a bare integer is not Money.
- Contribution intentions must be positive while active.
- Money values of different currencies cannot be added or compared without an explicit, sourced conversion operation.

### Currency

- Use a validated currency code and its known minor-unit exponent.
- Each club has exactly one base currency in V1; NOK is the expected Norwegian default.
- Every authoritative saving-plan and cycle expected amount must match its club's base currency.
- Other ISO currencies remain supported for clubs created with a different base currency.
- Investment-target trading currency is market metadata and is not the same concept as the member's contribution currency.

### AllocationBasisPoints

- Integer range for one allocation line: `1..10000`.
- One complete strategy allocation set must sum exactly to `10000`.
- No tolerance, epsilon, or floating-point comparison is allowed.

### GovernanceRuleSet

An owned value of `Club`, not a standalone aggregate in V1:

```text
GovernanceRuleSet {
  threshold_kind: SIMPLE_MAJORITY | SUPERMAJORITY | UNANIMOUS
}
```

The rule is selected at club creation and is effectively locked for V1. The rule and computed electorate/required-yes count are still snapshotted when a proposal opens so its historical result is self-contained. Governance-change proposals are not part of V1.

### VotingThreshold

For frozen electorate size `N`:

- Simple majority: `floor(N / 2) + 1` yes votes.
- Supermajority: `ceil(3 × N / 4)` yes votes.
- Unanimous: `N` yes votes.

The denominator is the frozen electorate, not only votes cast. Calculations use integer arithmetic.

For `N = 4`:

- Simple majority requires `3` yes votes.
- Supermajority requires `3` yes votes.
- Unanimous requires `4` yes votes.

### RecurringSchedule

Conceptual fields include:

- cadence, initially monthly
- calendar day or recurrence rule
- IANA timezone
- effective start and optional end
- explicit behavior for a day absent from a month
- configuration-deadline offset, approximately three days before Investment Day by default
- reporting window boundaries

The schedule describes recurrence only. It does not itself represent an occurrence or execute a job.

### ProposedStrategySnapshot

A complete immutable candidate once voting opens:

- base strategy version
- ordered allocation lines
- target references and historical target descriptors
- integer basis points totaling `10000`

### Participation reporting and verification sources

Member-reported outcomes use:

- `MEMBER_REPORTED`

Future verification may use:

- `IMPORT`
- `BROKER_API`
- `EMBEDDED_BROKER`

`MEMBER_REPORTED` is the V1 source for a member's own confirmation, skip, or failure report. It can never produce `VERIFIED`. `IMPORT`, `BROKER_API`, and `EMBEDDED_BROKER` are separate future verification sources. Changing verification must not erase or overwrite an earlier member report.

## 6. Lifecycle Models

### ClubMembership

```text
active --member leaves--------> left
active --authorized removal---> removed
```

Terminal memberships never return to active. Rejoining creates a new tenure.

### OwnershipTransfer

```text
PENDING -> ACCEPTED
        -> REJECTED
        -> EXPIRED
```

Only target acceptance changes ownership. The current owner and target membership roles remain unchanged for every other outcome.

### StrategyProposal

V1 state model:

```text
DRAFT --submit----------------------> OPEN
DRAFT --active creator abandons----> CANCELLED

OPEN --threshold reached------------> APPROVED
OPEN --approval impossible---------> REJECTED
OPEN --deadline reached------------> EXPIRED
OPEN --zero votes + active creator-> CANCELLED
```

- `DRAFT` is editable and has not entered governance.
- `OPEN` has a frozen candidate, electorate, voting rule, threshold, and deadline.
- `APPROVED` means the yes threshold was reached and a new immutable `StrategyVersion` was created.
- `REJECTED` means approval became mathematically impossible, or all eligible votes were cast without reaching the threshold.
- `EXPIRED` means the deadline passed before approval or rejection was reached.
- `CANCELLED` means the active creator abandoned a draft or cancelled an open proposal before any vote was cast.

The four outcomes are terminal. A terminal proposal never returns to `OPEN`.

After the first vote is cast, normal V1 user actions cannot cancel the proposal. Exceptional administrative or legal intervention is outside the normal V1 domain flow.

### Vote

```text
NOT_CAST -> YES | NO
```

One electorate membership may cast at most one vote. A submitted choice is immutable and cannot be changed or retracted.

### StrategyVersion

```text
created/approved for future effective_at -> scheduled
effective_at reached                     -> active
later version becomes effective          -> superseded
```

These are temporal interpretations. The record and allocation snapshot remain immutable throughout.

### InvestmentCycle

```text
UPCOMING -> OPEN -> COMPLETED
    |         |
    └---------┴----> CANCELLED
```

- `UPCOMING`: A generated future cycle. Configuration may change until `configuration_deadline_at`.
- `OPEN`: The applicable strategy and expected participation are frozen and the investment/reporting window is active.
- `COMPLETED`: The cycle is closed and member reports are immutable through normal member-facing flows. This does not claim that every expected investment completed or prevent future independent evidence from attaching separately.
- `CANCELLED`: The occurrence will not proceed or was explicitly cancelled. History remains.

An “overdue” indicator is derived from time and missing reports, not a stored lifecycle state.

### MemberSavingPlan

```text
ACTIVE -> INACTIVE
ACTIVE -> REPLACED
```

A replacement preserves the prior effective period and becomes the standing plan for future cycle deadlines.

### StrategyReadiness

```text
PENDING -> READY
```

Each new future strategy version creates a new readiness context; an older `READY` state never carries forward.

### MemberCycleParticipation

```text
EXPECTED -> CONFIRMED
         -> SKIPPED
         -> FAILED

While cycle is OPEN:
CONFIRMED | SKIPPED | FAILED -> any other member-reported outcome

UNVERIFIED -> VERIFIED
```

The first dimension describes expected/member-reported outcome. The second describes independent evidence quality. `MEMBER_REPORTED` can change the first dimension but can never produce `VERIFIED`. When the cycle becomes `COMPLETED`, normal member-facing outcome changes stop.

## 7. Strategy Versioning

### Creation

During club creation/setup, the owner defines the complete initial strategy. Finalizing it creates StrategyVersion 1 through a special bootstrap path with:

- `origin = GENESIS`
- `created_by` referencing the owner membership
- `created_at`
- `effective_at`
- no source proposal

StrategyVersion 1 must reference valid active InvestmentTargets, contain a complete allocation snapshot totaling exactly `10000` basis points, and become immutable once finalized. New members joining an existing club join under the strategy effective at that time.

Every strategy version after version 1 originates from one approved StrategyProposal. There is no second proposal-free path.

### Proposal relationship

A proposal references the exact base strategy version from which it was prepared. While draft, its candidate may be edited. Opening the vote freezes:

- base version
- complete proposed allocations
- target descriptors
- electorate
- voting rule and computed threshold
- deadline
- intended `effective_at` or target future cycle

### Approval

Approval is one atomic domain operation:

1. Confirm the proposal is open.
2. Confirm the threshold is satisfied.
3. Confirm its base version is still the latest approved version in the linear history.
4. Create exactly one new strategy version from the frozen proposed snapshot.
5. Record `approved_at` and an `effective_at` strictly later than the base version's effective time.
6. Close the proposal as approved.

A club may have multiple draft and historical strategy proposals, but at most one proposal may be `OPEN` at a time. Before a draft opens, its base must still be the club's latest strategy version; otherwise the draft must be revised against that version. This prevents competing approved branches without adding another proposal state.

### Immutability and historical access

- Version records and allocation lines are never updated in place.
- A correction is another proposal and another version.
- Effective times increase with version order, so a later version cannot become active before its base or reactivate an older policy.
- The active strategy at any past instant is derived from `effective_at`.
- Cycles reference the exact strategy version used, even after a later version becomes active.
- Target descriptors in allocation snapshots preserve meaning if target metadata later changes.

### Activation

For proposal-origin versions, `approved_at` records governance completion. For every version, `effective_at` records when the policy begins governing new cycles. Approval and effectiveness are intentionally different facts; the genesis version has creation provenance instead of a governance approval.

Recommended V1 behavior:

- A proposal specifies its intended future effective time or cycle before voting opens.
- Approval and effectiveness are separate recorded facts.
- The new version normally becomes effective for the first future Investment Cycle whose `configuration_deadline_at` still gives members the product-configured preparation period, approximately three days by default.
- A cycle already `OPEN` or past its configuration deadline keeps its snapshotted strategy version.
- `effective_at` cannot be retroactive.
- Successive effective times are strictly increasing.
- Each version applies from its own `effective_at` up to, but not including, the next version's `effective_at`; therefore active strategy intervals do not overlap.

## 8. Voting and Governance

### Eligibility and weight

- One active membership tenure receives one vote.
- Contribution amount, owner role, and tenure length do not change vote weight.
- The electorate is frozen when voting opens.
- Invitations and inactive memberships are ineligible.
- A member who joins after opening is not added.
- A member who later leaves or is removed remains eligible for that already-open proposal through a narrowly scoped ballot capability.

### Choices and abstention

V1 uses `YES` and `NO`. An eligible member who does not vote has no vote record. Because the recommended threshold denominator is the full frozen electorate, non-voting does not help a proposal pass.

### Thresholds

The club's current governance rule is copied onto the proposal at opening. The proposal stores both the electorate size and computed required yes count so its result remains explainable.

V1 rules:

- Simple majority: strictly more than 50% of the frozen electorate, calculated as `floor(N / 2) + 1`.
- Supermajority: at least 75% of the frozen electorate, calculated as `ceil(3 × N / 4)`.
- Unanimous: 100% of the frozen electorate, calculated as `N`.

No separate quorum is needed if the threshold denominator is the full electorate.

### Closing a proposal

- Approve immediately when the required yes count is reached and the base is still valid.
- Reject immediately if the current yes votes plus every uncast electorate member cannot reach the required yes count.
- Reject when all eligible votes have been cast without reaching the threshold.
- Expire when the deadline passes while the proposal is still open and has reached neither approval nor rejection.
- The active creator may cancel while the proposal is `DRAFT`.
- The active creator may cancel an `OPEN` proposal only while zero votes have been cast.
- After the first vote is cast, normal user-driven cancellation is forbidden.

### Membership changes during an open vote

- Keep the frozen electorate, voting eligibility snapshot, and denominator unchanged.
- Do not add a member who joins after opening.
- Preserve votes cast before a member leaves or is removed.
- A member who leaves or is removed loses normal club access but may still view the frozen proposal snapshot and cast that ballot until it becomes terminal.
- If that former member does not vote, their non-vote remains in the denominator and does not count as yes.

### Historical integrity

Each electorate membership may cast at most one vote. Votes are final, immutable, and cannot be changed or retracted. A user's later departure, rejoin, role change, or account anonymization does not alter the recorded proposal result.

### Ballot visibility

While a proposal is `OPEN`, members may see:

- electorate size
- number of votes cast
- aggregate progress toward closure

They may not see individual vote choices or how a named member voted.

After the proposal becomes `APPROVED`, `REJECTED`, `EXPIRED`, or `CANCELLED`, current club members may view individual historical votes. The eventual UI must clearly communicate vote finality before submission.

## 9. Investment Day Model

The recommended terminology and flow are:

```text
Recurring InvestmentSchedule
        ↓ generates
InvestmentCycle (one Investment Day occurrence)
        ↓ snapshots MemberSavingPlan values
MemberCycleParticipation
        ↓ preserves member report and evidence source separately
Future broker evidence / verification
```

### Recurring schedule

The schedule defines when cycles should occur, in which timezone, and the default offset used to derive each cycle's configuration deadline. It is not itself an occurrence and does not run scheduler infrastructure.

### Investment cycle

A cycle is generated idempotently from one schedule occurrence. It freezes:

- `investment_day_at`
- `configuration_deadline_at`
- reporting window
- schedule revision
- strategy version
- eligible membership tenures
- each applicable saving plan's expected amount and currency

The V1 configuration deadline is approximately three days before Investment Day. Exact offset may be product-configurable. Schedule, strategy, or saving-plan changes after the deadline apply to a later cycle.

### Expected member participation

`MemberCycleParticipation` preserves:

- which membership was expected
- the exact expected amount and club base currency at the deadline
- member-reported outcome, source, and time
- independent verification state, source, and time

The expected amount is a historical snapshot, not a live reference to `MemberSavingPlan`, and does not imply that money moved.

### Manual confirmation

A member may set their own participation outcome to `CONFIRMED`, `SKIPPED`, or `FAILED` with `member_report_source = MEMBER_REPORTED`.

- `CONFIRMED` means “the member reports that the scheduled investment completed.”
- `SKIPPED` and `FAILED` are also member reports.
- None of these values imply independent verification.
- No report remains `EXPECTED`; it must not be converted to failed.

### Member report corrections

While the InvestmentCycle is `OPEN`, a member may correct their own report between `CONFIRMED`, `SKIPPED`, and `FAILED`. `MemberCycleParticipation` stores the latest report and appropriate initial-report and correction timestamps; V1 does not require event sourcing or a revision ledger.

When the cycle becomes `COMPLETED`, its member reports become immutable through normal member-facing flows. Post-completion support corrections or reconciliation are future concerns and are not designed in V1. A corrected report remains `MEMBER_REPORTED` and does not gain independent verification.

### Future broker verification

Future data from `IMPORT`, `BROKER_API`, or `EMBEDDED_BROKER` may set a separate verification state and verification source. Outcome/member report and verification/evidence are independent dimensions: a `CONFIRMED` + `MEMBER_REPORTED` outcome may later also become `VERIFIED` + `BROKER_API`. Verification must not overwrite the member-reported outcome or source.

### Aggregate club information

Exact per-member amounts remain private. A monetary aggregate may be exposed only when it includes contribution records from at least three distinct members. This safeguard applies independently to expected, member-confirmed, and independently verified totals.

When the threshold is met, the club may expose clearly labelled aggregates such as:

- total expected contribution for a cycle
- total member-confirmed contribution
- total independently verified contribution
- count of members ready, confirmed, skipped, failed, or verified

When fewer than three distinct member records are included, Vesty shows only non-monetary group information such as “2 / 2 ready,” “2 members confirmed,” or “Investment Day completed.” Filtering must not permit a member to reduce an exposed monetary aggregate below the three-member threshold and infer another member's amount.

### Calendar semantics

`investment_day_at` is Vesty's planned coordination date. Weekends, public holidays, fund settlement rules, and broker processing delays may cause actual execution later. The cycle date is never broker evidence and must not be presented as a verified transaction time.

## 10. Authorization Model

This section defines intended authority, not RLS implementation.

### View a club

- Active owners and members may view current club strategy, locked governance rule, schedule, proposals, aggregate cycle information, and permitted history.
- Pending invitations receive only the minimum invitation context, including the current effective strategy needed to understand what the invitee would join.
- Former memberships lose access to current and future private club data when they leave or are removed.
- A former membership already included in an open proposal electorate retains only the frozen proposal snapshot and ballot capability until that proposal becomes terminal.
- Former-member records remain stored and continue to identify historical participation. V1 does not provide ongoing read-only club access after departure.

### Invite members

- Only the active owner may invite members, revoke invitations, and view invitation status.
- Only the server-validated intended recipient may accept or decline their invitation.

### Ownership and membership administration

- Only the active owner may remove another active member.
- Only the owner may initiate ownership transfer to another active member.
- The selected target member must explicitly accept before ownership changes.
- Until acceptance, the existing owner remains `OWNER` and the target remains `MEMBER`.
- The target member may reject the transfer; an expired or rejected transfer leaves ownership unchanged.
- Successful acceptance atomically changes both roles and is auditable.
- The owner cannot leave or be removed while still owner, including while a transfer is pending.
- A normal member cannot remove members or transfer ownership.

### Governance

- During club setup, only the owner may finalize StrategyVersion 1 through the genesis path, by selecting an allowlisted curated package. The server writes the allocations.
- After StrategyVersion 1 exists, every strategy change requires the proposal and voting flow.
- The owner selects `SIMPLE_MAJORITY`, `SUPERMAJORITY`, or `UNANIMOUS` when creating the club.
- Governance configuration is locked after club creation in V1.
- No V1 actor may edit governance through a proposal or ordinary administration.
- Every proposal still snapshots the locked rule and calculated threshold for historical audit.

### Create proposals

- Any active owner or member may create a strategy proposal.
- An active proposer may edit or cancel their own `DRAFT`.
- The proposing active member may submit/open a valid complete draft; opening is a server-authorized freeze operation, not a client-side state edit.
- The active creator may cancel an `OPEN` proposal only while zero votes have been cast.
- Once the first vote is cast, normal user-driven cancellation is no longer allowed.

### Vote

- Only a membership contained in the proposal's frozen electorate may vote.
- Later departure does not revoke that ballot eligibility, but grants no access beyond the frozen proposal and ballot.
- A user acts through the server-validated identity's membership, never a client-supplied `user_id`.
- Each electorate membership may cast at most one final vote; it cannot be changed or retracted.
- While voting is open, members may see turnout/progress counts but not individual vote choices.
- Current club members may see individual historical votes after the proposal becomes terminal.

### Saving plans, transactions, and contribution privacy

- Each owner or member may view and manage only their own exact `MemberSavingPlan` amount.
- Each owner or member may view their own exact cycle expected amount, participation details, transactions, and derived positions.
- Ownership does not grant access to another member's exact amount, transaction, or position size.
- Active club members may see readiness/completion counts without access to underlying per-member amounts.
- Monetary aggregates are visible only when at least three distinct member contribution records are included.

### Targets and schedule

- Vesty manages the InvestmentTarget catalog and target lifecycle.
- Owners and members may reference active targets in strategy drafts but cannot create or rewrite catalog identity.
- The owner manages InvestmentSchedule configuration.
- Schedule changes affect future cycles and do not rewrite generated cycles.

### Readiness and cycle participation

- Each active owner or member may set only their own `StrategyReadiness`.
- Each active owner or member may report only their own `MemberCycleParticipation` and confirm only their own Investment Day transactions.
- A member may correct their own report while the cycle is `OPEN`.
- Normal member-facing correction ends when the cycle becomes `COMPLETED`.
- The owner cannot report or confirm on another member's behalf.
- Exact amounts and private notes remain visible only to the affected member, while coarse status/count aggregates may be visible to active club members.

### Remove members

- Only the active owner may remove an active member.
- Removal preserves the membership tenure and history.
- Removing a member does not alter a frozen proposal electorate, threshold, voting eligibility, or already-cast vote.

### Leave

- An active member may leave.
- The owner must transfer ownership to another active member before leaving.

### Archive a club

- Only the active owner may archive the club.
- Archival stops normal future activity but preserves memberships, strategies, proposals, votes, cycles, readiness, and participation history.
- Normal V1 behavior does not hard-delete a club with meaningful history.

## 11. Financial Data Rules

### Money

- Store authoritative amounts as integer minor units plus currency.
- Never store authoritative member contributions as JavaScript floating point.
- Never infer currency from locale, club country, broker, or UI formatting.
- Every club has exactly one base currency, and all authoritative V1 saving-plan and cycle contribution amounts for that club use it.
- NOK is the expected default for Norwegian V1, while other valid ISO currencies may be selected for other clubs.
- Money still carries currency explicitly even when it must equal the club base currency.
- V1 does not mix or convert authoritative recurring contribution amounts within one club.

### Allocations

- Store allocation percentages as integer basis points.
- Every complete proposed and approved strategy totals exactly `10000`.
- Validate the total when a proposal opens and again when a strategy version is created.
- Member contribution size never changes strategy basis points.

### Deterministic allocation amounts

If Vesty displays suggested per-target monetary amounts, it must preserve the member's total exactly:

1. Multiply integer minor units by each line's basis points.
2. Compute initial line amounts with integer division.
3. Distribute remaining minor units by descending fractional remainder.
4. Break equal remainders by immutable strategy-allocation order.

This largest-remainder boundary prevents silent loss or creation of minor units. Any zero-sized line caused by a very small contribution must be shown explicitly rather than silently rounded up.

These amounts remain planning guidance. A broker may apply minimum order sizes, fees, different rounding, or fail to execute.

Club expected, member-confirmed, and broker-verified totals are different aggregates and must be labelled accordingly. A monetary aggregate may be shown only when it includes records from at least three distinct members; otherwise only non-monetary counts or completion indicators may be shown.

## 12. Audit and Historical Integrity

V1 does not require event sourcing. Strong history comes from immutable records, explicit state transitions, timestamps, and preserved references.

Preserve and treat as immutable once finalized:

- terminal invitations
- membership tenures and terminal reasons
- ownership-transfer initiation, target, terminal outcome, and timestamps
- the club's creation-time governance selection
- opened proposal candidate snapshots
- proposal governance and electorate snapshots
- cast votes
- proposal result, cancellation eligibility, and closure facts
- strategy-version origin, provenance, and allocations
- generated/opened investment-cycle snapshots
- saving-plan effective periods
- member-cycle expected amounts
- completed-cycle latest reports, report/correction timestamps, and member-report sources
- each independently recorded verification fact and source
- strategy-readiness records

Mutable drafts and current configuration may change only before their freeze boundary. A member may update only their own latest participation report while its cycle is `OPEN`; completion freezes normal member-facing edits. Every important terminal action records who acted and when.

Normal product operations must not cascade-delete historical strategy, proposal, vote, cycle, or membership records. Privacy-driven account deletion should anonymize or detach removable personal data while retaining the minimum stable historical actor reference required for governance integrity.

The model must eventually answer:

- Which strategy was effective at a given instant?
- Which proposal produced it?
- Was the strategy created through the one-time genesis path or an approved proposal, and who created it?
- What complete change was proposed and against which base version?
- Which memberships were eligible and which voted?
- Which voting rule and threshold produced the result?
- When was the genesis version created or a later version approved, and when did it become effective?
- Which strategy and planned amount applied to a member's Investment Cycle?
- Was a participation outcome member-reported or independently verified, and from which source?

## 13. Future Integration Boundaries

Broker and market integrations belong outside the core club/governance model.

### Broker mappings

Vesty owns the stable InvestmentTarget catalog; neither a club nor a broker owns target identity. A future adapter may map a target to market-data provider identifiers, Nordnet identifiers, or another broker's identifiers. Those mappings remain outside the V1 core and do not redefine the target. Strategy allocations continue to reference the stable Vesty target and preserve a historical descriptor.

### Read-only broker sync and imports

Adapters normalize provider data into immutable external observations with:

- source type
- provider
- external identity/idempotency key
- observed time and effective/trade time
- explicit Money and instrument identity
- raw-source reference or integrity metadata

The domain may compare those observations with a `MemberCycleParticipation`. It does not let provider payloads become Club, StrategyVersion, StrategyProposal, or Vote records.

### Portfolio and market data

V1 stores verified provider mappings and NAV observations in `market_data_instrument_mappings` and `market_prices`. Ingest is server-side only. Production ingest is intended to be Twelve Data after a real key proves all four TestFlight funds; those mappings stay inactive until that proof. Yahoo unofficial remains probe-only. Current market value still requires real quantity × latest NAV; Investment Day V1 rows usually have null quantity, so Club/Home current-value UI remains demo until quantity exists. Historical portfolio value additionally requires chronological holdings and historical NAVs. See `docs/market-data.md`. Prices do not alter immutable governance history.

### Verified transactions

Future evidence and verification assessments attach to `MemberCycleParticipation`. `MEMBER_REPORTED` outcomes remain preserved and may agree or conflict with external evidence without being rewritten.

### Embedded brokerage

If a regulated partner later enables execution, that capability requires a separate execution/custody boundary with its own legal, security, and accounting model. `EMBEDDED_BROKER` provenance must not imply that Vesty itself held money or executed a trade.

This separation allows integrations to evolve without redesigning Clubs, StrategyVersions, StrategyProposals, or Votes.

## 14. Explicit Non-Goals for V1

- Vesty holding, pooling, receiving, or transferring customer money
- trade execution, order routing, settlement, or custody
- proof that a recurring broker saving plan executed
- individual-stock trading workflows
- crypto, derivatives, leverage, or short-selling workflows
- personalized investment advice or automated suitability decisions
- public clubs or a public social network
- weighted economic ownership or cap-table accounting
- enterprise RBAC or organization hierarchies
- broker-specific core entities
- a complete securities/instrument master database
- live market data, performance reporting, or portfolio rebalancing
- tax-lot, tax-return, or accounting functionality
- event sourcing, CQRS, microservices, or generic workflow frameworks

## 15. Open Product Decisions

No domain-blocking Open Decisions remain for the V1 database contract. Exact UI wording, schedule defaults, retention operations required by law, and future administrative correction mechanisms may be decided during later product development without changing the core domain boundaries defined here.

## 16. Recommended V1 Domain

The smallest recommended domain to carry into database design is:

### Identity and club

1. `User` identity reference
2. `Club`
3. `ClubInvitation`
4. `ClubMembership`
5. `OwnershipTransfer`

### Strategy and governance

6. `InvestmentTarget`
7. `StrategyVersion`
8. `StrategyAllocation`
9. `StrategyReadiness`
10. `StrategyProposal`
11. `ProposalElectorate`
12. `Vote`

### Investment Day coordination

13. `InvestmentSchedule`
14. `InvestmentCycle`
15. `MemberSavingPlan`
16. `MemberCycleParticipation`
17. `MemberInvestmentTransaction` (member-reported buy; positions are derived)

### Owned value objects

- `Money`
- `Currency`
- `AllocationBasisPoints`
- `GovernanceRuleSet`
- `VotingThreshold`
- `OwnershipTransferStatus`
- `StrategyVersionOrigin`
- `RecurringSchedule`
- `ProposedStrategySnapshot`
- `ParticipationOutcome`
- `MemberReportSource`
- `VerificationSource`
- `VerificationState`

### Deliberate omissions

- No separate mutable `Strategy` shell: the strategy is the ordered set of immutable versions.
- No standalone `ClubGovernance` aggregate: governance is a locked club-owned rule set snapshotted onto proposals.
- No generic transfer workflow: `OwnershipTransfer` is a narrow dependent record required for acceptance and audit.
- No `MemberContributionIntent`: `MemberSavingPlan` is the standing recurring configuration.
- No separate `MemberCycleReport`: `MemberCycleParticipation` preserves the cycle expectation, member-reported outcome, source, and independent verification dimensions.
- `MemberInvestmentTransaction` records a member-reported buy as coordination evidence. Vesty still does not receive money, custody assets, or store market value. Positions are derived cost basis only.
- No broker account, order, trade execution, or live market-data entity in the V1 core.
- No generic proposal or governance-change framework in V1.

The final set deliberately deviates from a single `VERIFIED` participation status: verification is a separate state because evidence quality is not the same dimension as expected, confirmed, skipped, or failed outcome. This preserves the hard distinction between member report and broker verification without adding another V1 entity.

This model keeps Clubs, Strategies, Proposals, and Votes broker-neutral; uses a Vesty-managed InvestmentTarget catalog; separates standing plan, cycle snapshot, member report, and future verification; preserves historical governance; and remains small enough to translate into a straightforward PostgreSQL/Supabase design in a later task.
