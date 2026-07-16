import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs as nodeParseArgs } from "node:util";

import { type AnyBulkWriteOperation, type Db } from "mongodb";

import { COLLECTIONS } from "@/lib/db/collections";
import type { HouseholdDocument } from "@/lib/db/documents";

import { hashImportRef } from "./import-ref";
import { connectMongo, runCli } from "./cli";
import type {
  CategoriesManifest,
  ManifestLiabilitySnapshot,
  WorkbookManifest,
} from "./manifest-types";

/**
 * The `apply` CLI (chunk 3): sync the extract manifests into MongoDB (ADR 0005
 * decision 3). Idempotent per file — upsert by deterministic `_id`, then delete
 * orphaned imported docs for that file — so re-running the current year's
 * workbook updates and prunes rather than duplicating. `--dry-run` prints the
 * exact plan touching nothing (stories 8, 12).
 *
 *   MONGODB_URI=… pnpm import:apply <archive-dir> [--dry-run] [--db <name>]
 *
 * Net Worth liability history (chunk 7): a liability `Account` is derived per
 * distinct canonical liability name across all workbooks, and each DebtsEquity
 * balance becomes a dated `Snapshot`. Accounts upsert with $set/$setOnInsert
 * (NOT replaceOne) so a post-cutover check-in's live `balance` — and a
 * derived `closedAt` — survive a later re-apply.
 */

export type CollectionSync = {
  collection: string;
  /** The workbook file whose docs these are, or `null` for cross-year categories. */
  scope: string | null;
  inserted: number;
  updated: number;
  /** Imported docs for this file that vanished from the manifest → deleted. */
  deletedOrphans: number;
};

export type ApplyReport = {
  dryRun: boolean;
  householdId: string;
  syncs: CollectionSync[];
};

type ImportedDoc = { _id: string; importRef: string };

// Our documents key on a string `_id` (nanoid/hash/namespaced), not the
// driver's default ObjectId — type collections with this so string-id filters
// and replacements typecheck.
type StringIdDoc = { _id: string; [key: string]: unknown };

/**
 * Sync every manifest into `db` under `householdId`. Pure of any global state —
 * the clock (`now`) is injected — so integration tests are deterministic.
 * Reads only when `dryRun`, computing the same insert/update/orphan counts it
 * would apply.
 */
export async function applyManifests(input: {
  db: Db;
  householdId: string;
  categories: CategoriesManifest;
  workbooks: WorkbookManifest[];
  dryRun: boolean;
  now: Date;
}): Promise<ApplyReport> {
  const { db, householdId, categories, workbooks, dryRun, now } = input;

  const syncs: CollectionSync[] = [];

  // Cross-year, config-derived docs: upsert-only (no per-file orphan scope).
  syncs.push(
    await syncCollection({
      db, collection: COLLECTIONS.categories, docs: categories.categories,
      householdId, now, scope: null, dryRun,
    }),
  );
  syncs.push(
    await syncCollection({
      db, collection: COLLECTIONS.categoryTargets, docs: categories.incomeBaselines,
      householdId, now, scope: null, dryRun,
    }),
  );

  // Derived liability accounts: cross-year like categories (upsert-only, no
  // per-file orphan sweep) but with $set/$setOnInsert so user-owned fields
  // survive a re-apply. Run before the snapshot sync so every snapshot's
  // accountId points at an account this apply already touched.
  syncs.push(
    await syncLiabilityAccounts({
      db, workbooks, householdId, now, dryRun,
    }),
  );

  // Per-workbook, cell-derived docs: orphan-scoped to the file.
  for (const wb of workbooks) {
    syncs.push(
      await syncCollection({
        db, collection: COLLECTIONS.transactions, docs: wb.transactions,
        householdId, now, scope: wb.file, dryRun,
      }),
    );
    syncs.push(
      await syncCollection({
        db, collection: COLLECTIONS.categoryTargets, docs: wb.estimateTargets,
        householdId, now, scope: wb.file, dryRun,
      }),
    );
    syncs.push(
      await syncCollection({
        db, collection: COLLECTIONS.snapshots, docs: snapshotDocs(wb.liabilitySnapshots),
        householdId, now, scope: wb.file, dryRun,
      }),
    );
  }

  return { dryRun, householdId, syncs };
}

/** `_id`/importRef for a derived liability account, keyed by canonical name. */
function liabilityAccountRef(name: string): string {
  return `liability!account!${name}`;
}

type SnapshotDoc = ImportedDoc & {
  accountId: string;
  date: string;
  value: number;
};

/** One Snapshot document per liability-balance snapshot in a workbook. */
function snapshotDocs(snapshots: ManifestLiabilitySnapshot[]): SnapshotDoc[] {
  return snapshots.map((s) => ({
    _id: s._id,
    importRef: s.importRef,
    accountId: hashImportRef(liabilityAccountRef(s.liability)),
    date: s.date,
    value: s.balance,
  }));
}

/**
 * Derive one liability `Account` per distinct canonical liability name across
 * all workbooks and upsert it. **Not** {@link syncCollection}'s replaceOne: a
 * post-cutover check-in updates an account's live `balance`, so a re-apply must
 * never clobber a user-edited value. The ownership rule per field:
 *
 * - **Identity** (`name`, `class`, `importRef`) — import-owned, always `$set`.
 * - **`balance`** — seeded from the latest snapshot on insert; on update it is
 *   advanced to the new latest **only while still import-derived**, i.e. the
 *   account's current balance equals the *previous* apply's latest imported
 *   snapshot value (covers the whole pre-cutover re-run cadence, where nothing
 *   else moves it). A balance that differs (a user check-in/edit) — or one with
 *   no imported snapshot to compare against — is left alone.
 * - **`closedAt`** — data-driven: the max snapshot month across *all*
 *   liabilities is the archive's edge; a liability whose own last snapshot
 *   predates it has ended → `$set closedAt` = that last date. Symmetrically, a
 *   liability that *resumes* (reaches the edge again) gets its stale derived
 *   `closedAt` `$unset` — but only when the current value equals the previous
 *   apply's latest imported snapshot date, i.e. it is the value a previous
 *   apply derived; a manually-closed account (unrelated date) stays closed.
 *   `closedAt` never appears in `$set` and `$unset` at once (the branches are
 *   exclusive), and `balance` moves out of `$setOnInsert` when `$set` takes it
 *   (Mongo rejects the same path in both).
 *
 * The previous apply's snapshots are read here, BEFORE the snapshot sync runs
 * ({@link applyManifests} orders it so) — they are the provenance that tells
 * import-derived values apart from user edits.
 */
async function syncLiabilityAccounts(input: {
  db: Db;
  workbooks: WorkbookManifest[];
  householdId: string;
  now: Date;
  dryRun: boolean;
}): Promise<CollectionSync> {
  const { db, workbooks, householdId, now, dryRun } = input;
  const col = db.collection<StringIdDoc>(COLLECTIONS.accounts);

  // Latest snapshot (max date) per canonical liability — the only element the
  // derivation reads, so an O(n) pick rather than a sort.
  const latestByName = new Map<string, ManifestLiabilitySnapshot>();
  for (const wb of workbooks) {
    for (const snap of wb.liabilitySnapshots) {
      const cur = latestByName.get(snap.liability);
      if (!cur || snap.date > cur.date) latestByName.set(snap.liability, snap);
    }
  }

  // The archive edge: the latest snapshot month across all liabilities.
  let maxDate = "";
  for (const latest of latestByName.values()) {
    if (latest.date > maxDate) maxDate = latest.date;
  }

  const ids = [...latestByName.keys()].map((name) => hashImportRef(liabilityAccountRef(name)));
  const existing = new Map<string, { balance?: number; closedAt?: string }>();
  if (ids.length > 0) {
    const rows = await col
      .find({ _id: { $in: ids } }, { projection: { _id: 1, balance: 1, closedAt: 1 } })
      .toArray();
    for (const r of rows) {
      existing.set(r._id, {
        balance: r.balance as number | undefined,
        closedAt: r.closedAt as string | undefined,
      });
    }
  }

  // The previous apply's latest imported snapshot per existing account — still
  // in the DB because this runs before the snapshot sync. Its value/date are
  // what a previous apply would have written into balance/closedAt.
  const snapshotsCol = db.collection<StringIdDoc>(COLLECTIONS.snapshots);
  const prevLatest = new Map<string, { value: number; date: string }>();
  for (const _id of existing.keys()) {
    const [row] = await snapshotsCol
      .find(
        { householdId, accountId: _id, importRef: { $exists: true } },
        { projection: { value: 1, date: 1 } },
      )
      .sort({ date: -1 })
      .limit(1)
      .toArray();
    if (row) prevLatest.set(_id, { value: row.value as number, date: row.date as string });
  }

  let inserted = 0;
  let updated = 0;
  const ops: AnyBulkWriteOperation<StringIdDoc>[] = [];
  for (const [name, latest] of latestByName) {
    const ref = liabilityAccountRef(name);
    const _id = hashImportRef(ref);
    const current = existing.get(_id);
    if (current) updated++;
    else inserted++;

    const derivedClosed = latest.date < maxDate;
    const prev = current ? prevLatest.get(_id) : undefined;
    const advanceBalance =
      current !== undefined && prev !== undefined && current.balance === prev.value;
    const clearClosedAt =
      !derivedClosed &&
      current?.closedAt !== undefined &&
      prev !== undefined &&
      current.closedAt === prev.date;

    ops.push({
      updateOne: {
        filter: { _id },
        update: {
          $set: {
            name,
            class: "liability",
            householdId,
            importRef: ref,
            ...(advanceBalance ? { balance: latest.balance } : {}),
            ...(derivedClosed ? { closedAt: latest.date } : {}),
          },
          $setOnInsert: {
            ...(advanceBalance ? {} : { balance: latest.balance }),
            createdAt: now,
          },
          ...(clearClosedAt ? { $unset: { closedAt: "" } } : {}),
        },
        upsert: true,
      },
    });
  }
  if (!dryRun && ops.length > 0) await col.bulkWrite(ops);

  return { collection: COLLECTIONS.accounts, scope: null, inserted, updated, deletedOrphans: 0 };
}

/**
 * Upsert `docs` by `_id`, stamping `householdId` and preserving each existing
 * doc's `createdAt` (fresh docs get `now`) so re-applies are byte-idempotent.
 * When `scope` is a file, also delete this household's imported docs from that
 * file whose refs are gone from the manifest — making the DB mirror the sheet.
 */
async function syncCollection<T extends ImportedDoc>(input: {
  db: Db;
  collection: string;
  docs: T[];
  householdId: string;
  now: Date;
  scope: string | null;
  dryRun: boolean;
}): Promise<CollectionSync> {
  const { db, collection, docs, householdId, now, scope, dryRun } = input;
  const col = db.collection<StringIdDoc>(collection);

  const ids = docs.map((d) => d._id);
  const existing = new Map<string, Date | undefined>();
  if (ids.length > 0) {
    const rows = await col
      .find({ _id: { $in: ids } }, { projection: { _id: 1, createdAt: 1 } })
      .toArray();
    for (const r of rows) existing.set(r._id, r.createdAt as Date | undefined);
  }

  let inserted = 0;
  let updated = 0;
  const ops: AnyBulkWriteOperation<StringIdDoc>[] = [];
  for (const doc of docs) {
    const known = existing.has(doc._id);
    if (known) updated++;
    else inserted++;
    ops.push({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: { ...doc, householdId, createdAt: existing.get(doc._id) ?? now },
        upsert: true,
      },
    });
  }

  let deletedOrphans = 0;
  if (scope !== null) {
    const orphanFilter = {
      householdId,
      importRef: { $regex: `^${escapeRegExp(scope)}!` },
      _id: { $nin: ids },
    };
    deletedOrphans = await col.countDocuments(orphanFilter);
    if (!dryRun) {
      if (ops.length > 0) await col.bulkWrite(ops);
      if (deletedOrphans > 0) await col.deleteMany(orphanFilter);
    }
  } else if (!dryRun && ops.length > 0) {
    await col.bulkWrite(ops);
  }

  return { collection, scope, inserted, updated, deletedOrphans };
}

/** The single household in v1; apply stamps its id onto every imported doc. */
export async function resolveHouseholdId(db: Db): Promise<string> {
  const households = await db
    .collection<HouseholdDocument>(COLLECTIONS.households)
    .find({}, { projection: { _id: 1 } })
    .toArray();
  if (households.length === 0) {
    throw new Error(
      "No household found — sign in once to bootstrap the household before applying.",
    );
  }
  if (households.length > 1) {
    throw new Error(`Expected exactly one household, found ${households.length}.`);
  }
  return households[0]._id;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

export async function runApply(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const archiveDir = args.archiveDir;
  if (!archiveDir) {
    process.stderr.write(
      "usage: MONGODB_URI=… pnpm import:apply <archive-dir> [--dry-run] [--db <name>]\n",
    );
    return 2;
  }

  const { categories, workbooks } = readManifests(join(archiveDir, "import", "manifest"));

  const { client, db } = await connectMongo(args.db);
  try {
    const householdId = await resolveHouseholdId(db);
    const report = await applyManifests({
      db, householdId, categories, workbooks,
      dryRun: args.dryRun, now: new Date(),
    });
    process.stdout.write(formatReport(report, db.databaseName));
    return 0;
  } finally {
    await client.close();
  }
}

/** Read `categories.json` + every `YYYY.json` from a manifest directory. */
export function readManifests(manifestDir: string): {
  categories: CategoriesManifest;
  workbooks: WorkbookManifest[];
} {
  const categoriesPath = join(manifestDir, "categories.json");
  if (!existsSync(categoriesPath)) {
    throw new Error(`Manifest not found: ${categoriesPath} (run extract first)`);
  }
  const categories = readJson<CategoriesManifest>(categoriesPath);
  const workbooks = readdirSync(manifestDir)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .sort()
    .map((f) => readJson<WorkbookManifest>(join(manifestDir, f)));
  return { categories, workbooks };
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function formatReport(report: ApplyReport, dbName: string): string {
  const verb = report.dryRun ? "DRY-RUN (no writes)" : "APPLIED";
  const lines = [`apply ${verb} → db "${dbName}", household ${report.householdId}`];
  for (const s of report.syncs) {
    const scope = s.scope ?? "cross-year";
    lines.push(
      `  ${s.collection} [${scope}]: +${s.inserted} ~${s.updated} -${s.deletedOrphans}`,
    );
  }
  return lines.join("\n") + "\n";
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseArgs(argv: string[]): {
  archiveDir?: string;
  dryRun: boolean;
  db?: string;
} {
  const { values, positionals } = nodeParseArgs({
    args: argv,
    options: {
      "dry-run": { type: "boolean", default: false },
      db: { type: "string" },
    },
    allowPositionals: true,
    strict: true,
  });
  return {
    archiveDir: positionals[0],
    dryRun: values["dry-run"] ?? false,
    db: values.db,
  };
}

runCli(import.meta.url, "apply", () => runApply(process.argv.slice(2)));
