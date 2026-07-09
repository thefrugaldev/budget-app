import { parseArgs as nodeParseArgs } from "node:util";

import { type Db } from "mongodb";

import { COLLECTIONS } from "@/lib/db/collections";
import type { TransactionDocument } from "@/lib/db/documents";

import { connectMongo, runCli } from "./cli";

/**
 * Post-import storage audit (chunk 6, story 18). Reports per-collection document
 * counts, average document sizes, and total bytes from a live database, then
 * projects how many years of headroom remain against the database's free-tier
 * storage cap at the *observed* transactions-per-year rate.
 *
 * Read-only: it issues `collStats` and count/min-max reads and writes nothing.
 * Run it against prod after the first apply to answer "how long until we
 * outgrow the free tier?".
 *
 * Growth model: only `transactions` grows unboundedly (roughly one row per spend
 * event); categories, targets, and income baselines are effectively fixed. So we
 * project future growth from the transactions collection's own footprint
 * (data + indexes) divided across its rows, times the observed rows-per-year.
 *
 * Sizes use MongoDB's *logical* `size` + `totalIndexSize` (uncompressed),
 * not on-disk `storageSize`. That deliberately overestimates usage — a
 * conservative headroom figure is the safe direction to be wrong in, and it's
 * portable across engines that compress differently (WiredTiger vs Cosmos).
 */

/** 1 GiB in bytes. Free-tier caps are quoted in GB; we treat them as binary. */
const GIB = 1024 ** 3;
/** Cosmos DB (Mongo API) free-tier storage allotment, the app's target tier. */
const DEFAULT_CAP_GIB = 25;

export type CollectionStat = {
  name: string;
  count: number;
  /** Mean document size in bytes (`avgObjSize`), 0 for an empty collection. */
  avgDocBytes: number;
  /** Logical (uncompressed) data size in bytes. */
  dataBytes: number;
  /** Total index size in bytes. */
  indexBytes: number;
};

export type StorageProjection = {
  capBytes: number;
  usedBytes: number;
  freeBytes: number;
  /** `usedBytes / capBytes` in [0, 1]. */
  usedFraction: number;
  /** Mean bytes (data + index) a single transaction occupies. */
  bytesPerTransaction: number;
  /** Observed rows/year, or null when it can't be derived (no transactions). */
  transactionsPerYear: number | null;
  /** Projected growth in bytes/year, or null when the rate is unknown. */
  bytesPerYear: number | null;
  /** Years until the cap is reached at the observed rate, or null if unknown. */
  yearsOfHeadroom: number | null;
};

export type StorageAudit = {
  db: string;
  collections: CollectionStat[];
  totalDataBytes: number;
  totalIndexBytes: number;
  transactions: {
    count: number;
    firstYear: number | null;
    lastYear: number | null;
  };
  projection: StorageProjection;
};

/**
 * Pure projection: given per-collection stats, the cap, and the transaction
 * count + observed year span, compute usage and years-of-headroom. Kept free of
 * any DB contact so the headroom math — the load-bearing part — is unit-tested
 * directly on synthetic stats.
 */
export function projectStorage(input: {
  collections: CollectionStat[];
  capBytes: number;
  transactionCount: number;
  firstYear: number | null;
  lastYear: number | null;
}): StorageProjection {
  const { collections, capBytes, transactionCount, firstYear, lastYear } = input;

  const usedBytes = collections.reduce((sum, c) => sum + c.dataBytes + c.indexBytes, 0);
  const freeBytes = Math.max(0, capBytes - usedBytes);
  const usedFraction = capBytes > 0 ? usedBytes / capBytes : 0;

  const txn = collections.find((c) => c.name === COLLECTIONS.transactions);
  const txnFootprint = txn ? txn.dataBytes + txn.indexBytes : 0;
  const bytesPerTransaction = transactionCount > 0 ? txnFootprint / transactionCount : 0;

  // Inclusive span: a single year of data is one year, not zero.
  const yearSpan =
    firstYear !== null && lastYear !== null ? Math.max(1, lastYear - firstYear + 1) : null;
  const transactionsPerYear =
    yearSpan !== null && transactionCount > 0 ? transactionCount / yearSpan : null;
  const bytesPerYear =
    transactionsPerYear !== null ? transactionsPerYear * bytesPerTransaction : null;
  const yearsOfHeadroom =
    bytesPerYear !== null && bytesPerYear > 0 ? freeBytes / bytesPerYear : null;

  return {
    capBytes,
    usedBytes,
    freeBytes,
    usedFraction,
    bytesPerTransaction,
    transactionsPerYear,
    bytesPerYear,
    yearsOfHeadroom,
  };
}

/** Read `collStats` for every known collection (absent ones are skipped). */
async function collectStats(db: Db): Promise<CollectionStat[]> {
  const stats: CollectionStat[] = [];
  for (const name of Object.values(COLLECTIONS)) {
    let raw: { count?: number; avgObjSize?: number; size?: number; totalIndexSize?: number };
    try {
      raw = await db.command({ collStats: name });
    } catch {
      continue; // Collection doesn't exist yet — nothing to report.
    }
    stats.push({
      name,
      count: raw.count ?? 0,
      avgDocBytes: Math.round(raw.avgObjSize ?? 0),
      dataBytes: raw.size ?? 0,
      indexBytes: raw.totalIndexSize ?? 0,
    });
  }
  return stats;
}

/** Transaction count and the earliest/latest budget year present (all docs). */
async function transactionSpan(
  db: Db,
): Promise<{ count: number; firstYear: number | null; lastYear: number | null }> {
  const coll = db.collection<TransactionDocument>(COLLECTIONS.transactions);
  const count = await coll.countDocuments({});
  if (count === 0) return { count: 0, firstYear: null, lastYear: null };

  // `date` is a sortable "YYYY-MM-DD" string, so min/max are one indexed read each.
  const projection = { date: 1 } as const;
  const [first] = await coll.find({}, { projection }).sort({ date: 1 }).limit(1).toArray();
  const [last] = await coll.find({}, { projection }).sort({ date: -1 }).limit(1).toArray();
  return {
    count,
    firstYear: yearOf(first?.date),
    lastYear: yearOf(last?.date),
  };
}

function yearOf(date: string | undefined): number | null {
  if (!date) return null;
  const year = Number.parseInt(date.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

/** Gather live stats and project headroom against `capBytes`. Read-only. */
export async function auditStorage(input: { db: Db; capBytes: number }): Promise<StorageAudit> {
  const { db, capBytes } = input;
  const collections = await collectStats(db);
  const span = await transactionSpan(db);
  return {
    db: db.databaseName,
    collections,
    totalDataBytes: collections.reduce((s, c) => s + c.dataBytes, 0),
    totalIndexBytes: collections.reduce((s, c) => s + c.indexBytes, 0),
    transactions: { count: span.count, firstYear: span.firstYear, lastYear: span.lastYear },
    projection: projectStorage({
      collections,
      capBytes,
      transactionCount: span.count,
      firstYear: span.firstYear,
      lastYear: span.lastYear,
    }),
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

export async function runAudit(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const capBytes = args.capGib * GIB;

  const { client, db } = await connectMongo(args.db);
  try {
    const audit = await auditStorage({ db, capBytes });
    process.stdout.write(formatReport(audit));
    return 0; // Informational — a full disk is a warning, not a failed run.
  } finally {
    await client.close();
  }
}

/** Human-readable byte size (binary units, 1 decimal above KiB). */
function humanBytes(bytes: number): string {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

function formatYears(years: number | null): string {
  if (years === null) return "n/a (no transactions to project from)";
  if (years >= 1000) return `${Math.round(years).toLocaleString("en-US")} years`;
  return `${years.toFixed(years >= 10 ? 0 : 1)} years`;
}

function formatReport(audit: StorageAudit): string {
  const { projection: p, transactions: t } = audit;
  const lines = [`storage audit → db "${audit.db}"`, "  collections:"];

  const sorted = [...audit.collections].sort((a, b) => b.dataBytes - a.dataBytes);
  const namePad = Math.max(0, ...sorted.map((c) => c.name.length));
  for (const c of sorted) {
    lines.push(
      `    ${c.name.padEnd(namePad)}  ${String(c.count).padStart(7)} docs  ` +
        `avg ${humanBytes(c.avgDocBytes).padStart(9)}  ` +
        `data ${humanBytes(c.dataBytes).padStart(9)}  index ${humanBytes(c.indexBytes).padStart(9)}`,
    );
  }

  const pct = (p.usedFraction * 100).toFixed(p.usedFraction < 0.01 ? 4 : 2);
  lines.push(
    "",
    `  used ${humanBytes(p.usedBytes)} of ${humanBytes(p.capBytes)} (${pct}%) — ${humanBytes(p.freeBytes)} free`,
  );

  if (p.transactionsPerYear === null) {
    lines.push("  growth: no transactions — cannot project headroom");
  } else {
    const span =
      t.firstYear !== null && t.lastYear !== null
        ? `${t.firstYear}–${t.lastYear} (${Math.max(1, t.lastYear - t.firstYear + 1)}y)`
        : "unknown span";
    lines.push(
      `  growth: ${t.count.toLocaleString("en-US")} transactions over ${span} = ` +
        `${Math.round(p.transactionsPerYear).toLocaleString("en-US")}/yr @ ` +
        `${humanBytes(p.bytesPerTransaction)}/txn ≈ ${humanBytes(p.bytesPerYear ?? 0)}/yr`,
      `  headroom: ~${formatYears(p.yearsOfHeadroom)} at the observed rate`,
    );
  }

  if (p.usedFraction >= 0.8) {
    lines.push(`  ⚠ over 80% of the storage cap is in use`);
  }
  return lines.join("\n") + "\n";
}

function parseArgs(argv: string[]): { db?: string; capGib: number } {
  const { values } = nodeParseArgs({
    args: argv,
    options: { db: { type: "string" }, "cap-gb": { type: "string" } },
    allowPositionals: true,
    strict: true,
  });
  const capGib = values["cap-gb"] !== undefined ? Number(values["cap-gb"]) : DEFAULT_CAP_GIB;
  if (!Number.isFinite(capGib) || capGib <= 0) {
    throw new Error(`--cap-gb must be a positive number (got "${values["cap-gb"]}")`);
  }
  return { db: values.db, capGib };
}

runCli(import.meta.url, "storage-audit", () => runAudit(process.argv.slice(2)));
