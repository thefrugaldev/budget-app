import type { Category, RangeAggregate } from "@/types/budget";
import type {
  AttentionReason,
  AttentionResult,
  AttentionRow,
} from "@/types/attention";
import type { ThresholdDescriptor } from "@/types/threshold";

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
 * Classify one category against its in-range aggregate. Returns the reason plus
 * the `thresholdDescriptor` it was derived from (so the caller reuses it for the
 * row rather than recomputing), or `null` if the category is on track (no
 * attention needed). A category with no cap/goal this month (`denominator <= 0`)
 * can't be over or behind anything, so it's never an exception. Signal
 * semantics come from `thresholdDescriptor` — the single source shared with the
 * meter/trend (Harvest ADR 0002), so nothing disagrees.
 *
 * Note the `withdrawn` (`total < 0`) and `not-started` (`total === 0`) branches
 * mirror the special cases `thresholdDescriptor` itself encodes for savings (it
 * labels them "Withdrawn" / "Not started"); the `AttentionReason` enum and the
 * display label are separate concerns but must stay in lockstep — change one,
 * revisit the other.
 */
function classify(
  kind: Category["kind"],
  total: number,
  denominator: number,
): { reason: AttentionReason; descriptor: ThresholdDescriptor } | null {
  if (denominator <= 0) return null;
  const descriptor = thresholdDescriptor(kind, denominator, total);
  if (kind === "expense") {
    // Only an exceeded cap is attention; under/near/at read as fine.
    return descriptor.state === "over" ? { reason: "over-cap", descriptor } : null;
  }
  if (kind === "savings") {
    if (total < 0) return { reason: "withdrawn", descriptor }; // net reversal/withdrawal
    if (total === 0) return { reason: "not-started", descriptor }; // goal set, untouched
    if (descriptor.state === "over") return { reason: "goal-met", descriptor }; // reached
    if (descriptor.state === "under") return { reason: "behind", descriptor }; // < 70% of goal
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
 *
 * `limit` is the **maximum number of rows** to return; pass `Infinity` for no
 * cap. It's floored at 0, so a stray negative yields no rows (with every match
 * counted in `hiddenCount`) rather than JS's negative-`slice` surprise.
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
    const hit = classify(category.kind, agg.total, agg.denominator);
    if (!hit) continue;
    all.push({
      category,
      reason: hit.reason,
      descriptor: hit.descriptor,
      total: agg.total,
      denominator: agg.denominator,
    });
  }

  all.sort((a, b) => {
    const bySeverity = ATTENTION_SEVERITY[a.reason] - ATTENTION_SEVERITY[b.reason];
    if (bySeverity !== 0) return bySeverity;
    return a.category.name.localeCompare(b.category.name);
  });

  const rows = all.slice(0, Math.max(0, limit));
  return { rows, hiddenCount: all.length - rows.length };
}
