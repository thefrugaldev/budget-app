import type { Category, RangeAggregate } from "@/types/budget";
import type {
  AttentionPace,
  AttentionReason,
  AttentionResult,
  AttentionRow,
  PendingRow,
} from "@/types/attention";
import type { ThresholdDescriptor } from "@/types/threshold";

import { fmt } from "./format";
import { thresholdDescriptor } from "./threshold";

/** Default "handful of rows" cap for the Pulse module (story 19). */
export const DEFAULT_ATTENTION_LIMIT = 5;

/**
 * Month-progress fraction (see `monthProgress`) below which a not-yet-funded
 * savings goal reads as "pending" — normal this early in the month — and at or
 * above which $0 saved promotes to a "Behind pace" exception. Tuned constant
 * (#178); not user-configurable.
 */
export const PENDING_UNTIL = 0.5;

/**
 * How far below the straight-line pace a partially-funded goal may fall before
 * it counts as behind, as a fraction of the goal (10 percentage points). Keeps
 * a goal that's only just shy of pace from nagging on every load.
 */
export const PACE_TOLERANCE = 0.1;

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

/** What `classify` decides for one category: an exception row, a calm pending goal, or on-track. */
type Classified =
  | {
      kind: "row";
      reason: AttentionReason;
      descriptor: ThresholdDescriptor;
      gap: number;
      action: string;
    }
  | { kind: "pending"; goal: number }
  | null;

/**
 * Classify one category against its in-range aggregate. Returns an exception
 * row (reason + the `thresholdDescriptor` it derived from, so the caller reuses
 * it rather than recomputing, plus the gap and an action verb), a `pending`
 * marker for an unfunded-but-not-late savings goal, or `null` when on track.
 * Callers pre-filter income and `denominator <= 0`, so this only ever sees a
 * judged expense/savings category. Signal semantics come from
 * `thresholdDescriptor` — the single source shared with the meter/trend
 * (Harvest ADR 0002) — so nothing disagrees.
 *
 * `pace` present ⇒ the selected range *is* the in-progress current month, so a
 * not-yet-funded goal is softened (pending early, behind pace once late) rather
 * than flagged as missed. Absent ⇒ a closed window (past/multi-month), where
 * $0 saved is genuinely missed and stays a `not-started` row (#178 stories
 * 3–6). Over-cap and net-withdrawal are exceptions in either mode (story 6).
 */
function classify(
  kind: Category["kind"],
  total: number,
  denominator: number,
  pace: AttentionPace | undefined,
): Classified {
  const descriptor = thresholdDescriptor(kind, denominator, total);

  if (kind === "expense") {
    // Only an exceeded cap is attention; under/near/at read as fine.
    if (descriptor.state !== "over") return null;
    const gap = total - denominator;
    return { kind: "row", reason: "over-cap", descriptor, gap, action: `Over by ${fmt(gap)}` };
  }

  // savings — income is filtered out before this point.
  // A net withdrawal/reversal is always an exception, pace or not (story 6).
  if (total < 0) {
    const gap = Math.abs(total);
    return { kind: "row", reason: "withdrawn", descriptor, gap, action: `Withdrew ${fmt(gap)}` };
  }
  // A met goal is a positive exception at any time.
  if (total >= denominator) {
    return { kind: "row", reason: "goal-met", descriptor, gap: 0, action: "" };
  }

  if (pace) {
    // In-progress current month: soften a not-yet-funded goal against pace.
    if (total === 0) {
      if (pace.monthProgress < PENDING_UNTIL) return { kind: "pending", goal: denominator };
      // Late and still untouched → behind by the whole goal.
      return {
        kind: "row",
        reason: "behind",
        descriptor,
        gap: denominator,
        action: `Fund ${fmt(denominator)} to catch up`,
      };
    }
    // Partially funded: behind only once it trails pace by more than tolerance.
    const expected = denominator * pace.monthProgress;
    if (total < expected - denominator * PACE_TOLERANCE) {
      const gap = expected - total;
      return {
        kind: "row",
        reason: "behind",
        descriptor,
        gap,
        action: `Fund ${fmt(gap)} to catch up`,
      };
    }
    return null; // keeping pace → on track
  }

  // Closed window: $0 is genuinely missed; a goal under 70% is behind.
  if (total === 0) {
    return {
      kind: "row",
      reason: "not-started",
      descriptor,
      gap: denominator,
      action: `Fund ${fmt(denominator)}`,
    };
  }
  if (descriptor.state === "under") {
    const gap = denominator - total;
    return { kind: "row", reason: "behind", descriptor, gap, action: `Fund ${fmt(gap)}` };
  }
  return null; // near / at goal → on track
}

/**
 * Selects the exception rows for Pulse's "Needs attention" module (#166 stories
 * 18/19, extended for pace-awareness in #178) from the current-range
 * aggregates. Pass the **active** categories and their {@link RangeAggregate}s
 * (from `aggregateRange`); income and categories with no cap/goal this range
 * (`denominator <= 0`) or no matching aggregate are skipped — they can't be
 * over or behind anything. Rows are ordered by severity (see
 * `ATTENTION_SEVERITY`), then by name, and capped to `limit` — `hiddenCount`
 * reports the overflow so the caller never truncates silently.
 *
 * Alongside the rows it returns the calm `pending` group (unfunded-but-not-late
 * goals) and the `evaluatedCount` / `onTrackCount` for the "N of N on track"
 * affirmation. A met goal counts as on track (done well); pending goals count
 * as neither on track nor a problem.
 *
 * `limit` is the **maximum number of rows** to return; pass `Infinity` for no
 * cap. It's floored at 0, so a stray negative yields no rows (with every match
 * counted in `hiddenCount`) rather than JS's negative-`slice` surprise. Pass
 * `options.pace` only when the range is the in-progress current month; omit it
 * for closed windows so a genuinely-missed $0 goal still surfaces.
 */
export function selectAttention(
  categories: Category[],
  aggregates: RangeAggregate[],
  limit: number = DEFAULT_ATTENTION_LIMIT,
  options: { pace?: AttentionPace } = {},
): AttentionResult {
  const { pace } = options;
  const aggById = new Map(aggregates.map((a) => [a.categoryId, a]));
  const all: AttentionRow[] = [];
  const pending: PendingRow[] = [];
  let evaluatedCount = 0;

  for (const category of categories) {
    if (category.kind === "income") continue; // out of scope for this module
    const agg = aggById.get(category.id);
    if (!agg || agg.denominator <= 0) continue; // no aggregate / no cap-goal to judge
    evaluatedCount++;
    const hit = classify(category.kind, agg.total, agg.denominator, pace);
    if (!hit) continue; // on track
    if (hit.kind === "pending") {
      pending.push({ category, goal: hit.goal });
      continue;
    }
    all.push({
      category,
      reason: hit.reason,
      descriptor: hit.descriptor,
      total: agg.total,
      denominator: agg.denominator,
      gap: hit.gap,
      action: hit.action,
    });
  }

  all.sort((a, b) => {
    const bySeverity = ATTENTION_SEVERITY[a.reason] - ATTENTION_SEVERITY[b.reason];
    if (bySeverity !== 0) return bySeverity;
    return a.category.name.localeCompare(b.category.name);
  });
  pending.sort((a, b) => a.category.name.localeCompare(b.category.name));

  const rows = all.slice(0, Math.max(0, limit));
  // On track = judged − pending − problems; a met goal is a success, not a problem.
  const problems = all.filter((r) => r.reason !== "goal-met").length;
  const onTrackCount = evaluatedCount - pending.length - problems;

  return { rows, hiddenCount: all.length - rows.length, pending, evaluatedCount, onTrackCount };
}
