import type { CategoryKind } from "@/types/budget";

/**
 * Internal types for the Excel-archive importer (issue #118 / ADR 0005).
 *
 * These describe the *transform layer* — the pure functions that turn raw
 * workbook comment lines, cell checksums, and the curated mapping/overrides
 * config into structured, provenance-bearing intermediate data. The CLIs
 * (`extract` / `apply`, later chunks) read workbooks and write the database;
 * everything here is deterministic and side-effect-free so it can be unit
 * tested on synthetic fixtures with no workbook or MongoDB in sight (story 19).
 *
 * The importer module is deliberately self-contained: it depends on the app
 * only for the `CategoryKind` union (so imported categories can't drift from
 * the app's kinds) — a type-only import that erases at runtime.
 */

/**
 * One successfully parsed transaction comment line
 * (`M/D - $Amount (Vendor - Note)` and its known variants). Amount is a
 * **signed integer number of cents** — integer math keeps per-cell
 * reconciliation exact, avoiding binary-float drift when summing hundreds of
 * lines against a checksum. The `month`/`day` are the line's own date as
 * written; budget-month dating (which month the payment is *for*) is applied
 * separately by {@link ./budget-month}.
 */
export type ParsedTransactionLine = {
  kind: "transaction";
  /** 1–12, from the leading `M/D`. */
  month: number;
  /** 1–31, from the leading `M/D` (clamped later against the budget month). */
  day: number;
  /** Signed integer cents. Negative for the `(-$…)` refund form. */
  amountCents: number;
  vendor: string | null;
  note: string | null;
};

/**
 * A comment line that does not match any known transaction shape (e.g. a
 * free-text note with no amount). Carried through rather than dropped so
 * extract can surface it in a report; the reconciliation gate decides whether
 * a cell containing one still balances.
 */
export type UnparsedLine = { kind: "unparsed"; raw: string };

export type ParsedLine = ParsedTransactionLine | UnparsedLine;

/**
 * A per-line exception from the curated `overrides.json` (in the private
 * archive repo), keyed by the line's 1-based position within its cell (the
 * `#line` of its {@link buildImportRef}). ADR 0005 decision 1: every cell must
 * reconcile exactly or carry explicit overrides — no silent deltas.
 *
 * - `skip` — exclude the line from the cell (e.g. an annual payment already
 *   captured as amortized monthly deposits, which would otherwise double-count).
 * - `sign-flip` — negate the line's amount (a refund keyed in as positive).
 * - `set-amount` — replace the parsed amount with a corrected value in cents.
 * - `set-date` — correct the line's month/day (does not affect the checksum).
 */
export type LineOverride =
  | { line: number; action: "skip"; reason: string }
  | { line: number; action: "sign-flip"; reason: string }
  | { line: number; action: "set-amount"; amountCents: number; reason: string }
  | { line: number; action: "set-date"; month: number; day: number; reason: string };

export type ReconcileStatus = "exact" | "reconciled-by-flip" | "unreconciled";

/**
 * The reconciliation verdict for one cell: whether its itemized lines sum to
 * the cell's checksum value, and by what means. `effectiveLines` is the final
 * set of lines (overrides applied, auto-flips accepted, skips removed) that a
 * reconciled cell contributes to the manifest.
 */
export type ReconcileResult = {
  status: ReconcileStatus;
  cellValueCents: number;
  /** Sum of `effectiveLines` in cents. */
  sumCents: number;
  /**
   * `sumCents - cellValueCents` *before* any auto-flip — the raw gap a reviewer
   * needs when a cell fails to reconcile. Zero on `exact`/`reconciled-by-flip`.
   */
  deltaCents: number;
  effectiveLines: ParsedTransactionLine[];
  /** 1-based line indices the keyword rule flipped to reach reconciliation. */
  autoFlippedLines: number[];
};

/**
 * One canonical app category a set of (possibly renamed-over-the-years)
 * spreadsheet row labels collapses into. From the curated `mapping.json`.
 * `icon` is validated against the app's icon catalog at extract time (chunk 2),
 * not here.
 */
export type MappedCategory = {
  canonicalName: string;
  kind: CategoryKind;
  /** Lucide icon name, e.g. `"ShoppingCart"`. */
  icon: string;
  /**
   * Every spreadsheet row label (across years, including rename chains) that
   * resolves to this category. Matched case-insensitively after trimming.
   */
  aliases: string[];
  /** Optional active-window override, "YYYY-MM"; otherwise data-derived. */
  activeFrom?: string;
  activeUntil?: string;
};

/**
 * A vendor-string normalization rule from `mapping.json`, letting one codified
 * rule stand in for thousands of hand-edits (story 11). `exact` replaces the
 * whole vendor (case-insensitive) on a match; `regex` applies a
 * case-insensitive `String.replace`.
 */
export type VendorRewrite = {
  match: string;
  to: string;
  mode?: "exact" | "regex";
};

export type CategoryMapping = {
  categories: MappedCategory[];
  vendorRewrites: VendorRewrite[];
};

/** The four coordinates that locate a value in the workbook archive. */
export type ImportRefParts = {
  /** Workbook file, e.g. `"2023.xlsx"`. */
  file: string;
  /** Worksheet/tab name, e.g. `"2023"` or `"DebtsEquity"`. */
  sheet: string;
  /** A1-style cell reference, e.g. `"D14"`. */
  cell: string;
  /** 1-based line index within the cell's comment (1 for cell-level rows). */
  line: number;
};
