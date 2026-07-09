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

## Extract CLI (chunk 2)

| Module | Responsibility |
| --- | --- |
| `extract.ts` | CLI entry: arg parsing, config/workbook IO, lock-file warning, deterministic output writing, hard reconciliation gate. |
| `workbook.ts` | ExcelJS reader → structured, cell-addressed `RawWorkbook` (year grid, Estimate, DebtsEquity). All spreadsheet contact is confined here. |
| `config.ts` | Parse + validate `mapping.json` / `overrides.json` / `income.json`, failing loudly on malformed config. |
| `icon-validate.ts` | Every mapping/income icon must resolve in the app's lucide catalog (story 7). |
| `build-manifest.ts` | The extract core: raw workbooks + configs → manifests + reports, composing the chunk-1 transforms. Pure/deterministic. |
| `reports.ts` | Reconciliation and vendor-frequency report formatters. |
| `manifest-types.ts` | Manifest document + report shapes. |
| `fixtures/build-fixture-workbook.ts` | Synthetic workbook builder (in-memory ExcelJS) — real shapes, invented values (story 19). |

**Manifest layout.** Config-derived, cross-year documents (canonical categories,
W-2 income baselines) live in `categories.json` and are upsert-only. Workbook-cell
documents (transactions, estimate targets, liability snapshots) live in per-year
`YYYY.json` and carry a `<file>!…` importRef, so chunk 3's per-file orphan
deletion is scoped to them. Liability snapshots are extracted now but not applied
until Net Worth ships (#109 / chunk 7).

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
existing doc's `createdAt` is preserved so re-applies don't churn. Liability
snapshots are skipped until Net Worth ships (#109 / chunk 7).

| Module | Responsibility |
| --- | --- |
| `apply.ts` | `applyManifests` (pure of global state — clock injected), `resolveHouseholdId`, `readManifests`, and the CLI. |
| `../../test/memory-mongo.ts` | Disposable-MongoDB harness (`mongodb-memory-server`) — the repo's first Mongo integration harness, reusable beyond the importer. |

## Not yet (later chunks)

- **Chunk 4:** parity validation against the app's own aggregations.
- **Chunk 7 (blocked by #109):** apply the already-extracted DebtsEquity
  liability snapshots.
