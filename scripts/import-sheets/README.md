# Excel archive importer

Turns the household's 2020–2026 Excel workbooks into app data, reproducibly and
idempotently. Decisions are recorded in
[ADR 0005](../../docs/adr/0005-excel-archive-import.md); the operational plan is
issue #118.

**Code is public; data is private.** This directory holds only the importer
code and synthetic test fixtures — never real vendors, amounts, salaries, or
balances. The workbooks, category `mapping.json`, `overrides.json`, and the
generated manifests/reports live in the separate private `budget-sheet-archive`
repo, which the CLIs take as an argument.

## Usage

```
pnpm import:extract <archive-dir> [--out <dir>]
```

Reads `YYYY.xlsx` workbooks at the archive root plus `import/{mapping,overrides,income}.json`,
and writes `import/manifest/{categories,YYYY}.json` and `import/reports/{reconciliation,vendors}.json`.
Output is deterministic (byte-identical for unchanged inputs). Any cell whose
itemized lines don't reconcile fails the run (exit 1); the reconciliation report
lists unreconciled cells first.

## Pure transforms (chunk 1)

The deterministic, side-effect-free core, unit-tested on synthetic inputs:

| Module | Responsibility |
| --- | --- |
| `parse-line.ts` | Parse a comment line `M/D - $Amount (Vendor - Note)` and its variants (no-parens, thousands separators, `(-$…)` refunds) into a structured, signed-cents transaction. |
| `money.ts` | Dollars ⇄ integer cents. Cents keep per-cell reconciliation exact. |
| `budget-month.ts` | Date a line by its **budget month** (the grid column), clamping the day and preserving the true paid date as a `(paid M/D)` note suffix. |
| `reconcile.ts` | The reconciliation gate: a cell's lines must sum to its value exactly, or via explicit overrides / a conditional refund-keyword sign-flip. |
| `mapping.ts` | Resolve spreadsheet row labels to canonical app categories (rename chains, merged savings pairs) and apply vendor-rewrite rules. |
| `import-ref.ts` | Build the human-readable `importRef` provenance string and its deterministic document `_id`. |
| `types.ts` | Importer-internal types. |

**Override actions (`overrides.json`).** Per-cell exceptions, keyed by the
cell's importRef prefix; each carries a mandatory `reason` — the checked-in
audit trail for ADR 0005 decision 1 (no silent deltas).

| Action | When to use |
| --- | --- |
| `skip` | Drop a parsed line (e.g. an annual payment already captured as amortized monthly deposits). |
| `sign-flip` | Negate a parsed line's amount (a refund keyed in as positive). |
| `set-amount` | Replace a parsed line's amount with a corrected value in cents. |
| `set-date` | Correct a parsed line's month/day (doesn't affect the checksum). |
| `add-line` | Append a synthetic line the parser can't produce: unparseable/informational comment shapes (a `Paid (1/15)` autopay cell whose value *is* the transaction, `$(-42.00)`, `1,811.44` with no `$`) or an unitemized remainder beyond the parsed lines. `{ line, day, month?, amountCents, vendor?, note?, reason }` — `line` becomes the emitted transaction's importRef index and must sit above the cell's parsed-line count (collisions throw); `month` defaults to the cell's own column month; the line joins the sum before the exact/flip evaluation, is never auto-flipped, and flows through budget-month dating and vendor rewrites like a parsed line. |

## Extract CLI (chunk 2)

| Module | Responsibility |
| --- | --- |
| `extract.ts` | CLI entry: arg parsing, config/workbook IO, lock-file warning, deterministic output writing, hard reconciliation gate. |
| `workbook.ts` | ExcelJS reader → structured, cell-addressed `RawWorkbook` (year grid, Estimate, DebtsEquity). All spreadsheet contact is confined here. |
| `config.ts` | Parse + validate `mapping.json` / `overrides.json` / `income.json`, failing loudly on malformed config. Also parses the optional `liabilities` (canonical-name rules) and `skipRows` (deliberately-not-imported labels). |
| `icon-validate.ts` | Every mapping/income icon must resolve in the app's lucide catalog (story 7). |
| `build-manifest.ts` | The extract core: raw workbooks + configs → manifests + reports, composing the chunk-1 transforms. Pure/deterministic. |
| `reports.ts` | Reconciliation and vendor-frequency report formatters. |
| `manifest-types.ts` | Manifest document + report shapes. |
| `fixtures/build-fixture-workbook.ts` | Synthetic workbook builder (in-memory ExcelJS) — real shapes, invented values (story 19). |

**Manifest layout.** Config-derived, cross-year documents (canonical categories,
W-2 income baselines) live in `categories.json` and are upsert-only. Workbook-cell
documents (transactions, estimate targets, liability snapshots) live in per-year
`YYYY.json` and carry a `<file>!…` importRef, so the per-file orphan deletion is
scoped to them.

**skipRows / liabilities (mapping.json).** `skipRows` is a list of grid row
labels (normalized like aliases) that are deliberately not imported even when
nonzero — the sheet's derived totals (`Total`, `Remaining After Expenses &
Savings`, …) and one-off income rows smeared into the W-2 baselines (ADR §6).
Without it, a nonzero unmapped row hard-errors the extract, which would block the
cutover. A label can't be both a skipRow and a category alias. `liabilities` is
the DebtsEquity analogue of category mapping: `{ canonicalName, aliases[] }`
entries rename display-ugly or year-varying column headers onto one canonical
account name; unmapped headers pass through unchanged (mapping only renames).

**Payoff cross-check.** DebtsEquity tabs carry no comments, but 2023-onward the
year grid's Mortgage row cells carry a `Payoff Left - $…` metadata line. Extract
compares each such payoff quote against the resolved liability's DebtsEquity
balance for the **same month and the previous month-end** — a quote written
before that month's payment posted matches the prior balance (a real-data timing
artifact), and the previous month is looked up across workbook boundaries
(January → December of the prior year's file). A payoff quote includes accrued
interest, so it never matches the principal balance exactly — the check is
tolerance-based and passes when **either** comparison is within **0.5% relative
delta** (failing when both diverge, or when neither month has a balance). Each
report entry records the best comparison (`matched: "month" | "prior-month"`).
The results land in the reconciliation report (`liabilityCrossChecks`), and any
failure exits the extract CLI non-zero, same as an unreconciled cell. A negative
DebtsEquity balance also hard-fails, naming the cell.

## Apply CLI (chunk 3)

```
MONGODB_URI=… pnpm import:apply <archive-dir> [--dry-run] [--first-apply] [--db <name>]
```

Syncs the manifests into MongoDB. Idempotent per file — upsert by deterministic
`_id`, then delete orphaned imported docs for that file — so re-running the
current year's workbook updates and prunes rather than duplicating.
`--dry-run` prints the plan and touches nothing; `--first-apply` wipes the
seed/demo data (any doc with no `importRef`) and writes the auto-seed-disabled
marker so a cold start never re-seeds (and refuses to run once imported data
exists). `householdId` is stamped from the single household document; each
existing doc's `createdAt` is preserved so re-applies don't churn.

Apply also syncs the Net Worth liability history: one liability `Account` is
derived per distinct canonical liability name (cross-year, upsert-only), and each
DebtsEquity balance becomes a dated `Snapshot` under it. A liability whose last
snapshot predates the archive's latest month is auto-`closedAt` (a loan paid off
mid-archive). Accounts upsert with `$set`/`$setOnInsert` (not `replaceOne`) so a
post-cutover check-in's live `balance` — and a derived `closedAt` — survive a
re-apply. `--first-apply` does **not** wipe seeded/hand-entered accounts or
snapshots (net-worth seed uses random UUIDs, indistinguishable from real data);
clearing that test data at cutover is an explicit RUNBOOK step.

| Module | Responsibility |
| --- | --- |
| `apply.ts` | `applyManifests` (pure of global state — clock injected), `resolveHouseholdId`, `readManifests`, and the CLI. |
| `../../test/memory-mongo.ts` | Disposable-MongoDB harness (`mongodb-memory-server`) — the repo's first Mongo integration harness, reusable beyond the importer. |

## Parity validation (chunk 4)

```
MONGODB_URI=… pnpm import:parity <archive-dir> [--db <name>]
```

Proves the import round-tripped: reads the applied DB through the app's own
`toTransaction`/`toCategory` mappers and runs the app's own aggregations
(`monthTotalsByCategory` for monthly spend, `ytdTotalsByCategory` for year
totals), then diffs every category-month and category-year against the manifest
sums. Exits non-zero on any divergence, naming the offending cell's source
`importRef`s. Considers only imported docs, so it's meaningful on a DB that also
holds seed or hand-entered data. `parity.ts` — `expectedTotals` (pure) +
`checkParity` + CLI.

## Storage audit (chunk 6)

```
MONGODB_URI=… pnpm import:audit [--cap-gb <n>] [--db <name>]
```

Read-only. Reports per-collection document counts, average document sizes, and
total bytes, then projects years of free-tier headroom at the *observed*
transactions-per-year rate (story 18). Only `transactions` grows unboundedly, so
the projection is driven by that collection's footprint per row times its
rows/year. Sizes are logical (uncompressed) — a deliberately conservative
headroom estimate. `--cap-gb` overrides the storage cap (default 25 GiB, the
Cosmos DB Mongo-API free tier). `storage-audit.ts` — `projectStorage` (pure) +
`auditStorage` + CLI.

## Prod runbook (chunk 6)

[RUNBOOK.md](./RUNBOOK.md) is the operational procedure: auth-bootstrap ordering
(the household must exist before apply can stamp it), the first prod apply,
current-year re-run cadence, the cutover checklist, and the post-cutover backup
policy. Reset protection for imported data (chunk 5) is the danger-zone opt-in
described there and in the app's Settings danger zone.
