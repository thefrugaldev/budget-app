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

**Threshold state**:
A category's status for a given month relative to its target: `under`, `near`, `at`, or `over`. Drives the UI color. Same vocabulary for both kinds, but the *meaning* flips: `over` is bad for expense categories, good for savings categories.
_Avoid_: Status, level.

**Transaction**:
A single dated entry recording money flowing into or out of a category. Currently entered manually. Carries a signed `amount` (positive in the category's primary direction, negative in the reverse), a `vendor` string, and a freeform `note`.
_Avoid_: Entry, line item, expense (reserved for the category kind).

**Vendor**:
A free-text string identifying the merchant or counterparty on a transaction (e.g., "Whole Foods", "Amazon", "Greystar"). Vendors are not a formal entity — they're whatever the user types, with autocomplete from history to keep the spelling consistent. A vendor may appear across many categories.
_Avoid_: Merchant, payee (overloaded with finance-domain meaning).
