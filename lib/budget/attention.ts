import type { Category, RangeAggregate } from "@/types/budget";
import type {
  AttentionReason,
  AttentionResult,
  AttentionRow,
} from "@/types/attention";

import { thresholdDescriptor } from "./threshold";

/** Default "handful of rows" cap for the Pulse module (story 19). */
export const DEFAULT_ATTENTION_LIMIT = 5;

/**
 * Severity rank (ascending = surfaced first). Over-cap expenses lead, then the
 * savings shortfalls from worst to mildest, and met goals last as a positive
 * exception. Single source of truth for the "ordered by severity" contract.
 */
const ATTENTION_SEVERITY: Record<AttentionReason, number> = {
  "over-cap": 0,
  withdrawn: 1,
  "not-started": 2,
  behind: 3,
  "goal-met": 4,
};

/**
 * Classify one category against its in-range aggregate, or `null` if it's on
 * track (no attention needed). A category with no cap/goal this month
 * (`denominator <= 0`) can't be over or behind anything, so it's never an
 * exception. Signal semantics come from `thresholdDescriptor` — the single
 * source shared with the meter/trend (Harvest ADR 0002), so nothing disagrees.
 */
function classify(
  kind: Category["kind"],
  total: number,
  denominator: number,
): AttentionReason | null {
  if (denominator <= 0) return null;
  if (kind === "expense") {
    // Only an exceeded cap is attention; under/near/at read as fine.
    return thresholdDescriptor(kind, denominator, total).state === "over"
      ? "over-cap"
      : null;
  }
  if (kind === "savings") {
    if (total < 0) return "withdrawn"; // net reversal/withdrawal
    if (total === 0) return "not-started"; // goal set, untouched
    const { state } = thresholdDescriptor(kind, denominator, total);
    if (state === "over") return "goal-met"; // reached (positive exception)
    if (state === "under") return "behind"; // < 70% of goal
    return null; // near / at goal → on track
  }
  return null; // income is out of scope for this module
}

/**
 * Selects the exception rows for Pulse's "Needs attention" module (issue #166
 * stories 18/19) from the current-range aggregates. Pass the **active**
 * categories and their {@link RangeAggregate}s (from `aggregateRange`); a
 * category with no matching aggregate is skipped. Rows are ordered by severity
 * (see `ATTENTION_SEVERITY`), then by name for a stable order, and capped to
 * `limit` — `hiddenCount` reports the overflow so the caller never truncates
 * silently.
 */
export function selectAttention(
  categories: Category[],
  aggregates: RangeAggregate[],
  limit: number = DEFAULT_ATTENTION_LIMIT,
): AttentionResult {
  const aggById = new Map(aggregates.map((a) => [a.categoryId, a]));
  const all: AttentionRow[] = [];
  for (const category of categories) {
    const agg = aggById.get(category.id);
    if (!agg) continue;
    const reason = classify(category.kind, agg.total, agg.denominator);
    if (!reason) continue;
    all.push({
      category,
      reason,
      descriptor: thresholdDescriptor(category.kind, agg.denominator, agg.total),
      total: agg.total,
      denominator: agg.denominator,
    });
  }

  all.sort((a, b) => {
    const bySeverity = ATTENTION_SEVERITY[a.reason] - ATTENTION_SEVERITY[b.reason];
    if (bySeverity !== 0) return bySeverity;
    return a.category.name.localeCompare(b.category.name);
  });

  const rows = limit >= 0 ? all.slice(0, limit) : all;
  return { rows, hiddenCount: Math.max(0, all.length - rows.length) };
}
