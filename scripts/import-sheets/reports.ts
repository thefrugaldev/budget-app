import type {
  CellReconcileReport,
  ReconciliationReport,
  VendorReport,
} from "./manifest-types";
import { compareStrings } from "./sort";

/**
 * The two review artifacts extract emits alongside the manifests (story 11).
 * Pure formatters over data the manifest builder collected during its pass, so
 * they're deterministic and independently testable. Both are sorted to put
 * what a reviewer must act on first.
 */

/**
 * Summarize every cell's reconciliation verdict. Cells are ordered
 * unreconciled → reconciled-by-flip → exact (then by ref), so the head of the
 * report is exactly the set of divergences that must be resolved (via an
 * override) before a prod apply.
 */
export function buildReconciliationReport(
  cells: CellReconcileReport[],
): ReconciliationReport {
  const rank = (s: string) =>
    s === "unreconciled" ? 0 : s === "reconciled-by-flip" ? 1 : 2;
  const sorted = [...cells].sort(
    (a, b) => rank(a.status) - rank(b.status) || compareStrings(a.ref, b.ref),
  );
  return {
    totalCells: cells.length,
    exact: cells.filter((c) => c.status === "exact").length,
    reconciledByFlip: cells.filter((c) => c.status === "reconciled-by-flip").length,
    unreconciled: cells.filter((c) => c.status === "unreconciled").length,
    cells: sorted,
  };
}

/**
 * Vendor frequency across all emitted transactions, using the *rewritten*
 * vendor names — so the report reflects the codified rewrite rules and a
 * reviewer can spot residual noise to fold into another rule (rather than
 * hand-editing rows). Sorted by count desc, then name.
 */
export function buildVendorReport(
  tally: Map<string, { count: number; totalCents: number }>,
): VendorReport {
  const vendors = [...tally.entries()]
    .map(([vendor, v]) => ({ vendor, count: v.count, totalCents: v.totalCents }))
    .sort((a, b) => b.count - a.count || compareStrings(a.vendor, b.vendor));
  return { vendors };
}
