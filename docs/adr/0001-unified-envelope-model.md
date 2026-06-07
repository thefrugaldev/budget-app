# Unified envelope model: one Category, three kinds, signed amounts, effective-dated targets

## Status

Accepted (2026-06-06)

## Context

The app needs to model expense tracking against caps, savings tracking against goals, and (added during design) income tracking against a salary baseline. A naive design would treat each of these as a separate domain entity — `ExpenseCategory`, `SavingsAccount`, `IncomeSource` — with bespoke transaction shapes per type, separate threshold logic, and divergent UI components. That path produces three parallel data models, three parallel aggregation pipelines, and three parallel UI flows that drift apart over time.

We also need to honestly represent two things the obvious model handles badly: monthly targets that change over time (raises, life-phase shifts like schooling ending), and "reverse" activity (expense refunds, savings withdrawals) without distorting the threshold meter or losing historical accuracy.

## Decision

We model **all three financial concerns as a single `Category` entity** with a `kind` discriminator (`"expense" | "savings" | "income"`), backed by three orthogonal mechanisms shared uniformly across kinds:

1. **One `Transaction` shape with a signed `amount`.** Positive means activity in the category's primary direction (spent for expense, contributed for savings, earned for income); negative means the reverse (refund, withdrawal, income reversal). There is no separate `transactionType` enum and no parallel "refund" or "withdrawal" entity. A monthly total is a signed sum of transactions and is allowed to be negative.

2. **One effective-dated `CategoryTarget` table** giving each category a *history* of monthly targets (`{ categoryId, monthly, effectiveFrom: "YYYY-MM" }`), not a single mutable `monthly` field. For any month M, the resolved target is the row with the greatest `effectiveFrom <= M`. Income targets are entered as gross-yearly in the UI but stored as monthly, so the storage shape is uniform across kinds.

3. **One effective-dated category lifecycle** (`activeFrom`, optional `activeUntil`), so categories can phase in and out over years without being deleted. The current-month overview filters by active range; historical views and the category detail page are unfiltered.

Income exists fully within this model. Baseline salary is the income category's target history; bonuses, RSU vests, and side-gig income are transactions on income categories — no separate "bonus" entity, no special-case checkbox. Savings categories are explicitly **not** accounts: they have no balance, never reconcile against external account balances, and will remain isolated from the phase-3 net-worth/FIRE accounts model that will be a distinct entity set.

## Consequences

**Positive:**

- Aggregation, threshold UI, range selection, sparkline, and trend chart components work uniformly across all three kinds.
- Mid-year raises, target adjustments, and category phase-ins/outs are recorded as data, not as destructive edits — historical reporting (e.g., year-over-year savings rate) is accurate because it resolves *each* month against the target in effect at that time.
- Phase 3 (net worth, FIRE) does not require a transaction schema migration; it adds a distinct `Account` entity alongside the unchanged categories model.
- The threshold state machine stays four-deep (`under | near | at | over`); the negative-monthly-total case is handled by render-layer cues, not by extending the state machine. (See `memory/threshold_ui_negatives.md`.)

**Negative / trade-offs:**

- The shared `Category` document has more fields than a per-kind model would, and some logic branches on `kind` (e.g., palette direction, "Spent"/"Deposit"/"Received" segmented-control labels). Acceptable cost given how much else stays uniform.
- Effective-dated targets and lifecycle require a "resolve at time M" lookup wherever category data is read. Every place in today's code that reads `category.monthly` has to migrate to `resolveTarget(categoryId, ym)`.
- Signed amounts require care at entry time: the UI uses a positive-only number field paired with a kind-aware segmented control ("Spent / Refunded" etc.) rather than raw signed-number entry, so users can't accidentally submit `-100` when they meant `100`.

## Considered alternatives

- **Per-kind entities and tables** (`ExpenseCategory`, `SavingsAccount`, `IncomeSource`, each with its own transaction shape). Rejected — guarantees drift across the three flows and forces three implementations of every shared concern (range selection, threshold UI, sparkline, etc.).
- **Single `monthly` field with no history.** Rejected — historical 6-month trend charts would compare every past bar against the *current* target, falsifying months when the target was different.
- **Binary `archived` flag instead of `activeUntil`.** Rejected — can't represent "started in 2024-08," "ended in 2027-05," or scheduled future starts.
- **`transactionType` enum (`purchase | refund | deposit | withdrawal`) instead of signed `amount`.** Rejected — adds a second discriminator that has to stay in sync with the category kind, complicates aggregation, and produces no information that the sign doesn't already convey.
- **Income as a checkbox on savings transactions** (the bonus-into-brokerage shortcut). Rejected — can't represent a bonus you only partially saved, or a bonus you spent entirely; both distort the savings-rate calculation.
- **HYSA/Brokerage as accounts (with balances) now.** Rejected for phase 1 — adds account reconciliation, balance snapshots, and interest/growth tracking, none of which the "did I save what I planned to save?" question needs. Phase 3 adds accounts as a separate entity set; savings categories remain behavior trackers.
