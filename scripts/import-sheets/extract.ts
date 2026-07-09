import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildExtract } from "./build-manifest";
import { parseIncome, parseMapping, parseOverrides } from "./config";
import { assertIconsResolve } from "./icon-validate";
import { readWorkbook } from "./workbook";
import type { ExtractResult } from "./manifest-types";

/**
 * The `extract` CLI (chunk 2): parse the workbook archive + curated configs
 * into reviewable manifests and reconciliation/vendor reports. No database
 * contact and deterministic output — unchanged inputs produce byte-identical
 * files (ADR 0005 decision 4). `apply` (chunk 3) consumes the manifests later.
 *
 *   pnpm import:extract <archive-dir> [--out <dir>]
 *
 * Layout under the archive dir: `YYYY.xlsx` workbooks at the root; configs and
 * output under `import/` (`mapping.json`, `overrides.json`, `income.json`,
 * `manifest/`, `reports/`) — matching the private archive repo's README.
 *
 * The reconciliation gate is hard: any unreconciled cell prints a summary and
 * exits non-zero, so a divergent extract never silently produces a manifest.
 */
export async function runExtract(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const archiveDir = args.archiveDir;
  if (!archiveDir) {
    process.stderr.write(
      "usage: pnpm import:extract <archive-dir> [--out <dir>]\n",
    );
    return 2;
  }

  const importDir = join(archiveDir, "import");
  const outDir = args.out ?? importDir;

  warnOnLockFiles(archiveDir);

  const mapping = parseMapping(readJson(join(importDir, "mapping.json"), true));
  const overrides = parseOverrides(readJson(join(importDir, "overrides.json"), false));
  const income = parseIncome(readJson(join(importDir, "income.json"), false));
  assertIconsResolve(mapping, income);

  const workbookFiles = readdirSync(archiveDir)
    .filter((f) => /^\d{4}\.xlsx$/.test(f))
    .sort();
  if (workbookFiles.length === 0) {
    throw new Error(`No YYYY.xlsx workbooks found in ${archiveDir}`);
  }
  const workbooks = await Promise.all(
    workbookFiles.map((f) => readWorkbook(join(archiveDir, f))),
  );

  const result = buildExtract({ workbooks, mapping, overrides, income });
  writeOutputs(outDir, result);

  const { reconciliation: recon } = result;
  process.stdout.write(
    `extract: ${recon.totalCells} cells — ${recon.exact} exact, ` +
      `${recon.reconciledByFlip} by flip, ${recon.unreconciled} unreconciled\n`,
  );
  if (recon.unreconciled > 0) {
    process.stderr.write(
      `FAILED reconciliation gate: ${recon.unreconciled} cell(s) do not balance. ` +
        `See ${join(outDir, "reports", "reconciliation.json")} (unreconciled listed first).\n`,
    );
    return 1;
  }
  return 0;
}

function writeOutputs(outDir: string, result: ExtractResult): void {
  const manifestDir = join(outDir, "manifest");
  const reportsDir = join(outDir, "reports");
  mkdirSync(manifestDir, { recursive: true });
  mkdirSync(reportsDir, { recursive: true });

  writeJson(join(manifestDir, "categories.json"), result.categories);
  for (const wb of result.workbooks) {
    const year = wb.file.replace(/\.xlsx$/, "");
    writeJson(join(manifestDir, `${year}.json`), wb);
  }
  writeJson(join(reportsDir, "reconciliation.json"), result.reconciliation);
  writeJson(join(reportsDir, "vendors.json"), result.vendors);
}

function warnOnLockFiles(dir: string): void {
  const locks = readdirSync(dir).filter((f) => f.startsWith("~$") && f.endsWith(".xlsx"));
  if (locks.length > 0) {
    process.stderr.write(
      `WARNING: Excel lock file(s) present (${locks.join(", ")}). A workbook is ` +
        `open in Excel — you may be extracting a mid-edit save. Close it first.\n`,
    );
  }
}

function readJson(path: string, required: boolean): unknown {
  if (!existsSync(path)) {
    if (required) throw new Error(`Required config not found: ${path}`);
    return undefined;
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, stableStringify(value) + "\n", "utf8");
}

/**
 * Deterministic JSON: object keys sorted recursively so serialization never
 * depends on insertion order. Document arrays are already sorted by `importRef`
 * in the builder, so the whole output is byte-stable across runs.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2);
}
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

function parseArgs(argv: string[]): { archiveDir?: string; out?: string } {
  const out: { archiveDir?: string; out?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") out.out = argv[++i];
    else if (!arg.startsWith("-") && !out.archiveDir) out.archiveDir = arg;
  }
  return out;
}

// Run when invoked directly (tsx scripts/import-sheets/extract.ts …).
if (import.meta.url === `file://${process.argv[1]}`) {
  runExtract(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write(`extract error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    });
}
