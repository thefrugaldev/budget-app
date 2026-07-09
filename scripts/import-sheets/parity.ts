import { realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs as nodeParseArgs } from "node:util";

import { MongoClient, type Db } from "mongodb";

import { monthTotalsByCategory, ytdTotalsByCategory } from "@/lib/budget/aggregate";
import { COLLECTIONS } from "@/lib/db/collections";
import type { CategoryDocument, TransactionDocument } from "@/lib/db/documents";
import { toCategory, toTransaction } from "@/lib/db/mappers";

import { readManifests, resolveHouseholdId } from "./apply";
import type { WorkbookManifest } from "./manifest-types";

/**
 * Parity validation (chunk 4, story 13): prove the import round-tripped
 * correctly by running the app's *own* aggregations over the applied database
 * and diffing every category-month against the manifest sums — correctness
 * proven, not eyeballed. It reads the DB through the same `toTransaction` /
 * `toCategory` mappers the app uses and feeds them to `monthTotalsByCategory`
 * (monthly spend) and `ytdTotalsByCategory` (year totals), so a mismatch means
 * apply, the mappers, or the aggregation disagrees with what extract produced.
 *
 * Only imported docs (those carrying an `importRef`) are considered, so parity
 * is meaningful even on a database that also holds seed or hand-entered data.
 * Any mismatch is reported with the offending cell's source `importRef`s.
 */

export type ParityMismatch = {
  /** `"month"` (monthly-spend agg) or `"year"` (YTD agg). */
  scope: "month" | "year";
  categoryId: string;
  /** `"YYYY-MM"` for a month, `"YYYY"` for a year. */
  period: string;
  expected: number;
  actual: number;
  deltaCents: number;
  /** Source cell refs contributing to this category-period (empty if DB-only). */
  importRefs: string[];
};

export type ParityReport = {
  checkedCategoryMonths: number;
  checkedCategoryYears: number;
  mismatches: ParityMismatch[];
};

const cents = (n: number): number => Math.round(n * 100);
const cellKey = (categoryId: string, period: string): string => `${categoryId}|${period}`;

type Expected = {
  monthly: Map<string, number>;
  yearly: Map<string, number>;
  provenanceMonthly: Map<string, string[]>;
  provenanceYearly: Map<string, string[]>;
};

/**
 * The per-(category, month) and per-(category, year) sums the applied database
 * *should* aggregate to, plus the source refs behind each — derived purely from
 * the manifests (no DB). A transaction's period is its budget-month date.
 */
export function expectedTotals(workbooks: WorkbookManifest[]): Expected {
  const monthly = new Map<string, number>();
  const yearly = new Map<string, number>();
  const provenanceMonthly = new Map<string, string[]>();
  const provenanceYearly = new Map<string, string[]>();

  const add = (map: Map<string, number>, key: string, amount: number) =>
    map.set(key, (map.get(key) ?? 0) + amount);
  const track = (map: Map<string, string[]>, key: string, ref: string) =>
    map.set(key, [...(map.get(key) ?? []), ref]);

  for (const wb of workbooks) {
    for (const t of wb.transactions) {
      const ym = t.date.slice(0, 7);
      const year = t.date.slice(0, 4);
      const mKey = cellKey(t.categoryId, ym);
      const yKey = cellKey(t.categoryId, year);
      add(monthly, mKey, t.amount);
      add(yearly, yKey, t.amount);
      track(provenanceMonthly, mKey, t.importRef);
      track(provenanceYearly, yKey, t.importRef);
    }
  }
  return { monthly, yearly, provenanceMonthly, provenanceYearly };
}

/**
 * Run the app's aggregations over the applied DB's imported docs and diff every
 * category-month (and category-year) against the manifest expectations.
 */
export async function checkParity(input: {
  db: Db;
  householdId: string;
  workbooks: WorkbookManifest[];
}): Promise<ParityReport> {
  const { db, householdId, workbooks } = input;

  const imported = { householdId, importRef: { $exists: true } };
  const [txnDocs, catDocs] = await Promise.all([
    db.collection<TransactionDocument>(COLLECTIONS.transactions).find(imported).toArray(),
    db.collection<CategoryDocument>(COLLECTIONS.categories).find(imported).toArray(),
  ]);
  const txns = txnDocs.map(toTransaction);
  const cats = catDocs.map(toCategory);

  const expected = expectedTotals(workbooks);
  const mismatches: ParityMismatch[] = [];

  // Monthly-spend parity: the app's per-month category totals vs manifest sums.
  const months = new Set<string>();
  for (const key of expected.monthly.keys()) months.add(key.split("|")[1]);
  for (const t of txns) months.add(t.date.slice(0, 7));

  let checkedCategoryMonths = 0;
  for (const ym of months) {
    const actual = monthTotalsByCategory(txns, cats, ym);
    for (const categoryId of categoriesInPeriod(expected.monthly, actual, ym)) {
      const exp = expected.monthly.get(cellKey(categoryId, ym)) ?? 0;
      const act = actual.get(categoryId) ?? 0;
      checkedCategoryMonths++;
      if (cents(exp) !== cents(act)) {
        mismatches.push(mismatch("month", categoryId, ym, exp, act, expected.provenanceMonthly));
      }
    }
  }

  // YTD parity: exercise the app's year-to-date aggregation at each year-end
  // (which sums that whole calendar year) against the manifest year sums.
  const years = new Set<string>();
  for (const key of expected.yearly.keys()) years.add(key.split("|")[1]);
  for (const t of txns) years.add(t.date.slice(0, 4));

  let checkedCategoryYears = 0;
  for (const year of years) {
    const actual = ytdTotalsByCategory(txns, cats, new Date(`${year}-12-31T00:00:00.000Z`));
    for (const categoryId of categoriesInPeriod(expected.yearly, actual, year)) {
      const exp = expected.yearly.get(cellKey(categoryId, year)) ?? 0;
      const act = actual.get(categoryId) ?? 0;
      checkedCategoryYears++;
      if (cents(exp) !== cents(act)) {
        mismatches.push(mismatch("year", categoryId, year, exp, act, expected.provenanceYearly));
      }
    }
  }

  return { checkedCategoryMonths, checkedCategoryYears, mismatches };
}

/** Category ids to check for a period: those the manifest expects, plus any the
 * DB aggregation produced a nonzero total for (to catch unexpected extras). */
function categoriesInPeriod(
  expectedForScope: Map<string, number>,
  actual: Map<string, number>,
  period: string,
): Set<string> {
  const ids = new Set<string>();
  for (const key of expectedForScope.keys()) {
    const [categoryId, p] = key.split("|");
    if (p === period) ids.add(categoryId);
  }
  for (const [categoryId, total] of actual) if (cents(total) !== 0) ids.add(categoryId);
  return ids;
}

function mismatch(
  scope: "month" | "year",
  categoryId: string,
  period: string,
  expected: number,
  actual: number,
  provenance: Map<string, string[]>,
): ParityMismatch {
  return {
    scope,
    categoryId,
    period,
    expected,
    actual,
    deltaCents: cents(actual) - cents(expected),
    importRefs: provenance.get(cellKey(categoryId, period)) ?? [],
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

export async function runParity(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const archiveDir = args.archiveDir;
  if (!archiveDir) {
    process.stderr.write(
      "usage: MONGODB_URI=… pnpm import:parity <archive-dir> [--db <name>]\n",
    );
    return 2;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI environment variable");
  const dbName = args.db ?? process.env.MONGODB_DB_NAME ?? "budget";

  const { workbooks } = readManifests(join(archiveDir, "import", "manifest"));

  const client = await new MongoClient(uri).connect();
  try {
    const db = client.db(dbName);
    const householdId = await resolveHouseholdId(db);
    const report = await checkParity({ db, householdId, workbooks });
    process.stdout.write(formatReport(report, dbName));
    return report.mismatches.length === 0 ? 0 : 1;
  } finally {
    await client.close();
  }
}

function formatReport(report: ParityReport, dbName: string): string {
  const lines = [
    `parity → db "${dbName}": ${report.checkedCategoryMonths} category-months + ` +
      `${report.checkedCategoryYears} category-years checked`,
  ];
  if (report.mismatches.length === 0) {
    lines.push("  ✓ all category totals match the manifest");
  } else {
    lines.push(`  ✗ ${report.mismatches.length} mismatch(es):`);
    for (const m of report.mismatches) {
      lines.push(
        `  [${m.scope} ${m.period}] category ${m.categoryId}: ` +
          `expected ${m.expected.toFixed(2)}, got ${m.actual.toFixed(2)} ` +
          `(Δ ${(m.deltaCents / 100).toFixed(2)})`,
      );
      if (m.importRefs.length > 0) {
        lines.push(`      source: ${m.importRefs.join(", ")}`);
      } else {
        lines.push(`      source: (present in DB, absent from manifest)`);
      }
    }
  }
  return lines.join("\n") + "\n";
}

function parseArgs(argv: string[]): { archiveDir?: string; db?: string } {
  const { values, positionals } = nodeParseArgs({
    args: argv,
    options: { db: { type: "string" } },
    allowPositionals: true,
    strict: true,
  });
  return { archiveDir: positionals[0], db: values.db };
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entry);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  runParity(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write(`parity error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    });
}
