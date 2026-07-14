# Import runbook (prod)

The operational procedure for importing the 2020–2026 Excel archive into
production, keeping the current year in sync until cutover, and the ongoing
policy afterwards. Companion to [ADR 0005](../../docs/adr/0005-excel-archive-import.md)
and issue #118; the CLIs themselves are documented in [README.md](./README.md).

**Data is private.** Every command below takes the private `budget-sheet-archive`
checkout as its `<archive-dir>`. Never paste `MONGODB_URI`, keys, or real values
into a shared transcript, PR, or log.

## Before you start (once)

- Have the private `budget-sheet-archive` repo checked out, with
  `import/{mapping,overrides,income}.json` authored and committed.
- Have the prod `MONGODB_URI` and (if it differs from `budget`) `MONGODB_DB_NAME`
  in your shell env, sourced from the secret store — not hard-coded.
- Close every workbook in Excel. Extract warns on a `~$*.xlsx` lock file, but the
  safe move is to confirm nothing is mid-edit before a real save.

## Auth bootstrap must come first

Apply stamps every imported document with the household's id, read from the
single `households` document. **That document must already exist**, or apply
aborts. So the ordering is fixed:

1. Deploy the app to prod and sign in **once** as the household owner. First
   sign-in bootstraps the `users` / `households` / `members` records (ADR 0004).
2. Confirm exactly one household exists before applying — apply resolves the id
   from it and refuses ambiguity.

Only then is the DB ready for a first apply.

## First prod apply (cutover-eligible, still reversible)

Everything imported is reproducible from the archive, so **no backup is required
before the first apply** — a bad run is fixed by re-running, not by restore.

1. **Extract** the whole archive and review the reports in the archive repo:
   ```
   pnpm import:extract <archive-dir>
   ```
   The reconciliation report must show zero unreconciled cells **and** every
   liability payoff cross-check passing (extract exits non-zero on either). Skim
   the vendor-frequency report for anything that should become a rewrite rule
   before real data lands.
2. **Dry-run apply** and read the plan end to end — inserts/updates/orphan
   deletions per collection per file. Nothing is written:
   ```
   MONGODB_URI=… pnpm import:apply <archive-dir> --dry-run
   ```
3. **First apply.** `--first-apply` wipes the seed/demo data and writes the
   auto-seed-disabled marker so a cold start never re-seeds over imported data
   (it refuses to run if imported docs already exist, so it can't clobber a real
   import):
   ```
   MONGODB_URI=… pnpm import:apply <archive-dir> --first-apply
   ```
4. **Parity-check** — the app's own aggregations must agree with the manifest
   sums for every category-month and category-year (exits non-zero on any drift,
   naming the offending source cells):
   ```
   MONGODB_URI=… pnpm import:parity <archive-dir>
   ```
5. **Storage audit** — record the baseline footprint and headroom (story 18):
   ```
   MONGODB_URI=… pnpm import:audit <archive-dir>
   ```

## Re-run cadence for the current year (pre-cutover)

Until cutover, `2026.xlsx` keeps changing. Re-import it as needed — apply is
idempotent per file:

1. Save the workbook in Excel and close it.
2. `pnpm import:extract <archive-dir>` → review the reconciliation report.
3. `pnpm import:apply <archive-dir> --dry-run` → sanity-check the plan
   (**no `--first-apply`** — the seed is already gone and hand-entered data, if
   any, must be preserved).
4. `pnpm import:apply <archive-dir>` → upserts changed rows and prunes rows that
   vanished from the workbook, scoped to that file's `importRef` prefix.
5. `pnpm import:parity <archive-dir>` → confirm the round-trip still holds.

Re-running an unchanged workbook is a no-op (deterministic ids, preserved
`createdAt`), so a re-run is always safe.

## Cutover readiness (what gates the switchover)

Cutover retires `2026.xlsx` entirely, so the app must be able to hold **every**
data type the workbook holds *and* offer a go-forward entry path for each. Three
of the four are already live (transactions, income, category estimates — imported
in chunks 1–6, entered in-app via the existing surfaces). The fourth is the
`DebtsEquity` liability/balance history, and it sets the gate:

- **Net Worth (#109) is the gate — not FIRE (#110).** Two reasons: chunk 7 writes
  liability history into #109's `Snapshot`/`Account` document types (so those must
  exist), and #109's monthly **check-in flow** is the only in-app place to *enter*
  balances going forward. Until it ships, the `DebtsEquity` half of the workbook
  has nowhere to live in the app, so the sheet can't be fully retired.
- **FIRE (#110) does not gate cutover.** It's a *derived* page (nest egg + budget
  actuals + planning knobs) and migrates **no** spreadsheet data — nothing is
  stranded if you switch over before it exists. Wait for it only if you want Net
  Worth *and* FIRE both live for the switchover as a product/ceremony call, not
  because any data depends on it.
- **Chunk 7 must be merged and validated *before* the final apply**, since the
  cutover apply is what brings the liability history over. On a dev/preview DB,
  confirm imported snapshots (a) render in the trajectory chart's carry-forward
  series (#109 story 10) and (b) are spared by the danger-zone reset — i.e. the
  chunk-5 `importRef` protection extends to the snapshot collection.

**Until cutover, keep the workbook the *sole* working system — do not dual-enter.**
Re-applying interim `2026.xlsx` saves is free (idempotent), and interim liability
edits sit safely in the archive until chunk 7's final apply. But hand-entering
*new* data directly in the app before cutover creates app-side data the archive
can't reproduce — which forfeits the "no backup needed before first apply" safety
and muddies parity. Treat the app as read-only preview until the final apply.

Recommended order: ship #109 (its check-in is the go-forward path) → run + validate
chunk 7 against the real types → *optionally* #110 → cutover (below).

## Cutover checklist

The one-way switch from spreadsheet to app as system of record:

- [ ] Final `2026.xlsx` save; workbook closed.
- [ ] `pnpm import:extract` — reconciliation report clean (cells + liability
      payoff cross-checks all pass).
- [ ] **Clear hand-entered/seeded net-worth test data.** Any accounts, snapshots,
      or `fireAssumptions` created while previewing #109/#110 must go before the
      final apply. `--first-apply` **cannot** identify them — the net-worth seed
      scripts use random UUIDs, indistinguishable from hand-entered data, so the
      seed wipe deliberately does not touch these collections. Delete them
      directly (a scoped `deleteMany` on `accounts`, `snapshots`, and
      `fireAssumptions` for the household), or use the Settings danger-zone reset
      (which now clears imported *and* hand-entered accounts/snapshots on the
      opt-in) **before** the first apply brings the real liability history over.
      Imported liability snapshots render in the trajectory chart via the
      carry-forward series (#109 story 10) and are spared by the default reset
      (chunk-5 `importRef` protection, extended to the snapshot collection in
      chunk 7).
- [ ] `pnpm import:apply --dry-run` — plan reviewed.
- [ ] `pnpm import:apply` — final sync.
- [ ] `pnpm import:parity` — passes.
- [ ] `pnpm import:audit` — headroom recorded.
- [ ] Spot-check a few historical months in the app against the sheet.
- [ ] **Take the first database backup.** This is the moment the app becomes
      authoritative, so it's the first backup that matters — the baseline the
      mandatory post-cutover policy below builds on. Do it before retiring the
      workbook.
- [ ] Retire the spreadsheet: from here the app is authoritative; new data is
      entered in the app, not the workbook.

## Post-cutover backup policy

Before cutover, imported data is fully reproducible from the archive, so backups
are optional. **After cutover, backups are mandatory:** hand-entered data now
exists that the archive can't regenerate. The first required backup is the one
taken *at* cutover (the checklist step above); from then on, any apply run
(should one ever be needed) is preceded by a database backup — the danger-zone
reset already spares imported docs by default (chunk 5), but a backup is the
belt-and-braces step before any bulk write to a live, authoritative database.
