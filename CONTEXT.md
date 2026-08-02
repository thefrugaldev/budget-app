# Budget App

A personal budgeting tool. Phase 1 tracks monthly spending and savings against per-category targets; later phases add net-worth and FIRE tooling on top of the same transaction data.

## Language

**Category**:
A named bucket of activity (e.g., Groceries, HYSA) with a `kind` of `expense` or `savings`.
_Avoid_: Bucket, envelope, group.

**Expense category**:
A category where activity is money leaving the budget; the target acts as a cap (going over is bad).

**Savings category**:
A category where activity is money set aside; the target acts as a goal (reaching/exceeding it is good). Tracks **net contributions** for the month — withdrawals are recorded as negative-amount transactions and reduce the month's total, which is allowed to go below zero. A savings category is *not* an account; it does not have a balance, and it never reconciles against real-world account balances.

**Income category**:
A category representing money coming in. The target represents *baseline* salary (entered as gross yearly, stored as monthly); the actual baseline salary is implicit from the target, not logged per-paycheck. Irregular income (bonuses, RSU vests, side-gig, refunds-of-income) is captured as transactions on the income category. YTD income = (elapsed months × resolved baseline) + sum(income transactions).
_Avoid_: Earnings, paycheck (overloaded), revenue.

**Savings rate**:
`YTD saved / YTD income`. Computed from gross income (the income target is gross/pre-tax), so it does not account for taxes.

**Target**:
The monthly dollar value associated with a category — a cap for expense categories, a goal for savings categories. Targets are **effective-dated**: a category has a history of targets, and the target in effect for a given month is the most recent one whose `effectiveFrom` is on or before that month.
_Avoid_: Threshold (reserved for the *state* computed from amount vs. target), limit, budget (overloaded — means the whole app).

**Target suggestion**:
A system-detected proposal to change a category's Target, derived from a sustained divergence between recent activity and the target in effect. The owner **accepts** it (writing a new Target) or **dismisses** it. A suggestion is deliberately calm and occasional — distinct in register from a **Threshold state** (this-month status) and from "Needs attention" (this-month problems); it is a slow, structural observation that the plan has drifted from reality. Not a Target until accepted. A **dismissal** is the persisted memory that a suggestion was declined at a given observed level, used to avoid re-nagging until the picture materially changes.
_Avoid_: Recommendation, nudge, insight, alert (too urgent).

**Threshold state**:
A category's status for a given month relative to its target: `under`, `near`, `at`, or `over`. Drives the UI color. Same vocabulary for both kinds, but the *meaning* flips: `over` is bad for expense categories, good for savings categories.
_Avoid_: Status, level.

**Transaction**:
A single dated entry recording money flowing into or out of a category. Currently entered manually. Carries a signed `amount` (positive in the category's primary direction, negative in the reverse), a `vendor` string, and a freeform `note`.
_Avoid_: Entry, line item, expense (reserved for the category kind).

**Household**:
The unit of data ownership. Every budget and net-worth document belongs to exactly one household; users access data by being members of it. Sharing the app with someone means inviting them into your household — data is never shared piecemeal.
_Avoid_: Tenant, workspace, organization (all too corporate for a family budget), family (a household may include a non-family member, e.g. an advisor).

**User**:
An authenticated person, signed in via a third-party identity provider. A user sees a household's data only through a membership in it. The user is the *auth* concept — never call it an "account" (that's a financial account).
_Avoid_: Account (taken), profile (the display surface for a user, not the entity).

**Member**:
A user's role-bearing association with a household. Roles: `owner` (everything, including member management and destructive actions; exactly one per household), `editor` (full CRUD on budget, net-worth, and FIRE assumptions; no member management, no danger zone), `viewer` (reads everything, changes nothing — may adjust FIRE knobs locally but cannot save them).
_Avoid_: Collaborator, guest, sharee.

**Invite**:
A pending, owner-created grant: an email address plus a role. A user who authenticates with a matching verified email becomes a member with that role — the app never sends email; the invitee is told out-of-band. An uninvited sign-in gets no data and no household ("private app" screen). The very first user to ever sign in bootstraps the household as its owner.
_Avoid_: Invitation link (a different, rejected mechanism), allowlist (the mechanism, not the entity).

**Account**:
A manually-maintained financial account on the Net Worth side of the app (e.g., Brokerage, HYSA, Mortgage), with a `class` of `asset` or `liability` and, for assets, a `kind`: `cash` (manual balance — HYSA, checking), `investment` (valued as holdings × market price — brokerage, 401k), or `property` (manual balance, illiquid — house, car). Liabilities are always manual-balance. Accounts are a distinct entity set from Categories: a savings *category* tracks contribution behavior in the budget; an *account* tracks real-world value. The two never reconcile (see ADR 0001). Budget and Net Worth data meet only in FIRE calculations.
_Avoid_: Using "account" for the sign-in/auth concept — that is the **User** (profile). Avoid: wallet, portfolio (reserved for a possible aggregate view).

**Holding**:
A position inside an investment account: a ticker symbol and a quantity (share count). A holding's value is quantity × current market price. Cash and property accounts have no holdings.
_Avoid_: Position (fine colloquially, but "holding" is canonical), asset (reserved for the account class).

**Net worth**:
Sum of asset account values minus sum of liability account values.

**Snapshot**:
A dated record of an account's value at the moment the user updated it — the computed value plus the holdings/prices (or manual balance) behind it. Snapshots are the source of truth for net-worth history: the chart plots recorded snapshots, never reconstructions from historical market prices. A month's net worth = the signed sum over accounts of each account's latest snapshot on or before that month's end (carry-forward). The live headline is separate: current quantities × current market prices.
_Avoid_: Balance entry, valuation (fine as the verb — "the snapshot's valuation" — but the record is a snapshot).

**Nest egg**:
The FIRE-eligible portion of net worth: the sum of `cash` and `investment` asset accounts. Property and liabilities are excluded automatically — a house is not withdrawable, and debt payments are already counted in monthly expenses. No per-account configuration.
_Avoid_: Portfolio, FIRE number (reserved for the *target* nest egg: annual retirement spend ÷ safe withdrawal rate).

**FIRE number**:
The target nest egg: annual retirement spend ÷ safe withdrawal rate, in today's dollars. All FIRE math is done in real terms — the nest egg compounds at the *real* growth rate (expected nominal return minus expected inflation), contributions are constant in today's dollars, and the FIRE number never inflates.

**FIRE date**:
The projected date the nest egg first reaches the FIRE number, given current nest egg, monthly contribution, and real growth rate. Displayed alongside the user's age at that date (birth year is a stored assumption).

**Coast number**:
The nest egg that would grow to the FIRE number by the traditional retirement age (an assumption, default 65) with **zero further contributions**: FIRE number ÷ (1 + real rate)^(years remaining). Reaching it means compounding alone finishes the job — the user can "coast" (cover expenses only, stop saving for retirement).
_Avoid_: Coast FIRE number (verbose), barista FIRE (different concept — do not introduce).

**Assumption**:
A user-set input to FIRE math, persisted with data-derived defaults: retirement spend (default: trailing-12-month expense average), monthly contribution (default: trailing-12-month savings average), expected nominal return (7%), expected inflation (3%), safe withdrawal rate (4%), birth year, traditional retirement age (65).
_Avoid_: Setting (reserved for app settings), scenario (implies multiple saved sets — there is one).

**Vendor**:
A free-text string identifying the merchant or counterparty on a transaction (e.g., "Whole Foods", "Amazon", "Greystar"). Vendors are not a formal entity — they're whatever the user types, with autocomplete from history to keep the spelling consistent. A vendor may appear across many categories.
_Avoid_: Merchant, payee (overloaded with finance-domain meaning).

**Archive**:
The household's 2020–2026 Excel budget workbooks and the recipe (mapping, overrides, manifests) for importing them — kept in a private repo, separate from this public codebase. The historical system of record until cutover.
_Avoid_: Spreadsheets (ambiguous once imported), backup (it is the source, not a copy).

**Imported**:
Said of a category, target, transaction, or snapshot that originated from the archive rather than manual entry. An imported document carries provenance back to its exact source cell and is excluded from destructive bulk actions ("Clear all data") unless explicitly opted in.
_Avoid_: Migrated, seeded (reserved for demo seed data).

**Budget month**:
The month a payment is *for*, as distinct from the calendar date it was paid — recurring bills are often paid in the last days of the prior month. Imported transactions are dated by budget month, with the true paid date preserved in the note.
_Avoid_: Statement month, period.

**Cutover**:
The moment the app replaces the archive as the sole system of record: final workbook save, final import, no further spreadsheet edits, manual entry begins.
_Avoid_: Launch, go-live (the app is already deployed before cutover).
