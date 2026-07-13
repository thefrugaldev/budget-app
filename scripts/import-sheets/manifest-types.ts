import type { CategoryKind, IncomeFrequency, PayCadence } from "@/types/budget";

import type { ReconcileStatus } from "./types";

/**
 * Manifest document shapes — the exact records `apply` (chunk 3) syncs into
 * MongoDB. Each carries its deterministic `_id` and human-readable `importRef`
 * (ADR 0005 decision 3). `householdId` is deliberately absent: it is stamped at
 * apply from the existing household document, not baked into the reproducible
 * manifest.
 *
 * Two manifest scopes, distinguished by provenance:
 *   - **Config-derived, cross-year** ({@link CategoriesManifest}) — canonical
 *     categories and W-2 income baselines. Upsert-only; not owned by any one
 *     workbook, so never orphan-deleted per file.
 *   - **Workbook-cell-derived, per-year** ({@link WorkbookManifest}) — one per
 *     `YYYY.xlsx`; transactions, estimate targets, liability snapshots. These
 *     carry a `<file>!…` importRef and ARE orphan-scoped to their file.
 */

export type ManifestCategory = {
  _id: string;
  importRef: string;
  name: string;
  kind: CategoryKind;
  icon: string;
  /** Inclusive "YYYY-MM"; data-derived (first active month) or overridden. */
  activeFrom: string;
  /** Inclusive "YYYY-MM"; absent means still active. */
  activeUntil?: string;
  incomeFrequency?: IncomeFrequency;
  payCadence?: PayCadence;
  firstPaycheckDate?: string;
};

export type ManifestCategoryTarget = {
  _id: string;
  importRef: string;
  categoryId: string;
  monthly: number;
  /** "YYYY-MM" — a year's estimate takes effect at its January. */
  effectiveFrom: string;
};

export type ManifestTransaction = {
  _id: string;
  importRef: string;
  categoryId: string;
  /** Signed dollars (negative = refund/withdrawal). */
  amount: number;
  /** ISO date "YYYY-MM-DD", in the budget month. */
  date: string;
  vendor?: string;
  note?: string;
};

/**
 * A liability-balance snapshot from a DebtsEquity cell. Applied (chunk 7) as a
 * Net Worth `Snapshot` under a derived liability `Account`.
 */
export type ManifestLiabilitySnapshot = {
  _id: string;
  importRef: string;
  /**
   * Canonical liability name — the DebtsEquity column header run through the
   * optional `mapping.liabilities` rename (unmapped headers pass through).
   */
  liability: string;
  /** Month-end ISO date "YYYY-MM-DD". */
  date: string;
  balance: number;
};

export type CategoriesManifest = {
  categories: ManifestCategory[];
  incomeBaselines: ManifestCategoryTarget[];
};

export type WorkbookManifest = {
  file: string;
  transactions: ManifestTransaction[];
  estimateTargets: ManifestCategoryTarget[];
  liabilitySnapshots: ManifestLiabilitySnapshot[];
};

/** The complete extract output for the whole archive. */
export type ExtractResult = {
  categories: CategoriesManifest;
  workbooks: WorkbookManifest[];
  reconciliation: ReconciliationReport;
  vendors: VendorReport;
};

// ── Reports ────────────────────────────────────────────────────────────────

/** One cell's reconciliation verdict, for the report (story 11). */
export type CellReconcileReport = {
  /** `<file>!<sheet>!<cell>` — the cell's importRef prefix. */
  ref: string;
  category: string;
  /** 1–12 budget month. */
  month: number;
  status: ReconcileStatus;
  cellValueCents: number;
  sumCents: number;
  deltaCents: number;
  autoFlippedLines: number[];
};

/**
 * One payoff-metadata cross-check (chunk 7 / story 17). A `Payoff Left - $…`
 * line in a year-grid liability row's cell comment is compared against the same
 * month's DebtsEquity balance for that liability. A payoff quote includes
 * accrued interest, so it never matches the principal balance exactly; the check
 * is tolerance-based (`ok` iff `deltaPct` ≤ 0.5). A payoff line with no matching
 * DebtsEquity balance is a failing entry (`balanceCents: null`, `ok: false`).
 */
export type LiabilityCrossCheck = {
  /** `<file>!<sheet>!<cell>#<line>` — the payoff comment line's importRef. */
  ref: string;
  /** Canonical liability name the row resolved to. */
  liability: string;
  /** 1–12 budget month the payoff line sits in. */
  month: number;
  payoffCents: number;
  /** The month's DebtsEquity balance in cents, or null when none matched. */
  balanceCents: number | null;
  /** |payoff − balance| / balance × 100, or null when no balance matched. */
  deltaPct: number | null;
  ok: boolean;
};

export type ReconciliationReport = {
  totalCells: number;
  exact: number;
  reconciledByFlip: number;
  unreconciled: number;
  /** All cells, unreconciled first (then by ref) so review lands on failures. */
  cells: CellReconcileReport[];
  /** How many payoff-metadata lines were checked. */
  liabilityCrossChecksTotal: number;
  /** How many of those passed (`deltaPct` ≤ 0.5 against a matched balance). */
  liabilityCrossChecksPassed: number;
  /** Every cross-check, failures first (then by ref). */
  liabilityCrossChecks: LiabilityCrossCheck[];
};

/** Post-rewrite vendor frequency, so rewrite rules can be reviewed once (story 11). */
export type VendorFrequencyEntry = {
  vendor: string;
  count: number;
  totalCents: number;
};

export type VendorReport = {
  vendors: VendorFrequencyEntry[];
};
