import { toBudgetMonthDate, appendPaidNote, daysInMonth } from "./budget-month";
import { buildImportRef, hashImportRef } from "./import-ref";
import { resolveCategory, rewriteVendor } from "./mapping";
import { centsToDollars } from "./money";
import { parseCommentLine } from "./parse-line";
import { reconcileCell } from "./reconcile";
import { buildReconciliationReport, buildVendorReport } from "./reports";
import { compareStrings } from "./sort";
import type {
  CellReconcileReport,
  ExtractResult,
  ManifestCategory,
  ManifestCategoryTarget,
  ManifestLiabilitySnapshot,
  ManifestTransaction,
  WorkbookManifest,
} from "./manifest-types";
import type {
  CategoryMapping,
  IncomeConfig,
  LineOverride,
  MappedCategory,
  OverridesConfig,
  ParsedTransactionLine,
} from "./types";
import type { RawWorkbook } from "./workbook";

/**
 * The extract core (chunk 2): raw workbooks + curated configs → the full set of
 * manifests and reports (ADR 0005). Pure and deterministic — no IO, no clock —
 * so the same inputs always yield byte-identical output. It composes the
 * chunk-1 transforms: {@link parseCommentLine}, {@link reconcileCell},
 * {@link toBudgetMonthDate}, {@link resolveCategory}/{@link rewriteVendor}, and
 * the {@link buildImportRef} provenance/id scheme.
 *
 * The reconciliation gate is *reported*, not thrown, here — every cell's
 * verdict lands in the report so a reviewer sees the whole picture; the CLI
 * turns any `unreconciled` cell into a non-zero exit.
 */
export function buildExtract(input: {
  workbooks: RawWorkbook[];
  mapping: CategoryMapping;
  overrides: OverridesConfig;
  income: IncomeConfig;
}): ExtractResult {
  const { workbooks, mapping, overrides, income } = input;

  const activity = new ActivityTracker();
  const cellReports: CellReconcileReport[] = [];
  const vendorTally = new Map<string, { count: number; totalCents: number }>();

  const orderedFiles = [...workbooks].sort((a, b) => a.year - b.year);
  const manifests: WorkbookManifest[] = orderedFiles.map((wb) =>
    buildWorkbook(wb, { mapping, overrides, income }, activity, cellReports, vendorTally),
  );

  const categories = buildCategoriesManifest(mapping, income, activity);

  return {
    categories,
    workbooks: manifests,
    reconciliation: buildReconciliationReport(cellReports),
    vendors: buildVendorReport(vendorTally),
  };
}

function buildWorkbook(
  wb: RawWorkbook,
  cfg: { mapping: CategoryMapping; overrides: OverridesConfig; income: IncomeConfig },
  activity: ActivityTracker,
  cellReports: CellReconcileReport[],
  vendorTally: Map<string, { count: number; totalCents: number }>,
): WorkbookManifest {
  const { mapping, overrides } = cfg;
  const transactions: ManifestTransaction[] = [];
  const estimateTargets: ManifestCategoryTarget[] = [];
  const liabilitySnapshots: ManifestLiabilitySnapshot[] = [];

  for (const row of wb.gridRows) {
    const category = resolveCategory(row.label, mapping);
    const hasValue = row.cells.some((c) => (c.valueCents ?? 0) !== 0);
    if (!category) {
      if (hasValue) {
        throw new Error(
          `${wb.file}!${wb.gridSheet}: row "${row.label}" is unmapped but has nonzero values`,
        );
      }
      continue; // an all-zero unmapped row (a spacer/total) — nothing to import
    }

    for (const cell of row.cells) {
      if (category.kind === "savings") {
        emitSavingsMonthly(wb, cell, category, transactions, activity);
      } else if (category.kind === "expense") {
        emitExpenseCell(wb, cell, category, overrides, transactions, cellReports, vendorTally, activity, mapping);
      } else {
        throw new Error(
          `${wb.file}!${wb.gridSheet}: income row "${row.label}" in the grid (income comes from config)`,
        );
      }
    }
  }

  for (const est of wb.estimates) {
    const category = resolveCategory(est.label, mapping);
    // The Estimate tab's income rows are stale (ADR §6 uses W-2 config); skip
    // unmapped rows and any income-kind row so an estimate target can't collide
    // with the W-2 income baseline for the same category.
    if (!category || category.kind === "income") continue;
    const ref = buildImportRef({ file: wb.file, sheet: "Estimate", cell: est.cell, line: 1 });
    estimateTargets.push({
      _id: hashImportRef(ref),
      importRef: ref,
      categoryId: categoryId(category.canonicalName),
      monthly: centsToDollars(est.monthlyCents),
      effectiveFrom: `${wb.year}-01`,
    });
  }

  for (const liab of wb.liabilities) {
    const ref = buildImportRef({ file: wb.file, sheet: "DebtsEquity", cell: liab.cell, line: 1 });
    liabilitySnapshots.push({
      _id: hashImportRef(ref),
      importRef: ref,
      liability: liab.liability,
      date: monthEnd(wb.year, liab.month),
      balance: centsToDollars(liab.balanceCents),
    });
  }

  return {
    file: wb.file,
    transactions: sortByRef(transactions),
    estimateTargets: sortByRef(estimateTargets),
    liabilitySnapshots: sortByRef(liabilitySnapshots),
  };
}

/** A savings cell is a month-level total (no itemization) → one transaction. */
function emitSavingsMonthly(
  wb: RawWorkbook,
  cell: { month: number; cell: string; valueCents: number | null },
  category: MappedCategory,
  out: ManifestTransaction[],
  activity: ActivityTracker,
): void {
  const cents = cell.valueCents ?? 0;
  if (cents === 0) return;
  const ref = buildImportRef({ file: wb.file, sheet: wb.gridSheet, cell: cell.cell, line: 1 });
  out.push({
    _id: hashImportRef(ref),
    importRef: ref,
    categoryId: categoryId(category.canonicalName),
    amount: centsToDollars(cents),
    date: monthEnd(wb.year, cell.month),
    note: "Imported monthly total",
  });
  activity.mark(category.canonicalName, wb.year, cell.month);
}

/** An expense cell: reconcile its itemized comment lines, then emit each. */
function emitExpenseCell(
  wb: RawWorkbook,
  cell: { month: number; cell: string; valueCents: number | null; comment: string | null },
  category: MappedCategory,
  overrides: OverridesConfig,
  out: ManifestTransaction[],
  cellReports: CellReconcileReport[],
  vendorTally: Map<string, { count: number; totalCents: number }>,
  activity: ActivityTracker,
  mapping: CategoryMapping,
): void {
  const cents = cell.valueCents ?? 0;
  const txLines = (cell.comment ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .map(parseCommentLine)
    .filter((l): l is ParsedTransactionLine => l.kind === "transaction");

  // A blank, zero-value cell with nothing itemized contributes nothing.
  if (cents === 0 && txLines.length === 0) return;

  const prefix = `${wb.file}!${wb.gridSheet}!${cell.cell}`;
  const cellOverrides = overrides.cells[prefix] ?? [];

  const verdict = reconcileCell({
    cellValueCents: cents,
    lines: txLines,
    overrides: cellOverrides,
    refundKeywords: overrides.refundKeywords,
  });
  cellReports.push({
    ref: prefix,
    category: category.canonicalName,
    month: cell.month,
    status: verdict.status,
    cellValueCents: verdict.cellValueCents,
    sumCents: verdict.sumCents,
    deltaCents: verdict.deltaCents,
    autoFlippedLines: verdict.autoFlippedLines,
  });

  // Only a reconciled cell contributes transactions; the CLI fails the run on
  // any unreconciled cell, so we never persist a divergent one.
  if (verdict.status === "unreconciled") return;

  // Amounts come straight from reconcileCell's effectiveLines (overrides +
  // accepted auto-flip already applied, skips removed) — the single source of
  // truth, so the manifest can't diverge from the verdict. Only `set-date`
  // (which doesn't affect the checksum, so reconcile ignores it) is applied
  // here, with the same last-wins override precedence reconcile uses.
  const overrideByLine = new Map<number, LineOverride>();
  for (const o of cellOverrides) overrideByLine.set(o.line, o);

  for (const eff of verdict.effectiveLines) {
    const override = overrideByLine.get(eff.line);
    const { month, day } =
      override?.action === "set-date"
        ? { month: override.month, day: override.day }
        : { month: eff.month, day: eff.day };
    const coerced = toBudgetMonthDate({
      budgetYear: wb.year,
      budgetMonth: cell.month,
      commentMonth: month,
      commentDay: day,
    });
    const vendor = rewriteVendor(eff.vendor, mapping.vendorRewrites);
    const note = appendPaidNote(eff.note, coerced.paidNote);

    const ref = buildImportRef({ file: wb.file, sheet: wb.gridSheet, cell: cell.cell, line: eff.line });
    out.push({
      _id: hashImportRef(ref),
      importRef: ref,
      categoryId: categoryId(category.canonicalName),
      amount: centsToDollars(eff.amountCents),
      date: coerced.date,
      ...(vendor ? { vendor } : {}),
      ...(note ? { note } : {}),
    });
    tallyVendor(vendorTally, vendor, eff.amountCents);
    activity.mark(category.canonicalName, wb.year, cell.month);
  }
}

function buildCategoriesManifest(
  mapping: CategoryMapping,
  income: IncomeConfig,
  activity: ActivityTracker,
) {
  const categories: ManifestCategory[] = [];

  for (const c of mapping.categories) {
    if (c.kind === "income") continue; // income categories come from income config
    const window = activity.window(c.canonicalName);
    if (!window && !c.activeFrom) continue; // never used and no override — omit
    const ref = categoryImportRef(c.canonicalName);
    categories.push({
      _id: hashImportRef(ref),
      importRef: ref,
      name: c.canonicalName,
      kind: c.kind,
      icon: c.icon,
      activeFrom: c.activeFrom ?? window!.from,
      ...(c.activeUntil ? { activeUntil: c.activeUntil } : {}),
    });
  }

  const incomeBaselines: ManifestCategoryTarget[] = [];
  for (const s of income.sources) {
    const years = Object.keys(s.annualGrossByYear).sort();
    if (years.length === 0) continue;
    const ref = categoryImportRef(s.canonicalName);
    categories.push({
      _id: hashImportRef(ref),
      importRef: ref,
      name: s.canonicalName,
      kind: "income",
      icon: s.icon,
      activeFrom: `${years[0]}-01`,
      incomeFrequency: "recurring",
      payCadence: s.payCadence,
      ...(s.firstPaycheckDate ? { firstPaycheckDate: s.firstPaycheckDate } : {}),
    });
    for (const year of years) {
      const baselineRef = `income!${s.canonicalName}#${year}`;
      incomeBaselines.push({
        _id: hashImportRef(baselineRef),
        importRef: baselineRef,
        categoryId: categoryId(s.canonicalName),
        monthly: round2(s.annualGrossByYear[year] / 12),
        effectiveFrom: `${year}-01`,
      });
    }
  }

  return {
    categories: sortByRef(categories),
    incomeBaselines: sortByRef(incomeBaselines),
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Tracks the first/last active "YYYY-MM" per canonical category for windows. */
class ActivityTracker {
  private readonly months = new Map<string, string[]>();
  mark(name: string, year: number, month: number): void {
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    const list = this.months.get(name) ?? [];
    list.push(ym);
    this.months.set(name, list);
  }
  window(name: string): { from: string; until: string } | null {
    const list = this.months.get(name);
    if (!list || list.length === 0) return null;
    const sorted = [...list].sort();
    return { from: sorted[0], until: sorted[sorted.length - 1] };
  }
}

function categoryImportRef(canonicalName: string): string {
  return `mapping!category!${canonicalName}`;
}
function categoryId(canonicalName: string): string {
  return hashImportRef(categoryImportRef(canonicalName));
}

function tallyVendor(
  tally: Map<string, { count: number; totalCents: number }>,
  vendor: string | null,
  amountCents: number,
): void {
  if (!vendor) return;
  const cur = tally.get(vendor) ?? { count: 0, totalCents: 0 };
  cur.count += 1;
  cur.totalCents += amountCents;
  tally.set(vendor, cur);
}

function monthEnd(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth(year, month)).padStart(2, "0")}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sortByRef<T extends { importRef: string }>(docs: T[]): T[] {
  return [...docs].sort((a, b) => compareStrings(a.importRef, b.importRef));
}
