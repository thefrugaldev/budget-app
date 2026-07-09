import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs as nodeParseArgs } from "node:util";

import { type AnyBulkWriteOperation, type Db } from "mongodb";

import { COLLECTIONS } from "@/lib/db/collections";
import { autoSeedDisabledId } from "@/lib/db/seed-marker";
import type { HouseholdDocument } from "@/lib/db/documents";

import { connectMongo, runCli } from "./cli";
import type { CategoriesManifest, WorkbookManifest } from "./manifest-types";

/**
 * The `apply` CLI (chunk 3): sync the extract manifests into MongoDB (ADR 0005
 * decision 3). Idempotent per file — upsert by deterministic `_id`, then delete
 * orphaned imported docs for that file — so re-running the current year's
 * workbook updates and prunes rather than duplicating. `--dry-run` prints the
 * exact plan touching nothing; `--first-apply` wipes prod's seed/demo data and
 * disables auto-seed so imported data is the only data (stories 8, 12, 15, 16).
 *
 *   MONGODB_URI=… pnpm import:apply <archive-dir> [--dry-run] [--first-apply] [--db <name>]
 *
 * Liability snapshots are deliberately skipped until Net Worth ships (#109 /
 * chunk 7); apply reports how many it left for later.
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
  firstApply: boolean;
  householdId: string;
  /** Seed/demo docs removed by `--first-apply` (0 otherwise). */
  seedWiped: number;
  syncs: CollectionSync[];
  /** Liability-snapshot docs left for chunk 7. */
  skippedLiabilitySnapshots: number;
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
  firstApply: boolean;
  now: Date;
}): Promise<ApplyReport> {
  const { db, householdId, categories, workbooks, dryRun, firstApply, now } = input;

  const seedWiped = firstApply
    ? await wipeSeedAndDisableAutoSeed({ db, householdId, dryRun, now })
    : 0;

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

  // Per-workbook, cell-derived docs: orphan-scoped to the file.
  let skippedLiabilitySnapshots = 0;
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
    // Skipped until #109 provides the Account/Snapshot collections (chunk 7).
    skippedLiabilitySnapshots += wb.liabilitySnapshots.length;
  }

  return { dryRun, firstApply, householdId, seedWiped, syncs, skippedLiabilitySnapshots };
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

/**
 * First-prod-apply prep (story 15): remove the seed/demo data and write the
 * auto-seed-disabled marker so a cold start never re-seeds. Refuses to run once
 * imported data exists — `--first-apply` is for the initial apply only.
 *
 * Seed docs are identified by their namespaced `_id` prefix (`<householdId>:…`,
 * from `seedDocId`) — NOT by "lacks an importRef". That distinction matters:
 * a hand-entered transaction added between bootstrap and import (a random-UUID
 * `_id`, no `importRef`) must survive rather than be silently wiped. Only the
 * demo seed carries the household-namespaced key.
 *
 * Returns the number of seed docs removed (a projected count under `dryRun`).
 */
async function wipeSeedAndDisableAutoSeed(input: {
  db: Db;
  householdId: string;
  dryRun: boolean;
  now: Date;
}): Promise<number> {
  const { db, householdId, dryRun, now } = input;
  const seedCollections = [
    COLLECTIONS.categories,
    COLLECTIONS.categoryTargets,
    COLLECTIONS.transactions,
  ];

  const importedCount = (
    await Promise.all(
      seedCollections.map((c) =>
        db.collection(c).countDocuments({ householdId, importRef: { $exists: true } }),
      ),
    )
  ).reduce((a, b) => a + b, 0);
  if (importedCount > 0) {
    throw new Error(
      "--first-apply refused: imported data already present. It is for the " +
        "initial apply only; re-run without it to sync updates.",
    );
  }

  // Seed docs only: keys are `${householdId}:…`. An anchored `^`-prefix regex on
  // `_id` uses the primary key index. Hand-entered docs (UUID keys) are spared.
  const seedFilter = { householdId, _id: { $regex: `^${escapeRegExp(householdId)}:` } };
  let wiped = 0;
  for (const c of seedCollections) {
    wiped += await db.collection<StringIdDoc>(c).countDocuments(seedFilter);
    if (!dryRun) await db.collection<StringIdDoc>(c).deleteMany(seedFilter);
  }

  if (!dryRun) {
    await db.collection<StringIdDoc>(COLLECTIONS.meta).updateOne(
      { _id: autoSeedDisabledId(householdId) },
      { $set: { householdId, clearedAt: now } },
      { upsert: true },
    );
  }
  return wiped;
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
      "usage: MONGODB_URI=… pnpm import:apply <archive-dir> [--dry-run] [--first-apply] [--db <name>]\n",
    );
    return 2;
  }

  const { categories, workbooks } = readManifests(join(archiveDir, "import", "manifest"));

  const { client, db } = await connectMongo(args.db);
  try {
    const householdId = await resolveHouseholdId(db);
    const report = await applyManifests({
      db, householdId, categories, workbooks,
      dryRun: args.dryRun, firstApply: args.firstApply, now: new Date(),
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
  if (report.firstApply) lines.push(`  first-apply: ${report.seedWiped} seed doc(s) wiped, auto-seed disabled`);
  for (const s of report.syncs) {
    const scope = s.scope ?? "categories";
    lines.push(
      `  ${s.collection} [${scope}]: +${s.inserted} ~${s.updated} -${s.deletedOrphans}`,
    );
  }
  lines.push(`  liability snapshots skipped (chunk 7 / #109): ${report.skippedLiabilitySnapshots}`);
  return lines.join("\n") + "\n";
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseArgs(argv: string[]): {
  archiveDir?: string;
  dryRun: boolean;
  firstApply: boolean;
  db?: string;
} {
  const { values, positionals } = nodeParseArgs({
    args: argv,
    options: {
      "dry-run": { type: "boolean", default: false },
      "first-apply": { type: "boolean", default: false },
      db: { type: "string" },
    },
    allowPositionals: true,
    strict: true,
  });
  return {
    archiveDir: positionals[0],
    dryRun: values["dry-run"] ?? false,
    firstApply: values["first-apply"] ?? false,
    db: values.db,
  };
}

runCli(import.meta.url, "apply", () => runApply(process.argv.slice(2)));
