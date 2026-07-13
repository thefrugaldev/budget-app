import ExcelJS from "exceljs";

import type {
  CategoryMapping,
  IncomeConfig,
  OverridesConfig,
} from "../types";

/**
 * Synthetic fixture workbook for the extract tests (story 19 — no real
 * financial data in this public repo). It reproduces the real workbook
 * *shapes* with invented values: a year grid whose cells carry itemized
 * comments, an Estimate tab, and a transposed DebtsEquity tab. Built in memory
 * with ExcelJS so the tests exercise the real read path without checking a
 * binary into git.
 *
 * The fixture deliberately covers the tricky cases:
 *   - a vendor+note line and a vendor-only line that sum to the cell (exact)
 *   - a prior-month bill (budget-month coercion → `(paid M/D)`)
 *   - a prior-*year* bill dated in December, budgeted to January
 *   - a savings row with a bare monthly total (no comment)
 *   - a refund line that reconciles only via the keyword sign-flip
 *   - optionally, an unbalanced cell with no override (the hard-gate case)
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * How the fixture's mortgage-payoff cross-check should land:
 *   - `"pass"` (default): a `Payoff Left - $…` line within 0.5% of the Jan
 *     balance (a payoff quote incl. accrued interest);
 *   - `"fail"`: a payoff line >0.5% off;
 *   - `"missing"`: a payoff line in a month with no DebtsEquity balance;
 *   - `"none"`: no payoff metadata at all.
 */
export type PayoffMode = "pass" | "fail" | "missing" | "none";

export type FixtureOptions = {
  includeUnreconciled?: boolean;
  /** Add a nonzero derived-total row declared as a skipRow (must not import). */
  includeSkipRow?: boolean;
  /** Add a nonzero row that is neither mapped nor skipped (hard-error case). */
  includeUnmappedNonzero?: boolean;
  /** Make the January Mortgage balance negative (extract must fail). */
  negativeBalance?: boolean;
  /** Use a display-ugly liability header, exercising canonicalization. */
  uglyLiabilityHeader?: boolean;
  payoffMode?: PayoffMode;
};

export async function buildFixtureWorkbook(
  opts: FixtureOptions = {},
): Promise<Buffer> {
  const payoffMode = opts.payoffMode ?? "pass";
  const wb = new ExcelJS.Workbook();

  // ── Estimate tab ──
  const est = wb.addWorksheet("Estimate");
  est.getCell("B1").value = "Estimate (Monthly)";
  est.getCell("A2").value = "Groceries";
  est.getCell("B2").value = 150;
  est.getCell("A3").value = "Mortgage";
  est.getCell("B3").value = 1900;

  // ── DebtsEquity tab (transposed: months down, liabilities across) ──
  const debts = wb.addWorksheet("DebtsEquity");
  debts.getCell("B1").value = opts.uglyLiabilityHeader ? "Home Loan" : "Mortgage";
  debts.getCell("C1").value = "Total Debts"; // reader stops here…
  debts.getCell("D1").value = "Equity"; // …so this column is NOT a liability
  debts.getCell("A2").value = "January";
  debts.getCell("B2").value = opts.negativeBalance ? -300000 : 300000;
  debts.getCell("C2").value = 300000;
  debts.getCell("D2").value = 50000;
  debts.getCell("A3").value = "February";
  debts.getCell("B3").value = 299000;
  debts.getCell("C3").value = 299000;
  debts.getCell("D3").value = 55000;

  // ── Year grid ──
  const grid = wb.addWorksheet("2023");
  MONTHS.forEach((m, i) => {
    grid.getCell(1, i + 2).value = m; // B1..M1
  });
  grid.getCell("N1").value = "Yearly"; // a computed column the reader ignores

  // Row 2: Groceries (expense)
  grid.getCell("A2").value = "Groceries";
  setCell(grid, "B2", 152.1, "1/3 - $52.10 (Costco - household)\n1/10 - $100.00 (Safeway)");
  setCell(grid, "C2", 50, "1/31 - $50.00 (Costco)"); // paid in Jan, budgeted Feb
  setCell(grid, "D2", 0, "3/5 - $20.00 (Corner Store)\n3/6 - $20.00 (refund from Corner Store)");

  // Row 3: Mortgage (expense) — Dec bill budgeted to January. Its cell comments
  // also carry the mortgage-payoff metadata (an extra non-transaction line that
  // parses as `unparsed` and is dropped from the reconciliation sum).
  grid.getCell("A3").value = "Mortgage";
  setCell(grid, "B3", 1900, mortgageComment(payoffMode));
  if (payoffMode === "missing") {
    // March (D3) has no DebtsEquity balance → a payoff here can't be matched.
    setCell(grid, "D3", 1900, "3/28 - $1,900.00 (Chase)\nPayoff Left - $290,000.00");
  }

  // Row 4: Brokerage (savings) — bare monthly total, no comment
  grid.getCell("A4").value = "Brokerage";
  grid.getCell("B4").value = 500;

  if (opts.includeUnreconciled) {
    // Row 5: an expense cell whose lines don't sum to the value, no override.
    grid.getCell("A5").value = "Dining";
    setCell(grid, "B5", 100, "1/4 - $30.00 (Cafe)"); // 30 ≠ 100 → unreconciled
  }

  if (opts.includeSkipRow) {
    // A derived total the sheet computes: nonzero, unmapped, but declared a
    // skipRow — must NOT trip the unmapped-nonzero hard error, must NOT import.
    grid.getCell("A6").value = "Total";
    grid.getCell("B6").value = 2552.1;
  }

  if (opts.includeUnmappedNonzero) {
    // Neither mapped nor a skipRow, but nonzero → the hard-error case.
    grid.getCell("A7").value = "Mystery Row";
    grid.getCell("B7").value = 42;
  }

  // exceljs's Buffer type drifts from @types/node's; bridge through unknown.
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}

/**
 * The Mortgage row's January comment: the true bill line plus, per mode, a
 * `Payoff Left - $…` metadata line. Pass value is 300,150 vs a 300,000 balance
 * (0.05% — under tolerance); fail is 305,000 (1.67% — over). `missing` keeps
 * January clean and puts the payoff in a balance-less month (added separately).
 */
function mortgageComment(mode: PayoffMode): string {
  const bill = "12/28 - $1,900.00 (Chase)";
  switch (mode) {
    case "pass":
      return `${bill}\nPayoff Left - $300,150.00`;
    case "fail":
      return `${bill}\nPayoff Left - $305,000.00`;
    default:
      return bill;
  }
}

function setCell(
  ws: ExcelJS.Worksheet,
  address: string,
  value: number,
  note: string,
): void {
  const cell = ws.getCell(address);
  cell.value = value;
  cell.note = note;
}

/** The fixture's companion configs, matching its labels. */
export const fixtureMapping: CategoryMapping = {
  categories: [
    { canonicalName: "Groceries", kind: "expense", icon: "ShoppingCart", aliases: ["Groceries"] },
    { canonicalName: "Mortgage", kind: "expense", icon: "House", aliases: ["Mortgage"] },
    { canonicalName: "Brokerage", kind: "savings", icon: "TrendingUp", aliases: ["Brokerage"] },
    { canonicalName: "Dining", kind: "expense", icon: "Utensils", aliases: ["Dining"] },
  ],
  vendorRewrites: [{ match: "Chase", to: "Chase Mortgage", mode: "exact" }],
  // "Home Loan" is the DebtsEquity header under `uglyLiabilityHeader`; it
  // canonicalizes to "Mortgage" so both header spellings share one account.
  liabilities: [{ canonicalName: "Mortgage", aliases: ["Mortgage", "Home Loan"] }],
  // A derived total the sheet computes — nonzero, never imported.
  skipRows: ["Total", "Remaining After Expenses & Savings"],
};

export const fixtureOverrides: OverridesConfig = {
  cells: {},
  refundKeywords: ["refund"],
};

export const fixtureIncome: IncomeConfig = {
  sources: [
    {
      canonicalName: "Salary",
      icon: "Banknote",
      payCadence: "bi-weekly",
      firstPaycheckDate: "2023-01-06",
      annualGrossByYear: { "2023": 120000 },
    },
  ],
};
