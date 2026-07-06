# Excel archive import: comments as source of truth, budget-month dating, deterministic provenance ids

## Status

Accepted (2026-07-05)

## Context

Seven Excel workbooks (2020–2026) hold the household's complete budget history: an `Estimate` tab (per-category monthly estimates + per-person income), a `DebtsEquity` tab (monthly liability balances), and a year grid (rows = categories, columns = months, cell = monthly total) where **cell comments** itemize individual transactions as `M/D - $Amount (Vendor - Notes)`. The archive must land in the app (including prod) reproducibly: 2026.xlsx keeps changing until cutover, so the import must be re-runnable without duplication. Audit findings that shaped the decisions: 8,218 of 8,223 comment lines parse with a small rule set; every nonzero expense cell has a comment; 69 cells' itemized lines don't sum to the cell value; ~150 lines carry a date from the month before their column (bills paid early for the following month); savings and income rows have month-level amounts only (no comments).

## Decision

1. **Comments are the transaction source of truth; cells are bookkeeping.** Each comment line becomes one Transaction (date, signed amount, vendor, note). Cell values act as a per-cell checksum: every cell must reconcile exactly (lines sum = cell value, after rules) or carry an explicit entry in a checked-in overrides file (skip / sign-flip / amount-fix per line). No silent deltas. Known rules: where a fee was recorded both as monthly amortized deposits and as the annual payment they fund, only the deposits import (both would double-count); pre-2022 refund/reimbursement lines written as positive amounts are sign-flipped only when that makes the cell reconcile.

2. **The column month wins — transactions are dated by budget month.** The sheets file payments under the month they are *for* (mortgage paid 1/27 sits in February). Imported dates take the column's month with the comment's day-of-month (clamped to a valid date); when coerced, the note gains a `(paid M/D)` suffix preserving the true payment date. This keeps monthly totals meaningful and preserves the "already paid this month" semantics a future bills feature can use.

3. **Deterministic ids with provenance.** Every imported document's `_id` is a hash of a human-readable `importRef` (`<file>!<sheet>!<cell>#<line>`), stored on the document. Re-running a file's import *syncs*: upsert by `_id` plus deletion of orphaned `importRef` docs for that file — the DB mirrors the sheet, not just accumulates from it. `importRef` also powers targeted revert, source-line traceability, and exclusion from "Clear all data" (which deletes imported docs only via an explicit opt-in).

4. **Code public, data private.** The importer (two-phase CLI: `extract` → reviewable per-file manifests + reconciliation reports; `apply --dry-run|--apply` → DB sync) lives in this public repo with synthetic fixtures. The workbooks, category mapping, overrides, manifests, and reports live in the private `budget-sheet-archive` repo — they contain vendors, salaries, and balances. The CLI takes the archive directory as its argument.

5. **Category mapping is a curated table, not name-matching.** Rename chains collapse to one canonical category, with the mapping (in the private archive repo) choosing each chain's canonical name; a chain may also split where a predecessor is genuinely a different, since-ended category rather than an earlier name. Expense-block rows that are actually investment contributions are reclassified as **savings** categories (they are contributions, not spending — historical expense totals intentionally diverge from the sheets' `Total` row). The paired `Savings From Checking (X)`/`External Savings (X)` rows merge into one savings category per destination; savings amounts import as month-end-dated transactions noted `Imported monthly total`. Active windows are data-driven (first/last nonzero month) with mapping overrides.

6. **Income baselines come from W-2 gross figures, not the Estimate tabs.** The sheets' income rows are take-home and went stale (one year still carried a figure that no longer applied). Per-year targets (figures in the private archive repo) use W-2 gross ÷ 12, keeping the app's documented gross-income savings-rate semantics. Irregular income is smeared into the baseline (the sheets never itemized it).

7. **DebtsEquity: extract now, apply later.** Liability balances become month-end snapshot documents in the manifests from day one, but `apply` skips them until Net Worth Accounts + Snapshots (#109) ship.

## Consequences

- Historical app months can disagree with a sheet column wherever an override or reclassification applies; the reconciliation reports in the archive repo are the permanent record of every divergence and why.
- The one-year-one-target granularity means a year's *final* estimate applies retroactively to its whole year (intra-year target history was never kept in the sheets).
- Imported data is fully reproducible from the archive repo, so prod backups only matter after cutover, once hand-entered data exists.
- At cutover: final 2026.xlsx save → final extract/apply → spreadsheet retires; the app becomes the sole system of record.

## Considered alternatives

- **Cell values as source of truth** (synthetic balancing entries force sheet parity). Rejected — pollutes date/vendor quality, which is the point of importing transactions at all.
- **True payment dates instead of budget-month dating.** Rejected — mortgage/HOA/utility payments would land in the "wrong" month, making historical monthly totals misleading; the true date survives in the note.
- **Random UUIDs + wipe-and-reload for re-runs.** Rejected — a full wipe can't coexist with post-cutover hand-entered data; deterministic sync can.
- **In-app import UI.** Rejected — a 7-file, one-household, config-driven migration is a CLI job; an upload UI would be built for an audience of one occasion.
- **Gross-up estimation of net paychecks for income baselines.** Rejected — pre-tax deductions (401k etc.) make the error bars huge; W-2s existed.
